import { createHash, randomUUID } from "crypto";
import type {
  AtlasBuild,
  PersistedScene,
  SimilarEdge,
  SimilarityBasis,
} from "@atlas/shared";
import {
  ATLAS_V1_MIN_EDGE_SCORE,
  DEFAULT_SIMILARITY_BASIS,
  DEFAULT_SIMILARITY_MODEL_VERSION,
  buildAnalysis,
  clusterProjectedTracks,
  computeSimilarityGraph,
  defaultSceneName,
  hashAtlasWorldVersion,
  normalizeSimilarityEdges,
  type ProjectedSceneMember,
  projectToPlane,
} from "@/lib/atlas-layout";
import { buildCollisionCandidates } from "@/lib/collision-build";
import {
  addAdjacentEdge,
  addCollisionEdge,
  addSceneDetailed,
  addSimilarEdge,
  addTrackToScene,
  createAtlasBuild,
  getActiveAtlasBuildRecord,
  getLatestAtlasBuildRecord,
  getPersistedScenesByBuildSeq,
  getRecentTracks,
  getTrackAudioEmbeddings,
  invalidateGraphCaches,
  markAtlasBuildActive,
  markAtlasBuildSuperseded,
} from "@/lib/helix";

const CANONICAL_SIMILARITY_K = 12;
const SCENE_MATCH_THRESHOLD = 0.25;
const MAX_ADJACENT_SCENES = 6;
const MIN_ADJACENCY_SCORE = 0.35;
const SCENE_COLORS = [
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#ef4444",
  "#84cc16",
  "#14b8a6",
  "#8b5cf6",
  "#ec4899",
];

interface BuildSceneCandidate {
  stable_id: string;
  name: string;
  color: string;
  centroid_x: number;
  centroid_y: number;
  track_ids: string[];
  members: ProjectedSceneMember[];
}

interface PersistedSceneNode extends BuildSceneCandidate {
  node_id: string;
}

interface SceneAdjacencyCandidate {
  from_scene_id: string;
  to_scene_id: string;
  score: number;
  basis: SimilarityBasis;
  build_seq: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashColorIndex(input: string): number {
  const hash = createHash("sha1").update(input).digest("hex").slice(0, 8);
  return Number.parseInt(hash, 16) % SCENE_COLORS.length;
}

function buildSceneId(buildId: string, trackIds: string[]): string {
  const digest = createHash("sha1")
    .update(`${buildId}:${trackIds.sort().join("|")}`)
    .digest("hex")
    .slice(0, 10);
  return `scene-${digest}`;
}

function centroidSimilarity(
  a: { centroid_x: number; centroid_y: number },
  b: { centroid_x: number; centroid_y: number }
): number {
  const distance = Math.hypot(a.centroid_x - b.centroid_x, a.centroid_y - b.centroid_y);
  return clamp(1 - distance / Math.SQRT2, 0, 1);
}

function memberOverlap(nextTrackIds: string[], previousTrackIds: string[]): number {
  const next = new Set(nextTrackIds);
  const prev = new Set(previousTrackIds);
  let intersection = 0;
  for (const trackId of next) {
    if (prev.has(trackId)) intersection += 1;
  }
  const union = new Set([...next, ...prev]).size;
  return union > 0 ? intersection / union : 0;
}

function matchStableScenes(
  buildId: string,
  clusters: ReturnType<typeof clusterProjectedTracks>,
  previousScenes: PersistedScene[]
): BuildSceneCandidate[] {
  const scoredMatches: Array<{
    clusterIndex: number;
    sceneIndex: number;
    score: number;
  }> = [];

  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
    const cluster = clusters[clusterIndex];
    for (let sceneIndex = 0; sceneIndex < previousScenes.length; sceneIndex++) {
      const previous = previousScenes[sceneIndex];
      const overlap = memberOverlap(cluster.track_ids, previous.track_ids);
      const proximity = centroidSimilarity(cluster, previous);
      const score = overlap * 0.7 + proximity * 0.3;
      if (score >= SCENE_MATCH_THRESHOLD) {
        scoredMatches.push({ clusterIndex, sceneIndex, score });
      }
    }
  }

  scoredMatches.sort((a, b) => b.score - a.score);

  const assignedClusters = new Set<number>();
  const assignedScenes = new Set<number>();
  const matches = new Map<number, PersistedScene>();

  for (const match of scoredMatches) {
    if (assignedClusters.has(match.clusterIndex) || assignedScenes.has(match.sceneIndex)) continue;
    assignedClusters.add(match.clusterIndex);
    assignedScenes.add(match.sceneIndex);
    matches.set(match.clusterIndex, previousScenes[match.sceneIndex]);
  }

