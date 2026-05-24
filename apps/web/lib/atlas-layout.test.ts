import assert from "node:assert/strict";
import test from "node:test";
import type { Track } from "@atlas/shared";
import {
  DEFAULT_SIMILARITY_BASIS,
  DEFAULT_SIMILARITY_MODEL_VERSION,
  FEATURE_FALLBACK_SIMILARITY_BASIS,
  FEATURE_FALLBACK_SIMILARITY_MODEL_VERSION,
  buildAnalysis,
  computeSimilarityGraph,
  scoreTrackSimilarity,
} from "./atlas-layout";

function makeTrack(id: string, overrides: Partial<Track> = {}): Track {
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
    energy: 0.72,
    brightness: 0.68,
    loudness: 0.73,
    complexity: 0.44,
    bpm_confidence: 0.9,
    key_confidence: 0.88,
    analysis_version: "v2-audio-informed",
    embedding_version: "v2-audio-clap-hybrid",
    upload_date: "2026-04-12T00:00:00.000Z",
    error: "",
    ...overrides,
  };
}

test("scoreTrackSimilarity prefers embeddings when both tracks have them", () => {
  const from = makeTrack("a");
  const to = makeTrack("b", { bpm: 126, key: "Em", energy: 0.65 });
  const edge = scoreTrackSimilarity(
    from,
    to,
    new Map([
      ["a", [1, 0, 0]],
      ["b", [0.99, 0.01, 0]],
    ])
  );

  assert.ok(edge);
  assert.equal(edge?.basis, DEFAULT_SIMILARITY_BASIS);
  assert.equal(edge?.model_version, DEFAULT_SIMILARITY_MODEL_VERSION);
  assert.ok((edge?.score ?? 0) > 0.75);
});

test("scoreTrackSimilarity falls back to feature scoring when embeddings are missing", () => {
  const from = makeTrack("a");
  const to = makeTrack("b", { bpm: 130, key: "Am", energy: 0.7 });
  const edge = scoreTrackSimilarity(from, to, new Map());

  assert.ok(edge);
  assert.equal(edge?.basis, FEATURE_FALLBACK_SIMILARITY_BASIS);
  assert.equal(edge?.model_version, FEATURE_FALLBACK_SIMILARITY_MODEL_VERSION);
});

test("buildAnalysis no longer injects hash-driven trait divergence", () => {
  const first = buildAnalysis(
    makeTrack("alpha", {
      analysis_version: "",
      embedding_version: "",
    })
  );
  const second = buildAnalysis(
    makeTrack("beta", {
      analysis_version: "",
      embedding_version: "",
    })
  );

  assert.equal(first.complexity, second.complexity);
  assert.equal(first.brightness, second.brightness);
  assert.equal(first.loudness, second.loudness);
});

test("computeSimilarityGraph emits embedding-backed and fallback edges deterministically", () => {
  const tracks = [
    makeTrack("a"),
    makeTrack("b", { energy: 0.69 }),
    makeTrack("c", { embedding_version: "", analysis_version: "v2-audio-informed" }),
  ];

  const withEmbeddings = computeSimilarityGraph(tracks, 2, {
    embeddingByTrackId: new Map([
      ["a", [1, 0, 0]],
      ["b", [0.98, 0.02, 0]],
    ]),
    generatedAt: "2026-04-12T00:00:00.000Z",
  });

  assert.ok(withEmbeddings.some((edge) => edge.basis === DEFAULT_SIMILARITY_BASIS));
  assert.ok(withEmbeddings.some((edge) => edge.basis === FEATURE_FALLBACK_SIMILARITY_BASIS));
  assert.ok(
    withEmbeddings.every((edge) => edge.updated_at === "2026-04-12T00:00:00.000Z")
  );
});
