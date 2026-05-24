import { HelixDB } from "helix-ts";
import { HELIX_URL } from "@atlas/shared";
import type {
  AdjacentSceneResult,
  AtlasBuild,
  AtlasTrackAnalysisV1,
  AtlasTrackProvenanceV1,
  AtlasScene,
  CollisionEdge,
  CollisionReason,
  CollisionTrackResult,
  PersistedScene,
  PersistedSceneMembership,
  SceneMemberResult,
  SceneAdjacencyEdge,
  SceneSummary,
  SimilarEdge,
  SimilarTrackResult,
  SimilarityBasis,
  Track,
  TrackDnaResponse,
  TrackSceneHome,
} from "@atlas/shared";
import {
  ATLAS_V1_MIN_EDGE_SCORE,
  DEFAULT_SIMILARITY_BASIS,
  DEFAULT_SIMILARITY_K,
  DEFAULT_SIMILARITY_MODEL_VERSION,
  buildAnalysis,
  computeSimilarityGraph,
  normalizeSimilarityEdges,
} from "@/lib/atlas-layout";
import {
  buildAtlasTrackAnalysis,
  buildAtlasTrackProvenance,
  buildFeatureZStats,
  buildTrackScoreMaps,
  describeSceneHomeDescriptor,
} from "@/lib/atlas-provenance";
import {
  buildTrackDnaSectionStates,
  buildTrackPlacementSummary,
} from "@/lib/track-dna";

let _client: HelixDB | null = null;
const HELIX_TIMEOUT_MS = 5000;
const GRAPH_CACHE_MS = 20_000;
const DEFAULT_SIMILARITY_TRACK_LIMIT = 500;
let _lastHelixWarningAt = 0;

let _activeBuildCache:
  | {
      generatedAt: number;
      build: AtlasBuild | null;
    }
  | null = null;
let _sceneCache:
  | {
      generatedAt: number;
      buildSeq: number;
      scenes: PersistedScene[];
      memberships: PersistedSceneMembership[];
      sceneByTrackId: Map<string, Pick<Track, "scene_id" | "scene_name" | "scene_color">>;
      membershipByTrackId: Map<string, PersistedSceneMembership>;
    }
  | null = null;
let _similarityCache:
  | {
      generatedAt: number;
      cacheKey: string;
      edges: SimilarEdge[];
    }
  | null = null;
let _adjacencyCache:
  | {
      generatedAt: number;
      buildSeq: number;
      edges: SceneAdjacencyEdge[];
    }
  | null = null;
let _collisionCache:
  | {
      generatedAt: number;
      buildSeq: number;
      edges: CollisionEdge[];
    }
  | null = null;

function getClient(): HelixDB {
  if (!_client) {
    _client = new HelixDB(HELIX_URL);
  }
  return _client;
}

async function mcpPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${HELIX_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HELIX_TIMEOUT_MS),
        cache: "no-store",
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Helix MCP ${endpoint} failed (${res.status}): ${text.slice(0, 200)}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        return text.replace(/"/g, "");
      }
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Unknown Helix MCP error";
  throw new Error(`Helix MCP request failed for ${endpoint}: ${message}`);
}

type McpPropertyFilter = {
  key: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  value: string | number | boolean | Array<string | number | boolean>;
};

async function mcpFilterItems(
  connectionId: string,
  propertyFilters: McpPropertyFilter[]
): Promise<void> {
  await mcpPost("mcp/filter_items", {
    connection_id: connectionId,
    data: {
      filter: {
        properties: [propertyFilters],
      },
    },
  });
}

async function mcpCollect(
  connectionId: string,
  options?: {
    range?: { start: number; end: number };
    drop?: boolean;
  }
): Promise<unknown> {
  return mcpPost("mcp/collect", {
    connection_id: connectionId,
    ...(options?.range ? { range: options.range } : {}),
    ...(typeof options?.drop === "boolean" ? { drop: options.drop } : {}),
  });
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInteger(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    // Fall through to comma parsing.
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseNumber(item, Number.NaN))
      .filter((item) => Number.isFinite(item));
  }
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return parseNumberArray(parsed);
  } catch {
    return value
      .split(",")
      .map((item) => parseNumber(item.trim(), Number.NaN))
      .filter((item) => Number.isFinite(item));
  }
}

function normalizeBasis(value: unknown): SimilarityBasis {
  return value === "audio" ? value : DEFAULT_SIMILARITY_BASIS;
}

function normalizeCollisionReason(value: string): CollisionReason | null {
  switch (value) {
    case "TIMBRE_CLOSE":
    case "VIBE_COMPLEMENT":
    case "BPM_COMPATIBLE":
    case "KEY_COMPATIBLE":
    case "CROSS_SCENE":
      return value;
    case "SIMILAR_FOUNDATION":
      return "TIMBRE_CLOSE";
    case "HALF_DOUBLE_TIME":
      return "BPM_COMPATIBLE";
    default:
      return null;
  }
}

function collisionReasonLabel(reason: CollisionReason): string {
  switch (reason) {
    case "TIMBRE_CLOSE":
      return "Timbre close";
    case "VIBE_COMPLEMENT":
      return "Vibe complement";
    case "BPM_COMPATIBLE":
      return "Tempo compatible";
    case "KEY_COMPATIBLE":
      return "Key compatible";
    case "CROSS_SCENE":
      return "Cross-scene";
  }
}

function firstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (typeof row[key] === "string" && row[key]) return row[key] as string;
  }
  return null;
}

