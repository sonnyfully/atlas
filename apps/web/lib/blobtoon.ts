export const BLOBTOON_VERSION = 1;
export const DEFAULT_COVER_SIZE = 300;
export const MIN_COVER_SIZE = 64;
export const MAX_COVER_SIZE = 1024;

const MAX_SVG_LENGTH = 20_000;
const HEX_HASH_RE = /^[0-9a-f]+$/i;

export type Prng = () => number;

export interface BlobtoonPalette {
  background: string;
  blobMain: string;
  blobShadow: string;
  eyeWhite: string;
  eyePupil: string;
  mouth: string;
  accent: string;
}

export interface BlobtoonOptions {
  seed: number;
  size: number;
  version?: number;
}

function mod360(value: number): number {
  const mod = value % 360;
  return mod < 0 ? mod + 360 : mod;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${mod360(Math.round(h))} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function fmt(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

export function hashToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seedFromTrackIdentity(trackId: string, fileHash?: string): number {
  if (fileHash && fileHash.length >= 8 && HEX_HASH_RE.test(fileHash)) {
    const fromHash = Number.parseInt(fileHash.slice(0, 8), 16) >>> 0;
    if (fromHash !== 0) return fromHash;
  }
  return hashToSeed(trackId);
}

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildPalette(rand: Prng): BlobtoonPalette {
  const hue = rand() * 360;
  const accentHue = hue + 120 + rand() * 60;
  return {
    background: hsl(hue - 12, 40 + rand() * 20, 14 + rand() * 10),
    blobMain: hsl(hue + 8, 68 + rand() * 16, 52 + rand() * 10),
    blobShadow: hsl(hue - 20, 58 + rand() * 14, 36 + rand() * 8),
    eyeWhite: "hsl(0 0% 98%)",
    eyePupil: hsl(hue - 180, 16 + rand() * 15, 12 + rand() * 8),
    mouth: hsl(hue - 28, 72 + rand() * 12, 28 + rand() * 8),
    accent: hsl(accentHue, 76 + rand() * 10, 60 + rand() * 10),
  };
}

function buildBlobPath(rand: Prng, centerX: number, centerY: number): string {
  const points: Array<[number, number]> = [];
  const pointCount = 9;
  const step = (Math.PI * 2) / pointCount;

  for (let i = 0; i < pointCount; i++) {
    const angle = i * step + (rand() - 0.5) * 0.28;
    const radius = 24 + rand() * 11;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    points.push([x, y]);
  }

  const first = points[0];
  const last = points[points.length - 1];
  let d = `M ${fmt((first[0] + last[0]) / 2)} ${fmt((first[1] + last[1]) / 2)}`;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    d += ` Q ${fmt(current[0])} ${fmt(current[1])} ${fmt((current[0] + next[0]) / 2)} ${fmt((current[1] + next[1]) / 2)}`;
  }

  return `${d} Z`;
}

export function clampCoverSize(raw?: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_COVER_SIZE;
  const value = Math.round(Number(raw));
  if (value < MIN_COVER_SIZE) return MIN_COVER_SIZE;
  if (value > MAX_COVER_SIZE) return MAX_COVER_SIZE;
  return value;
}

function minimalSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(0 0% 18%)"/></svg>`;
}

export function generateBlobtoonSvg(options: BlobtoonOptions): string {
  const size = clampCoverSize(options.size);
  const version = options.version ?? BLOBTOON_VERSION;
  const rand = createPrng((options.seed ^ Math.imul(version, 0x9e3779b1)) >>> 0);
  const palette = buildPalette(rand);

  const centerX = 50 + (rand() - 0.5) * 6;
  const centerY = 52 + (rand() - 0.5) * 4;
  const blobPath = buildBlobPath(rand, centerX, centerY);
  const eyeY = centerY - 5 + rand() * 3;
  const eyeGap = 9 + rand() * 3;
  const eyeRadius = 2 + rand() * 0.8;
  const pupilRadius = eyeRadius * (0.45 + rand() * 0.1);
  const mouthStartX = centerX - 7 - rand() * 2;
  const mouthEndX = centerX + 7 + rand() * 2;
  const mouthY = centerY + 8 + rand() * 2.2;
  const mouthCurve = mouthY + 3 + rand() * 2;
  const accentX = 22 + rand() * 56;
  const accentY = 18 + rand() * 14;
  const accentR = 4 + rand() * 3;
  const shadowOffsetX = -2 - rand() * 2;
  const shadowOffsetY = 2 + rand() * 2;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${palette.background}"/>` +
    `<circle cx="${fmt(accentX)}" cy="${fmt(accentY)}" r="${fmt(accentR)}" fill="${palette.accent}" opacity="0.78"/>` +
    `<path d="${blobPath}" fill="${palette.blobShadow}" transform="translate(${fmt(shadowOffsetX)} ${fmt(shadowOffsetY)})"/>` +
    `<path d="${blobPath}" fill="${palette.blobMain}"/>` +
    `<circle cx="${fmt(centerX - eyeGap)}" cy="${fmt(eyeY)}" r="${fmt(eyeRadius)}" fill="${palette.eyeWhite}"/>` +
    `<circle cx="${fmt(centerX + eyeGap)}" cy="${fmt(eyeY)}" r="${fmt(eyeRadius)}" fill="${palette.eyeWhite}"/>` +
    `<circle cx="${fmt(centerX - eyeGap)}" cy="${fmt(eyeY)}" r="${fmt(pupilRadius)}" fill="${palette.eyePupil}"/>` +
    `<circle cx="${fmt(centerX + eyeGap)}" cy="${fmt(eyeY)}" r="${fmt(pupilRadius)}" fill="${palette.eyePupil}"/>` +
    `<path d="M ${fmt(mouthStartX)} ${fmt(mouthY)} Q ${fmt(centerX)} ${fmt(mouthCurve)} ${fmt(mouthEndX)} ${fmt(mouthY)}" stroke="${palette.mouth}" stroke-width="2.5" stroke-linecap="round" fill="none"/>` +
    `</svg>`;

  if (svg.length > MAX_SVG_LENGTH) return minimalSvg(size);
  return svg;
}
