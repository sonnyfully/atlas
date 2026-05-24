import { createHash } from "crypto";
import type { SimilarEdge, SimilarityBasis, Track } from "@atlas/shared";

export const ATLAS_V1_WORLD_SIZE = 2048;
export const ATLAS_V1_MIN_EDGE_SCORE = 0.2;
export const DEFAULT_SIMILARITY_K = 10;
export const DEFAULT_SIMILARITY_BASIS: SimilarityBasis = "audio";
export const DEFAULT_SIMILARITY_MODEL_VERSION = "v4-audio-embed-blend";
export const FEATURE_FALLBACK_SIMILARITY_BASIS: SimilarityBasis = "audio_features";
export const FEATURE_FALLBACK_SIMILARITY_MODEL_VERSION = "v4-audio-feature-fallback";

const PROJECTION_VERSION = "projection-skim-v1";
const CLUSTER_VERSION = "scene-kmeans-v2";
const SCENE_GRAPH_VERSION = "scene-graph-v1";
const SCORE_VERSION = "bridge-collision-v1";
const PROVENANCE_VERSION = "provenance-v1";

export interface AnalysisPoint {
  energy: number;
  tempo: number;
  duration: number;
  key_index: number;
  valence: number;
  complexity: number;
  brightness: number;
  loudness: number;
  mood_x: number;
  mood_y: number;
}

export interface SimilarAdjacency {
  undirectedEdges: Array<{ from: string; to: string; score: number }>;
  neighborsByTrack: Map<string, Array<{ id: string; score: number }>>;
}

export interface ProjectedSceneCluster {
  temp_id: string;
  sorted_index: number;
  centroid_x: number;
  centroid_y: number;
  avg_energy: number;
  avg_tempo: number;
  track_ids: string[];
  members: ProjectedSceneMember[];
}

export interface ProjectedSceneMember {
  track_id: string;
  membership_score: number;
}

export interface SimilarityGraphOptions {
  embeddingByTrackId?: Map<string, number[]>;
  generatedAt?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashUnit(input: string): number {
  const hash = createHash("sha1").update(input).digest("hex").slice(0, 8);
  const value = Number.parseInt(hash, 16);
  return (value >>> 0) / 0xffffffff;
}

function keyToIndex(value: string): number {
  const key = value.trim().toLowerCase();
  if (!key) return 0;
  const map: Record<string, number> = {
    c: 0,
    "c#": 1,
    db: 1,
    d: 2,
    "d#": 3,
    eb: 3,
    e: 4,
    f: 5,
    "f#": 6,
    gb: 6,
    g: 7,
    "g#": 8,
    ab: 8,
    a: 9,
    "a#": 10,
    bb: 10,
    b: 11,
  };
  const root = key.replace(/(maj|min|m)$/g, "");
  return map[root] ?? 0;
}

export function buildAnalysis(track: Track): AnalysisPoint {
  const energy = clamp(Number.isFinite(track.energy) ? track.energy : 0.5, 0, 1);
  const tempo = clamp((Number.isFinite(track.bpm) ? track.bpm : 120) / 180, 0, 1);
  const duration = clamp((Number.isFinite(track.duration_sec) ? track.duration_sec : 180) / 420, 0, 1);
  const keyIndex = keyToIndex(track.key ?? "");
  const minor = /m(in)?$/i.test(track.key ?? "") ? 1 : 0;
  const keyPhase = ((keyIndex % 12) / 12) * Math.PI * 2;
  const hasRichAnalysis =
    typeof track.analysis_version === "string" && track.analysis_version.length > 0;
  const brightness = clamp(
    hasRichAnalysis ? track.brightness : 0.24 + energy * 0.48 + tempo * 0.16,
    0,
    1
  );
  const loudness = clamp(
    hasRichAnalysis ? track.loudness : 0.22 + energy * 0.55 + tempo * 0.1,
    0,
    1
  );
  const complexity = clamp(
    hasRichAnalysis ? track.complexity : 0.28 + Math.abs(tempo - 0.5) * 0.45 + brightness * 0.12,
    0,
    1
  );
  const valence = clamp(
    0.48 +
      Math.cos(keyPhase) * 0.21 -
      minor * 0.14 +
      (energy - 0.5) * 0.18 +
      (brightness - 0.5) * 0.16,
    0,
    1
  );
  const angle = keyPhase * 0.55 + (valence - 0.5) * Math.PI + (brightness - 0.5) * 0.8;

  return {
    energy,
    tempo,
    duration,
    key_index: keyIndex,
    valence,
    complexity,
    brightness,
    loudness,
    mood_x: Math.cos(angle),
    mood_y: Math.sin(angle),
  };
}

export function defaultSceneName(index: number, avgEnergy: number, avgTempo: number): string {
  if (avgEnergy >= 0.75) return `Voltage ${index + 1}`;
  if (avgEnergy <= 0.34) return `Drift ${index + 1}`;
  if (avgTempo >= 0.72) return `Pulse ${index + 1}`;
  return `Orbit ${index + 1}`;
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return null;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA <= 0 || normB <= 0) return null;
  return clamp(dot / Math.sqrt(normA * normB), 0, 1);
}