function normalizeTrackRow(row: Record<string, unknown>): Track | null {
  if (typeof row.id !== "string" || typeof row.status !== "string") return null;
  return {
    id: row.id,
    title: typeof row.title === "string" ? row.title : "",
    artist: typeof row.artist === "string" ? row.artist : "",
    filepath: typeof row.filepath === "string" ? row.filepath : "",
    original_filename: typeof row.original_filename === "string" ? row.original_filename : "",
    file_hash: typeof row.file_hash === "string" ? row.file_hash : "",
    status: row.status as Track["status"],
    duration_sec: parseNumber(row.duration_sec, 0),
    bpm: parseNumber(row.bpm, 0),
    key: typeof row.key === "string" ? row.key : "",
    energy: parseNumber(row.energy, 0),
    brightness: parseNumber(row.brightness, 0),
    loudness: parseNumber(row.loudness, 0),
    complexity: parseNumber(row.complexity, 0),
    bpm_confidence: parseNumber(row.bpm_confidence, 0),
    key_confidence: parseNumber(row.key_confidence, 0),
    analysis_version: typeof row.analysis_version === "string" ? row.analysis_version : "",
    embedding_version: typeof row.embedding_version === "string" ? row.embedding_version : "",
    upload_date: typeof row.upload_date === "string" ? row.upload_date : "",
    error: typeof row.error === "string" ? row.error : "",
    scene_id: typeof row.scene_id === "string" ? row.scene_id : undefined,
    scene_name: typeof row.scene_name === "string" ? row.scene_name : undefined,
    scene_color: typeof row.scene_color === "string" ? row.scene_color : undefined,
  };
}

function normalizeTracks(rows: unknown[]): Track[] {
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => normalizeTrackRow(row))
    .filter((row): row is Track => !!row);
}

function normalizeAtlasBuild(row: Record<string, unknown> | null): AtlasBuild | null {
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    build_id: typeof row.build_id === "string" ? row.build_id : "",
    build_seq: parseInteger(row.build_seq, 0),
    version_hash: typeof row.version_hash === "string" ? row.version_hash : "",
    generated_at: typeof row.generated_at === "string" ? row.generated_at : "",
    status: typeof row.status === "string" ? row.status : "",
    ready_track_count: parseInteger(row.ready_track_count, 0),
    similar_edge_count: parseInteger(row.similar_edge_count, 0),
    scene_count: parseInteger(row.scene_count, 0),
    similarity_basis: normalizeBasis(row.similarity_basis),
    model_version:
      typeof row.model_version === "string" && row.model_version.length > 0
        ? row.model_version
        : DEFAULT_SIMILARITY_MODEL_VERSION,
  };
}

function normalizePersistedScenes(rows: Record<string, unknown>[]): PersistedScene[] {
  return rows
    .map((row) => {
      if (typeof row.id !== "string" || typeof row.stable_id !== "string") return null;
      const members = Array.isArray(row.members) ? row.members : [];
      const trackIds = members
        .filter((member): member is Record<string, unknown> => !!member && typeof member === "object")
        .map((member) => member.track_id)
        .filter((id): id is string => typeof id === "string");

      return {
        id: row.id,
        stable_id: row.stable_id,
        name: typeof row.name === "string" ? row.name : row.stable_id,
        build_id: typeof row.build_id === "string" ? row.build_id : "",
        build_seq: parseInteger(row.build_seq, 0),
        centroid_x: parseNumber(row.centroid_x, 0),
        centroid_y: parseNumber(row.centroid_y, 0),
        color: typeof row.color === "string" ? row.color : "#f97316",
        track_count: parseInteger(row.track_count, trackIds.length),
        updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
        track_ids: trackIds,
      } satisfies PersistedScene;
    })
    .filter((scene): scene is PersistedScene => !!scene);
}

function normalizeSimilarEdges(rows: Record<string, unknown>[]): SimilarEdge[] {
  const deduped = new Map<string, SimilarEdge>();

  for (const row of rows) {
    const fromId = firstString(row, ["from_id", "from_track_id", "from_node"]);
    const toId = firstString(row, ["to_id", "to_track_id", "to_node"]);
    if (!fromId || !toId || fromId === toId) continue;
    const score = parseNumber(row.score, 0);
    if (!Number.isFinite(score)) continue;

    const edge: SimilarEdge = {
      id: typeof row.id === "string" ? row.id : undefined,
      from_id: fromId,
      to_id: toId,
      score,
      basis: normalizeBasis(row.basis),
      model_version:
        typeof row.model_version === "string" && row.model_version.length > 0
          ? row.model_version
          : DEFAULT_SIMILARITY_MODEL_VERSION,
      updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
      build_seq: parseInteger(row.build_seq, 0) || undefined,
    };
    const key = `${edge.from_id}:${edge.to_id}`;
    const previous = deduped.get(key);
    if (!previous || edge.score > previous.score) {
      deduped.set(key, edge);
    }
  }

  return Array.from(deduped.values());
}

function normalizeSceneMemberships(
  rows: Record<string, unknown>[],
  sceneByNodeId: Map<string, PersistedScene>
): PersistedSceneMembership[] {
  const deduped = new Map<string, PersistedSceneMembership>();

  for (const row of rows) {
    const trackId = firstString(row, ["from_id", "from_track_id", "from_node"]);
    const sceneNodeId = firstString(row, ["to_id", "to_scene_id", "to_node"]);
    if (!trackId || !sceneNodeId) continue;
    const scene = sceneByNodeId.get(sceneNodeId);
    if (!scene) continue;

    const membership: PersistedSceneMembership = {
      id: typeof row.id === "string" ? row.id : undefined,
      track_id: trackId,
      scene_node_id: sceneNodeId,
      scene_id: scene.stable_id,
      scene_name: scene.name,
      scene_color: scene.color,
      membership_score: parseNumber(row.membership_score, 1),
      build_seq: parseInteger(row.build_seq, scene.build_seq),
    };

    const previous = deduped.get(trackId);
    if (!previous || membership.membership_score > previous.membership_score) {
      deduped.set(trackId, membership);
    }
  }

  return Array.from(deduped.values());
}

