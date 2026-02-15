import { HelixDB } from "helix-ts";
import {
  TEXT_EMBEDDING_VERSION,
  AUDIO_EMBEDDING_VERSION,
} from "../packages/shared/embeddings";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";

function unwrapNodeId(result: unknown): string {
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
        return (value as { id: string }).id;
      }
    }
  }
  if (Array.isArray(result)) {
    for (const value of result) {
      const id = unwrapNodeId(value);
      if (id) return id;
    }
  }
  return "";
}

function unwrapNodes(result: unknown): Array<{ id: string }> {
  if (Array.isArray(result)) {
    return result.filter((row): row is { id: string } => {
      return !!row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string";
    });
  }
  if (result && typeof result === "object") {
    for (const value of Object.values(result as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        return value.filter((row): row is { id: string } => {
          return !!row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string";
        });
      }
    }
  }
  return [];
}

async function addTestTrack(client: HelixDB, index: number): Promise<string> {
  const result = await client.query("AddTrack", {
    title: `Smoke Test Track ${index}`,
    artist: "Test Artist",
    filepath: `/audio/smoke_test_${index}.wav`,
    original_filename: `smoke_test_${index}.wav`,
    file_hash: `smoke_${Date.now()}_${index}`,
    status: "PENDING",
    upload_date: new Date().toISOString(),
  });
  const trackId = unwrapNodeId(result);
  if (!trackId) throw new Error(`AddTrack #${index} did not return a track ID`);
  return trackId;
}

async function smokeTest() {
  const client = new HelixDB(HELIX_URL);

  console.log("=== Atlas Smoke Test (C2) ===");
  console.log(`Connecting to HelixDB at ${HELIX_URL}\n`);

  const trackA = await addTestTrack(client, 1);
  const trackB = await addTestTrack(client, 2);
  console.log(`Created tracks: ${trackA}, ${trackB}`);

  const baseEmbedding = Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.01));
  const baseAudioEmbedding = Array.from({ length: 512 }, (_, i) => Math.cos(i * 0.01));

  await client.query("UpdateTrackAnalysis", {
    id: trackA,
    duration_sec: 240,
    bpm: 128,
    key: "Am",
    energy: 0.72,
    status: "PROCESSING",
  });
  await client.query("UpdateTrackAnalysis", {
    id: trackB,
    duration_sec: 238,
    bpm: 129,
    key: "Am",
    energy: 0.70,
    status: "PROCESSING",
  });

  await client.query("AddTrackEmbedding", {
    track_id: trackA,
    embedding: baseEmbedding,
  });
  await client.query("AddTrackEmbedding", {
    track_id: trackB,
    embedding: baseEmbedding.map((v, i) => v + (i % 13 === 0 ? 0.0005 : 0)),
  });

  await client.query("AddAudioEmbedding", {
    track_id: trackA,
    embedding: baseAudioEmbedding,
  });
  await client.query("AddAudioEmbedding", {
    track_id: trackB,
    embedding: baseAudioEmbedding.map((v, i) => v + (i % 17 === 0 ? 0.0005 : 0)),
  });

  const textNeighborsRaw = await client.query("FindNeighbors", {
    embedding: baseEmbedding,
    k: 5,
  });
  const textNeighbors = unwrapNodes(textNeighborsRaw);
  if (textNeighbors.length === 0) {
    throw new Error("FindNeighbors returned 0 results");
  }
  console.log(`Text neighbors found: ${textNeighbors.length}`);

  const audioNeighborsRaw = await client.query("FindAudioNeighbors", {
    embedding: baseAudioEmbedding,
    k: 5,
  });
  const audioNeighbors = unwrapNodes(audioNeighborsRaw);
  if (audioNeighbors.length === 0) {
    throw new Error("FindAudioNeighbors returned 0 results");
  }
  console.log(`Audio neighbors found: ${audioNeighbors.length}`);

  await client.query("AddSimilarEdge", {
    from_id: trackA,
    to_id: trackB,
    score: 0.91,
    basis: "hybrid",
    model_version: `${TEXT_EMBEDDING_VERSION}+${AUDIO_EMBEDDING_VERSION}`,
  });

  await client.query("UpdateTrackStatus", {
    id: trackA,
    status: "READY",
  });
  await client.query("UpdateTrackStatus", {
    id: trackB,
    status: "READY",
  });

  console.log("\n=== All C2 smoke tests passed ===");
}

smokeTest().catch((err) => {
  console.error("\nSmoke test FAILED:", err);
  process.exit(1);
});