function effectiveBpmDelta(fromBpm: number, toBpm: number): number {
  if (!Number.isFinite(fromBpm) || !Number.isFinite(toBpm) || fromBpm <= 0 || toBpm <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const direct = Math.abs(fromBpm - toBpm);
  const halfDouble = Math.min(
    Math.abs(fromBpm - toBpm * 2),
    Math.abs(fromBpm * 2 - toBpm),
    Math.abs(fromBpm - toBpm / 2),
    Math.abs(fromBpm / 2 - toBpm)
  );
  return Math.min(direct, halfDouble);
}

function bpmCompatibilityScore(from: Track, to: Track): number {
  const delta = effectiveBpmDelta(from.bpm, to.bpm);
  const rawScore =
    Number.isFinite(delta) && delta !== Number.POSITIVE_INFINITY
      ? Math.max(0, 1 - Math.min(1, delta / 24))
      : 0.45;
  const confidence = Math.min(from.bpm_confidence ?? 0, to.bpm_confidence ?? 0);
  return rawScore * confidence + 0.45 * (1 - confidence);
}

function keyCompatibilityScore(from: Track, to: Track): number {
  const fromKey = keyToIndex(from.key ?? "");
  const toKey = keyToIndex(to.key ?? "");
  const rawInterval = Math.abs(fromKey - toKey) % 12;
  const interval = Math.min(rawInterval, 12 - rawInterval);
  const rawScore =
    interval === 0
      ? 1
      : interval === 5 || interval === 7
        ? 0.88
        : interval === 1 || interval === 2
          ? 0.62
          : 0.34;
  const confidence = Math.min(from.key_confidence ?? 0, to.key_confidence ?? 0);
  return rawScore * confidence + 0.45 * (1 - confidence);
}

function featureProximityScore(from: Track, to: Track): number {
  const comparisons = [
    1 - Math.abs((from.energy ?? 0.5) - (to.energy ?? 0.5)),
    1 - Math.abs((from.brightness ?? 0.5) - (to.brightness ?? 0.5)),
    1 - Math.abs((from.loudness ?? 0.5) - (to.loudness ?? 0.5)),
    1 - Math.abs((from.complexity ?? 0.5) - (to.complexity ?? 0.5)),
  ];
  return clamp(comparisons.reduce((sum, value) => sum + value, 0) / comparisons.length, 0, 1);
}

export function scoreTrackSimilarity(
  from: Track,
  to: Track,
  embeddingByTrackId?: Map<string, number[]>
): SimilarEdge | null {
  if (from.id === to.id) return null;

  const embeddingScore = embeddingByTrackId
    ? cosineSimilarity(embeddingByTrackId.get(from.id) ?? [], embeddingByTrackId.get(to.id) ?? [])
    : null;
  const bpmScore = bpmCompatibilityScore(from, to);
  const keyScore = keyCompatibilityScore(from, to);
  const featureScore = featureProximityScore(from, to);

  const usingEmbeddings = embeddingScore !== null;
  const rawScore = usingEmbeddings
    ? embeddingScore * 0.68 + bpmScore * 0.12 + keyScore * 0.12 + featureScore * 0.08
    : featureScore * 0.52 + bpmScore * 0.28 + keyScore * 0.2;
  const score = clamp(rawScore, 0, 1);
  if (score <= 0) return null;

  return {
    from_id: from.id,
    to_id: to.id,
    score,
    basis: usingEmbeddings ? DEFAULT_SIMILARITY_BASIS : FEATURE_FALLBACK_SIMILARITY_BASIS,
    model_version: usingEmbeddings
      ? DEFAULT_SIMILARITY_MODEL_VERSION
      : FEATURE_FALLBACK_SIMILARITY_MODEL_VERSION,
    updated_at: new Date().toISOString(),
  };
}

export function computeSimilarityGraph(
  tracks: Track[],
  k = DEFAULT_SIMILARITY_K,
  options?: SimilarityGraphOptions
): SimilarEdge[] {
  const bySource = new Map<string, SimilarEdge[]>();
  const generatedAt = options?.generatedAt ?? new Date().toISOString();

  for (let i = 0; i < tracks.length; i++) {
    const from = tracks[i];
    const edges: SimilarEdge[] = [];
    for (let j = 0; j < tracks.length; j++) {
      if (i === j) continue;
      const edge = scoreTrackSimilarity(from, tracks[j], options?.embeddingByTrackId);
      if (edge) edges.push({ ...edge, updated_at: generatedAt });
    }
    edges.sort((a, b) => b.score - a.score);
    bySource.set(from.id, edges.slice(0, Math.max(1, k)));
  }

  return Array.from(bySource.values()).flat();
}

export function normalizeSimilarityEdges(
  edges: SimilarEdge[],
  trackIds: Set<string>,
  minScore = ATLAS_V1_MIN_EDGE_SCORE
): SimilarAdjacency {
  const bestByPair = new Map<string, { from: string; to: string; score: number }>();

  for (const edge of edges) {
    if (!trackIds.has(edge.from_id) || !trackIds.has(edge.to_id)) continue;
    if (edge.from_id === edge.to_id) continue;
    if (!Number.isFinite(edge.score) || edge.score < minScore) continue;
    const a = edge.from_id < edge.to_id ? edge.from_id : edge.to_id;
    const b = edge.from_id < edge.to_id ? edge.to_id : edge.from_id;
    const key = `${a}:${b}`;
    const previous = bestByPair.get(key);
    if (!previous || edge.score > previous.score) {
      bestByPair.set(key, { from: a, to: b, score: edge.score });
    }
  }

  const undirectedEdges = Array.from(bestByPair.values()).sort((a, b) => b.score - a.score);
  const neighborsByTrack = new Map<string, Array<{ id: string; score: number }>>();
  for (const id of trackIds) neighborsByTrack.set(id, []);
  for (const edge of undirectedEdges) {
    neighborsByTrack.get(edge.from)?.push({ id: edge.to, score: edge.score });
    neighborsByTrack.get(edge.to)?.push({ id: edge.from, score: edge.score });
  }
  for (const [id, neighbors] of neighborsByTrack) {
    neighborsByTrack.set(
      id,
      neighbors
        .sort((a, b) => b.score - a.score)
        .slice(0, 18)
    );
  }

  return { undirectedEdges, neighborsByTrack };
}

export function projectToPlane(
  tracks: Array<{ id: string; analysis: AnalysisPoint }>,
  undirectedEdges: Array<{ from: string; to: string; score: number }>
): Map<string, { x01: number; y01: number }> {
  const indexById = new Map<string, number>();
  const ids = tracks.map((track, index) => {
    indexById.set(track.id, index);
    return track.id;
  });
  const baseX = new Float64Array(tracks.length);
  const baseY = new Float64Array(tracks.length);
  const x = new Float64Array(tracks.length);
  const y = new Float64Array(tracks.length);
  const fx = new Float64Array(tracks.length);
  const fy = new Float64Array(tracks.length);

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const jitterA = hashUnit(`${track.id}:x`) - 0.5;
    const jitterB = hashUnit(`${track.id}:y`) - 0.5;
    const angle = Math.atan2(track.analysis.mood_y, track.analysis.mood_x) + jitterA * 0.45;
    const radius = 0.19 + track.analysis.complexity * 0.34 + Math.abs(jitterB) * 0.08;
    const startX = clamp(
      0.5 + Math.cos(angle) * radius + (track.analysis.tempo - 0.5) * 0.18 + jitterA * 0.05,
      0.02,
      0.98
    );
    const startY = clamp(
      0.5 + Math.sin(angle) * radius + (track.analysis.energy - 0.5) * 0.2 + jitterB * 0.05,
      0.02,
      0.98
    );
    baseX[i] = startX;
    baseY[i] = startY;
    x[i] = startX;
    y[i] = startY;
  }

  for (let iter = 0; iter < 26; iter++) {
    fx.fill(0);
    fy.fill(0);

    for (const edge of undirectedEdges) {
      const a = indexById.get(edge.from);
      const b = indexById.get(edge.to);
      if (a === undefined || b === undefined) continue;
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const dist = Math.max(0.0001, Math.hypot(dx, dy));
      const ux = dx / dist;
      const uy = dy / dist;
      const desired = 0.05 + (1 - edge.score) * 0.17;
      const pull = (dist - desired) * 0.045 * (0.35 + edge.score * 0.65);
      fx[a] += ux * pull;
      fy[a] += uy * pull;
      fx[b] -= ux * pull;
      fy[b] -= uy * pull;
    }

    for (let i = 0; i < tracks.length; i++) {
      fx[i] += (baseX[i] - x[i]) * 0.03;
      fy[i] += (baseY[i] - y[i]) * 0.03;
      x[i] = clamp(x[i] + clamp(fx[i], -0.035, 0.035), 0.01, 0.99);
      y[i] = clamp(y[i] + clamp(fy[i], -0.035, 0.035), 0.01, 0.99);
    }
  }

  const positions = new Map<string, { x01: number; y01: number }>();
  for (let i = 0; i < tracks.length; i++) {
    positions.set(ids[i], { x01: x[i], y01: y[i] });
  }
  return positions;
}