function normalizeSceneAdjacencyEdges(
  rows: Record<string, unknown>[],
  sceneByNodeId: Map<string, PersistedScene>
): SceneAdjacencyEdge[] {
  const deduped = new Map<string, SceneAdjacencyEdge>();

  for (const row of rows) {
    const fromNodeId = firstString(row, ["from_id", "from_scene_id", "from_node"]);
    const toNodeId = firstString(row, ["to_id", "to_scene_id", "to_node"]);
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) continue;
    const fromScene = sceneByNodeId.get(fromNodeId);
    const toScene = sceneByNodeId.get(toNodeId);
    if (!fromScene || !toScene) continue;

    const edge: SceneAdjacencyEdge = {
      id: typeof row.id === "string" ? row.id : undefined,
      from_scene_id: fromScene.stable_id,
      to_scene_id: toScene.stable_id,
      score: parseNumber(row.score, 0),
      basis: normalizeBasis(row.basis),
      build_seq: parseInteger(row.build_seq, fromScene.build_seq),
    };
    const key = `${edge.from_scene_id}:${edge.to_scene_id}`;
    const previous = deduped.get(key);
    if (!previous || edge.score > previous.score) {
      deduped.set(key, edge);
    }
  }

  return Array.from(deduped.values());
}

function normalizeCollisionEdges(rows: Record<string, unknown>[]): CollisionEdge[] {
  const deduped = new Map<string, CollisionEdge>();

  for (const row of rows) {
    const fromId = firstString(row, ["from_id", "from_track_id", "from_node"]);
    const toId = firstString(row, ["to_id", "to_track_id", "to_node"]);
    if (!fromId || !toId || fromId === toId) continue;

    const reasons = parseStringArray(row.reasons)
      .map((reason) => normalizeCollisionReason(reason))
      .filter((reason): reason is CollisionReason => !!reason);
    const edge: CollisionEdge = {
      id: typeof row.id === "string" ? row.id : undefined,
      from_id: fromId,
      to_id: toId,
      score: parseNumber(row.score, 0),
      reasons,
      bpm_delta: parseNumber(row.bpm_delta, -1),
      key_relation: typeof row.key_relation === "string" ? row.key_relation : "UNKNOWN",
      build_seq: parseInteger(row.build_seq, 0),
    };
    const key = `${edge.from_id}:${edge.to_id}`;
    const previous = deduped.get(key);
    if (!previous || edge.score > previous.score) {
      deduped.set(key, edge);
    }
  }

  return Array.from(deduped.values());
}

function sortTracks(tracks: Track[], sort: "recent" | "alpha"): Track[] {
  const copy = [...tracks];
  if (sort === "alpha") {
    copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else {
    copy.sort((a, b) => (b.upload_date || "").localeCompare(a.upload_date || ""));
  }
  return copy;
}

function reportHelixUnavailable(context: string, err: unknown): void {
  const now = Date.now();
  if (now - _lastHelixWarningAt < 30000) return;
  _lastHelixWarningAt = now;
  const reason = err instanceof Error ? err.message : String(err);
  console.warn(
    `[helix] ${context}: Helix unavailable at ${HELIX_URL}. Returning fallback data. Reason: ${reason}`
  );
}

function unwrap(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const obj = result as Record<string, unknown>;

  if ("id" in obj && "label" in obj) return obj;

  const keys = Object.keys(obj);
  if (keys.length === 1) {
    const inner = obj[keys[0]];
    if (inner && typeof inner === "object") {
      return inner as Record<string, unknown>;
    }
  }

  if (Array.isArray(result) && result.length > 0) {
    return unwrap(result[0]);
  }

  return obj;
}

function unwrapList(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object"
    );
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        return value.filter(
          (item): item is Record<string, unknown> => !!item && typeof item === "object"
        );
      }
    }
  }
  return [];
}

function mergeRowsById(...groups: Record<string, unknown>[][]): Record<string, unknown>[] {
  const merged = new Map<string, Record<string, unknown>>();
  const fallback: Record<string, unknown>[] = [];

  for (const rows of groups) {
    for (const row of rows) {
      if (typeof row.id === "string") {
        merged.set(row.id, {
          ...(merged.get(row.id) ?? {}),
          ...row,
        });
      } else {
        fallback.push(row);
      }
    }
  }

  return [...merged.values(), ...fallback];
}

async function getPersistedEdgeRowsByType(
  edgeType: "SIMILAR_TO" | "IN_SCENE" | "ADJACENT" | "COLLIDES_WITH",
  buildSeq: number
): Promise<Record<string, unknown>[]> {
  const connId = (await mcpPost("mcp/init", {})) as string;
  await mcpPost("mcp/e_from_type", {
    connection_id: connId,
    data: { edge_type: edgeType },
  });
  await mcpFilterItems(connId, [{ key: "build_seq", operator: "==", value: buildSeq }]);
  return unwrapList(await mcpCollect(connId, { drop: true }));
}

function sceneToAtlasScene(scene: PersistedScene): AtlasScene {
  return {
    id: scene.stable_id,
    name: scene.name,
    color: scene.color,
    centroid_x: scene.centroid_x,
    centroid_y: scene.centroid_y,
    track_count: scene.track_count,
  };
}

function sceneToSceneSummary(
  scene: PersistedScene,
  adjacentSceneCount: number
): SceneSummary {
  return {
    id: scene.stable_id,
    name: scene.name,
    color: scene.color,
    centroid: {
      x: scene.centroid_x,
      y: scene.centroid_y,
    },
    track_count: scene.track_count,
    adjacent_scene_count: adjacentSceneCount,
  };
}

export function invalidateGraphCaches(): void {
  _activeBuildCache = null;
  _sceneCache = null;
  _similarityCache = null;
  _adjacencyCache = null;
  _collisionCache = null;
}

async function getSceneAssignmentMap(
  buildSeq: number
): Promise<Map<string, Pick<Track, "scene_id" | "scene_name" | "scene_color">>> {
  const now = Date.now();
  if (_sceneCache && _sceneCache.buildSeq === buildSeq && now - _sceneCache.generatedAt < GRAPH_CACHE_MS) {
    return _sceneCache.sceneByTrackId;
  }

  const scenes = await getPersistedScenesByBuildSeq(buildSeq);
  const sceneByTrackId = new Map<string, Pick<Track, "scene_id" | "scene_name" | "scene_color">>();
  for (const scene of scenes) {
    for (const trackId of scene.track_ids) {
      sceneByTrackId.set(trackId, {
        scene_id: scene.stable_id,
        scene_name: scene.name,
        scene_color: scene.color,
      });
    }
  }

  _sceneCache = {
    generatedAt: now,
    buildSeq,
    scenes,
    memberships: _sceneCache?.buildSeq === buildSeq ? _sceneCache.memberships : [],
    sceneByTrackId,
    membershipByTrackId:
      _sceneCache?.buildSeq === buildSeq ? _sceneCache.membershipByTrackId : new Map<string, PersistedSceneMembership>(),
  };
  return sceneByTrackId;
}