  return clusters.map((cluster, clusterIndex) => {
    const matched = matches.get(clusterIndex);
    if (matched) {
      return {
        stable_id: matched.stable_id,
        name: matched.name,
        color: matched.color,
        centroid_x: cluster.centroid_x,
        centroid_y: cluster.centroid_y,
        track_ids: [...cluster.track_ids],
        members: cluster.members.map((member) => ({ ...member })),
      };
    }

    const stableId = buildSceneId(buildId, cluster.track_ids);
    return {
      stable_id: stableId,
      name: defaultSceneName(cluster.sorted_index, cluster.avg_energy, cluster.avg_tempo),
      color: SCENE_COLORS[hashColorIndex(stableId)],
      centroid_x: cluster.centroid_x,
      centroid_y: cluster.centroid_y,
      track_ids: [...cluster.track_ids],
      members: cluster.members.map((member) => ({ ...member })),
    };
  });
}

function uniqueEdges(edges: SimilarEdge[]): SimilarEdge[] {
  const seen = new Set<string>();
  const deduped: SimilarEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from_id}:${edge.to_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(edge);
  }
  return deduped;
}

function buildSceneAdjacencyCandidates(
  scenes: PersistedSceneNode[],
  undirectedEdges: Array<{ from: string; to: string; score: number }>,
  sceneByTrackId: Map<string, string>,
  buildSeq: number
): SceneAdjacencyCandidate[] {
  const pairStats = new Map<string, { from: string; to: string; sum: number; count: number }>();

  for (const edge of undirectedEdges) {
    const fromScene = sceneByTrackId.get(edge.from);
    const toScene = sceneByTrackId.get(edge.to);
    if (!fromScene || !toScene || fromScene === toScene) continue;
    const a = fromScene < toScene ? fromScene : toScene;
    const b = fromScene < toScene ? toScene : fromScene;
    const key = `${a}:${b}`;
    const row = pairStats.get(key) ?? { from: a, to: b, sum: 0, count: 0 };
    row.sum += edge.score;
    row.count += 1;
    pairStats.set(key, row);
  }

  const byScene = new Map<string, SceneAdjacencyCandidate[]>();
  for (const scene of scenes) byScene.set(scene.stable_id, []);

  for (const row of pairStats.values()) {
    const density = clamp(row.count / 14, 0, 1);
    const avgScore = row.sum / Math.max(1, row.count);
    const blend = clamp(avgScore * 0.75 + density * 0.25, 0, 1);
    if (blend < MIN_ADJACENCY_SCORE) continue;

    const forward: SceneAdjacencyCandidate = {
      from_scene_id: row.from,
      to_scene_id: row.to,
      score: blend,
      basis: DEFAULT_SIMILARITY_BASIS,
      build_seq: buildSeq,
    };
    const reverse: SceneAdjacencyCandidate = {
      from_scene_id: row.to,
      to_scene_id: row.from,
      score: blend,
      basis: DEFAULT_SIMILARITY_BASIS,
      build_seq: buildSeq,
    };
    byScene.get(row.from)?.push(forward);
    byScene.get(row.to)?.push(reverse);
  }

  return Array.from(byScene.values()).flatMap((rows) =>
    rows
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ADJACENT_SCENES)
  );
}

