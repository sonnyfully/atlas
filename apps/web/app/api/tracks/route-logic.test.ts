import assert from "node:assert/strict";
import test from "node:test";
import type { AtlasBuild, Track, TrackDnaResponse } from "@atlas/shared";
import { resolveTrackRoute } from "./[id]/route-logic";

function createTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: "track-1",
    title: "Midnight Drive",
    artist: "Atlas Echo",
    filepath: "/tmp/midnight-drive.wav",
    original_filename: "midnight-drive.wav",
    file_hash: "hash-1",
    status: "READY",
    duration_sec: 214,
    bpm: 124,
    key: "Am",
    energy: 0.82,
    brightness: 0.71,
    loudness: 0.66,
    complexity: 0.52,
    bpm_confidence: 0.9,
    key_confidence: 0.88,
    analysis_version: "v2-audio-informed",
    embedding_version: "v2-audio-clap-hybrid",
    upload_date: "2026-04-11T00:00:00.000Z",
    error: "",
    ...overrides,
  };
}

function createBuild(overrides: Partial<AtlasBuild> = {}): AtlasBuild {
  return {
    id: "build-node-1",
    build_id: "atlas-build-1",
    build_seq: 7,
    version_hash: "world-abc",
    generated_at: "2026-04-11T00:00:00.000Z",
    status: "READY",
    ready_track_count: 12,
    similar_edge_count: 24,
    scene_count: 4,
    similarity_basis: "audio",
    model_version: "atlas-audio-v1",
    ...overrides,
  };
}

function createDna(overrides: Partial<TrackDnaResponse> = {}): TrackDnaResponse {
  const track = createTrack(overrides.track ?? {});

  return {
    ...track,
    status: track.status,
    track,
    build: createBuild(),
    analysis: {
      energy: 0.82,
      tempo: 0.64,
      duration: 0.55,
      key_index: 9,
      valence: 0.48,
      complexity: 0.52,
      brightness: 0.71,
      loudness: 0.66,
      mood_x: 0.12,
      mood_y: 0.21,
    },
    provenance: {
      top_features: [{ name: "energy", value: 0.82, z: 0.9 }],
      similarity_context: {
        within_scene_rank: 1,
        cross_scene_neighbors: 1,
      },
      reason_codes: ["SCENE_CORE"],
    },
    placement_summary: "Energy is the clearest driver here.",
    section_states: {
      scene_home: {
        state: "ready",
        message: "Atlas has a persisted home scene for this track.",
      },
      adjacent_scenes: {
        state: "ready_empty",
        message: "This scene has no persisted adjacent-scene edges yet.",
      },
      similar_tracks: {
        state: "ready_empty",
        message: "This track has no persisted similar neighbors in the active build yet.",
      },
      collisions: {
        state: "ready_empty",
        message: "No persisted collision pairs passed the current build for this track.",
      },
    },
    scene_home: {
      scene: {
        id: "scene-1",
        name: "Neon Crest",
        color: "#ff6600",
        centroid_x: 0.4,
        centroid_y: 0.6,
        track_count: 5,
      },
      membership_score: 0.91,
      build_seq: 7,
      descriptor: "Core anchor for this scene",
    },
    adjacent_scenes: [],
    similar_tracks: [],
    collisions: [],
    ...overrides,
  };
}

test("resolveTrackRoute returns 404 for unknown tracks", async () => {
  const response = await resolveTrackRoute({
    id: "missing-track",
    getTrackDna: async () => null,
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Track not found" });
});

test("resolveTrackRoute returns pending DNA payloads unchanged", async () => {
  const dna = createDna({
    track: createTrack({ status: "PROCESSING" }),
    status: "PROCESSING",
    build: null,
    scene_home: null,
    placement_summary: "Analysis is still running.",
    section_states: {
      scene_home: { state: "not_ready", message: "Scene placement appears after analysis completes." },
      adjacent_scenes: { state: "not_ready", message: "Nearby scenes unlock after this track is analyzed and placed." },
      similar_tracks: { state: "not_ready", message: "Similarity context appears after analysis completes." },
      collisions: { state: "not_ready", message: "Collision pairs appear after Atlas finishes analysis and graph placement." },
    },
  });
  const response = await resolveTrackRoute({
    id: "track-1",
    getTrackDna: async () => dna,
  });

  assert.equal(response.status, 200);
  assert.equal((response.body as TrackDnaResponse).status, "PROCESSING");
  assert.equal((response.body as TrackDnaResponse).section_states.scene_home.state, "not_ready");
});

test("resolveTrackRoute returns ready DNA payloads with missing graph states intact", async () => {
  const dna = createDna({
    build: createBuild({ similar_edge_count: 0 }),
    scene_home: null,
    section_states: {
      scene_home: {
        state: "no_graph_data",
        message: "The active build has not persisted a scene assignment for this track yet.",
      },
      adjacent_scenes: {
        state: "no_graph_data",
        message: "Nearby scenes unlock after Atlas persists this track's home scene.",
      },
      similar_tracks: {
        state: "no_graph_data",
        message: "The active build has not published persisted similar-track edges yet.",
      },
      collisions: {
        state: "no_graph_data",
        message: "Collision pairs depend on this track landing in the persisted graph first.",
      },
    },
  });

  const response = await resolveTrackRoute({
    id: "track-1",
    getTrackDna: async () => dna,
  });

  assert.equal(response.status, 200);
  assert.equal((response.body as TrackDnaResponse).section_states.similar_tracks.state, "no_graph_data");
  assert.equal((response.body as TrackDnaResponse).scene_home, null);
});

test("resolveTrackRoute returns 500 when getTrackDna throws", async (t) => {
  t.mock.method(console, "error", () => {});

  const response = await resolveTrackRoute({
    id: "track-1",
    getTrackDna: async () => {
      throw new Error("boom");
    },
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "Failed to fetch track" });
});