async function enrichTracksWithCurrentScenes(tracks: Track[]): Promise<Track[]> {
  if (tracks.length === 0) return tracks;
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return tracks;

  const sceneByTrackId = await getSceneAssignmentMap(activeBuild.build_seq);
  return tracks.map((track) => ({
    ...track,
    ...(sceneByTrackId.get(track.id) ?? {}),
  }));
}

async function getTrackWithCurrentScene(id: string): Promise<Track | null> {
  const track = await getTrack(id);
  if (!track) return null;
  const enriched = await enrichTracksWithCurrentScenes([track]);
  return enriched[0] ?? track;
}

async function getPersistedSimilarEdgesForBuild(build: AtlasBuild): Promise<SimilarEdge[]> {
  const now = Date.now();
  const cacheKey = `${build.build_seq}:${build.version_hash}:similar`;
  if (_similarityCache && _similarityCache.cacheKey === cacheKey && now - _similarityCache.generatedAt < GRAPH_CACHE_MS) {
    return _similarityCache.edges;
  }

  const [queryResult, mcpResult] = await Promise.all([
    getClient().query("GetSimilarEdgesByBuildSeq", { build_seq: build.build_seq }),
    getPersistedEdgeRowsByType("SIMILAR_TO", build.build_seq),
  ]);

  const edges = normalizeSimilarEdges(
    mergeRowsById(mcpResult, unwrapList(queryResult)).map((row) => ({
      ...row,
      basis: row.basis ?? build.similarity_basis,
      model_version: row.model_version ?? build.model_version,
    }))
  );

  _similarityCache = {
    generatedAt: now,
    cacheKey,
    edges,
  };
  return edges;
}

async function getPersistedAdjacentEdgesForBuild(buildSeq: number): Promise<SceneAdjacencyEdge[]> {
  const now = Date.now();
  if (_adjacencyCache && _adjacencyCache.buildSeq === buildSeq && now - _adjacencyCache.generatedAt < GRAPH_CACHE_MS) {
    return _adjacencyCache.edges;
  }

  const scenes = await getPersistedScenesByBuildSeq(buildSeq);
  const sceneByNodeId = new Map(scenes.map((scene) => [scene.id, scene]));
  const [queryResult, mcpResult] = await Promise.all([
    getClient().query("GetAdjacentEdgesByBuildSeq", { build_seq: buildSeq }),
    getPersistedEdgeRowsByType("ADJACENT", buildSeq),
  ]);
  const edges = normalizeSceneAdjacencyEdges(
    mergeRowsById(mcpResult, unwrapList(queryResult)),
    sceneByNodeId
  );

  _adjacencyCache = {
    generatedAt: now,
    buildSeq,
    edges,
  };
  return edges;
}

async function getPersistedCollisionEdgesForBuild(buildSeq: number): Promise<CollisionEdge[]> {
  const now = Date.now();
  if (_collisionCache && _collisionCache.buildSeq === buildSeq && now - _collisionCache.generatedAt < GRAPH_CACHE_MS) {
    return _collisionCache.edges;
  }

  const [queryResult, mcpResult] = await Promise.all([
    getClient().query("GetCollisionEdgesByBuildSeq", { build_seq: buildSeq }),
    getPersistedEdgeRowsByType("COLLIDES_WITH", buildSeq),
  ]);
  const edges = normalizeCollisionEdges(mergeRowsById(mcpResult, unwrapList(queryResult)));


  _collisionCache = {
    generatedAt: now,
    buildSeq,
    edges,
  };
  return edges;
}

export async function getAdjacentEdgesByBuildSeq(buildSeq: number): Promise<SceneAdjacencyEdge[]> {
  return getPersistedAdjacentEdgesForBuild(buildSeq);
}

export async function getCollisionEdgesByBuildSeq(buildSeq: number): Promise<CollisionEdge[]> {
  return getPersistedCollisionEdgesForBuild(buildSeq);
}

export async function isHelixAvailable(): Promise<boolean> {
  try {
    await mcpPost("mcp/init", {});
    return true;
  } catch {
    return false;
  }
}

export async function getTrack(id: string): Promise<Track | null> {
  try {
    const result = await getClient().query("GetTrack", { id });
    const row = unwrap(result);
    return row ? normalizeTrackRow(row) : null;
  } catch {
    return null;
  }
}

export async function getRecentTracks(): Promise<Track[]> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;

    await mcpPost("mcp/n_from_type", {
      connection_id: connId,
      data: { node_type: "Track" },
    });

    const collected = await mcpCollect(connId);

    const tracks = sortTracks(normalizeTracks(Array.isArray(collected) ? collected : []), "recent");
    return enrichTracksWithCurrentScenes(tracks);
  } catch (err) {
    reportHelixUnavailable("getRecentTracks", err);
    return [];
  }
}

export async function addTrack(params: {
  title: string;
  artist: string;
  filepath: string;
  original_filename: string;
  file_hash: string;
  status: string;
  upload_date: string;
}): Promise<string> {
  const result = await getClient().query("AddTrack", params);
  const row = unwrap(result);
  const id = typeof row?.id === "string" ? row.id : "";
  if (!id) {
    throw new Error("AddTrack returned no track id");
  }
  invalidateGraphCaches();
  return id;
}

