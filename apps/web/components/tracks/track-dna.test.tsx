import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AtlasBuild, Track, TrackDnaResponse } from "@atlas/shared";
import { TrackActionRail, TrackDnaStoryContent } from "./track-dna";

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
        cross_scene_neighbors: 2,
      },
      reason_codes: ["SCENE_CORE", "SCENE_BRIDGE"],
    },
    placement_summary:
      "Energy is the clearest driver here; Atlas places this track in Neon Crest as core anchor for this scene.",
    section_states: {
      scene_home: {
        state: "ready",
        message: "Atlas has a persisted home scene for this track.",
      },
      adjacent_scenes: {
        state: "ready",
        message: "Atlas found 2 nearby scenes.",
      },
      similar_tracks: {
        state: "ready",
        message: "Atlas found 2 persisted neighbors.",
      },
      collisions: {
        state: "ready",
        message: "Atlas found 2 persisted collision pairs.",
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
    adjacent_scenes: [
      {
        scene: {
          id: "scene-2",
          name: "Afterglow",
          color: "#22aa88",
          centroid_x: 0.2,
          centroid_y: 0.3,
          track_count: 4,
        },
        score: 0.78,
        basis: "audio",
        build_seq: 7,
      },
    ],
    similar_tracks: [
      {
        track: createTrack({
          id: "track-2",
          title: "Electric Current",
          artist: "Atlas Echo",
          scene_id: "scene-2",
          scene_name: "Afterglow",
        }),
        score: 0.88,
        basis: "audio",
        model_version: "atlas-audio-v1",
        build_seq: 7,
      },
    ],
    collisions: [
      {
        track: createTrack({
          id: "track-3",
          title: "Night Merge",
          artist: "Crossfade Club",
          scene_id: "scene-3",
          scene_name: "Bridge Line",
        }),
        score: 0.84,
        reasons: ["TIMBRE_CLOSE", "CROSS_SCENE"],
        reason_labels: ["Timbre close", "Cross scene"],
        bpm_delta: 0.4,
        key_relation: "MATCH",
        build_seq: 7,
      },
    ],
    ...overrides,
  };
}

test("TrackDnaStoryContent renders the full ready-state narrative", () => {
  const html = renderToStaticMarkup(<TrackDnaStoryContent dna={createDna()} />);

  assert.match(html, /Core Traits/);
  assert.match(html, /Placement Summary/);
  assert.match(html, /Neon Crest/);
  assert.match(html, /Collision Lab/);
  assert.match(html, /Electric Current/);
  assert.match(html, /Night Merge/);
});

test("TrackDnaStoryContent renders specific fallback copy for missing graph sections", () => {
  const html = renderToStaticMarkup(
    <TrackDnaStoryContent
      dna={createDna({
        scene_home: null,
        adjacent_scenes: [],
        similar_tracks: [],
        collisions: [],
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
            state: "ready_empty",
            message: "This track has no persisted similar neighbors in the active build yet.",
          },
          collisions: {
            state: "ready_empty",
            message: "No persisted collision pairs passed the current build for this track.",
          },
        },
      })}
    />
  );

  assert.match(html, /The active build has not persisted a scene assignment for this track yet/);
  assert.match(html, /Nearby scenes unlock after Atlas persists this track(?:&#x27;|')s home scene/);
  assert.match(html, /This track has no persisted similar neighbors in the active build yet/);
  assert.match(html, /No persisted collision pairs passed the current build for this track/);
});

test("TrackDnaStoryContent renders the progress shell for processing tracks", () => {
  const html = renderToStaticMarkup(
    <TrackDnaStoryContent
      dna={createDna({
        track: createTrack({ status: "PROCESSING" }),
        status: "PROCESSING",
        build: null,
        placement_summary: "Analysis is still running.",
        scene_home: null,
        adjacent_scenes: [],
        similar_tracks: [],
        collisions: [],
        section_states: {
          scene_home: { state: "not_ready", message: "Scene placement appears after analysis completes." },
          adjacent_scenes: { state: "not_ready", message: "Nearby scenes unlock after this track is analyzed and placed." },
          similar_tracks: { state: "not_ready", message: "Similarity context appears after analysis completes." },
          collisions: { state: "not_ready", message: "Collision pairs appear after Atlas finishes analysis and graph placement." },
        },
      })}
    />
  );

  assert.match(html, /Track DNA/);
  assert.match(html, /Analysis is still running/);
  assert.match(html, /Scene placement appears after analysis completes/);
  assert.match(html, /midnight-drive\.wav/);
});

test("TrackActionRail links the primary Atlas surfaces together", () => {
  const html = renderToStaticMarkup(<TrackActionRail dna={createDna()} />);

  assert.match(html, /Back Home/);
  assert.match(html, /Open Scene/);
  assert.match(html, /Open Map/);
  assert.match(html, /Jump to Collisions/);
  assert.match(html, /Jump to Similarity/);
});