export function clusterProjectedTracks(
  tracks: Array<{ id: string; analysis: AnalysisPoint; x01: number; y01: number }>
): ProjectedSceneCluster[] {
  if (tracks.length === 0) return [];

  const k = clamp(Math.round(Math.sqrt(tracks.length / 70) + 2), 3, 22);
  const centers: Array<{ x: number; y: number }> = [];
  const firstIndex = tracks
    .map((track, index) => ({ index, score: track.analysis.energy + track.analysis.tempo * 0.5 }))
    .sort((a, b) => b.score - a.score)[0]?.index ?? 0;
  centers.push({ x: tracks[firstIndex].x01, y: tracks[firstIndex].y01 });

  while (centers.length < Math.min(k, tracks.length)) {
    let farthestIndex = 0;
    let farthestDistance = -1;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      let nearest = Number.POSITIVE_INFINITY;
      for (const center of centers) {
        const dx = center.x - track.x01;
        const dy = center.y - track.y01;
        nearest = Math.min(nearest, dx * dx + dy * dy);
      }
      if (nearest > farthestDistance) {
        farthestDistance = nearest;
        farthestIndex = i;
      }
    }
    centers.push({ x: tracks[farthestIndex].x01, y: tracks[farthestIndex].y01 });
  }

  const assignment = new Int32Array(tracks.length);
  assignment.fill(0);

  for (let iter = 0; iter < 14; iter++) {
    for (let i = 0; i < tracks.length; i++) {
      let bestCluster = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let c = 0; c < centers.length; c++) {
        const dx = centers[c].x - tracks[i].x01;
        const dy = centers[c].y - tracks[i].y01;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = c;
        }
      }
      assignment[i] = bestCluster;
    }

    const sums = Array.from({ length: centers.length }, () => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < tracks.length; i++) {
      const cluster = assignment[i];
      sums[cluster].x += tracks[i].x01;
      sums[cluster].y += tracks[i].y01;
      sums[cluster].n += 1;
    }

    for (let c = 0; c < centers.length; c++) {
      if (sums[c].n === 0) continue;
      centers[c].x = sums[c].x / sums[c].n;
      centers[c].y = sums[c].y / sums[c].n;
    }
  }

  const enriched = centers.map((center, index) => ({ center, index }));
  enriched.sort((a, b) =>
    a.center.x === b.center.x ? a.center.y - b.center.y : a.center.x - b.center.x
  );
  const stableSceneIndex = new Map<number, number>();
  enriched.forEach((entry, sortedIndex) => {
    stableSceneIndex.set(entry.index, sortedIndex);
  });

  const clusters: ProjectedSceneCluster[] = [];
  for (let sceneIndex = 0; sceneIndex < centers.length; sceneIndex++) {
    const sortedIndex = stableSceneIndex.get(sceneIndex) ?? sceneIndex;
    const sceneTracks = tracks.filter((_, i) => assignment[i] === sceneIndex);
    if (sceneTracks.length === 0) continue;
    const avgEnergy = sceneTracks.reduce((sum, row) => sum + row.analysis.energy, 0) / sceneTracks.length;
    const avgTempo = sceneTracks.reduce((sum, row) => sum + row.analysis.tempo, 0) / sceneTracks.length;
    const centroidX = sceneTracks.reduce((sum, row) => sum + row.x01, 0) / sceneTracks.length;
    const centroidY = sceneTracks.reduce((sum, row) => sum + row.y01, 0) / sceneTracks.length;
    const centroidEnergy =
      sceneTracks.reduce((sum, row) => sum + row.analysis.energy, 0) / sceneTracks.length;
    const centroidTempo =
      sceneTracks.reduce((sum, row) => sum + row.analysis.tempo, 0) / sceneTracks.length;
    const centroidValence =
      sceneTracks.reduce((sum, row) => sum + row.analysis.valence, 0) / sceneTracks.length;
    const centroidComplexity =
      sceneTracks.reduce((sum, row) => sum + row.analysis.complexity, 0) / sceneTracks.length;
    const distances = sceneTracks.map((row) => ({
      track_id: row.id,
      distance: Math.hypot(
        row.x01 - centroidX,
        row.y01 - centroidY,
        (row.analysis.energy - centroidEnergy) * 0.6,
        (row.analysis.tempo - centroidTempo) * 0.6,
        (row.analysis.valence - centroidValence) * 0.45,
        (row.analysis.complexity - centroidComplexity) * 0.45
      ),
    }));
    const maxDistance = distances.reduce((max, row) => Math.max(max, row.distance), 0);
    const members = distances
      .map((row) => ({
        track_id: row.track_id,
        membership_score:
          sceneTracks.length === 1 || maxDistance <= 0.0001
            ? 1
            : clamp(1 - row.distance / maxDistance, 0.05, 1),
      }))
      .sort((a, b) => b.membership_score - a.membership_score || a.track_id.localeCompare(b.track_id));
    clusters.push({
      temp_id: `scene-${sortedIndex + 1}`,
      sorted_index: sortedIndex,
      centroid_x: centroidX,
      centroid_y: centroidY,
      avg_energy: avgEnergy,
      avg_tempo: avgTempo,
      track_ids: members.map((row) => row.track_id),
      members,
    });
  }

  clusters.sort((a, b) => a.sorted_index - b.sorted_index);
  return clusters;
}

export function hashAtlasWorldVersion(tracks: Track[]): string {
  const projectionInput = [...tracks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (track) =>
        `${track.id}:${track.file_hash}:${track.bpm}:${track.energy}:${track.brightness}:${track.loudness}:${track.complexity}:${track.duration_sec}:${track.key}:${track.analysis_version}:${track.embedding_version}`
    )
    .join("|");
  return createHash("sha1")
    .update(
      [
        PROJECTION_VERSION,
        CLUSTER_VERSION,
        SCENE_GRAPH_VERSION,
        SCORE_VERSION,
        PROVENANCE_VERSION,
        projectionInput,
      ].join("::")
    )
    .digest("hex")
    .slice(0, 16);
}
