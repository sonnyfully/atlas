import { useMemo, useState } from "react";

export type QualityMode = "high" | "med" | "low";
export type QualityPreference = "auto" | QualityMode;

export interface QualityConfig {
  mode: QualityMode;
  preference: QualityPreference;
  setPreference: (next: QualityPreference) => void;
  usePoints: boolean;
  enableSsao: boolean;
  enableBloom: boolean;
  enableDepthOfField: boolean;
  enableNoise: boolean;
  enableVignette: boolean;
  sparklesCount: number;
  dpr: [number, number];
  ssaoResolutionScale: number;
}

const POINTS_NODE_THRESHOLD = 2000;

function autoModeForCount(nodeCount: number): QualityMode {
  if (nodeCount > 6000) return "low";
  if (nodeCount > 2500) return "med";
  return "high";
}

export function useQuality(nodeCount: number): QualityConfig {
  const [preference, setPreference] = useState<QualityPreference>("auto");

  return useMemo(() => {
    const mode = preference === "auto" ? autoModeForCount(nodeCount) : preference;
    const usePoints = mode === "low" || nodeCount > POINTS_NODE_THRESHOLD;

    if (mode === "low") {
      return {
        mode,
        preference,
        setPreference,
        usePoints,
        enableSsao: false,
        enableBloom: false,
        enableDepthOfField: false,
        enableNoise: false,
        enableVignette: false,
        sparklesCount: 24,
        dpr: [0.75, 1],
        ssaoResolutionScale: 0.5,
      } satisfies QualityConfig;
    }

    if (mode === "med") {
      return {
        mode,
        preference,
        setPreference,
        usePoints,
        enableSsao: true,
        enableBloom: false,
        enableDepthOfField: false,
        enableNoise: true,
        enableVignette: true,
        sparklesCount: 52,
        dpr: [0.9, 1.25],
        ssaoResolutionScale: 0.5,
      } satisfies QualityConfig;
    }

    return {
      mode,
      preference,
      setPreference,
      usePoints,
      enableSsao: true,
      enableBloom: true,
      enableDepthOfField: true,
      enableNoise: true,
      enableVignette: true,
      sparklesCount: 96,
      dpr: [1, 1.5],
      ssaoResolutionScale: 0.6,
    } satisfies QualityConfig;
  }, [nodeCount, preference]);
}
