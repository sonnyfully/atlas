const BASE_URL = process.env.ATLAS_BASE_URL ?? "http://localhost:3000";

type TrackRow = {
  id: string;
  status?: string;
};

type TrackDnaResponse = {
  status?: string;
  placement_summary?: string;
  section_states?: Record<string, { state?: string; message?: string }>;
  scene_home?: { scene?: { id?: string; name?: string } } | null;
  similar_tracks?: unknown[];
  collisions?: unknown[];
};

type SceneListResponse = {
  build?: { build_seq?: number } | null;
  scenes?: Array<{ id: string; name: string }>;
};

type SceneDetailResponse = {
  scene?: { id?: string; name?: string } | null;
  members?: unknown[];
  adjacent_scenes?: unknown[];
};

type SimilarResponse = {
  source_id?: string;
  results?: unknown[];
};

type CollisionResponse = {
  source_id?: string;
  results?: unknown[];
};

type AtlasMapResponse = {
  world?: { version_hash?: string };
  tracks?: unknown[];
  scenes?: unknown[];
  scene_graph_edges?: unknown[];
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function main(): Promise<void> {
  console.log("=== Atlas Smoke ===");
  console.log(`Base URL: ${BASE_URL}`);

  const tracks = await fetchJson<TrackRow[]>(`${BASE_URL}/api/tracks`);
  assert(Array.isArray(tracks), "Track list response must be an array");

  const latestReady = tracks.find((track) => track.status === "READY");
  assert(!!latestReady?.id, "Expected at least one READY track");

  const [dna, similar, collisions, scenes, map] = await Promise.all([
    fetchJson<TrackDnaResponse>(`${BASE_URL}/api/tracks/${latestReady!.id}`),
    fetchJson<SimilarResponse>(`${BASE_URL}/api/tracks/${latestReady!.id}/similar`),
    fetchJson<CollisionResponse>(`${BASE_URL}/api/tracks/${latestReady!.id}/collisions`),
    fetchJson<SceneListResponse>(`${BASE_URL}/api/scenes`),
    fetchJson<AtlasMapResponse>(`${BASE_URL}/api/atlas/map?v=1`),
  ]);

  assert(dna.status === "READY", "Latest DNA payload should be READY");
  assert(typeof dna.placement_summary === "string" && dna.placement_summary.length > 0, "DNA payload needs a placement summary");
  assert(!!dna.section_states, "DNA payload needs section state metadata");
  assert(Array.isArray(dna.similar_tracks), "DNA payload needs similar_tracks");
  assert(Array.isArray(dna.collisions), "DNA payload needs collisions");

  assert(similar.source_id === latestReady!.id, "Similar route source_id should match the requested track");
  assert(Array.isArray(similar.results), "Similar route should return a results array");

  assert(collisions.source_id === latestReady!.id, "Collision route source_id should match the requested track");
  assert(Array.isArray(collisions.results), "Collision route should return a results array");

  assert(!!map.world?.version_hash, "Map payload must include world.version_hash");
  assert(Array.isArray(map.tracks), "Map payload must include tracks");
  assert(Array.isArray(map.scenes), "Map payload must include scenes");
  assert(Array.isArray(map.scene_graph_edges), "Map payload must include scene_graph_edges");

  if (scenes.build) {
    assert(Array.isArray(scenes.scenes) && scenes.scenes.length > 0, "Active build should have persisted scenes");
    const firstScene = scenes.scenes?.[0];
    assert(!!firstScene?.id, "Expected at least one scene id");

    const sceneDetail = await fetchJson<SceneDetailResponse>(`${BASE_URL}/api/scenes/${firstScene!.id}`);
    assert(sceneDetail.scene?.id === firstScene!.id, "Scene detail should resolve the requested scene");
    assert(Array.isArray(sceneDetail.members), "Scene detail should include members");
    assert(Array.isArray(sceneDetail.adjacent_scenes), "Scene detail should include adjacent scenes");
  }

  console.log("Smoke checks passed.");
  console.log(`- READY tracks: ${tracks.filter((track) => track.status === "READY").length}`);
  console.log(`- Latest DNA: ${BASE_URL}/track/${latestReady!.id}`);
  console.log(`- Scenes: ${BASE_URL}/scenes`);
  console.log(`- Map: ${BASE_URL}/map`);
}

main().catch((error) => {
  console.error("Atlas smoke failed:", error);
  process.exit(1);
});

export {};
