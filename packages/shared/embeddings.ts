import {
  pipeline,
  env,
  AutoProcessor,
  ClapAudioModelWithProjection,
} from "@huggingface/transformers";
import { execFile } from "child_process";
import { extname } from "path";
import { readFile } from "fs/promises";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Configure to use local models if downloaded, or download to a cache
// In a node environment, this defaults to ~/.cache/huggingface
env.allowLocalModels = true;

// Constants
export const TEXT_EMBEDDING_VERSION = "v1-text-minilm";
export const AUDIO_EMBEDDING_VERSION = "v2-audio-clap-hybrid";
export const TEXT_EMBEDDING_DIM = 384;
export const AUDIO_EMBEDDING_DIM = 512;

export type AudioDecodePath = "wav_js" | "ffmpeg";

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
  durationSec: number;
  decode_path: AudioDecodePath;
  source_format: string;
}

export interface AudioEmbeddingDetails {
  embedding: number[];
  model_version: string;
  decode_path: AudioDecodePath;
  sample_rate: number;
  source_format: string;
}

// Singleton instances for pipelines
let textEmbeddingPipeline: any = null;
let clapProcessor: any = null;
let clapAudioModel: any = null;
let ffmpegAvailablePromise: Promise<boolean> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function l2Normalize(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm <= 0) return values.map(() => 0);
  return values.map((value) => value / norm);
}

function readPcmSample(
  buffer: Buffer,
  offset: number,
  audioFormat: number,
  bitsPerSample: number
): number {
  if (audioFormat === 1) {
    switch (bitsPerSample) {
      case 16:
        return buffer.readInt16LE(offset) / 32768;
      case 24:
        return buffer.readIntLE(offset, 3) / 8388608;
      case 32:
        return buffer.readInt32LE(offset) / 2147483648;
      default:
        throw new Error(`Unsupported WAV PCM bit depth: ${bitsPerSample}`);
    }
  }

  if (audioFormat === 3) {
    switch (bitsPerSample) {
      case 32:
        return clamp(buffer.readFloatLE(offset), -1, 1);
      case 64:
        return clamp(buffer.readDoubleLE(offset), -1, 1);
      default:
        throw new Error(`Unsupported WAV float bit depth: ${bitsPerSample}`);
    }
  }

  throw new Error(`Unsupported WAV audio format: ${audioFormat}`);
}

function decodeWavBufferToMonoFloat32(
  buffer: Buffer,
  sourceFormat: string,
  decodePath: AudioDecodePath
): DecodedAudio {
  if (buffer.length < 44) {
    throw new Error("Invalid WAV file: too small");
  }

  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error("Invalid WAV file: RIFF/WAVE header missing");
  }

  let offset = 12;
  let audioFormat = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let sampleRate = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      if (chunkDataOffset + Math.min(chunkSize, 16) > buffer.length) {
        throw new Error("Invalid WAV file: truncated fmt chunk");
      }
      audioFormat = buffer.readUInt16LE(chunkDataOffset);
      numChannels = buffer.readUInt16LE(chunkDataOffset + 2);
      sampleRate = buffer.readUInt32LE(chunkDataOffset + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataOffset + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize <= 0) {
    throw new Error("Invalid WAV file: missing data chunk");
  }
  if (numChannels < 1) {
    throw new Error("Invalid WAV file: missing channel metadata");
  }
  if (sampleRate <= 0) {
    throw new Error("Invalid WAV file: missing sample rate");
  }

  const availableDataBytes = Math.max(0, buffer.length - dataOffset);
  dataSize = Math.min(dataSize, availableDataBytes);

  const bytesPerSample = bitsPerSample / 8;
  if (!Number.isFinite(bytesPerSample) || bytesPerSample <= 0) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
  }

  const frameBytes = numChannels * bytesPerSample;
  const frameCount = Math.floor(dataSize / frameBytes);
  const output = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    const frameStart = dataOffset + i * frameBytes;
    for (let c = 0; c < numChannels; c++) {
      sum += readPcmSample(buffer, frameStart + c * bytesPerSample, audioFormat, bitsPerSample);
    }
    output[i] = clamp(sum / numChannels, -1, 1);
  }

  return {
    samples: output,
    sampleRate,
    channels: numChannels,
    durationSec: frameCount / sampleRate,
    decode_path: decodePath,
    source_format: sourceFormat,
  };
}

