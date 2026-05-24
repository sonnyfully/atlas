import { HelixDB } from "helix-ts";
import { access } from "fs/promises";
import {
  generateAudioEmbedding,
  AUDIO_EMBEDDING_VERSION,
} from "../packages/shared/embeddings";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";
const KNN_LIMIT = 10;

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

async function mcpFilterItems(
  connectionId: string,
  propertyFilters: Array<{
    key: string;
    operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
    value: string | number | boolean | Array<string | number | boolean>;
  }>
): Promise<void> {
  await mcpPost("mcp/filter_items", {
    connection_id: connectionId,
    data: {
      filter: {
        properties: [propertyFilters],
      },
    },
  });
}

async function mcpCollect(
  connectionId: string,
  options?: {
    range?: { start: number; end: number };
    drop?: boolean;
  }
): Promise<unknown> {
  return mcpPost("mcp/collect", {
    connection_id: connectionId,
    ...(options?.range ? { range: options.range } : {}),
    ...(typeof options?.drop === "boolean" ? { drop: options.drop } : {}),
  });
}

async function getAllReadyTracks(): Promise<TrackNode[]> {
  const connId = (await mcpPost("mcp/init", {})) as string;
  await mcpPost("mcp/n_from_type", {
    connection_id: connId,
    data: { node_type: "Track" },
  });
  await mcpFilterItems(connId, [{ key: "status", operator: "==", value: "READY" }]);
  const rows = await mcpCollect(connId);
  return unwrapNodeArray(rows);
}

async function hasAudioEdge(trackId: string): Promise<boolean> {
  const connId = (await mcpPost("mcp/init", {})) as string;
  await mcpPost("mcp/n_from_id", {
    connection_id: connId,
    data: { id: trackId },
  });
  await mcpPost("mcp/out_step", {
    connection_id: connId,
    data: { edge_type: "HAS_AUDIO_EMBEDDING" },
  });
  const rows = await mcpCollect(connId, {
    range: { start: 0, end: 1 },
  });
  return unwrapNodeArray(rows).length > 0;
}

function buildAudioNeighborScores(
  sourceTrackId: string,
  audioNeighbors: Array<{ id: string }>
): Array<{ id: string; score: number; basis: "audio"; modelVersion: string }> {
  const byId = new Map<string, number>();

  for (let i = 0; i < audioNeighbors.length; i++) {
    const id = audioNeighbors[i]?.id;
    if (!id || id === sourceTrackId) continue;
    byId.set(id, Math.max(byId.get(id) ?? 0, rankScore(i, KNN_LIMIT)));
  }

  return Array.from(byId.entries())
    .map(([id, score]) => ({
      id,
      score,
      basis: "audio" as const,
      modelVersion: AUDIO_EMBEDDING_VERSION,
    }))
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

    const alreadyHasAudio = await hasAudioEdge(track.id);
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

      const audioNeighborsRaw = await client.query("FindAudioNeighbors", {
        embedding: audioEmbedding,
        k: KNN_LIMIT,
      });
      const merged = buildAudioNeighborScores(track.id, unwrapNodeArray(audioNeighborsRaw));

      for (const neighbor of merged) {
        try {
          await client.query("AddSimilarEdge", {
            from_id: track.id,
            to_id: neighbor.id,
            score: neighbor.score,
            basis: "audio",
            model_version: "backfill-audio",
            updated_at: new Date().toISOString(),
            build_seq: 0,
          });
        } catch (err) {
          console.warn(`- Skipped similarity edge ${track.id} -> ${neighbor.id}:`, err);
        }
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
