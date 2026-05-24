import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type {
  AtlasMapSceneV1,
  AtlasMapTrackV1,
  AtlasMapV1Response,
  AtlasSceneGraphEdgeV1,
  CollisionEdge,
  PersistedScene,
  SceneAdjacencyEdge,
  Track,
} from "@atlas/shared";
import {
  ATLAS_V1_MIN_EDGE_SCORE,
  ATLAS_V1_WORLD_SIZE,
  buildAnalysis,
  clusterProjectedTracks,
  defaultSceneName,
  hashAtlasWorldVersion,
  normalizeSimilarityEdges,
  projectToPlane,
} from "@/lib/atlas-layout";
import {
  buildAtlasTrackAnalysis,
  buildAtlasTrackProvenance,
  buildFeatureZStats,
  buildTrackScoreMaps,
} from "@/lib/atlas-provenance";
import {
  getActiveAtlasBuildRecord,
  getAdjacentEdgesByBuildSeq,
  getAllSimilarEdges,
  getCollisionEdgesByBuildSeq,
  getPersistedScenesByBuildSeq,
  getRecentTracks,
  isHelixAvailable,
} from "@/lib/helix";
import { getCoverUrl } from "@/lib/covers";

const ATLAS_V1_MAX_TRACKS = 2000;
const ATLAS_V1_DIR = join(process.cwd(), "..", "..", "data", "atlas", "v1");

const inMemoryCache = new Map<string, AtlasMapV1Response>();

interface AnalysisPoint extends ReturnType<typeof buildAnalysis> {}

