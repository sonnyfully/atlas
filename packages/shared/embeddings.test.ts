import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  decodeAudioFile,
  isFfmpegAvailable,
  resampleLinear,
} from "./embeddings";

const execFileAsync = promisify(execFile);

function buildMonoWavBuffer(args: {
  sampleRate: number;
  durationSec: number;
  frequencyHz: number;
}): Buffer {
  const { sampleRate, durationSec, frequencyHz } = args;
  const frameCount = Math.floor(sampleRate * durationSec);
  const dataSize = frameCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < frameCount; i++) {
    const sample = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * 0.5;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

test("decodeAudioFile keeps WAV on the pure JS path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "atlas-embed-test-"));
  const wavPath = join(dir, "tone.wav");
  await writeFile(wavPath, buildMonoWavBuffer({
    sampleRate: 16000,
    durationSec: 1,
    frequencyHz: 220,
  }));

  const decoded = await decodeAudioFile(wavPath);

  assert.equal(decoded.decode_path, "wav_js");
  assert.equal(decoded.sampleRate, 16000);
  assert.equal(decoded.source_format, "wav");
  assert.ok(decoded.samples.length > 0);
});

test("decodeAudioFile uses ffmpeg fallback for MP3 when available", async (t) => {
  if (!(await isFfmpegAvailable())) {
    t.skip("ffmpeg is not available in this environment");
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), "atlas-embed-test-"));
  const wavPath = join(dir, "tone.wav");
  const mp3Path = join(dir, "tone.mp3");
  await writeFile(wavPath, buildMonoWavBuffer({
    sampleRate: 22050,
    durationSec: 1,
    frequencyHz: 330,
  }));

  await execFileAsync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    wavPath,
    mp3Path,
  ]);

  const decoded = await decodeAudioFile(mp3Path);

  assert.equal(decoded.decode_path, "ffmpeg");
  assert.equal(decoded.source_format, "mp3");
  assert.ok(decoded.sampleRate > 0);
  assert.ok(decoded.samples.length > 0);
});

test("resampleLinear preserves endpoints and adjusts output length", () => {
  const input = new Float32Array([0, 0.5, 1, 0.5]);
  const output = resampleLinear(input, 4, 8);

  assert.equal(output.length, 8);
  assert.equal(output[0], 0);
  assert.ok(Math.abs(output[output.length - 1]! - 0.5) < 0.05);
});
