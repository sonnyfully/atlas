import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAtlasTrackProvenance,
  buildFeatureZStats,
  buildTrackScoreMaps,
  describeSceneHomeDescriptor,
} from "./atlas-provenance";

test("top feature ordering is deterministic", () => {
  const zByFeature = buildFeatureZStats([
    {
      energy: 0.9,
      tempo: 0.8,
      duration: 0.5,
      key_index: 9,
      valence: 0.3,
      complexity: 0.2,
      brightness: 0.95,
      loudness: 0.92,
      mood_x: 0.1,
      mood_y: 0.2,
    },
    {
      energy: 0.4,
      tempo: 0.45,
      duration: 0.52,
      key_index: 2,
      valence: 0.55,
      complexity: 0.6,
      brightness: 0.35,
      loudness: 0.42,
      mood_x: 0.3,
      mood_y: 0.4,
    },
  ]);

  const first = buildAtlasTrackProvenance({
    trackId: "track-a",
    analysis: {
      energy: 0.9,
      tempo: 0.8,
      duration: 0.5,
      key_index: 9,
      valence: 0.3,
      complexity: 0.2,
      brightness: 0.95,
      loudness: 0.92,
      mood_x: 0.1,
      mood_y: 0.2,
    },
    zByFeature,
  });

  const second = buildAtlasTrackProvenance({
    trackId: "track-a",
    analysis: {
      energy: 0.9,
      tempo: 0.8,
      duration: 0.5,
      key_index: 9,
      valence: 0.3,
      complexity: 0.2,
      brightness: 0.95,
      loudness: 0.92,
      mood_x: 0.1,
      mood_y: 0.2,
    },
    zByFeature,
  });

  assert.deepEqual(first.top_features, second.top_features);
  assert.equal(first.top_features?.[0]?.name, "tempo");
});

test("scene rank and cross-scene neighbors flow through provenance", () => {
  const scores = buildTrackScoreMaps(
    [
      {
        trackId: "a",
        analysis: {
          energy: 0.7,
          tempo: 0.72,
          duration: 0.5,
          key_index: 9,
          valence: 0.55,
          complexity: 0.44,
          brightness: 0.68,
          loudness: 0.74,
          mood_x: 0.1,
          mood_y: 0.2,
        },
      },
      {
        trackId: "b",
        analysis: {
          energy: 0.65,
          tempo: 0.7,
          duration: 0.5,
          key_index: 9,
          valence: 0.52,
          complexity: 0.41,
          brightness: 0.61,
          loudness: 0.69,
          mood_x: 0.2,
          mood_y: 0.3,
        },
      },
      {
        trackId: "c",
        analysis: {
          energy: 0.3,
          tempo: 0.32,
          duration: 0.6,
          key_index: 2,
          valence: 0.22,
          complexity: 0.74,
          brightness: 0.21,
          loudness: 0.29,
          mood_x: -0.2,
          mood_y: 0.4,
        },
      },
    ],
    new Map([
      ["a", [{ id: "b", score: 0.38 }, { id: "c", score: 0.86 }]],
      ["b", [{ id: "a", score: 0.38 }]],
      ["c", [{ id: "a", score: 0.86 }]],
    ]),
    new Map([
      ["a", "scene-1"],
      ["b", "scene-1"],
      ["c", "scene-2"],
    ])
  );

  const provenance = buildAtlasTrackProvenance({
    trackId: "a",
    analysis: {
      energy: 0.7,
      tempo: 0.72,
      duration: 0.5,
      key_index: 9,
      valence: 0.55,
      complexity: 0.44,
      brightness: 0.68,
      loudness: 0.74,
      mood_x: 0.1,
      mood_y: 0.2,
    },
    zByFeature: buildFeatureZStats([
      {
        energy: 0.7,
        tempo: 0.72,
        duration: 0.5,
        key_index: 9,
        valence: 0.55,
        complexity: 0.44,
        brightness: 0.68,
        loudness: 0.74,
        mood_x: 0.1,
        mood_y: 0.2,
      },
      {
        energy: 0.65,
        tempo: 0.7,
        duration: 0.5,
        key_index: 9,
        valence: 0.52,
        complexity: 0.41,
        brightness: 0.61,
        loudness: 0.69,
        mood_x: 0.2,
        mood_y: 0.3,
      },
      {
        energy: 0.3,
        tempo: 0.32,
        duration: 0.6,
        key_index: 2,
        valence: 0.22,
        complexity: 0.74,
        brightness: 0.21,
        loudness: 0.29,
        mood_x: -0.2,
        mood_y: 0.4,
      },
    ]),
    scores,
  });

  assert.equal(provenance.similarity_context?.within_scene_rank, 1);
  assert.equal(provenance.similarity_context?.cross_scene_neighbors, 1);
  assert.ok(provenance.reason_codes?.includes("SCENE_BRIDGE"));
  assert.ok(provenance.reason_codes?.includes("SCENE_CORE"));
  assert.equal(
    describeSceneHomeDescriptor(0.91, provenance),
    "Bridge between neighboring scenes"
  );
});

test("non-scene provenance still preserves high-energy and fast-tempo reasons", () => {
  const provenance = buildAtlasTrackProvenance({
    trackId: "solo",
    analysis: {
      energy: 0.88,
      tempo: 0.79,
      duration: 0.5,
      key_index: 9,
      valence: 0.55,
      complexity: 0.44,
      brightness: 0.68,
      loudness: 0.74,
      mood_x: 0.1,
      mood_y: 0.2,
    },
    zByFeature: buildFeatureZStats([
      {
        energy: 0.88,
        tempo: 0.79,
        duration: 0.5,
        key_index: 9,
        valence: 0.55,
        complexity: 0.44,
        brightness: 0.68,
        loudness: 0.74,
        mood_x: 0.1,
        mood_y: 0.2,
      },
    ]),
  });

  assert.ok(provenance.reason_codes?.includes("HIGH_ENERGY"));
  assert.ok(provenance.reason_codes?.includes("FAST_TEMPO"));
  assert.equal(provenance.similarity_context, undefined);
});
