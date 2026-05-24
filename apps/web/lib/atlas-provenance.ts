import type {
  AtlasTrackAnalysisV1,
  AtlasTrackFeatureContributionV1,
  AtlasTrackProvenanceV1,
} from "@atlas/shared";
import type { AnalysisPoint } from "./atlas-layout";

const FEATURE_ORDER = [
  "energy",
  "tempo",
  "duration",
  "key_index",
  "valence",
  "complexity",
  "brightness",
  "loudness",
  "mood_x",
  "mood_y",
] as const satisfies ReadonlyArray<keyof AtlasTrackAnalysisV1>;

const PROVENANCE_FEATURES = [
  "energy",
  "tempo",
  "valence",
  "complexity",
  "brightness",
  "loudness",
] as const satisfies ReadonlyArray<keyof AtlasTrackAnalysisV1>;

export interface FeatureZStat {
  mean: number;
  stdDev: number;
}

export interface TrackScoreMaps {
  bridgeByTrack: Map<string, number>;
  collisionByTrack: Map<string, number>;
  withinSceneRankByTrack: Map<string, number>;
  crossSceneNeighborsByTrack: Map<string, number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildAtlasTrackAnalysis(analysis: AnalysisPoint): AtlasTrackAnalysisV1 {
  return {
    energy: analysis.energy,
    tempo: analysis.tempo,
    duration: analysis.duration,
    key_index: analysis.key_index,
    valence: analysis.valence,
    complexity: analysis.complexity,
    brightness: analysis.brightness,
    loudness: analysis.loudness,
    mood_x: analysis.mood_x,
    mood_y: analysis.mood_y,
  };
}

export function zScoreStats(values: number[]): FeatureZStat {
  if (values.length === 0) return { mean: 0, stdDev: 1 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => {
      const delta = value - mean;
      return sum + delta * delta;
    }, 0) / values.length;
  return { mean, stdDev: Math.max(0.0001, Math.sqrt(variance)) };
}

export function buildFeatureZStats(
  analyses: AtlasTrackAnalysisV1[]
): Record<(typeof PROVENANCE_FEATURES)[number], FeatureZStat> {
  const stats = {
    energy: zScoreStats(analyses.map((analysis) => analysis.energy)),
    tempo: zScoreStats(analyses.map((analysis) => analysis.tempo)),
    valence: zScoreStats(analyses.map((analysis) => analysis.valence)),
    complexity: zScoreStats(analyses.map((analysis) => analysis.complexity)),
    brightness: zScoreStats(analyses.map((analysis) => analysis.brightness)),
    loudness: zScoreStats(analyses.map((analysis) => analysis.loudness)),
  } satisfies Record<(typeof PROVENANCE_FEATURES)[number], FeatureZStat>;
  return stats;
}

export function buildTrackScoreMaps(
  rows: Array<{ trackId: string; analysis: AtlasTrackAnalysisV1 }>,
  neighborsByTrack: Map<string, Array<{ id: string; score: number }>>,
  sceneIdByTrack: Map<string, string>
): TrackScoreMaps {
  const bridgeByTrack = new Map<string, number>();
  const collisionByTrack = new Map<string, number>();
  const withinSceneStrength = new Map<string, number>();
  const crossSceneNeighborsByTrack = new Map<string, number>();

  for (const row of rows) {
    const sceneId = sceneIdByTrack.get(row.trackId);
    const neighbors = neighborsByTrack.get(row.trackId) ?? [];

    if (!sceneId) {
      bridgeByTrack.set(row.trackId, 0);
      collisionByTrack.set(row.trackId, 0);
      withinSceneStrength.set(row.trackId, 0);
      crossSceneNeighborsByTrack.set(row.trackId, 0);
      continue;
    }

    let totalWeight = 0;
    let crossWeight = 0;
    let withinWeight = 0;
    let crossNeighbors = 0;
    const byScene = new Map<string, number>();

    for (const neighbor of neighbors) {
      const neighborSceneId = sceneIdByTrack.get(neighbor.id);
      if (!neighborSceneId) continue;

      totalWeight += neighbor.score;
      byScene.set(neighborSceneId, (byScene.get(neighborSceneId) ?? 0) + neighbor.score);
      if (neighborSceneId !== sceneId) {
        crossWeight += neighbor.score;
        crossNeighbors += 1;
      } else {
        withinWeight += neighbor.score;
      }
    }

    const bridge = totalWeight > 0 ? clamp(crossWeight / totalWeight, 0, 1) : 0;
    bridgeByTrack.set(row.trackId, bridge);
    withinSceneStrength.set(row.trackId, withinWeight);
    crossSceneNeighborsByTrack.set(row.trackId, crossNeighbors);

    const distribution = Array.from(byScene.values());
    let entropy = 0;
    for (const value of distribution) {
      const p = totalWeight > 0 ? value / totalWeight : 0;
      if (p > 0) entropy += -p * Math.log2(p);
    }
    const maxEntropy = distribution.length > 1 ? Math.log2(distribution.length) : 1;
    const collision = clamp((entropy / maxEntropy) * (0.45 + bridge * 0.55), 0, 1);
    collisionByTrack.set(row.trackId, collision);
  }

  const withinSceneRankByTrack = new Map<string, number>();
  const rowsByScene = new Map<string, Array<{ id: string; score: number }>>();
  for (const row of rows) {
    const sceneId = sceneIdByTrack.get(row.trackId);
    if (!sceneId) continue;
    const sceneRows = rowsByScene.get(sceneId) ?? [];
    sceneRows.push({
      id: row.trackId,
      score: withinSceneStrength.get(row.trackId) ?? 0,
    });
    rowsByScene.set(sceneId, sceneRows);
  }

  for (const sceneRows of rowsByScene.values()) {
    sceneRows
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .forEach((row, index) => {
        withinSceneRankByTrack.set(row.id, index + 1);
      });
  }

  return {
    bridgeByTrack,
    collisionByTrack,
    withinSceneRankByTrack,
    crossSceneNeighborsByTrack,
  };
}

export function buildAtlasTrackProvenance(args: {
  trackId: string;
  analysis: AtlasTrackAnalysisV1;
  zByFeature: Record<(typeof PROVENANCE_FEATURES)[number], FeatureZStat>;
  scores?: Partial<TrackScoreMaps>;
}): AtlasTrackProvenanceV1 {
  const { trackId, analysis, zByFeature, scores } = args;
  const topFeatures = PROVENANCE_FEATURES
    .map((name) => {
      const value = analysis[name];
      const stats = zByFeature[name];
      const z = stats ? (value - stats.mean) / stats.stdDev : 0;
      return { name, value, z } satisfies AtlasTrackFeatureContributionV1;
    })
    .sort((a, b) => {
      const delta = Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0);
      if (delta !== 0) return delta;
      return FEATURE_ORDER.indexOf(a.name as keyof AtlasTrackAnalysisV1) -
        FEATURE_ORDER.indexOf(b.name as keyof AtlasTrackAnalysisV1);
    })
    .slice(0, 4);

