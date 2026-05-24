import type { DecodedAudio } from "@atlas/shared/embeddings";

export const ANALYSIS_VERSION = "v2-audio-informed";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface AudioFeatureEstimate {
  energy: number;
  brightness: number;
  loudness: number;
  complexity: number;
  bpm: number;
  bpm_confidence: number;
  key: string;
  key_confidence: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeDb(db: number): number {
  return clamp((db + 60) / 60, 0, 1);
}

export function normalizeMusicalKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const match = trimmed.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!match) return "";

  const [, rootLetter, accidental, suffixRaw] = match;
  const root = `${rootLetter.toUpperCase()}${accidental ?? ""}`;
  const suffix = suffixRaw.trim().toLowerCase();
  const isMinor = suffix === "m" || suffix === "min" || suffix === "minor";

  return isMinor ? `${root}m` : root;
}

function computeFrameRms(samples: Float32Array, frameSize: number, hopSize: number): number[] {
  if (samples.length === 0) return [];
  const frames: number[] = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let sumSquares = 0;
    for (let i = 0; i < frameSize; i++) {
      const value = samples[start + i] ?? 0;
      sumSquares += value * value;
    }
    frames.push(Math.sqrt(sumSquares / frameSize));
  }

  return frames;
}

function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate || samples.length === 0) return samples;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    output[i] = samples[Math.min(samples.length - 1, Math.floor(i * ratio))] ?? 0;
  }

  return output;
}

export function estimateTempo(samples: Float32Array, sampleRate: number): {
  bpm: number;
  confidence: number;
} {
  if (samples.length === 0 || sampleRate <= 0) {
    return { bpm: 0, confidence: 0 };
  }

  const targetRate = sampleRate > 11025 ? 11025 : sampleRate;
  const working = downsample(samples, sampleRate, targetRate);
  const frameSize = 1024;
  const hopSize = 512;
  const rms = computeFrameRms(working, frameSize, hopSize);
  if (rms.length < 8) {
    return { bpm: 0, confidence: 0 };
  }

  const envelope = rms.map((value, index) => {
    const previous = index > 0 ? rms[index - 1] ?? value : value;
    return Math.max(0, value - previous);
  });
  const fps = targetRate / hopSize;
  const minLag = Math.max(1, Math.round((60 / 200) * fps));
  const maxLag = Math.max(minLag + 1, Math.round((60 / 60) * fps));

  let bestLag = 0;
  let bestScore = 0;
  let secondBest = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let i = lag; i < envelope.length; i++) {
      score += envelope[i]! * envelope[i - lag]!;
    }
    if (score > bestScore) {
      secondBest = bestScore;
      bestScore = score;
      bestLag = lag;
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (bestLag <= 0 || bestScore <= 0) {
    return { bpm: 0, confidence: 0 };
  }

  const bpm = clamp((60 * fps) / bestLag, 60, 200);
  const confidence = clamp(
    ((bestScore - secondBest) / Math.max(bestScore, 1e-6)) * 0.7 +
      Math.min(1, bestScore * 10) * 0.3,
    0,
    1
  );

  return {
    bpm,
    confidence,
  };
}

