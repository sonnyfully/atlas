import type {
  CollisionEdge,
  CollisionReason,
  SimilarEdge,
  Track,
} from "@atlas/shared";
import { buildAnalysis, type AnalysisPoint } from "./atlas-layout";

const MAX_EMBEDDING_NEIGHBORS = 12;
const MAX_SIMILAR_FALLBACK_NEIGHBORS = 8;
const MAX_CANDIDATES_PER_TRACK = 16;
export const MAX_COLLISIONS_PER_TRACK = 5;
export const MIN_COLLISION_SCORE = 0.58;

export interface CollisionCandidate {
  to_id: string;
  timbre_score: number;
  source: "embedding" | "similar";
}

export interface CollisionScoreDetails {
  score: number;
  reasons: CollisionReason[];
  bpm_delta: number;
  key_relation: string;
  vibe_similarity: number;
  timbre_score: number;
}

interface ScoreCollisionCandidateArgs {
  fromTrack: Track;
  toTrack: Track;
  timbreScore: number;
  fromAnalysis?: AnalysisPoint;
  toAnalysis?: AnalysisPoint;
  sceneByTrackId: Map<string, string>;
  adjacentScenePairs: Set<string>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scenePairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function keyToIndex(value: string): number | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
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
  return map[root] ?? null;
}

function isMinorKey(value: string): boolean {
  return /m(in)?$/i.test(value.trim());
}