export async function updateTrackAnalysis(params: {
  id: string;
  duration_sec: number;
  bpm: number;
  key: string;
  energy: number;
  brightness: number;
  loudness: number;
  complexity: number;
  bpm_confidence: number;
  key_confidence: number;
  analysis_version: string;
  embedding_version: string;
  status: string;
}): Promise<void> {
  await getClient().query("UpdateTrackAnalysis", params);
  invalidateGraphCaches();
}

export async function updateTrackStatus(id: string, status: string): Promise<void> {
  await getClient().query("UpdateTrackStatus", { id, status });
  invalidateGraphCaches();
}

export async function updateTrackError(id: string, error: string): Promise<void> {
  await getClient().query("UpdateTrackError", { id, error });
  invalidateGraphCaches();
}

export async function addAudioEmbedding(trackId: string, embedding: number[]): Promise<void> {
  await getClient().query("AddAudioEmbedding", {
    track_id: trackId,
    embedding,
  });
}

export async function getTrackAudioEmbedding(trackId: string): Promise<number[] | null> {
  try {
    const result = await getClient().query("GetTrackAudioEmbedding", { track_id: trackId });
    const row = unwrap(result) ?? unwrapList(result)[0] ?? null;
    if (!row) return null;
    const embedding = parseNumberArray(row.embedding);
    return embedding.length > 0 ? embedding : null;
  } catch {
    return null;
  }
}

export async function getTrackAudioEmbeddings(trackIds: string[]): Promise<Map<string, number[]>> {
  const rows = await Promise.all(
    trackIds.map(async (trackId) => [trackId, await getTrackAudioEmbedding(trackId)] as const)
  );
  const embeddingByTrackId = new Map<string, number[]>();
  for (const [trackId, embedding] of rows) {
    if (embedding && embedding.length > 0) {
      embeddingByTrackId.set(trackId, embedding);
    }
  }
  return embeddingByTrackId;
}

export async function findAudioNeighbors(embedding: number[], k: number): Promise<Track[]> {
  const result = await getClient().query("FindAudioNeighbors", { embedding, k });
  return normalizeTracks(unwrapList(result));
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;
    await mcpPost("mcp/search_keyword", {
      connection_id: connId,
      data: { query, label: "Track", limit },
    });
    const collected = await mcpCollect(connId);
    return enrichTracksWithCurrentScenes(normalizeTracks(Array.isArray(collected) ? collected : []));
  } catch (err) {
    reportHelixUnavailable("searchTracks", err);
    return [];
  }
}

export async function getAllTracks(
  sort: "recent" | "alpha" = "recent",
  offset = 0,
  limit = 25
): Promise<Track[]> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;

    await mcpPost("mcp/n_from_type", {
      connection_id: connId,
      data: { node_type: "Track" },
    });

    await mcpPost("mcp/order_by", {
      connection_id: connId,
      data: {
        properties: sort === "recent" ? "upload_date" : "title",
        order: sort === "recent" ? "desc" : "asc",
      },
    });

    const collected = await mcpCollect(connId, {
      range: { start: offset, end: offset + limit },
    });

    return enrichTracksWithCurrentScenes(normalizeTracks(Array.isArray(collected) ? collected : []));
  } catch (err) {
    reportHelixUnavailable("getAllTracks", err);
    const fallback = await getRecentTracks();
    return sortTracks(fallback, sort).slice(offset, offset + limit);
  }
}

export async function findTrackByHash(hash: string): Promise<Track | null> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;

    await mcpPost("mcp/n_from_type", {
      connection_id: connId,
      data: { node_type: "Track" },
    });

    await mcpFilterItems(connId, [{ key: "file_hash", operator: "==", value: hash }]);

    const collected = await mcpCollect(connId, {
      range: { start: 0, end: 1 },
    });

    const match = normalizeTracks(Array.isArray(collected) ? collected : [])[0] ?? null;
    if (!match) return null;
    const enriched = await enrichTracksWithCurrentScenes([match]);
    return enriched[0] ?? match;
  } catch {
    return null;
  }
}

export async function createAtlasBuild(params: {
  build_id: string;
  build_seq: number;
  version_hash: string;
  generated_at: string;
  ready_track_count: number;
  similar_edge_count: number;
  scene_count: number;
  similarity_basis: SimilarityBasis;
  model_version: string;
}): Promise<AtlasBuild> {
  const result = await getClient().query("CreateAtlasBuild", params);
  const build = normalizeAtlasBuild(unwrap(result));
  if (!build) {
    throw new Error("CreateAtlasBuild returned no build");
  }
  invalidateGraphCaches();
  return build;
}

export async function getLatestAtlasBuildRecord(): Promise<AtlasBuild | null> {
  const result = await getClient().query("GetLatestAtlasBuild", {});
  return normalizeAtlasBuild(unwrap(result));
}

export async function getActiveAtlasBuildRecord(): Promise<AtlasBuild | null> {
  const now = Date.now();
  if (_activeBuildCache && now - _activeBuildCache.generatedAt < GRAPH_CACHE_MS) {
    return _activeBuildCache.build;
  }

  try {
    const result = await getClient().query("GetActiveAtlasBuild", {});
    const build = normalizeAtlasBuild(unwrap(result));
    _activeBuildCache = { generatedAt: now, build };
    return build;
  } catch {
    _activeBuildCache = { generatedAt: now, build: null };
    return null;
  }
}

export async function markAtlasBuildActive(id: string): Promise<void> {
  await getClient().query("MarkAtlasBuildActive", { id });
  invalidateGraphCaches();
}

export async function markAtlasBuildSuperseded(id: string): Promise<void> {
  await getClient().query("MarkAtlasBuildSuperseded", { id });
  invalidateGraphCaches();
}

export async function addSceneDetailed(params: {
  stable_id: string;
  name: string;
  build_id: string;
  build_seq: number;
  centroid_x: number;
  centroid_y: number;
  color: string;
  track_count: number;
  updated_at: string;
}): Promise<{ id: string }> {
  const result = await getClient().query("AddSceneDetailed", params);
  const row = unwrap(result);
  const id = typeof row?.id === "string" ? row.id : "";
  if (!id) {
    throw new Error("AddSceneDetailed returned no scene id");
  }
  invalidateGraphCaches();
  return { id };
}