export async function rebuildCanonicalAtlasBuild(): Promise<AtlasBuild | null> {
  const allReadyTracks = (await getRecentTracks()).filter((track) => track.status === "READY");
  if (allReadyTracks.length === 0) {
    return null;
  }

  const latestBuild = await getLatestAtlasBuildRecord();
  const previousActiveBuild = await getActiveAtlasBuildRecord();
  const buildSeq = (latestBuild?.build_seq ?? 0) + 1;
  const generatedAt = new Date().toISOString();
  const buildId = `${generatedAt.slice(0, 10)}-${buildSeq}-${randomUUID().slice(0, 8)}`;
  const audioEmbeddingByTrackId = await getTrackAudioEmbeddings(
    allReadyTracks.map((track) => track.id)
  );

  const versionHash = hashAtlasWorldVersion(allReadyTracks);
  const rawEdges = computeSimilarityGraph(allReadyTracks, CANONICAL_SIMILARITY_K, {
    embeddingByTrackId: audioEmbeddingByTrackId,
    generatedAt,
  })
    .filter((edge) => edge.score >= ATLAS_V1_MIN_EDGE_SCORE)
    .map((edge) => ({
      ...edge,
      build_seq: buildSeq,
      updated_at: generatedAt,
    }));
  const similarEdges = uniqueEdges(rawEdges);

  const trackIds = new Set(allReadyTracks.map((track) => track.id));
  const { undirectedEdges } = normalizeSimilarityEdges(similarEdges, trackIds, ATLAS_V1_MIN_EDGE_SCORE);
  const analysisByTrack = new Map(allReadyTracks.map((track) => [track.id, buildAnalysis(track)]));
  const projected = projectToPlane(
    allReadyTracks.map((track) => ({
      id: track.id,
      analysis: analysisByTrack.get(track.id)!,
    })),
    undirectedEdges
  );

  const clusters = clusterProjectedTracks(
    allReadyTracks.map((track) => {
      const analysis = analysisByTrack.get(track.id)!;
      const pos = projected.get(track.id)!;
      return {
        id: track.id,
        analysis,
        x01: pos.x01,
        y01: pos.y01,
      };
    })
  );

  const previousScenes =
    previousActiveBuild ? await getPersistedScenesByBuildSeq(previousActiveBuild.build_seq) : [];
  const matchedScenes = matchStableScenes(buildId, clusters, previousScenes);

  const build = await createAtlasBuild({
    build_id: buildId,
    build_seq: buildSeq,
    version_hash: versionHash,
    generated_at: generatedAt,
    ready_track_count: allReadyTracks.length,
    similar_edge_count: similarEdges.length,
    scene_count: matchedScenes.length,
    similarity_basis: DEFAULT_SIMILARITY_BASIS,
    model_version: DEFAULT_SIMILARITY_MODEL_VERSION,
  });

  for (const edge of similarEdges) {
    await addSimilarEdge({
      from_id: edge.from_id,
      to_id: edge.to_id,
      score: edge.score,
      basis: edge.basis,
      model_version: edge.model_version,
      updated_at: edge.updated_at ?? generatedAt,
      build_seq: buildSeq,
    });
  }

  const persistedScenes: PersistedSceneNode[] = [];
  for (const scene of matchedScenes) {
    const sceneNode = await addSceneDetailed({
      stable_id: scene.stable_id,
      name: scene.name,
      build_id: buildId,
      build_seq: buildSeq,
      centroid_x: scene.centroid_x,
      centroid_y: scene.centroid_y,
      color: scene.color,
      track_count: scene.track_ids.length,
      updated_at: generatedAt,
    });
    persistedScenes.push({
      ...scene,
      node_id: sceneNode.id,
    });

    for (const member of scene.members) {
      await addTrackToScene({
        track_id: member.track_id,
        scene_id: sceneNode.id,
        membership_score: member.membership_score,
        build_seq: buildSeq,
      });
    }
  }

  const sceneByTrackId = new Map<string, string>();
  for (const scene of persistedScenes) {
    for (const trackId of scene.track_ids) {
      sceneByTrackId.set(trackId, scene.stable_id);
    }
  }

  const adjacencyEdges = buildSceneAdjacencyCandidates(
    persistedScenes,
    undirectedEdges,
    sceneByTrackId,
    buildSeq
  );
  const sceneNodeIdByStableId = new Map(
    persistedScenes.map((scene) => [scene.stable_id, scene.node_id])
  );
  for (const edge of adjacencyEdges) {
    const fromSceneNodeId = sceneNodeIdByStableId.get(edge.from_scene_id);
    const toSceneNodeId = sceneNodeIdByStableId.get(edge.to_scene_id);
    if (!fromSceneNodeId || !toSceneNodeId) continue;
    await addAdjacentEdge({
      from_scene_id: fromSceneNodeId,
      to_scene_id: toSceneNodeId,
      score: edge.score,
      basis: edge.basis,
      build_seq: edge.build_seq,
    });
  }

  const adjacentScenePairs = new Set(
    adjacencyEdges.map((edge) => {
      const a = edge.from_scene_id < edge.to_scene_id ? edge.from_scene_id : edge.to_scene_id;
      const b = edge.from_scene_id < edge.to_scene_id ? edge.to_scene_id : edge.from_scene_id;
      return `${a}:${b}`;
    })
  );
  const collisionEdges = buildCollisionCandidates({
    tracks: allReadyTracks,
    similarEdges,
    sceneByTrackId,
    audioEmbeddingByTrackId,
    adjacentScenePairs,
    buildSeq,
  });
  for (const edge of collisionEdges) {
    await addCollisionEdge({
      from_id: edge.from_id,
      to_id: edge.to_id,
      score: edge.score,
      reasons: edge.reasons,
      bpm_delta: edge.bpm_delta,
      key_relation: edge.key_relation,
      build_seq: edge.build_seq,
    });
  }

  await markAtlasBuildActive(build.id);
  if (previousActiveBuild) {
    await markAtlasBuildSuperseded(previousActiveBuild.id);
  }
  invalidateGraphCaches();
  return {
    ...build,
    status: "ACTIVE",
  };
}
