import { randomFillSync } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { basename } from "path";
import { HelixDB } from "helix-ts";
import type {
  AtlasMapTrackV1,
  AtlasMapV1Response,
  SceneDetailResponse,
  SceneListResponse,
  TrackDnaResponse,
} from "../packages/shared";

const BASE_URL = process.env.ATLAS_BASE_URL ?? "http://localhost:3000";
const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";
const SEED_AUDIO = process.env.ATLAS_TEST_AUDIO ?? "data/seed_audio/midnight_drive.wav";

type Check = { name: string; ok: boolean; details?: string };
type CollisionRouteResponse = { results?: Array<Record<string, unknown>> };
const FEATURE_LABELS: Record<string, string> = {
  energy: "Energy",
  tempo: "Tempo",
  valence: "Valence",
  complexity: "Complexity",
  brightness: "Brightness",
  loudness: "Loudness",
};

function assert(checks: Check[], condition: boolean, name: string, details?: string): void {
  checks.push({ name, ok: condition, details: condition ? undefined : details });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validatePayload(payload: unknown): payload is AtlasMapV1Response {
  if (!isRecord(payload)) return false;
  if (!isRecord(payload.world)) return false;
  if (typeof payload.world.world_size !== "number") return false;
  if (typeof payload.world.version_hash !== "string") return false;
  if (!Array.isArray(payload.tracks)) return false;
  if (!Array.isArray(payload.scenes)) return false;
  if (!Array.isArray(payload.scene_graph_edges)) return false;
  return true;
}

function validateTrackDna(payload: unknown): payload is TrackDnaResponse {
  if (!isRecord(payload)) return false;
  if (typeof payload.status !== "string") return false;
  if (!isRecord(payload.track)) return false;
  if (!isRecord(payload.analysis)) return false;
  if (!isRecord(payload.provenance)) return false;
  if (!Array.isArray(payload.adjacent_scenes)) return false;
  if (!Array.isArray(payload.similar_tracks)) return false;
  if (!Array.isArray(payload.collisions)) return false;
  return true;
}

function validateSceneList(payload: unknown): payload is SceneListResponse {
  if (!isRecord(payload)) return false;
  if (!("build" in payload)) return false;
  if (!Array.isArray(payload.scenes)) return false;
  return true;
}

function validateSceneDetail(payload: unknown): payload is SceneDetailResponse {
  if (!isRecord(payload)) return false;
  if (!("build" in payload)) return false;
  if (!("scene" in payload)) return false;
  if (!Array.isArray(payload.members)) return false;
  if (!Array.isArray(payload.adjacent_scenes)) return false;
  return true;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${url} -> HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function fetchMap(): Promise<AtlasMapV1Response> {
  const json = await fetchJson<unknown>(`${BASE_URL}/api/atlas/map?v=1`);
  if (!validatePayload(json)) {
    throw new Error("Invalid /api/atlas/map?v=1 payload shape");
  }
  return json;
}

async function fetchTrackDna(trackId: string): Promise<TrackDnaResponse> {
  const json = await fetchJson<unknown>(`${BASE_URL}/api/tracks/${trackId}`);
  if (!validateTrackDna(json)) {
    throw new Error(`Invalid /api/tracks/${trackId} DNA payload shape`);
  }
  return json;
}

async function fetchSceneList(): Promise<SceneListResponse> {
  const json = await fetchJson<unknown>(`${BASE_URL}/api/scenes`);
  if (!validateSceneList(json)) {
    throw new Error("Invalid /api/scenes payload shape");
  }
  return json;
}

async function fetchSceneDetail(sceneId: string): Promise<SceneDetailResponse> {
  const json = await fetchJson<unknown>(`${BASE_URL}/api/scenes/${sceneId}`);
  if (!validateSceneDetail(json)) {
    throw new Error(`Invalid /api/scenes/${sceneId} payload shape`);
  }
  return json;
}

async function waitForMapVersionChange(previousHash: string): Promise<AtlasMapV1Response> {
  for (let i = 0; i < 45; i++) {
    const payload = await fetchMap();
    if (payload.world.version_hash !== previousHash) return payload;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for atlas version hash to change from ${previousHash}`);
}

function trackKey(track: AtlasMapTrackV1): string {
  return `${track.id}:${track.scene_id}:${track.pos.x}:${track.pos.y}`;
}

function validateMapIntegrity(payload: AtlasMapV1Response, checks: Check[]): void {
  const worldSize = payload.world.world_size;
  const sceneIds = new Set(payload.scenes.map((scene) => scene.id));

  for (const track of payload.tracks) {
    assert(
      checks,
      sceneIds.has(track.scene_id),
      "track.scene_id exists in scenes",
      `track=${track.id}, scene_id=${track.scene_id}`
    );
    const finite = Number.isFinite(track.pos.x) && Number.isFinite(track.pos.y);
    assert(checks, finite, "track pos finite", `track=${track.id}`);
    assert(
      checks,
      track.pos.x >= 0 && track.pos.x < worldSize,
      "track.pos.x in [0, world_size)",
      `track=${track.id}, x=${track.pos.x}, world_size=${worldSize}`
    );
    assert(
      checks,
      track.pos.y >= 0 && track.pos.y < worldSize,
      "track.pos.y in [0, world_size)",
      `track=${track.id}, y=${track.pos.y}, world_size=${worldSize}`
    );

    if (track.bridge_score !== undefined) {
      assert(
        checks,
        Number.isFinite(track.bridge_score) && track.bridge_score >= 0 && track.bridge_score <= 1,
        "bridge_score finite in [0,1]",
        `track=${track.id}, bridge_score=${track.bridge_score}`
      );
    }
    if (track.collision_score !== undefined) {
      assert(
        checks,
        Number.isFinite(track.collision_score) && track.collision_score >= 0 && track.collision_score <= 1,
        "collision_score finite in [0,1]",
        `track=${track.id}, collision_score=${track.collision_score}`
      );
    }
    if (track.provenance) {
      const hasWhy =
        (track.provenance.top_features?.length ?? 0) > 0 ||
        (track.provenance.reason_codes?.length ?? 0) > 0;
      assert(
        checks,
        hasWhy,
        "provenance non-empty when present",
        `track=${track.id}`
      );
    }
  }

  for (const edge of payload.scene_graph_edges) {
    assert(
      checks,
      sceneIds.has(edge.from_scene_id) && sceneIds.has(edge.to_scene_id),
      "scene_graph_edge scene ids exist",
      `edge=${edge.from_scene_id}->${edge.to_scene_id}`
    );
    assert(
      checks,
      Number.isFinite(edge.weight) && edge.weight >= 0 && edge.weight <= 1,
      "scene_graph_edge weight finite in [0,1]",
      `edge=${edge.from_scene_id}->${edge.to_scene_id}, weight=${edge.weight}`
    );
  }
}

async function uploadUniqueFixture(): Promise<string> {
  const source = await readFile(SEED_AUDIO);
  const copy = Buffer.from(source);
  if (copy.length > 700) {
    randomFillSync(copy, 530, 24);
  }
  const tempPath = `/tmp/atlas_test_${Date.now()}_${basename(SEED_AUDIO)}`;
  await writeFile(tempPath, copy);

  const form = new FormData();
  form.append("file", new Blob([copy]), basename(tempPath));

  const response = await fetch(`${BASE_URL}/api/ingest`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: HTTP ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("Upload response missing track id");
  }
  return json.id;
}

async function waitForTrackReady(trackId: string): Promise<TrackDnaResponse> {
  for (let i = 0; i < 60; i++) {
    const track = await fetchTrackDna(trackId);
    const status = String(track.status ?? "");
    if (status === "READY" || status === "ERROR") return track;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for track ${trackId} to reach READY/ERROR`);
}

async function hasAudioEmbedding(trackId: string): Promise<boolean> {
  const client = new HelixDB(HELIX_URL);
  const result = await client.query("GetTrackAudioEmbedding", { track_id: trackId });
  if (Array.isArray(result)) return result.length > 0;
  if (isRecord(result)) {
    return Object.values(result).some((value) => Array.isArray(value) ? value.length > 0 : !!value);
  }
  return false;
}

async function main() {
  const checks: Check[] = [];

  const first = await fetchMap();
  assert(checks, first.world.world_size > 0, "world.world_size > 0");
  assert(checks, first.world.version_hash.length > 0, "world.version_hash exists");
  assert(checks, Array.isArray(first.tracks), "tracks array exists");
  assert(checks, Array.isArray(first.scenes), "scenes array exists");
  assert(checks, Array.isArray(first.scene_graph_edges), "scene_graph_edges array exists");
  validateMapIntegrity(first, checks);

  const second = await fetchMap();
  assert(
    checks,
    first.world.version_hash === second.world.version_hash,
    "version_hash stable across repeated calls"
  );

  const firstById = new Map(first.tracks.map((track) => [track.id, trackKey(track)]));
  let deterministic = true;
  for (const track of second.tracks) {
    if (firstById.get(track.id) !== trackKey(track)) {
      deterministic = false;
      break;
    }
  }
  assert(checks, deterministic, "track positions + scene_id deterministic across repeated calls");

  const oldHash = second.world.version_hash;
  const uploadedTrackId = await uploadUniqueFixture();
  const uploadedTrack = await waitForTrackReady(uploadedTrackId);
  assert(
    checks,
    uploadedTrack.status === "READY",
    "upload -> analyze reaches READY",
    `track=${uploadedTrackId}, status=${String(uploadedTrack.status)}`
  );
  assert(
    checks,
    Number.isFinite(Number(uploadedTrack.track.energy)),
    "analysis field energy stored",
    `track=${uploadedTrackId}, energy=${String(uploadedTrack.track.energy)}`
  );
  assert(
    checks,
    Number.isFinite(Number(uploadedTrack.track.duration_sec)),
    "analysis field duration_sec stored",
    `track=${uploadedTrackId}, duration_sec=${String(uploadedTrack.track.duration_sec)}`
  );
  assert(
    checks,
    Array.isArray(uploadedTrack.similar_tracks),
    "track DNA includes similar_tracks array",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    isRecord(uploadedTrack.analysis),
    "track DNA includes analysis object",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    isRecord(uploadedTrack.provenance),
    "track DNA includes provenance object",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    Array.isArray(uploadedTrack.collisions),
    "track DNA includes collisions array",
    `track=${uploadedTrackId}`
  );

  const embeddingPresent = await hasAudioEmbedding(uploadedTrackId);
  assert(checks, embeddingPresent, "audio embedding exists for uploaded track", `track=${uploadedTrackId}`);

  const collisionsRoute = await fetchJson<CollisionRouteResponse>(
    `${BASE_URL}/api/tracks/${uploadedTrackId}/collisions`
  );
  assert(
    checks,
    Array.isArray(collisionsRoute.results),
    "collision route returns results array",
    `track=${uploadedTrackId}`
  );
  const scenesList = await fetchSceneList();
  assert(checks, Array.isArray(scenesList.scenes), "scenes route returns scenes array");
  assert(
    checks,
    scenesList.scenes.length > 0,
    "scenes route returns at least one scene after build"
  );

  const homeSceneId = uploadedTrack.scene_home?.scene.id ?? scenesList.scenes[0]?.id ?? "";
  assert(
    checks,
    homeSceneId.length > 0,
    "track DNA exposes a scene id for scene detail navigation",
    `track=${uploadedTrackId}`
  );
  if (uploadedTrack.scene_home) {
    assert(
      checks,
      typeof uploadedTrack.scene_home.descriptor === "string" &&
        uploadedTrack.scene_home.descriptor.length > 0,
      "track DNA scene_home includes descriptor",
      `track=${uploadedTrackId}`
    );
  }

  if (homeSceneId) {
    const sceneDetail = await fetchSceneDetail(homeSceneId);
    assert(
      checks,
      sceneDetail.scene?.id === homeSceneId,
      "scene detail route returns requested stable id",
      `scene=${homeSceneId}`
    );
    assert(
      checks,
      sceneDetail.members.length > 0,
      "scene detail route returns member tracks",
      `scene=${homeSceneId}`
    );
    assert(
      checks,
      sceneDetail.members.every(
        (member) =>
          Number.isFinite(member.membership_score) &&
          member.membership_score > 0 &&
          member.membership_score <= 1
      ),
      "scene detail memberships stay in (0,1]",
      `scene=${homeSceneId}`
    );
    if (sceneDetail.members.length > 1) {
      assert(
        checks,
        sceneDetail.members.some((member) => member.membership_score < 0.999),
        "scene detail exposes non-default membership scores for multi-track scenes",
        `scene=${homeSceneId}`
      );
    }

    const missingSceneResponse = await fetch(`${BASE_URL}/api/scenes/not-a-real-scene-id`);
    assert(
      checks,
      missingSceneResponse.status === 404,
      "scene detail route returns 404 for missing stable id",
      `status=${missingSceneResponse.status}`
    );

    const scenesPage = await fetch(`${BASE_URL}/scenes`);
    const scenesHtml = await scenesPage.text();
    assert(
      checks,
      scenesPage.ok && scenesHtml.includes("Scene Directory"),
      "scenes index page renders",
      `status=${scenesPage.status}`
    );

    const scenePage = await fetch(`${BASE_URL}/scenes/${homeSceneId}`);
    const sceneHtml = await scenePage.text();
    assert(
      checks,
      scenePage.ok && sceneHtml.includes(homeSceneId),
      "scene detail page renders",
      `scene=${homeSceneId}, status=${scenePage.status}`
    );
  }

  const third = await waitForMapVersionChange(oldHash);
  const rebuiltTrack = await fetchTrackDna(uploadedTrackId);
  const trackPage = await fetch(`${BASE_URL}/track/${uploadedTrackId}`);
  const trackPageHtml = await trackPage.text();
  const rebuiltCollisionsRoute = await fetchJson<CollisionRouteResponse>(
    `${BASE_URL}/api/tracks/${uploadedTrackId}/collisions`
  );
  assert(
    checks,
    rebuiltTrack.collisions.every((item) => Array.isArray(item.reason_labels)),
    "track DNA collisions include reason_labels",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    isRecord(rebuiltTrack.analysis),
    "rebuilt track DNA includes analysis object",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    isRecord(rebuiltTrack.provenance),
    "rebuilt track DNA includes provenance object",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    trackPage.ok && trackPageHtml.includes(rebuiltTrack.track.title),
    "track page renders identity section",
    `track=${uploadedTrackId}, status=${trackPage.status}`
  );
  assert(
    checks,
    trackPage.ok && trackPageHtml.includes("Core Features"),
    "track page renders core features section",
    `track=${uploadedTrackId}, status=${trackPage.status}`
  );
  assert(
    checks,
    trackPageHtml.includes("Scene Home"),
    "track page renders scene home section",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    trackPageHtml.includes("Nearby World"),
    "track page renders nearby world section",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    trackPageHtml.includes("Collision Lab"),
    "track page renders collision lab section",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    trackPageHtml.includes("Similarity Context"),
    "track page renders similarity context section",
    `track=${uploadedTrackId}`
  );
  assert(
    checks,
    trackPageHtml.includes("Why It Sits Here"),
    "track page renders provenance explanation section",
    `track=${uploadedTrackId}`
  );
  const topFeatureName = rebuiltTrack.provenance.top_features?.[0]?.name;
  if (topFeatureName) {
    assert(
      checks,
      trackPageHtml.includes(FEATURE_LABELS[topFeatureName] ?? topFeatureName),
      "track page renders a provenance-driven feature label",
      `track=${uploadedTrackId}, feature=${topFeatureName}`
    );
  }
  if (rebuiltTrack.scene_home?.descriptor) {
    assert(
      checks,
      trackPageHtml.includes(rebuiltTrack.scene_home.descriptor),
      "track page renders scene descriptor copy",
      `track=${uploadedTrackId}`
    );
  }
  if (Array.isArray(rebuiltCollisionsRoute.results)) {
    const sortedDescending = rebuiltCollisionsRoute.results.every((row, index, rows) => {
      if (index === 0) return true;
      const prev = Number(rows[index - 1]?.score ?? Number.NaN);
      const current = Number(row?.score ?? Number.NaN);
      return prev >= current;
    });
    assert(
      checks,
      sortedDescending,
      "collision route results sorted descending",
      `track=${uploadedTrackId}`
    );
    const routeHasReasonLabels = rebuiltCollisionsRoute.results.every((row) =>
      Array.isArray(row.reason_labels)
    );
    assert(
      checks,
      routeHasReasonLabels,
      "collision route results include reason_labels",
      `track=${uploadedTrackId}`
    );
  }
  if (third.tracks.length >= 5) {
    assert(
      checks,
      rebuiltTrack.collisions.length >= 3 && rebuiltTrack.collisions.length <= 5,
      "uploaded track shows 3-5 collisions when enough READY tracks exist",
      `track=${uploadedTrackId}, collisions=${rebuiltTrack.collisions.length}, ready_tracks=${third.tracks.length}`
    );
  }
  const uploadedInMap = third.tracks.find((track) => track.id === uploadedTrackId);
  assert(checks, !!uploadedInMap, "uploaded track appears in map payload", `track=${uploadedTrackId}`);
  if (uploadedInMap) {
    assert(
      checks,
      typeof uploadedInMap.scene_id === "string" && uploadedInMap.scene_id.length > 0,
      "uploaded track has scene_id in map",
      `track=${uploadedTrackId}`
    );
    assert(
      checks,
      Number.isFinite(uploadedInMap.pos.x) && Number.isFinite(uploadedInMap.pos.y),
      "uploaded track has finite pos in map",
      `track=${uploadedTrackId}`
    );
    assert(
      checks,
      isRecord(uploadedInMap.analysis),
      "uploaded track has analysis payload in map",
      `track=${uploadedTrackId}`
    );
  }

  assert(
    checks,
    third.world.version_hash !== oldHash,
    "version_hash changes after dataset change"
  );

  const passed = checks.filter((check) => check.ok);
  const failed = checks.filter((check) => !check.ok);

  console.log(`Atlas v1 checks: ${passed.length}/${checks.length} passed`);
  if (failed.length > 0) {
    console.error("Failures:");
    for (const failure of failed) {
      console.error(`- ${failure.name}${failure.details ? ` :: ${failure.details}` : ""}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Atlas v1 test runner failed:", error);
  process.exit(1);
});
