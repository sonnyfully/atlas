import { HelixDB } from "helix-ts";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";
const ANALYSIS_VERSION = "v2-audio-informed";
const ALLOWED_COLLISION_REASONS = new Set([
  "TIMBRE_CLOSE",
  "VIBE_COMPLEMENT",
  "BPM_COMPATIBLE",
  "KEY_COMPATIBLE",
  "CROSS_SCENE",
]);

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

function unwrapRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  }
  if (result && typeof result === "object") {
    for (const value of Object.values(result as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        return value.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
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
  const buildSeq = Date.now();

  console.log("=== Atlas Smoke Test (C2) ===");
  console.log(`Connecting to HelixDB at ${HELIX_URL}\n`);

  const trackA = await addTestTrack(client, 1);
  const trackB = await addTestTrack(client, 2);
  console.log(`Created tracks: ${trackA}, ${trackB}`);
  const buildRaw = await client.query("CreateAtlasBuild", {
    build_id: `smoke-${Date.now()}`,
    build_seq: buildSeq,
    version_hash: "smoke-build",
    generated_at: new Date().toISOString(),
    ready_track_count: 2,
    similar_edge_count: 1,
    scene_count: 1,
    similarity_basis: "audio",
    model_version: "smoke",
  });
  const buildId = unwrapNodeId(buildRaw);
  if (!buildId) throw new Error("CreateAtlasBuild did not return a build ID");

  const baseAudioEmbedding = Array.from({ length: 512 }, (_, i) => Math.cos(i * 0.01));

  await client.query("UpdateTrackAnalysis", {
    id: trackA,
    duration_sec: 240,
    bpm: 128,
    key: "Am",
    energy: 0.72,
    brightness: 0.69,
    loudness: 0.74,
    complexity: 0.48,
    bpm_confidence: 0.92,
    key_confidence: 0.88,
    analysis_version: ANALYSIS_VERSION,
    embedding_version: "v2-audio-clap-hybrid",
    status: "PROCESSING",
  });
  await client.query("UpdateTrackAnalysis", {
    id: trackB,
    duration_sec: 238,
    bpm: 129,
    key: "Am",
    energy: 0.70,
    brightness: 0.67,
    loudness: 0.72,
    complexity: 0.46,
    bpm_confidence: 0.92,
    key_confidence: 0.88,
    analysis_version: ANALYSIS_VERSION,
    embedding_version: "v2-audio-clap-hybrid",
    status: "PROCESSING",
  });

  await client.query("AddAudioEmbedding", {
    track_id: trackA,
    embedding: baseAudioEmbedding,
  });
  await client.query("AddAudioEmbedding", {
    track_id: trackB,
    embedding: baseAudioEmbedding.map((v, i) => v + (i % 17 === 0 ? 0.0005 : 0)),
  });

  const audioNeighborsRaw = await client.query("FindAudioNeighbors", {
    embedding: baseAudioEmbedding,
    k: 5,
  });
  const audioNeighbors = unwrapNodes(audioNeighborsRaw);
  if (audioNeighbors.length === 0) {
    throw new Error("FindAudioNeighbors returned 0 results");
  }
  console.log(`Audio neighbors found: ${audioNeighbors.length}`);

  try {
    await client.query("AddSimilarEdge", {
      from_id: trackA,
      to_id: trackB,
      score: 0.91,
      basis: "audio",
      model_version: "smoke",
      updated_at: new Date().toISOString(),
      build_seq: buildSeq,
    });
    await client.query("AddSimilarEdge", {
      from_id: trackB,
      to_id: trackA,
      score: 0.91,
      basis: "audio",
      model_version: "smoke",
      updated_at: new Date().toISOString(),
      build_seq: buildSeq,
    });
  } catch (err) {
    console.warn("AddSimilarEdge write skipped in smoke test:", err);
  }

  const sceneRaw = await client.query("AddSceneDetailed", {
    stable_id: "scene-smoke",
    name: "Smoke Scene",
    build_id: "smoke-build",
    build_seq: buildSeq,
    centroid_x: 0.5,
    centroid_y: 0.5,
    color: "#f97316",
    track_count: 2,
    updated_at: new Date().toISOString(),
  });
  const sceneId = unwrapNodeId(sceneRaw);
  if (!sceneId) throw new Error("AddSceneDetailed did not return a scene ID");
  const adjacentSceneRaw = await client.query("AddSceneDetailed", {
    stable_id: "scene-smoke-b",
    name: "Smoke Scene B",
    build_id: "smoke-build",
    build_seq: buildSeq,
    centroid_x: 0.7,
    centroid_y: 0.6,
    color: "#22c55e",
    track_count: 0,
    updated_at: new Date().toISOString(),
  });
  const adjacentSceneId = unwrapNodeId(adjacentSceneRaw);
  if (!adjacentSceneId) throw new Error("Second AddSceneDetailed did not return a scene ID");

  await client.query("AddTrackToScene", {
    track_id: trackA,
    scene_id: sceneId,
    membership_score: 0.91,
    build_seq: buildSeq,
  });
  await client.query("AddTrackToScene", {
    track_id: trackB,
    scene_id: sceneId,
    membership_score: 0.67,
    build_seq: buildSeq,
  });

  try {
    await client.query("AddAdjacentEdge", {
      from_scene_id: sceneId,
      to_scene_id: adjacentSceneId,
      score: 0.5,
      basis: "audio",
      build_seq: buildSeq,
    });
    await client.query("AddAdjacentEdge", {
      from_scene_id: adjacentSceneId,
      to_scene_id: sceneId,
      score: 0.5,
      basis: "audio",
      build_seq: buildSeq,
    });
  } catch (err) {
    console.warn("AddAdjacentEdge write skipped in smoke test:", err);
  }

  await client.query("AddCollisionEdge", {
    from_id: trackA,
    to_id: trackB,
    score: 0.88,
    reasons: ["TIMBRE_CLOSE", "BPM_COMPATIBLE", "KEY_COMPATIBLE"],
    bpm_delta: 1,
    key_relation: "MATCH",
    build_seq: buildSeq,
  });
  await client.query("AddCollisionEdge", {
    from_id: trackB,
    to_id: trackA,
    score: 0.88,
    reasons: ["TIMBRE_CLOSE", "BPM_COMPATIBLE", "KEY_COMPATIBLE"],
    bpm_delta: 1,
    key_relation: "MATCH",
    build_seq: buildSeq,
  });
  await client.query("MarkAtlasBuildActive", {
    id: buildId,
  });

  await client.query("UpdateTrackStatus", {
    id: trackA,
    status: "READY",
  });
  await client.query("UpdateTrackStatus", {
    id: trackB,
    status: "READY",
  });

  const buildRead = unwrapNodeId(await client.query("GetActiveAtlasBuild", {}));
  if (!buildRead) {
    throw new Error("GetActiveAtlasBuild returned no active build");
  }
  const sceneRows = unwrapNodes(await client.query("GetScenesByBuildSeq", { build_seq: buildSeq }));
  if (sceneRows.length === 0) {
    throw new Error("GetScenesByBuildSeq returned 0 scenes");
  }
  const edgeRows = unwrapNodes(await client.query("GetSimilarEdgesByBuildSeq", { build_seq: buildSeq }));
  if (edgeRows.length === 0) {
    throw new Error("GetSimilarEdgesByBuildSeq returned 0 edges");
  }
  const membershipRows = unwrapRows(await client.query("GetSceneMembershipsByBuildSeq", { build_seq: buildSeq }));
  if (membershipRows.length < 2) {
    throw new Error("GetSceneMembershipsByBuildSeq returned too few memberships");
  }
  if (!membershipRows.every((row) => Number(row.build_seq) === buildSeq)) {
    throw new Error(`Scene memberships missing build_seq=${buildSeq}`);
  }
  if (!membershipRows.some((row) => Number(row.membership_score) < 1)) {
    throw new Error("Scene memberships missing non-default membership_score values");
  }
  const adjacentRows = unwrapNodes(await client.query("GetAdjacentEdgesByBuildSeq", { build_seq: buildSeq }));
  if (adjacentRows.length === 0) {
    throw new Error("GetAdjacentEdgesByBuildSeq returned 0 edges");
  }
  const collisionRows = unwrapRows(await client.query("GetCollisionEdgesByBuildSeq", { build_seq: buildSeq }));
  if (collisionRows.length === 0) {
    throw new Error("GetCollisionEdgesByBuildSeq returned 0 edges");
  }
  for (const row of collisionRows) {
    const reasons = Array.isArray(row.reasons)
      ? row.reasons
      : typeof row.reasons === "string"
        ? JSON.parse(row.reasons)
        : [];
    if (!Array.isArray(reasons) || reasons.some((reason) => !ALLOWED_COLLISION_REASONS.has(String(reason)))) {
      throw new Error(`Collision edge contained unexpected reasons: ${JSON.stringify(reasons)}`);
    }
  }
  const trackCollisionTracks = unwrapNodes(await client.query("GetTrackCollisionEdges", { track_id: trackA }));
  if (trackCollisionTracks.length === 0) {
    throw new Error("GetTrackCollisionEdges returned 0 rows");
  }

  console.log("\n=== All C2 smoke tests passed ===");
}

smokeTest().catch((err) => {
  console.error("\nSmoke test FAILED:", err);
  process.exit(1);
});