export async function addTrackToScene(params: {
  track_id: string;
  scene_id: string;
  membership_score: number;
  build_seq: number;
}): Promise<void> {
  await getClient().query("AddTrackToScene", params);
  invalidateGraphCaches();
}

export async function addSimilarEdge(params: {
  from_id: string;
  to_id: string;
  score: number;
  basis: SimilarityBasis;
  model_version: string;
  updated_at: string;
  build_seq: number;
}): Promise<void> {
  await getClient().query("AddSimilarEdge", params);
  invalidateGraphCaches();
}

export async function addAdjacentEdge(params: {
  from_scene_id: string;
  to_scene_id: string;
  score: number;
  basis: SimilarityBasis;
  build_seq: number;
}): Promise<void> {
  await getClient().query("AddAdjacentEdge", params);
  invalidateGraphCaches();
}

export async function addCollisionEdge(params: {
  from_id: string;
  to_id: string;
  score: number;
  reasons: CollisionReason[];
  bpm_delta: number;
  key_relation: string;
  build_seq: number;
}): Promise<void> {
  await getClient().query("AddCollisionEdge", params);
  invalidateGraphCaches();
}

export async function getPersistedScenesByBuildSeq(buildSeq: number): Promise<PersistedScene[]> {
  const now = Date.now();
  if (_sceneCache && _sceneCache.buildSeq === buildSeq && now - _sceneCache.generatedAt < GRAPH_CACHE_MS) {
    return _sceneCache.scenes;
  }

  const sceneRows = unwrapList(await getClient().query("GetScenesByBuildSeq", { build_seq: buildSeq }));
  const baseScenes = normalizePersistedScenes(sceneRows.map((scene) => ({ ...scene, members: [] })));
  const sceneByNodeId = new Map(baseScenes.map((scene) => [scene.id, scene]));

  const [queryMemberships, mcpMemberships] = await Promise.all([
    getClient().query("GetSceneMembershipsByBuildSeq", { build_seq: buildSeq }),
    getPersistedEdgeRowsByType("IN_SCENE", buildSeq),
  ]);
  const memberships = normalizeSceneMemberships(
    mergeRowsById(mcpMemberships, unwrapList(queryMemberships)),
    sceneByNodeId
  );

  if (memberships.length === 0 && sceneRows.length > 0) {
    const tracksConnId = (await mcpPost("mcp/init", {})) as string;
    await mcpPost("mcp/n_from_type", {
      connection_id: tracksConnId,
      data: { node_type: "Track" },
    });
    await mcpFilterItems(tracksConnId, [{ key: "status", operator: "==", value: "READY" }]);
    const collectedTracks = await mcpCollect(tracksConnId, { drop: true });
    const trackRows = normalizeTracks(Array.isArray(collectedTracks) ? collectedTracks : []);

    await Promise.all(
      trackRows.map(async (track) => {
        const sceneResults = unwrapList(await getClient().query("GetTrackScenes", { track_id: track.id }));
        for (const scene of sceneResults) {
          const sceneId = typeof scene.id === "string" ? scene.id : "";
          if (!sceneId || parseInteger(scene.build_seq, 0) !== buildSeq) continue;
          const persistedScene = sceneByNodeId.get(sceneId);
          if (!persistedScene) continue;
          memberships.push({
            track_id: track.id,
            scene_node_id: sceneId,
            scene_id: persistedScene.stable_id,
            scene_name: persistedScene.name,
            scene_color: persistedScene.color,
            membership_score: 1,
            build_seq: buildSeq,
          });
        }
      })
    );
  }

  const trackIdsBySceneNodeId = new Map<string, string[]>();
  for (const membership of memberships) {
    const rows = trackIdsBySceneNodeId.get(membership.scene_node_id) ?? [];
    rows.push(membership.track_id);
    trackIdsBySceneNodeId.set(membership.scene_node_id, rows);
  }

  const scenes = normalizePersistedScenes(
    sceneRows.map((scene) => ({
      ...scene,
      members: (trackIdsBySceneNodeId.get(typeof scene.id === "string" ? scene.id : "") ?? []).map(
        (track_id) => ({ track_id })
      ),
    }))
  );
  const sceneLookup = new Map(scenes.map((scene) => [scene.id, scene]));
  const sceneByTrackId = new Map<string, Pick<Track, "scene_id" | "scene_name" | "scene_color">>();
  const membershipByTrackId = new Map<string, PersistedSceneMembership>();

  for (const membership of memberships) {
    const scene = sceneLookup.get(membership.scene_node_id);
    if (!scene) continue;
    const normalizedMembership: PersistedSceneMembership = {
      ...membership,
      scene_id: scene.stable_id,
      scene_name: scene.name,
      scene_color: scene.color,
    };
    sceneByTrackId.set(membership.track_id, {
      scene_id: scene.stable_id,
      scene_name: scene.name,
      scene_color: scene.color,
    });
    membershipByTrackId.set(membership.track_id, normalizedMembership);
  }

  _sceneCache = {
    generatedAt: now,
    buildSeq,
    scenes,
    memberships: Array.from(membershipByTrackId.values()),
    sceneByTrackId,
    membershipByTrackId,
  };
  return scenes;
}

async function getPersistedSceneMembershipByTrackId(
  trackId: string,
  buildSeq: number
): Promise<PersistedSceneMembership | null> {
  await getPersistedScenesByBuildSeq(buildSeq);
  return _sceneCache?.membershipByTrackId.get(trackId) ?? null;
}

async function getPersistedSceneMembershipsByBuildSeq(
  buildSeq: number
): Promise<PersistedSceneMembership[]> {
  await getPersistedScenesByBuildSeq(buildSeq);
  return _sceneCache?.memberships ?? [];
}

