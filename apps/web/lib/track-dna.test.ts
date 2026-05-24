import assert from "node:assert/strict";
import test from "node:test";
import type {
  AtlasBuild,
  AtlasTrackProvenanceV1,
  Track,
  TrackSceneHome,
} from "@atlas/shared";
import {
  buildTrackDnaSectionStates,
  buildTrackPlacementSummary,
} from "./track-dna";

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

function createSceneHome(overrides: Partial<TrackSceneHome> = {}): TrackSceneHome {
  return {
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
    ...overrides,
  };
}

const provenance: AtlasTrackProvenanceV1 = {
  top_features: [{ name: "energy", value: 0.82, z: 0.9 }],
  similarity_context: {
    within_scene_rank: 1,
    cross_scene_neighbors: 2,
  },
  reason_codes: ["SCENE_CORE"],
};

test("placement summary ties top feature and scene together when both exist", () => {
  const summary = buildTrackPlacementSummary({
    track: createTrack(),
    provenance,
    sceneHome: createSceneHome(),
  });

  assert.match(summary, /Energy is the clearest driver here/i);
  assert.match(summary, /Neon Crest/);
  assert.match(summary, /core anchor for this scene/i);
});

test("placement summary falls back to graph-waiting copy when no scene is persisted", () => {
  const summary = buildTrackPlacementSummary({
    track: createTrack(),
    provenance,
    sceneHome: null,
  });

  assert.match(summary, /Energy stands out strongly/i);
  assert.match(summary, /Graph placement will fill in/i);
});

test("section states distinguish not-ready, no-build, missing graph data, and ready-empty", () => {
  const notReady = buildTrackDnaSectionStates({
    track: createTrack({ status: "PROCESSING" }),
    build: null,
    sceneHome: null,
    adjacentScenes: [],
    similarTracks: [],
    collisions: [],
  });
  assert.equal(notReady.scene_home.state, "not_ready");
  assert.equal(notReady.similar_tracks.state, "not_ready");

  const noBuild = buildTrackDnaSectionStates({
    track: createTrack(),
    build: null,
    sceneHome: null,
    adjacentScenes: [],
    similarTracks: [],
    collisions: [],
  });
  assert.equal(noBuild.scene_home.state, "no_active_build");
  assert.equal(noBuild.collisions.state, "no_active_build");

  const missingGraph = buildTrackDnaSectionStates({
    track: createTrack(),
    build: createBuild({ similar_edge_count: 0 }),
    sceneHome: null,
    adjacentScenes: [],
    similarTracks: [],
    collisions: [],
  });
  assert.equal(missingGraph.scene_home.state, "no_graph_data");
  assert.equal(missingGraph.similar_tracks.state, "no_graph_data");
  assert.equal(missingGraph.collisions.state, "no_graph_data");

  const readyEmpty = buildTrackDnaSectionStates({
    track: createTrack(),
    build: createBuild(),
    sceneHome: createSceneHome(),
    adjacentScenes: [],
    similarTracks: [],
    collisions: [],
  });
  assert.equal(readyEmpty.adjacent_scenes.state, "ready_empty");
  assert.equal(readyEmpty.similar_tracks.state, "ready_empty");
  assert.equal(readyEmpty.collisions.state, "ready_empty");
});