  const bridge = scores?.bridgeByTrack?.get(trackId) ?? 0;
  const collision = scores?.collisionByTrack?.get(trackId) ?? 0;
  const rank = scores?.withinSceneRankByTrack?.get(trackId);
  const crossSceneNeighbors = scores?.crossSceneNeighborsByTrack?.get(trackId) ?? 0;

  const reasonCodes: string[] = [];
  if (bridge >= 0.55) reasonCodes.push("SCENE_BRIDGE");
  if (collision >= 0.6) reasonCodes.push("SCENE_COLLISION");
  if ((rank ?? 0) > 0 && (rank ?? 0) <= 3) reasonCodes.push("SCENE_CORE");
  if (analysis.energy >= 0.75) reasonCodes.push("HIGH_ENERGY");
  if (analysis.tempo >= 0.72) reasonCodes.push("FAST_TEMPO");

  return {
    top_features: topFeatures,
    similarity_context:
      rank || crossSceneNeighbors > 0
        ? {
            within_scene_rank: rank,
            cross_scene_neighbors: crossSceneNeighbors,
          }
        : undefined,
    reason_codes: reasonCodes,
  };
}

export function describeSceneHomeDescriptor(
  membershipScore: number,
  provenance: AtlasTrackProvenanceV1
): string {
  const reasons = new Set(provenance.reason_codes ?? []);

  if (reasons.has("SCENE_BRIDGE")) return "Bridge between neighboring scenes";
  if (reasons.has("SCENE_CORE") && membershipScore >= 0.88) return "Core anchor for this scene";
  if (reasons.has("SCENE_COLLISION") && membershipScore >= 0.72) return "Stable home with crossover pull";
  if (membershipScore >= 0.8) return "Strong home-scene fit";
  if (membershipScore >= 0.6) return "Flexible fit on this scene edge";
  return "Loose edge of this scene";
}