export async function getScenesForActiveBuild(): Promise<SceneSummary[]> {
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return [];

  const [scenes, adjacentEdges] = await Promise.all([
    getPersistedScenesByBuildSeq(activeBuild.build_seq),
    getPersistedAdjacentEdgesForBuild(activeBuild.build_seq),
  ]);
  const adjacentCountBySceneId = new Map<string, number>();
  for (const edge of adjacentEdges) {
    adjacentCountBySceneId.set(
      edge.from_scene_id,
      (adjacentCountBySceneId.get(edge.from_scene_id) ?? 0) + 1
    );
  }

  return scenes
    .map((scene) => sceneToSceneSummary(scene, adjacentCountBySceneId.get(scene.stable_id) ?? 0))
    .sort((a, b) => b.track_count - a.track_count || a.name.localeCompare(b.name));
}

export async function getSceneByStableId(stableId: string): Promise<SceneSummary | null> {
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return null;

  const scenes = await getScenesForActiveBuild();
  return scenes.find((scene) => scene.id === stableId) ?? null;
}

export async function getSceneMembers(
  stableId: string
): Promise<SceneMemberResult[]> {
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return [];

  const [memberships, tracks] = await Promise.all([
    getPersistedSceneMembershipsByBuildSeq(activeBuild.build_seq),
    getRecentTracks(),
  ]);
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  return memberships
    .filter((membership) => membership.scene_id === stableId)
    .sort(
      (a, b) =>
        b.membership_score - a.membership_score || a.track_id.localeCompare(b.track_id)
    )
    .flatMap((membership) => {
      const track = trackById.get(membership.track_id);
      if (!track || track.status !== "READY") return [];
      return [
        {
          track,
          membership_score: membership.membership_score,
          build_seq: membership.build_seq,
        } satisfies SceneMemberResult,
      ];
    });
}

export async function getAdjacentScenes(
  stableId: string,
  limit = 6
): Promise<AdjacentSceneResult[]> {
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return [];

  const [scenes, edges] = await Promise.all([
    getPersistedScenesByBuildSeq(activeBuild.build_seq),
    getPersistedAdjacentEdgesForBuild(activeBuild.build_seq),
  ]);
  const sceneByStableId = new Map(scenes.map((scene) => [scene.stable_id, scene]));

  return edges
    .filter((edge) => edge.from_scene_id === stableId)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .flatMap((edge) => {
      const scene = sceneByStableId.get(edge.to_scene_id);
      if (!scene) return [];
      return [
        {
          scene: sceneToAtlasScene(scene),
          score: edge.score,
          basis: edge.basis,
          build_seq: edge.build_seq,
        } satisfies AdjacentSceneResult,
      ];
    });
}

export async function getAllSimilarEdges(
  options: number | { minScore?: number; limitTracks?: number; k?: number } = 0
): Promise<SimilarEdge[]> {
  const minScore = typeof options === "number" ? options : (options.minScore ?? 0);
  const limitTracks =
    typeof options === "number"
      ? DEFAULT_SIMILARITY_TRACK_LIMIT
      : Math.max(10, Math.floor(options.limitTracks ?? DEFAULT_SIMILARITY_TRACK_LIMIT));
  const k =
    typeof options === "number"
      ? DEFAULT_SIMILARITY_K
      : Math.max(1, Math.floor(options.k ?? DEFAULT_SIMILARITY_K));

  const activeBuild = await getActiveAtlasBuildRecord();
  if (activeBuild) {
    const edges = await getPersistedSimilarEdgesForBuild(activeBuild);
    return edges.filter((edge) => edge.score >= minScore);
  }

  const tracks = (await getRecentTracks())
    .filter((track) => track.status === "READY")
    .slice(0, limitTracks);
  const embeddingByTrackId = await getTrackAudioEmbeddings(tracks.map((track) => track.id));

  const now = Date.now();
  const trackFingerprint = tracks
    .map(
      (track) =>
        `${track.id}:${track.bpm}:${track.energy}:${track.brightness}:${track.loudness}:${track.complexity}:${track.duration_sec}:${track.key}:${track.analysis_version}:${track.embedding_version}:${embeddingByTrackId.has(track.id)}`
    )
    .join("|");
  const cacheKey = `${limitTracks}:${k}:${tracks.length}:${trackFingerprint}:fallback`;
  if (_similarityCache && _similarityCache.cacheKey === cacheKey && now - _similarityCache.generatedAt < GRAPH_CACHE_MS) {
    return _similarityCache.edges.filter((edge) => edge.score >= minScore);
  }

  const edges = computeSimilarityGraph(tracks, k, {
    embeddingByTrackId,
  });
  _similarityCache = {
    generatedAt: now,
    cacheKey,
    edges,
  };
  return edges.filter((edge) => edge.score >= minScore);
}

