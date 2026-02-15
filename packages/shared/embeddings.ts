
import {
  pipeline,
  env,
  AutoProcessor,
  ClapAudioModelWithProjection,
} from "@huggingface/transformers";
import { readFile } from "fs/promises";

// Configure to use local models if downloaded, or download to a cache
// In a node environment, this defaults to ~/.cache/huggingface
env.allowLocalModels = true;

// Constants
export const TEXT_EMBEDDING_VERSION = "v1-text-minilm";
export const AUDIO_EMBEDDING_VERSION = "v1-audio-clap"; // Phase C2
export const TEXT_EMBEDDING_DIM = 384;
export const AUDIO_EMBEDDING_DIM = 512; // Phase C2

// Singleton instances for pipelines
let textEmbeddingPipeline: any = null;
let clapProcessor: any = null;
let clapAudioModel: any = null;

/**
 * Generates a 384-dimensional text embedding using all-MiniLM-L6-v2.
 * L2-normalizes the output.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  if (!textEmbeddingPipeline) {
    console.log("Loading text embedding model...");
    // distinct model for text
    textEmbeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  // Generate embedding
  const output = await textEmbeddingPipeline(text, { pooling: 'mean', normalize: true });

  // Convert Tensor to standard array
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
  const parts = [
    `Title: ${title}`,
    `Artist: ${artist}`,
  ];

  if (key) parts.push(`Key: ${key}`);
  if (bpm) parts.push(`BPM: ${Math.round(bpm)}`);
  if (energy) parts.push(`Energy: ${energy.toFixed(2)}`);

  return parts.join(". ");
}

/**
 * Generates a 512-dimensional audio embedding using CLAP (clap-htsat-unfused).
 * Processes audio file and returns L2-normalized embedding.
 * 
 * @param audioPath - Absolute path to audio file
 * @returns 512-dim embedding vector
 */
export async function generateAudioEmbedding(audioPath: string): Promise<number[]> {
  if (!clapProcessor || !clapAudioModel) {
    console.log("Loading audio embedding model (CLAP)...");
    console.log("  This may take a moment (~300MB download on first run)");

    clapProcessor = await AutoProcessor.from_pretrained("Xenova/clap-htsat-unfused");
    clapAudioModel = await ClapAudioModelWithProjection.from_pretrained(
      "Xenova/clap-htsat-unfused"
    );
  }

  // In Node.js, transformers.js cannot decode audio paths directly.
  // We currently support WAV files by decoding PCM samples ourselves.
  const audio = await decodeMonoWavToFloat32(audioPath);
  const audioInputs = await clapProcessor(audio);
  const { audio_embeds } = await clapAudioModel(audioInputs);
  return Array.from(audio_embeds.data);
}

async function decodeMonoWavToFloat32(path: string): Promise<Float32Array> {
  const buffer = await readFile(path);
  if (buffer.length < 44) {
    throw new Error("Invalid WAV file: too small");
  }
  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error(
      "Unsupported audio format for CLAP in Node runtime. Use WAV files for now."
    );
  }

  let offset = 12;
  let numChannels = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      numChannels = buffer.readUInt16LE(chunkDataOffset + 2);
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
  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}. Expected 16-bit PCM.`);
  }

  const frameBytes = numChannels * 2;
  const frameCount = Math.floor(dataSize / frameBytes);
  const output = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    const frameStart = dataOffset + i * frameBytes;
    for (let c = 0; c < numChannels; c++) {
      const sample = buffer.readInt16LE(frameStart + c * 2);
      sum += sample / 32768;
    }
    output[i] = sum / numChannels;
  }

  return output;
}
