import assert from "node:assert/strict";
import test from "node:test";
import type { SimilarEdge, Track } from "@atlas/shared";
import {
  buildCollisionCandidatePoolForTrack,
  buildCollisionCandidates,
  scoreCollisionCandidateDetails,
} from "./collision-build";

function makeTrack(
  id: string,
  overrides: Partial<Track> = {}
): Track {
  return {
    id,
    title: `Track ${id}`,
    artist: "Atlas Test",
    filepath: `/tmp/${id}.wav`,
    original_filename: `${id}.wav`,
    file_hash: `hash-${id}`,
    status: "READY",
    duration_sec: 240,
    bpm: 128,
    key: "Am",
    energy: 0.7,
    brightness: 0.68,
    loudness: 0.72,
    complexity: 0.46,
    bpm_confidence: 0.9,
    key_confidence: 0.88,
    analysis_version: "v2-audio-informed",
    embedding_version: "v2-audio-clap-hybrid",
    upload_date: "2026-04-10T00:00:00.000Z",
    error: "",
    ...overrides,
  };
}

function makeSimilarEdge(from_id: string, to_id: string, score: number): SimilarEdge {
  return {
    from_id,
    to_id,
    score,
    basis: "audio",
    model_version: "test",
    updated_at: "2026-04-10T00:00:00.000Z",
    build_seq: 7,
  };
}

test("collision candidate pool prefers embeddings and fills from similar fallback", () => {
  const tracks = [
    makeTrack("source"),
    makeTrack("embed-a"),
    makeTrack("embed-b"),
    makeTrack("fallback"),
  ];
  const audioEmbeddingByTrackId = new Map<string, number[]>([
    ["source", [1, 0, 0]],
    ["embed-a", [0.99, 0.01, 0]],
    ["embed-b", [0.95, 0.02, 0.03]],
  ]);
  const similarEdges = [
    makeSimilarEdge("source", "fallback", 0.91),
    makeSimilarEdge("source", "embed-a", 0.2),
  ];

  const pool = buildCollisionCandidatePoolForTrack({
    sourceTrackId: "source",
    tracks,
    similarEdges,
    audioEmbeddingByTrackId,
  });

  assert.deepEqual(
    pool.map((item) => [item.to_id, item.source]),
    [
      ["embed-a", "embedding"],
      ["embed-b", "embedding"],
      ["fallback", "similar"],
    ]
  );
});

test("collision candidate pool falls back to similar neighbors when embeddings are missing", () => {
  const tracks = [makeTrack("source"), makeTrack("a"), makeTrack("b")];
  const pool = buildCollisionCandidatePoolForTrack({
    sourceTrackId: "source",
    tracks,
    similarEdges: [
      makeSimilarEdge("source", "b", 0.8),
      makeSimilarEdge("source", "a", 0.92),
    ],
    audioEmbeddingByTrackId: new Map(),
  });

  assert.deepEqual(
    pool.map((item) => [item.to_id, item.source, item.timbre_score]),
    [
      ["a", "similar", 0.92],
      ["b", "similar", 0.8],
    ]
  );
});

test("collision scoring assigns roadmap reason codes", () => {
  const fromTrack = makeTrack("from", { bpm: 128, key: "Am", energy: 0.78 });
  const toTrack = makeTrack("to", { bpm: 130, key: "Em", energy: 0.42 });
  const details = scoreCollisionCandidateDetails({
    fromTrack,
    toTrack,
    timbreScore: 0.94,
    fromAnalysis: {
      energy: 0.78,
      tempo: 0.71,
      duration: 0.5,
      key_index: 9,
      valence: 0.7,
      complexity: 0.42,
      brightness: 0.73,
      loudness: 0.68,
      mood_x: 0.3,
      mood_y: 0.7,
    },
    toAnalysis: {
      energy: 0.18,
      tempo: 0.63,
      duration: 0.48,
      key_index: 4,
      valence: 0.2,
      complexity: 0.82,
      brightness: 0.3,
      loudness: 0.28,
      mood_x: 0.1,
      mood_y: 0.5,
    },
    sceneByTrackId: new Map([
      ["from", "scene-a"],
      ["to", "scene-b"],
    ]),
    adjacentScenePairs: new Set(["scene-a:scene-b"]),
  });

  assert.ok(details);
  assert.equal(details?.key_relation, "FIFTH");
  assert.equal(details?.bpm_delta, 2);
  assert.deepEqual(details?.reasons, [
    "TIMBRE_CLOSE",
    "VIBE_COMPLEMENT",
    "BPM_COMPATIBLE",
    "KEY_COMPATIBLE",
    "CROSS_SCENE",
  ]);
});

test("collision generation is deterministic and rejects self/duplicate edges", () => {
  const tracks = [
    makeTrack("a", { bpm: 128, key: "Am", energy: 0.74 }),
    makeTrack("b", { bpm: 130, key: "Em", energy: 0.44 }),
    makeTrack("c", { bpm: 96, key: "C", energy: 0.3 }),
  ];
  const similarEdges = [
    makeSimilarEdge("a", "b", 0.88),
    makeSimilarEdge("a", "b", 0.81),
    makeSimilarEdge("a", "a", 0.99),
    makeSimilarEdge("b", "a", 0.88),
    makeSimilarEdge("b", "c", 0.72),
    makeSimilarEdge("c", "b", 0.72),
  ];
  const audioEmbeddingByTrackId = new Map<string, number[]>([
    ["a", [1, 0, 0]],
    ["b", [0.98, 0.02, 0]],
  ]);
  const args = {
    tracks,
    similarEdges,
    sceneByTrackId: new Map([
      ["a", "scene-a"],
      ["b", "scene-b"],
      ["c", "scene-c"],
    ]),
    audioEmbeddingByTrackId,
    adjacentScenePairs: new Set(["scene-a:scene-b"]),
    buildSeq: 7,
  };

  const first = buildCollisionCandidates(args);
  const second = buildCollisionCandidates(args);

  assert.deepEqual(first, second);
  assert.equal(first.some((edge) => edge.from_id === edge.to_id), false);
  assert.equal(
    first.filter((edge) => edge.from_id === "a" && edge.to_id === "b").length,
    1
  );
  assert.ok(first.some((edge) => edge.from_id === "b" && edge.to_id === "a"));
});