interface WorkingTrack {
  track: Track;
  analysis: AnalysisPoint;
  x01: number;
  y01: number;
  sceneId: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function readCachedMap(versionHash: string): Promise<AtlasMapV1Response | null> {
  const memory = inMemoryCache.get(versionHash);
  if (memory) return memory;
  const path = join(ATLAS_V1_DIR, `${versionHash}.json`);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as AtlasMapV1Response;
    if (parsed.world.version_hash !== versionHash) return null;
    inMemoryCache.set(versionHash, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedMap(payload: AtlasMapV1Response): Promise<void> {
  const path = join(ATLAS_V1_DIR, `${payload.world.version_hash}.json`);
  await mkdir(ATLAS_V1_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
  inMemoryCache.set(payload.world.version_hash, payload);
}

function buildSceneGraphEdges(
  undirectedEdges: Array<{ from: string; to: string; score: number }>,
  sceneByTrackId: Map<string, AtlasMapSceneV1>,
  bridgeByTrack: Map<string, number>,
  collisionByTrack: Map<string, number>
): AtlasSceneGraphEdgeV1[] {
  const pairStats = new Map<
    string,
    {
      from: string;
      to: string;
      sum: number;
      count: number;
      bridgeMass: number;
      collisionMass: number;
    }
  >();

  for (const edge of undirectedEdges) {
    const fromScene = sceneByTrackId.get(edge.from)?.id;
    const toScene = sceneByTrackId.get(edge.to)?.id;
    if (!fromScene || !toScene || fromScene === toScene) continue;
    const a = fromScene < toScene ? fromScene : toScene;
    const b = fromScene < toScene ? toScene : fromScene;
    const key = `${a}:${b}`;
    if (!pairStats.has(key)) {
      pairStats.set(key, {
        from: a,
        to: b,
        sum: 0,
        count: 0,
        bridgeMass: 0,
        collisionMass: 0,
      });
    }
    const row = pairStats.get(key);
    if (!row) continue;
    row.sum += edge.score;
    row.count += 1;
    row.bridgeMass += (bridgeByTrack.get(edge.from) ?? 0) + (bridgeByTrack.get(edge.to) ?? 0);
    row.collisionMass += (collisionByTrack.get(edge.from) ?? 0) + (collisionByTrack.get(edge.to) ?? 0);
  }

  return Array.from(pairStats.values())
    .map((row) => {
      const density = clamp(row.count / 14, 0, 1);
      const avgScore = row.sum / Math.max(1, row.count);
      const blend = clamp(avgScore * 0.75 + density * 0.25, 0, 1);
      const bridgeSignal = row.bridgeMass / Math.max(1, row.count * 2);
      const collisionSignal = row.collisionMass / Math.max(1, row.count * 2);
      let type: AtlasSceneGraphEdgeV1["type"] = "adjacent";
      if (bridgeSignal >= 0.58 || blend >= 0.74) type = "bridge";
      else if (collisionSignal >= 0.62) type = "collision";

      return {
        from_scene_id: row.from,
        to_scene_id: row.to,
        weight: blend,
        type,
      } satisfies AtlasSceneGraphEdgeV1;
    })
    .sort((a, b) => b.weight - a.weight);
}

function buildPersistedSceneGraphEdges(edges: SceneAdjacencyEdge[]): AtlasSceneGraphEdgeV1[] {
  return edges
    .map((edge) => ({
      from_scene_id: edge.from_scene_id,
      to_scene_id: edge.to_scene_id,
      weight: edge.score,
      type: "adjacent" as const,
    }))
    .sort((a, b) => b.weight - a.weight);
}

function buildCollisionScoreMap(
  trackIds: Set<string>,
  collisionEdges: CollisionEdge[]
): Map<string, number> {
  const collisionByTrack = new Map<string, number>();
  for (const trackId of trackIds) {
    collisionByTrack.set(trackId, 0);
  }
  for (const edge of collisionEdges) {
    if (!trackIds.has(edge.from_id)) continue;
    const previous = collisionByTrack.get(edge.from_id) ?? 0;
    if (edge.score > previous) {
      collisionByTrack.set(edge.from_id, edge.score);
    }
  }
  return collisionByTrack;
}

function buildEmpty(versionHash: string): AtlasMapV1Response {
  return {
    world: {
      world_size: ATLAS_V1_WORLD_SIZE,
      version_hash: versionHash,
    },
    tracks: [],
    scenes: [],
    scene_graph_edges: [],
  };
}

function buildSceneMaps(
  scenes: PersistedScene[]
): { sceneRows: AtlasMapSceneV1[]; sceneByTrackId: Map<string, AtlasMapSceneV1> } {
  const sceneRows = scenes
    .map((scene) => ({
      id: scene.stable_id,
      name: scene.name,
      centroid_pos: {
        x: scene.centroid_x * ATLAS_V1_WORLD_SIZE,
        y: scene.centroid_y * ATLAS_V1_WORLD_SIZE,
      },
      size: scene.track_count,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const sceneByStableId = new Map(sceneRows.map((scene) => [scene.id, scene]));
  const sceneByTrackId = new Map<string, AtlasMapSceneV1>();
  for (const scene of scenes) {
    const atlasScene = sceneByStableId.get(scene.stable_id);
    if (!atlasScene) continue;
    for (const trackId of scene.track_ids) {
      sceneByTrackId.set(trackId, atlasScene);
    }
  }
  return { sceneRows, sceneByTrackId };
}

function buildFallbackSceneMaps(working: WorkingTrack[]): {
  sceneRows: AtlasMapSceneV1[];
  sceneByTrackId: Map<string, AtlasMapSceneV1>;
} {
  const clusters = clusterProjectedTracks(
    working.map((row) => ({
      id: row.track.id,
      analysis: row.analysis,
      x01: row.x01,
      y01: row.y01,
    }))
  );

  const sceneRows: AtlasMapSceneV1[] = clusters.map((cluster) => ({
    id: cluster.temp_id,
    name: defaultSceneName(cluster.sorted_index, cluster.avg_energy, cluster.avg_tempo),
    centroid_pos: {
      x: cluster.centroid_x * ATLAS_V1_WORLD_SIZE,
      y: cluster.centroid_y * ATLAS_V1_WORLD_SIZE,
    },
    size: cluster.track_ids.length,
  }));

  const byId = new Map(sceneRows.map((scene) => [scene.id, scene]));
  const sceneByTrackId = new Map<string, AtlasMapSceneV1>();
  for (const cluster of clusters) {
    const scene = byId.get(cluster.temp_id);
    if (!scene) continue;
    for (const trackId of cluster.track_ids) {
      sceneByTrackId.set(trackId, scene);
    }
  }
  return { sceneRows, sceneByTrackId };
}

export async function getAtlasMapV1(options?: {
  forceRebuild?: boolean;
  maxTracks?: number;
}): Promise<AtlasMapV1Response> {
  const helixAvailable = await isHelixAvailable();
  if (!helixAvailable) {
    throw new Error("HELIX_UNAVAILABLE");
  }

  const maxTracks = Math.max(10, Math.min(ATLAS_V1_MAX_TRACKS, Math.floor(options?.maxTracks ?? ATLAS_V1_MAX_TRACKS)));
  const activeBuild = await getActiveAtlasBuildRecord();
  const allReadyTracks = (await getRecentTracks()).filter((track) => track.status === "READY");

  let persistedScenes: PersistedScene[] = [];
  let readyTracks = allReadyTracks;
  if (activeBuild) {
    persistedScenes = await getPersistedScenesByBuildSeq(activeBuild.build_seq);
    const activeTrackIds = new Set(persistedScenes.flatMap((scene) => scene.track_ids));
    readyTracks = allReadyTracks.filter((track) => activeTrackIds.has(track.id));
  }

  readyTracks = readyTracks.slice(0, maxTracks);
  if (persistedScenes.length > 0) {
    const visibleTrackIds = new Set(readyTracks.map((track) => track.id));
    persistedScenes = persistedScenes
      .map((scene) => ({
        ...scene,
        track_ids: scene.track_ids.filter((trackId) => visibleTrackIds.has(trackId)),
      }))
      .filter((scene) => scene.track_ids.length > 0);
  }
  const versionHash = activeBuild?.version_hash ?? hashAtlasWorldVersion(readyTracks);

  if (!options?.forceRebuild) {
    const cached = await readCachedMap(versionHash);
    if (cached) {
      const hasAnySimilarNeighbors = cached.tracks.some(
        (track) => (track.similar_neighbor_ids?.length ?? 0) > 0
      );
      const cacheLooksValid =
        !activeBuild ||
        (activeBuild.ready_track_count === 0 &&
          activeBuild.scene_count === 0 &&
          activeBuild.similar_edge_count === 0) ||
        (cached.tracks.length > 0 &&
          cached.scenes.length > 0 &&
          (cached.scene_graph_edges.length > 0 || cached.scenes.length <= 1) &&
          (hasAnySimilarNeighbors || activeBuild.similar_edge_count === 0));
      if (cacheLooksValid) return cached;
    }
  }

  if (readyTracks.length === 0) {
    const empty = buildEmpty(versionHash);
    await writeCachedMap(empty);
    return empty;
  }

  const trackIds = new Set(readyTracks.map((track) => track.id));
  const similarEdges = (await getAllSimilarEdges({
    minScore: ATLAS_V1_MIN_EDGE_SCORE,
    limitTracks: maxTracks,
    k: 12,
  })).filter((edge) => trackIds.has(edge.from_id) && trackIds.has(edge.to_id));
  const { undirectedEdges, neighborsByTrack } = normalizeSimilarityEdges(similarEdges, trackIds, ATLAS_V1_MIN_EDGE_SCORE);

  const analysisByTrackId = new Map<string, AnalysisPoint>();
  for (const track of readyTracks) {
    analysisByTrackId.set(track.id, buildAnalysis(track));
  }

  const projected = projectToPlane(
    readyTracks.map((track) => ({ id: track.id, analysis: analysisByTrackId.get(track.id)! })),
    undirectedEdges
  );

  const working: WorkingTrack[] = readyTracks
    .map((track) => {
      const analysis = analysisByTrackId.get(track.id);
      const pos = projected.get(track.id);
      if (!analysis || !pos) return null;
      return {
        track,
        analysis,
        x01: pos.x01,
        y01: pos.y01,
        sceneId: "",
      } satisfies WorkingTrack;
    })
    .filter((row): row is WorkingTrack => !!row);

  const { sceneRows, sceneByTrackId } =
    persistedScenes.length > 0 ? buildSceneMaps(persistedScenes) : buildFallbackSceneMaps(working);

  for (const row of working) {
    row.sceneId = sceneByTrackId.get(row.track.id)?.id ?? sceneRows[0]?.id ?? "scene-1";
  }

  const {
    bridgeByTrack,
    collisionByTrack: fallbackCollisionByTrack,
    withinSceneRankByTrack,
    crossSceneNeighborsByTrack,
  } = buildTrackScoreMaps(
    working.map((row) => ({
      trackId: row.track.id,
      analysis: buildAtlasTrackAnalysis(row.analysis),
    })),
    neighborsByTrack,
    new Map(Array.from(sceneByTrackId.entries()).map(([trackId, scene]) => [trackId, scene.id]))
  );

  let collisionByTrack = fallbackCollisionByTrack;
  let sceneGraphEdges = buildSceneGraphEdges(
    undirectedEdges,
    sceneByTrackId,
    bridgeByTrack,
    collisionByTrack
  );

  if (activeBuild) {
    const [adjacentEdges, collisionEdges] = await Promise.all([
      getAdjacentEdgesByBuildSeq(activeBuild.build_seq),
      getCollisionEdgesByBuildSeq(activeBuild.build_seq),
    ]);
    if (adjacentEdges.length > 0) {
      const visibleSceneIds = new Set(sceneRows.map((scene) => scene.id));
      sceneGraphEdges = buildPersistedSceneGraphEdges(
        adjacentEdges.filter(
          (edge) =>
            visibleSceneIds.has(edge.from_scene_id) &&
            visibleSceneIds.has(edge.to_scene_id)
        )
      );
    }
    if (collisionEdges.length > 0) {
      collisionByTrack = buildCollisionScoreMap(trackIds, collisionEdges);
    }
  }

  const zByFeature = buildFeatureZStats(
    working.map((row) => buildAtlasTrackAnalysis(row.analysis))
  );

  const tracks: AtlasMapTrackV1[] = working.map((row) => ({
    id: row.track.id,
    title: row.track.title,
    artist: row.track.artist,
    scene_id: row.sceneId,
    pos: {
      x: row.x01 * ATLAS_V1_WORLD_SIZE,
      y: row.y01 * ATLAS_V1_WORLD_SIZE,
    },
    analysis: buildAtlasTrackAnalysis(row.analysis),
    bpm: Number.isFinite(row.track.bpm) ? row.track.bpm : undefined,
    key: row.track.key || undefined,
    duration_s: Number.isFinite(row.track.duration_sec) ? row.track.duration_sec : undefined,
    artwork_url: getCoverUrl(row.track.id, { s: 128 }),
    bridge_score: bridgeByTrack.get(row.track.id),
    collision_score: collisionByTrack.get(row.track.id),
    similar_neighbor_ids: (neighborsByTrack.get(row.track.id) ?? []).slice(0, 10).map((n) => n.id),
    provenance: buildAtlasTrackProvenance({
      trackId: row.track.id,
      analysis: buildAtlasTrackAnalysis(row.analysis),
      zByFeature,
      scores: {
        bridgeByTrack,
        collisionByTrack,
        withinSceneRankByTrack,
        crossSceneNeighborsByTrack,
      },
    }),
  }));

  const payload: AtlasMapV1Response = {
    world: {
      world_size: ATLAS_V1_WORLD_SIZE,
      version_hash: versionHash,
    },
    tracks,
    scenes: sceneRows,
    scene_graph_edges: sceneGraphEdges,
  };

  await writeCachedMap(payload);
  return payload;
}