export async function getSimilarEdgesFrom(
  trackId: string,
  limit = 20,
  minScore = 0
): Promise<SimilarEdge[]> {
  const edges = await getAllSimilarEdges(minScore);
  return edges
    .filter((edge) => edge.from_id === trackId)
    .filter((edge) => edge.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

export async function getSimilarTrackResults(
  trackId: string,
  limit = 20
): Promise<SimilarTrackResult[]> {
  const edges = await getSimilarEdgesFrom(trackId, limit, 0);
  if (edges.length === 0) return [];

  const trackById = new Map<string, Track>();
  await Promise.all(
    edges.map(async (edge) => {
      if (trackById.has(edge.to_id)) return;
      const track = await getTrackWithCurrentScene(edge.to_id);
      if (track?.status === "READY") trackById.set(edge.to_id, track);
    })
  );

  const rows: SimilarTrackResult[] = [];
  for (const edge of edges) {
    const track = trackById.get(edge.to_id);
    if (!track) continue;
    rows.push({
      track,
      score: edge.score,
      basis: edge.basis,
      model_version: edge.model_version,
      updated_at: edge.updated_at,
      build_seq: edge.build_seq,
    });
  }
  return rows;
}

export async function getTrackCollisions(
  trackId: string,
  limit = 5
): Promise<CollisionTrackResult[]> {
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return [];

  const edges = (await getPersistedCollisionEdgesForBuild(activeBuild.build_seq))
    .filter((edge) => edge.from_id === trackId)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
  if (edges.length === 0) return [];

  const trackById = new Map<string, Track>();
  await Promise.all(
    edges.map(async (edge) => {
      if (trackById.has(edge.to_id)) return;
      const track = await getTrackWithCurrentScene(edge.to_id);
      if (track?.status === "READY") trackById.set(edge.to_id, track);
    })
  );

  return edges.flatMap((edge) => {
    const track = trackById.get(edge.to_id);
    if (!track) return [];
    return [
      {
        track,
        score: edge.score,
        reasons: edge.reasons,
        reason_labels: edge.reasons.map(collisionReasonLabel),
        bpm_delta: edge.bpm_delta,
        key_relation: edge.key_relation,
        build_seq: edge.build_seq,
      } satisfies CollisionTrackResult,
    ];
  });
}

export async function getAdjacentScenesForTrack(
  trackId: string,
  limit = 6
): Promise<AdjacentSceneResult[]> {
  const activeBuild = await getActiveAtlasBuildRecord();
  if (!activeBuild) return [];

  const membership = await getPersistedSceneMembershipByTrackId(trackId, activeBuild.build_seq);
  if (!membership) return [];
  return getAdjacentScenes(membership.scene_id, limit);
}

async function buildTrackDnaExplanation(
  track: Track,
  activeBuild: AtlasBuild | null
): Promise<{
  analysis: AtlasTrackAnalysisV1;
  provenance: AtlasTrackProvenanceV1;
  sceneHome: TrackSceneHome | null;
}> {
  const analysis = buildAtlasTrackAnalysis(buildAnalysis(track));
  const readyTracks = (await getRecentTracks()).filter((candidate) => candidate.status === "READY");
  const cohortTracks = readyTracks.length > 0 ? readyTracks : [track];
  const analysisByTrackId = new Map(
    cohortTracks.map((candidate) => [candidate.id, buildAtlasTrackAnalysis(buildAnalysis(candidate))])
  );
  const zByFeature = buildFeatureZStats(
    cohortTracks.map((candidate) => analysisByTrackId.get(candidate.id) ?? analysis)
  );

  let sceneHome: TrackSceneHome | null = null;
  let provenance = buildAtlasTrackProvenance({
    trackId: track.id,
    analysis,
    zByFeature,
  });

  if (!activeBuild || track.status !== "READY") {
    return { analysis, provenance, sceneHome };
  }

  const scenes = await getPersistedScenesByBuildSeq(activeBuild.build_seq);
  const sceneIdByTrack = new Map<string, string>();
  for (const scene of scenes) {
    for (const trackId of scene.track_ids) {
      sceneIdByTrack.set(trackId, scene.stable_id);
    }
  }

  const activeTrackIds = new Set(sceneIdByTrack.keys());
  const activeTracks = cohortTracks.filter((candidate) => activeTrackIds.has(candidate.id));
  const cohort = activeTracks.length > 0 ? activeTracks : cohortTracks;
  const cohortTrackIds = new Set(cohort.map((candidate) => candidate.id));
  const [membership, similarEdges] = await Promise.all([
    getPersistedSceneMembershipByTrackId(track.id, activeBuild.build_seq),
    getAllSimilarEdges({
      minScore: ATLAS_V1_MIN_EDGE_SCORE,
      limitTracks: Math.max(DEFAULT_SIMILARITY_TRACK_LIMIT, cohort.length),
      k: 12,
    }),
  ]);

  const filteredEdges = similarEdges.filter(
    (edge) => cohortTrackIds.has(edge.from_id) && cohortTrackIds.has(edge.to_id)
  );
  const { neighborsByTrack } = normalizeSimilarityEdges(
    filteredEdges,
    cohortTrackIds,
    ATLAS_V1_MIN_EDGE_SCORE
  );
  const scores = buildTrackScoreMaps(
    cohort.map((candidate) => ({
      trackId: candidate.id,
      analysis: analysisByTrackId.get(candidate.id) ?? buildAtlasTrackAnalysis(buildAnalysis(candidate)),
    })),
    neighborsByTrack,
    sceneIdByTrack
  );

  provenance = buildAtlasTrackProvenance({
    trackId: track.id,
    analysis,
    zByFeature: buildFeatureZStats(
      cohort.map(
        (candidate) =>
          analysisByTrackId.get(candidate.id) ?? buildAtlasTrackAnalysis(buildAnalysis(candidate))
      )
    ),
    scores,
  });

  if (membership) {
    const scene = scenes.find((candidate) => candidate.id === membership.scene_node_id);
    if (scene) {
      sceneHome = {
        scene: sceneToAtlasScene(scene),
        membership_score: membership.membership_score,
        build_seq: membership.build_seq,
        descriptor: describeSceneHomeDescriptor(membership.membership_score, provenance),
      };
    }
  }

  return { analysis, provenance, sceneHome };
}

export async function getTrackDna(trackId: string): Promise<TrackDnaResponse | null> {
  const track = await getTrackWithCurrentScene(trackId);
  if (!track) return null;

  const activeBuild = await getActiveAtlasBuildRecord();
  const { analysis, provenance, sceneHome } = await buildTrackDnaExplanation(track, activeBuild);

  const [similarTracks, collisions, adjacentScenes] =
    track.status === "READY"
      ? await Promise.all([
          getSimilarTrackResults(track.id, 8),
          getTrackCollisions(track.id, 5),
          getAdjacentScenesForTrack(track.id, 6),
        ])
      : [[], [], []];

  return {
    ...track,
    status: track.status,
    track,
    build: activeBuild,
    analysis,
    provenance,
    placement_summary: buildTrackPlacementSummary({
      track,
      provenance,
      sceneHome,
    }),
    section_states: buildTrackDnaSectionStates({
      track,
      build: activeBuild,
      sceneHome,
      adjacentScenes,
      similarTracks,
      collisions,
    }),
    scene_home: sceneHome,
    adjacent_scenes: adjacentScenes,
    similar_tracks: similarTracks,
    collisions,
  };
}