function frequencyForMidi(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function goertzelPower(frame: Float32Array, sampleRate: number, frequency: number): number {
  if (frequency <= 0 || frequency >= sampleRate / 2) return 0;
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let q0 = 0;
  let q1 = 0;
  let q2 = 0;

  for (let i = 0; i < frame.length; i++) {
    q0 = coeff * q1 - q2 + frame[i]!;
    q2 = q1;
    q1 = q0;
  }

  return q1 * q1 + q2 * q2 - coeff * q1 * q2;
}

export function estimateKey(samples: Float32Array, sampleRate: number): {
  key: string;
  confidence: number;
} {
  if (samples.length < 4096 || sampleRate <= 0) {
    return { key: "", confidence: 0 };
  }

  const targetRate = sampleRate > 22050 ? 22050 : sampleRate;
  const working = downsample(samples, sampleRate, targetRate);
  const frameSize = 4096;
  const maxFrames = 36;
  const hopSize =
    working.length <= frameSize * maxFrames
      ? Math.max(2048, Math.floor((working.length - frameSize) / Math.max(1, maxFrames - 1)))
      : Math.floor((working.length - frameSize) / Math.max(1, maxFrames - 1));
  const chroma = new Array<number>(12).fill(0);
  const midiNotes = Array.from({ length: 36 }, (_, index) => 48 + index);

  let frameCount = 0;
  for (let start = 0; start + frameSize <= working.length && frameCount < maxFrames; start += Math.max(1024, hopSize)) {
    const frame = working.slice(start, start + frameSize);
    let frameEnergy = 0;
    for (let i = 0; i < frame.length; i++) frameEnergy += frame[i]! * frame[i]!;
    if (frameEnergy <= 1e-4) continue;

    for (const midi of midiNotes) {
      const frequency = frequencyForMidi(midi);
      const power = goertzelPower(frame, targetRate, frequency);
      chroma[midi % 12] += power;
    }
    frameCount += 1;
  }

  if (frameCount === 0) {
    return { key: "", confidence: 0 };
  }

  const chromaNorm = chroma.map((value) => value / Math.max(...chroma, 1));
  let bestScore = -Infinity;
  let secondBest = -Infinity;
  let bestRoot = 0;
  let bestMinor = false;

  for (let root = 0; root < 12; root++) {
    const majorScore = MAJOR_PROFILE.reduce((sum, weight, index) => {
      return sum + chromaNorm[(index + root) % 12]! * weight;
    }, 0);
    const minorScore = MINOR_PROFILE.reduce((sum, weight, index) => {
      return sum + chromaNorm[(index + root) % 12]! * weight;
    }, 0);

    for (const candidate of [
      { score: majorScore, isMinor: false },
      { score: minorScore, isMinor: true },
    ]) {
      if (candidate.score > bestScore) {
        secondBest = bestScore;
        bestScore = candidate.score;
        bestRoot = root;
        bestMinor = candidate.isMinor;
      } else if (candidate.score > secondBest) {
        secondBest = candidate.score;
      }
    }
  }

  if (!Number.isFinite(bestScore) || bestScore <= 0) {
    return { key: "", confidence: 0 };
  }

  const key = `${NOTE_NAMES[bestRoot]}${bestMinor ? "m" : ""}`;
  const confidence = clamp(
    (bestScore - Math.max(secondBest, 0)) / Math.max(bestScore, 1e-6),
    0,
    1
  );

  return { key, confidence };
}

export function buildFallbackAudioFeatures(args: {
  bpm: number;
  energy: number;
  durationSec: number;
}): Pick<AudioFeatureEstimate, "brightness" | "loudness" | "complexity"> {
  const { bpm, energy, durationSec } = args;
  const tempoDrive = clamp((bpm > 0 ? bpm : 120) / 180, 0, 1);
  const normalizedDuration = clamp((durationSec > 0 ? durationSec : 210) / 420, 0, 1);

  return {
    brightness: clamp(0.24 + energy * 0.48 + tempoDrive * 0.16, 0, 1),
    loudness: clamp(0.22 + energy * 0.55 + tempoDrive * 0.1, 0, 1),
    complexity: clamp(0.28 + Math.abs(tempoDrive - 0.5) * 0.45 + (1 - normalizedDuration) * 0.1, 0, 1),
  };
}

export function estimateAudioFeatures(decoded: DecodedAudio): AudioFeatureEstimate {
  const { samples, sampleRate } = decoded;
  if (samples.length === 0 || sampleRate <= 0) {
    return {
      energy: 0,
      brightness: 0,
      loudness: 0,
      complexity: 0,
      bpm: 0,
      bpm_confidence: 0,
      key: "",
      key_confidence: 0,
    };
  }

  const sumSquares = samples.reduce((sum, value) => sum + value * value, 0);
  const rms = Math.sqrt(sumSquares / samples.length);
  const loudnessDb = 20 * Math.log10(rms + 1e-6);
  const loudness = normalizeDb(loudnessDb);

  let diffEnergy = 0;
  let zeroCrossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const current = samples[i] ?? 0;
    const previous = samples[i - 1] ?? 0;
    diffEnergy += (current - previous) ** 2;
    if ((current >= 0 && previous < 0) || (current < 0 && previous >= 0)) {
      zeroCrossings += 1;
    }
  }
  const brightness = clamp(
    diffEnergy / Math.max(sumSquares * 4, 1e-6),
    0,
    1
  );

  const frameRms = computeFrameRms(samples, Math.min(2048, samples.length), Math.max(512, Math.floor(sampleRate / 40)));
  const activity = stdDev(frameRms);
  const zeroCrossRate = zeroCrossings / Math.max(samples.length - 1, 1);

  const energy = clamp(loudness * 0.62 + activity * 2.2 + brightness * 0.16, 0, 1);
  const complexity = clamp(activity * 2.5 + zeroCrossRate * 14 + brightness * 0.2, 0, 1);

  const tempo = estimateTempo(samples, sampleRate);
  const key = estimateKey(samples, sampleRate);

  return {
    energy,
    brightness,
    loudness,
    complexity,
    bpm: tempo.bpm,
    bpm_confidence: tempo.confidence,
    key: key.key,
    key_confidence: key.confidence,
  };
}
