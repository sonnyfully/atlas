import type { CSSProperties } from "react";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const DEFAULT_SCENE_ID = "atlas-scene";
const BRAND_ORANGE_HUE = 18;
const BRAND_GUARD_BAND = 18;

type SceneCssVarName =
  | "--scene-h"
  | "--scene-s"
  | "--scene-l"
  | "--scene-accent"
  | "--scene-accent-soft";

export type SceneAccentVars = CSSProperties & Record<SceneCssVarName, string>;

interface SceneClassNames {
  border: string;
  glow: string;
  tint: string;
  chip: string;
}

export interface SceneAccent {
  hue: number;
  saturation: number;
  lightness: number;
  hsl: string;
  rgb: { r: number; g: number; b: number };
  cssVars: SceneAccentVars;
  classNames: SceneClassNames;
}

function normalizeAccentInput(input: unknown, fallback = DEFAULT_SCENE_ID): string {
  if (typeof input !== "string") return fallback;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sat = clamp(s / 100, 0, 1);
  const light = clamp(l / 100, 0, 1);

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function withBrandDistance(hue: number): number {
  const distance = Math.abs(hue - BRAND_ORANGE_HUE);
  if (distance >= BRAND_GUARD_BAND) {
    return hue;
  }
  return (hue + BRAND_GUARD_BAND * 2) % 360;
}

export function getSceneAccent(input: string): SceneAccent {
  const key = normalizeAccentInput(input);
  const hash = fnv1a(key);

  // Keep hues distributed while leaving a guard band around brand orange.
  const baseHue = 24 + (hash % 312);
  const hue = withBrandDistance(baseHue);
  const saturation = clamp(54 + ((hash >>> 8) % 15), 52, 68);
  const lightness = clamp(46 + ((hash >>> 16) % 11), 42, 56);
  const hsl = `${hue} ${saturation}% ${lightness}%`;
  const rgb = hslToRgb(hue, saturation, lightness);

  const cssVars: SceneAccentVars = {
    "--scene-h": `${hue}`,
    "--scene-s": `${saturation}%`,
    "--scene-l": `${lightness}%`,
    "--scene-accent": `hsl(${hsl})`,
    "--scene-accent-soft": `hsl(${hsl} / 0.14)`,
  };

  return {
    hue,
    saturation,
    lightness,
    hsl,
    rgb,
    cssVars,
    classNames: {
      border: "border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.3)]",
      glow: "shadow-[0_0_0_1px_hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.15),0_0_24px_hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.2)]",
      tint: "bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)]",
      chip: "bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.14)]",
    },
  };
}

export function useSceneAccent(sceneId?: string, fallbackId?: string): SceneAccent {
  const sceneKey = normalizeAccentInput(sceneId, "");
  const fallbackKey = normalizeAccentInput(fallbackId, DEFAULT_SCENE_ID);
  return getSceneAccent(sceneKey || fallbackKey);
}
