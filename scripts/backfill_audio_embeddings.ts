import { HelixDB } from "helix-ts";
import { access } from "fs/promises";
import {
  generateAudioEmbedding,
  TEXT_EMBEDDING_VERSION,
  AUDIO_EMBEDDING_VERSION,
} from "../packages/shared/embeddings";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";
const KNN_LIMIT = 10;
const TEXT_WEIGHT = 0.4;
const AUDIO_WEIGHT = 0.6;
const MODEL_VERSION_HYBRID = `${TEXT_EMBEDDING_VERSION}+${AUDIO_EMBEDDING_VERSION}`;

type TrackNode = {
  id: string;
  title?: string;
  filepath?: string;
  status?: string;
};

function rankScore(rank: number, k: number): number {
  return Math.max(0, 1 - rank / Math.max(1, k));
}

function unwrapNodeArray(result: unknown): TrackNode[] {
  if (Array.isArray(result)) {
    return result.filter((node): node is TrackNode => {
      return !!node && typeof node === "object" && typeof (node as TrackNode).id === "string";
    });
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        return value.filter((node): node is TrackNode => {
          return !!node && typeof node === "object" && typeof (node as TrackNode).id === "string";
        });
      }
    }
  }
  return [];
}

function extractEmbedding(result: unknown): number[] | null {
  const nodes = unwrapNodeArray(result);
  for (const node of nodes as Array<TrackNode & { embedding?: unknown }>) {
    if (Array.isArray(node.embedding)) {
      return node.embedding.filter((n): n is number => typeof n === "number");
    }
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object" && Array.isArray((value as { embedding?: unknown }).embedding)) {
        const embedding = (value as { embedding: unknown[] }).embedding;
        return embedding.filter((n): n is number => typeof n === "number");
      }
    }
  }
  return null;
}

async function mcpPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${HELIX_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text.replace(/"/g, "");
  }
}

async function getAllReadyTracks(): Promise<TrackNode[]> {
  const connId = (await mcpPost("mcp/init", {})) as string;
  await mcpPost("mcp/n_from_type", {
    connection_id: connId,
    data: { node_type: "Track" },
  });
  await mcpPost("mcp/filter_items", {
    connection_id: connId,
    data: {
      properties: [{ key: "status", operation: "==", value: "READY" }],
    },
  });
  const rows = await mcpPost("mcp/collect", {
    connection_id: connId,
    data: {},
  });
  return unwrapNodeArray(rows);
}

async function hasEdge(trackId: string, edgeType: "HAS_EMBEDDING" | "HAS_AUDIO_EMBEDDING"): Promise<boolean> {
  const connId = (await mcpPost("mcp/init", {})) as string;
  await mcpPost("mcp/n_from_id", {
    connection_id: connId,
    data: { id: trackId },
  });
  await mcpPost("mcp/out_step", {
    connection_id: connId,
    data: { edge_type: edgeType },
  });
  const rows = await mcpPost("mcp/collect", {
    connection_id: connId,
    data: { range: { start: 0, end: 1 } },
  });
  return unwrapNodeArray(rows).length > 0;
}

function mergeNeighborScores(
  sourceTrackId: string,
  textNeighbors: Array<{ id: string }>,
  audioNeighbors: Array<{ id: string }>
): Array<{ id: string; score: number; basis: "text" | "audio" | "hybrid"; modelVersion: string }> {
  const byId = new Map<string, { text?: number; audio?: number }>();

  for (let i = 0; i < textNeighbors.length; i++) {
    const id = textNeighbors[i]?.id;
    if (!id || id === sourceTrackId) continue;
    const entry = byId.get(id) ?? {};
    entry.text = Math.max(entry.text ?? 0, rankScore(i, KNN_LIMIT));
    byId.set(id, entry);
  }

  for (let i = 0; i < audioNeighbors.length; i++) {
    const id = audioNeighbors[i]?.id;
    if (!id || id === sourceTrackId) continue;
    const entry = byId.get(id) ?? {};
    entry.audio = Math.max(entry.audio ?? 0, rankScore(i, KNN_LIMIT));
    byId.set(id, entry);
  }

  return Array.from(byId.entries())
    .map(([id, scores]) => {
      if (typeof scores.text === "number" && typeof scores.audio === "number") {
        return {
          id,
          score: scores.text * TEXT_WEIGHT + scores.audio * AUDIO_WEIGHT,
          basis: "hybrid" as const,
          modelVersion: MODEL_VERSION_HYBRID,
        };
      }
      if (typeof scores.audio === "number") {
        return {
          id,
          score: scores.audio,
          basis: "audio" as const,
          modelVersion: AUDIO_EMBEDDING_VERSION,
        };
      }
      return {
        id,
        score: scores.text ?? 0,
        basis: "text" as const,
        modelVersion: TEXT_EMBEDDING_VERSION,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, KNN_LIMIT);
}

async function main() {
  const client = new HelixDB(HELIX_URL);
  console.log(`Backfilling audio embeddings via ${HELIX_URL}...\n`);

  const tracks = await getAllReadyTracks();
  console.log(`Found ${tracks.length} READY tracks`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let edgesCreated = 0;

  for (const track of tracks) {
    const title = track.title ?? track.id;
    if (!track.filepath) {
      console.log(`- Skip ${title}: missing filepath`);
      skipped++;
      continue;
    }

    const hasText = await hasEdge(track.id, "HAS_EMBEDDING");
    if (!hasText) {
      console.log(`- Skip ${title}: no text embedding`);
      skipped++;
      continue;
    }

    const alreadyHasAudio = await hasEdge(track.id, "HAS_AUDIO_EMBEDDING");
    if (alreadyHasAudio) {
      console.log(`- Skip ${title}: audio embedding already exists`);
      skipped++;
      continue;
    }

    try {
      await access(track.filepath);
      const audioEmbedding = await generateAudioEmbedding(track.filepath);
      await client.query("AddAudioEmbedding", {
        track_id: track.id,
        embedding: audioEmbedding,
      });

      const textVectorResult = await client.query("GetTrackEmbedding", { track_id: track.id });
      const textEmbedding = extractEmbedding(textVectorResult);
      if (!textEmbedding || textEmbedding.length === 0) {
        console.log(`- Skip ${title}: text vector content missing`);
        skipped++;
        continue;
      }

      const textNeighborsRaw = await client.query("FindNeighbors", {
        embedding: textEmbedding,
        k: KNN_LIMIT,
      });
      const audioNeighborsRaw = await client.query("FindAudioNeighbors", {
        embedding: audioEmbedding,
        k: KNN_LIMIT,
      });
      const merged = mergeNeighborScores(
        track.id,
        unwrapNodeArray(textNeighborsRaw),
        unwrapNodeArray(audioNeighborsRaw)
      );

      for (const neighbor of merged) {
        await client.query("AddSimilarEdge", {
          from_id: track.id,
          to_id: neighbor.id,
          score: neighbor.score,
          basis: neighbor.basis,
          model_version: neighbor.modelVersion,
        });
      }

      processed++;
      edgesCreated += merged.length;
      console.log(`- Processed ${title}: audio embedded, ${merged.length} similarity edges`);
    } catch (err) {
      failed++;
      console.error(`- Failed ${title}:`, err);
    }
  }

  console.log("\nBackfill summary:");
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Edges:     ${edgesCreated}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
