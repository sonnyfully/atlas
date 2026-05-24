import type { AtlasTrackAnalysisV1 } from "@atlas/shared";
import * as THREE from "three";

export type AtlasAnalysisPayload = AtlasTrackAnalysisV1 | Record<string, number | string>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function readAnalysisNumber(
  payload: AtlasAnalysisPayload,
  key: string,
  fallback: number
): number {
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function hsvToColor(h: number, s: number, v: number): any {
  const c = v * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (hh >= 0 && hh < 1) {
    r = c;
    g = x;
  } else if (hh >= 1 && hh < 2) {
    r = x;
    g = c;
  } else if (hh >= 2 && hh < 3) {
    g = c;
    b = x;
  } else if (hh >= 3 && hh < 4) {
    g = x;
    b = c;
  } else if (hh >= 4 && hh < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const m = v - c;
  return new THREE.Color(r + m, g + m, b + m);
}

export function analysisToColor(analysis: AtlasAnalysisPayload, trackId: string): any {
  const fallbackHue = hashUnit(`${trackId}:hue`) * 360;
  const moodX = readAnalysisNumber(analysis, "mood_x", hashUnit(`${trackId}:mx`) - 0.5);
  const moodY = readAnalysisNumber(analysis, "mood_y", hashUnit(`${trackId}:my`) - 0.5);
  const hasMoodVector = Math.abs(moodX) + Math.abs(moodY) > 0.001;
  const angle = hasMoodVector ? Math.atan2(moodY, moodX) : fallbackHue * (Math.PI / 180);
  const hue = hasMoodVector
    ? ((angle / (Math.PI * 2) + 1) % 1) * 360
    : fallbackHue;

  const energy = clamp(readAnalysisNumber(analysis, "energy", hashUnit(`${trackId}:en`)), 0, 1);
  const complexity = clamp(
    readAnalysisNumber(analysis, "complexity", hashUnit(`${trackId}:cx`)),
    0,
    1
  );
  const brightness = clamp(
    readAnalysisNumber(analysis, "brightness", hashUnit(`${trackId}:br`)),
    0,
    1
  );
  const loudness = clamp(readAnalysisNumber(analysis, "loudness", hashUnit(`${trackId}:ld`)), 0, 1);

  const saturation = clamp(0.46 + energy * 0.24 + complexity * 0.2, 0.42, 0.92);
  const value = clamp(0.52 + brightness * 0.24 + loudness * 0.14, 0.52, 0.95);

  return hsvToColor(hue, saturation, value);
}
