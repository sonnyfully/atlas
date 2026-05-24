import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackAudioFeatures,
  estimateKey,
  estimateTempo,
  normalizeMusicalKey,
} from "./audio-analysis";
import {
  chooseBpm,
  chooseKey,
} from "./analyze";

function buildPulseTrain(args: {
  bpm: number;
  sampleRate: number;
  durationSec: number;
}): Float32Array {
  const { bpm, sampleRate, durationSec } = args;
  const samples = new Float32Array(Math.floor(sampleRate * durationSec));
  const interval = Math.max(1, Math.floor((60 / bpm) * sampleRate));
  const pulseLength = Math.max(1, Math.floor(sampleRate * 0.05));

  for (let start = 0; start < samples.length; start += interval) {
    for (let i = 0; i < pulseLength && start + i < samples.length; i++) {
      const env = 1 - i / pulseLength;
      samples[start + i] = Math.sin((2 * Math.PI * 80 * i) / sampleRate) * env;
    }
  }

  return samples;
}

function buildChord(args: {
  frequencies: number[];
  sampleRate: number;
  durationSec: number;
}): Float32Array {
  const { frequencies, sampleRate, durationSec } = args;
  const frameCount = Math.floor(sampleRate * durationSec);
  const output = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let sample = 0;
    for (const frequency of frequencies) {
      sample += Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    output[i] = sample / frequencies.length * 0.45;
  }

  return output;
}

test("normalizeMusicalKey standardizes common key spellings", () => {
  assert.equal(normalizeMusicalKey("Amin"), "Am");
  assert.equal(normalizeMusicalKey("Cmaj"), "C");
  assert.equal(normalizeMusicalKey("f# minor"), "F#m");
});

test("chooseBpm prefers strong metadata but falls back to better audio estimates", () => {
  assert.deepEqual(
    chooseBpm({ value: 128, confidence: 0.92 }, { value: 122, confidence: 0.74 }),
    { value: 128, confidence: 0.92 }
  );
  assert.deepEqual(
    chooseBpm({ value: 128, confidence: 0.55 }, { value: 121, confidence: 0.72 }),
    { value: 121, confidence: 0.72 }
  );
});

test("chooseKey prefers strong metadata but falls back to better audio estimates", () => {
  assert.deepEqual(
    chooseKey({ value: "Am", confidence: 0.9 }, { value: "C", confidence: 0.65 }),
    { value: "Am", confidence: 0.9 }
  );
  assert.deepEqual(
    chooseKey({ value: "Am", confidence: 0.5 }, { value: "C", confidence: 0.72 }),
    { value: "C", confidence: 0.72 }
  );
});

test("estimateTempo detects a simple 120 BPM pulse train", () => {
  const signal = buildPulseTrain({
    bpm: 120,
    sampleRate: 22050,
    durationSec: 12,
  });
  const tempo = estimateTempo(signal, 22050);

  assert.ok(Math.abs(tempo.bpm - 120) < 6, `expected ~120 BPM, got ${tempo.bpm}`);
  assert.ok(tempo.confidence > 0.15);
});

test("estimateKey detects a simple A minor chord bed", () => {
  const signal = buildChord({
    frequencies: [220, 261.63, 329.63],
    sampleRate: 22050,
    durationSec: 8,
  });
  const key = estimateKey(signal, 22050);

  assert.equal(key.key, "Am");
  assert.ok(key.confidence > 0.05);
});

test("buildFallbackAudioFeatures remains bounded and deterministic", () => {
  const first = buildFallbackAudioFeatures({
    bpm: 124,
    energy: 0.7,
    durationSec: 240,
  });
  const second = buildFallbackAudioFeatures({
    bpm: 124,
    energy: 0.7,
    durationSec: 240,
  });

  assert.deepEqual(first, second);
  assert.ok(first.brightness >= 0 && first.brightness <= 1);
  assert.ok(first.loudness >= 0 && first.loudness <= 1);
  assert.ok(first.complexity >= 0 && first.complexity <= 1);
});