export function resampleLinear(
  samples: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Float32Array {
  if (fromSampleRate <= 0 || toSampleRate <= 0) {
    throw new Error("Sample rate must be positive");
  }
  if (fromSampleRate === toSampleRate || samples.length === 0) {
    return samples;
  }

  const ratio = toSampleRate / fromSampleRate;
  const outputLength = Math.max(1, Math.round(samples.length * ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i / ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = sourceIndex - left;
    output[i] = clamp(
      (samples[left] ?? 0) * (1 - mix) + (samples[right] ?? 0) * mix,
      -1,
      1
    );
  }

  return output;
}

export async function isFfmpegAvailable(): Promise<boolean> {
  if (!ffmpegAvailablePromise) {
    ffmpegAvailablePromise = execFileAsync("ffmpeg", ["-version"])
      .then(() => true)
      .catch(() => false);
  }
  return ffmpegAvailablePromise;
}

async function transcodeAudioToWavBuffer(audioPath: string): Promise<Buffer> {
  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      audioPath,
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "wav",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 128 * 1024 * 1024,
    }
  );

  return stdout as Buffer;
}

export async function decodeAudioFile(audioPath: string): Promise<DecodedAudio> {
  const buffer = await readFile(audioPath);
  const sourceFormat = extname(audioPath).slice(1).toLowerCase() || "unknown";

  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  if (riff === "RIFF" && wave === "WAVE") {
    return decodeWavBufferToMonoFloat32(buffer, sourceFormat, "wav_js");
  }

  if (!(await isFfmpegAvailable())) {
    throw new Error(
      `Unsupported audio format for pure JS decode: ${sourceFormat}. Install ffmpeg for fallback decode support.`
    );
  }

  const transcoded = await transcodeAudioToWavBuffer(audioPath);
  return decodeWavBufferToMonoFloat32(transcoded, sourceFormat, "ffmpeg");
}

async function getClapRuntime(): Promise<{
  processor: any;
  model: any;
  sampleRate: number;
}> {
  if (!clapProcessor || !clapAudioModel) {
    console.log("Loading audio embedding model (CLAP)...");
    console.log("  This may take a moment (~300MB download on first run)");

    clapProcessor = await AutoProcessor.from_pretrained("Xenova/clap-htsat-unfused");
    clapAudioModel = await ClapAudioModelWithProjection.from_pretrained(
      "Xenova/clap-htsat-unfused"
    );
  }

  const sampleRate =
    Number(clapProcessor?.feature_extractor?.config?.sampling_rate) || 48000;

  return {
    processor: clapProcessor,
    model: clapAudioModel,
    sampleRate,
  };
}

/**
 * Generates a 384-dimensional text embedding using all-MiniLM-L6-v2.
 * L2-normalizes the output.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!textEmbeddingPipeline) {
    console.log("Loading text embedding model...");
    textEmbeddingPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }

  const output = await textEmbeddingPipeline(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

/**
 * Validates and constructs the metadata text string for embedding.
 */
export function buildMetadataText(
  title: string,
  artist: string,
  key?: string,
  bpm?: number,
  energy?: number
): string {
  const parts = [`Title: ${title}`, `Artist: ${artist}`];

  if (key) parts.push(`Key: ${key}`);
  if (bpm) parts.push(`BPM: ${Math.round(bpm)}`);
  if (energy) parts.push(`Energy: ${energy.toFixed(2)}`);

  return parts.join(". ");
}

export async function generateAudioEmbeddingWithDetails(
  audioPath: string,
  decodedAudio?: DecodedAudio
): Promise<AudioEmbeddingDetails> {
  const runtime = await getClapRuntime();
  const decoded = decodedAudio ?? (await decodeAudioFile(audioPath));
  const prepared =
    decoded.sampleRate === runtime.sampleRate
      ? decoded.samples
      : resampleLinear(decoded.samples, decoded.sampleRate, runtime.sampleRate);

  const audioInputs = await runtime.processor(prepared);
  const { audio_embeds } = await runtime.model(audioInputs);
  const embedding = l2Normalize(Array.from(audio_embeds.data));

  return {
    embedding,
    model_version: AUDIO_EMBEDDING_VERSION,
    decode_path: decoded.decode_path,
    sample_rate: runtime.sampleRate,
    source_format: decoded.source_format,
  };
}

/**
 * Generates a 512-dimensional audio embedding using CLAP.
 *
 * @param audioPath - Absolute path to audio file
 * @returns 512-dim embedding vector
 */
export async function generateAudioEmbedding(audioPath: string): Promise<number[]> {
  const result = await generateAudioEmbeddingWithDetails(audioPath);
  return result.embedding;
}