function buildSimilarFallbackBySource(similarEdges: SimilarEdge[]): Map<string, SimilarEdge[]> {
  const dedupedBySource = new Map<string, Map<string, SimilarEdge>>();

  for (const edge of similarEdges) {
    if (edge.from_id === edge.to_id) continue;
    const byTarget = dedupedBySource.get(edge.from_id) ?? new Map<string, SimilarEdge>();
    const previous = byTarget.get(edge.to_id);
    if (!previous || edge.score > previous.score) {
      byTarget.set(edge.to_id, edge);
    }
    dedupedBySource.set(edge.from_id, byTarget);
  }

  const result = new Map<string, SimilarEdge[]>();
  for (const [fromId, byTarget] of dedupedBySource) {
    result.set(
      fromId,
      Array.from(byTarget.values()).sort(
        (a, b) => b.score - a.score || a.to_id.localeCompare(b.to_id)
      )
    );
  }
  return result;
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

export function computeVibeSimilarity(from: AnalysisPoint, to: AnalysisPoint): number {
  const weightedScore =
    (1 - Math.abs(from.energy - to.energy)) * 0.2 +
    (1 - Math.abs(from.tempo - to.tempo)) * 0.2 +
    (1 - Math.abs(from.valence - to.valence)) * 0.2 +
    (1 - Math.abs(from.complexity - to.complexity)) * 0.15 +
    (1 - Math.abs(from.brightness - to.brightness)) * 0.125 +
    (1 - Math.abs(from.loudness - to.loudness)) * 0.125;
  return clamp(weightedScore, 0, 1);
}

export function classifyCollisionKeyRelation(fromKey: string, toKey: string): string {
  const fromIndex = keyToIndex(fromKey);
  const toIndex = keyToIndex(toKey);
  if (fromIndex === null || toIndex === null) return "UNKNOWN";
  if (fromIndex === toIndex && isMinorKey(fromKey) === isMinorKey(toKey)) return "MATCH";

  const interval = (toIndex - fromIndex + 12) % 12;
  if (interval === 7 || interval === 5) return "FIFTH";
  if (interval === 1 || interval === 11) return "NEIGHBOR";
  return "DISTANT";
}

export function effectiveBpmDelta(fromBpm: number, toBpm: number): number {
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

export function buildCollisionCandidatePoolForTrack(args: {
  sourceTrackId: string;
  tracks: Track[];
  similarEdges: SimilarEdge[];
  audioEmbeddingByTrackId: Map<string, number[]>;
  similarFallbackBySource?: Map<string, SimilarEdge[]>;
}): CollisionCandidate[] {
  const {
    sourceTrackId,
    tracks,
    similarEdges,
    audioEmbeddingByTrackId,
    similarFallbackBySource = buildSimilarFallbackBySource(similarEdges),
  } = args;
  const candidates = new Map<string, CollisionCandidate>();
  const sourceEmbedding = audioEmbeddingByTrackId.get(sourceTrackId);

  if (sourceEmbedding) {
    const embeddingCandidates = tracks
      .flatMap((track) => {
        if (track.id === sourceTrackId) return [];
        const targetEmbedding = audioEmbeddingByTrackId.get(track.id);
        if (!targetEmbedding) return [];
        const score = cosineSimilarity(sourceEmbedding, targetEmbedding);
        if (score === null) return [];
        return [
          {
            to_id: track.id,
            timbre_score: score,
            source: "embedding" as const,
          },
        ];
      })
      .sort((a, b) => b.timbre_score - a.timbre_score || a.to_id.localeCompare(b.to_id))
      .slice(0, MAX_EMBEDDING_NEIGHBORS);

    for (const candidate of embeddingCandidates) {
      candidates.set(candidate.to_id, candidate);
    }
  }

  const similarFallback = similarFallbackBySource
    .get(sourceTrackId)
    ?.slice(0, MAX_SIMILAR_FALLBACK_NEIGHBORS) ?? [];

  for (const edge of similarFallback) {
    if (candidates.size >= MAX_CANDIDATES_PER_TRACK) break;
    if (edge.to_id === sourceTrackId || candidates.has(edge.to_id)) continue;
    candidates.set(edge.to_id, {
      to_id: edge.to_id,
      timbre_score: clamp(edge.score, 0, 1),
      source: "similar",
    });
  }

  return Array.from(candidates.values());
}

export function scoreCollisionCandidateDetails(
  args: ScoreCollisionCandidateArgs
): CollisionScoreDetails | null {
  const {
    fromTrack,
    toTrack,
    timbreScore,
    fromAnalysis = buildAnalysis(fromTrack),
    toAnalysis = buildAnalysis(toTrack),
    sceneByTrackId,
    adjacentScenePairs,
  } = args;

  const vibeSimilarity = computeVibeSimilarity(fromAnalysis, toAnalysis);
  const bpmDelta = effectiveBpmDelta(fromTrack.bpm, toTrack.bpm);
  const keyRelation = classifyCollisionKeyRelation(fromTrack.key, toTrack.key);
  const fromScene = sceneByTrackId.get(fromTrack.id);
  const toScene = sceneByTrackId.get(toTrack.id);
  const crossScene = !!fromScene && !!toScene && fromScene !== toScene;
  const sceneAdjacent = crossScene && adjacentScenePairs.has(scenePairKey(fromScene!, toScene!));

  let score = clamp(timbreScore, 0, 1) * 0.62;
  if (vibeSimilarity >= 0.45 && vibeSimilarity < 0.82) score += 0.12;
  if (vibeSimilarity >= 0.9) score -= 0.18;

  if (Number.isFinite(bpmDelta) && bpmDelta <= 4) score += 0.12;
  else if (Number.isFinite(bpmDelta) && bpmDelta <= 8) score += 0.07;

  if (keyRelation === "MATCH" || keyRelation === "FIFTH") score += 0.08;
  else if (keyRelation === "NEIGHBOR") score += 0.05;

  if (crossScene) {
    score += 0.08;
    if (sceneAdjacent) score += 0.04;
  }

  score = clamp(score, 0, 1);
  if (score < MIN_COLLISION_SCORE) return null;

  const reasons: CollisionReason[] = [];
  if (timbreScore >= 0.72) reasons.push("TIMBRE_CLOSE");
  if (vibeSimilarity >= 0.45 && vibeSimilarity < 0.82) reasons.push("VIBE_COMPLEMENT");
  if (Number.isFinite(bpmDelta) && bpmDelta <= 8) reasons.push("BPM_COMPATIBLE");
  if (keyRelation === "MATCH" || keyRelation === "FIFTH" || keyRelation === "NEIGHBOR") {
    reasons.push("KEY_COMPATIBLE");
  }
  if (crossScene) reasons.push("CROSS_SCENE");

  return {
    score,
    reasons,
    bpm_delta: Number.isFinite(bpmDelta) ? bpmDelta : -1,
    key_relation: keyRelation,
    vibe_similarity: vibeSimilarity,
    timbre_score: clamp(timbreScore, 0, 1),
  };
}

export function buildCollisionCandidates(args: {
  tracks: Track[];
  similarEdges: SimilarEdge[];
  sceneByTrackId: Map<string, string>;
  audioEmbeddingByTrackId: Map<string, number[]>;
  adjacentScenePairs: Set<string>;
  buildSeq: number;
}): CollisionEdge[] {
  const {
    tracks,
    similarEdges,
    sceneByTrackId,
    audioEmbeddingByTrackId,
    adjacentScenePairs,
    buildSeq,
  } = args;
  const trackById = new Map(tracks.map((track) => [track.id, track]));
  const analysisByTrackId = new Map(tracks.map((track) => [track.id, buildAnalysis(track)]));
  const bySource = new Map<string, CollisionEdge[]>();
  const similarFallbackBySource = buildSimilarFallbackBySource(similarEdges);

  for (const track of tracks) {
    const candidates = buildCollisionCandidatePoolForTrack({
      sourceTrackId: track.id,
      tracks,
      similarEdges,
      audioEmbeddingByTrackId,
      similarFallbackBySource,
    });
    const rows: CollisionEdge[] = [];

    for (const candidate of candidates) {
      if (candidate.to_id === track.id) continue;
      const targetTrack = trackById.get(candidate.to_id);
      if (!targetTrack) continue;
      const scored = scoreCollisionCandidateDetails({
        fromTrack: track,
        toTrack: targetTrack,
        timbreScore: candidate.timbre_score,
        fromAnalysis: analysisByTrackId.get(track.id),
        toAnalysis: analysisByTrackId.get(targetTrack.id),
        sceneByTrackId,
        adjacentScenePairs,
      });
      if (!scored) continue;

      rows.push({
        from_id: track.id,
        to_id: targetTrack.id,
        score: scored.score,
        reasons: scored.reasons,
        bpm_delta: scored.bpm_delta,
        key_relation: scored.key_relation,
        build_seq: buildSeq,
      });
    }

    bySource.set(track.id, rows);
  }

  const directional = new Map<string, CollisionEdge>();
  for (const [fromId, rows] of bySource) {
    rows
      .sort((a, b) => b.score - a.score || a.to_id.localeCompare(b.to_id))
      .slice(0, MAX_COLLISIONS_PER_TRACK)
      .forEach((row) => {
        directional.set(`${fromId}:${row.to_id}`, row);
      });
  }

  for (const edge of Array.from(directional.values())) {
    const reverseKey = `${edge.to_id}:${edge.from_id}`;
    if (!directional.has(reverseKey)) {
      directional.set(reverseKey, {
        ...edge,
        from_id: edge.to_id,
        to_id: edge.from_id,
      });
    }
  }

  return Array.from(directional.values()).sort(
    (a, b) =>
      a.from_id.localeCompare(b.from_id) ||
      b.score - a.score ||
      a.to_id.localeCompare(b.to_id)
  );
}
