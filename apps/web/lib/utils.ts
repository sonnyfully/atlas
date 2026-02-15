import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** Simple string hash for deterministic waveform generation. */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/** Deterministic cover color from track ID. */
export function trackCoverColor(id: string): string {
  const h = hashString(id) % 360;
  return `hsl(${h}, 45%, 35%)`;
}

/** Generate deterministic waveform bar heights (0.15 – 1) for a track id. */
export function generateWaveform(trackId: string, barCount: number): number[] {
  let seed = hashString(trackId);
  return Array.from({ length: barCount }, () => {
    seed = (seed * 16807 + 11) % 2147483647;
    return 0.15 + ((seed % 1000) / 1000) * 0.85;
  });
}
