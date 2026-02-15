import { HelixDB } from "helix-ts";
import { HELIX_URL } from "@atlas/shared";
import type { Track } from "@atlas/shared";

let _client: HelixDB | null = null;
const HELIX_TIMEOUT_MS = 5000;
let _lastHelixWarningAt = 0;

function getClient(): HelixDB {
  if (!_client) {
    _client = new HelixDB(HELIX_URL);
  }
  return _client;
}

// ── MCP traversal helper ────────────────────────────────────
// The helix-ts SDK `client.query()` works for named queries (AddTrack, GetTrack, etc.)
// but MCP traversal endpoints (mcp/init, mcp/n_from_type, mcp/collect, mcp/filter_items)
// require a { connection_id, data: {...} } envelope, so we call them via fetch.

async function mcpPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${HELIX_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HELIX_TIMEOUT_MS),
        cache: "no-store",
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Helix MCP ${endpoint} failed (${res.status}): ${text.slice(0, 200)}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        return text.replace(/"/g, "");
      }
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : "Unknown Helix MCP error";
  throw new Error(`Helix MCP request failed for ${endpoint}: ${message}`);
}

function normalizeTracks(rows: unknown[]): Track[] {
  return rows.filter((t: any) => t && t.id && t.status) as unknown as Track[];
}

function sortTracks(
  tracks: Track[],
  sort: "recent" | "alpha"
): Track[] {
  const copy = [...tracks];
  if (sort === "alpha") {
    copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else {
    copy.sort((a, b) => (b.upload_date || "").localeCompare(a.upload_date || ""));
  }
  return copy;
}

function reportHelixUnavailable(context: string, err: unknown): void {
  const now = Date.now();
  if (now - _lastHelixWarningAt < 30000) return;
  _lastHelixWarningAt = now;
  const reason = err instanceof Error ? err.message : String(err);
  console.warn(
    `[helix] ${context}: Helix unavailable at ${HELIX_URL}. Returning fallback data. Reason: ${reason}`
  );
}

// ── Query helpers ──────────────────────────────────────────────

// Helix named queries return results wrapped in the RETURN variable name,
// e.g. { track: { ... } } or { updated: { ... } }.
function unwrap(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const obj = result as Record<string, unknown>;

  if ("id" in obj && "label" in obj) return obj;

  const keys = Object.keys(obj);
  if (keys.length === 1) {
    const inner = obj[keys[0]];
    if (inner && typeof inner === "object" && "id" in (inner as object)) {
      return inner as Record<string, unknown>;
    }
  }

  if (Array.isArray(result) && result.length > 0) {
    return unwrap(result[0]);
  }

  return obj;
}

function unwrapList(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object"
    );
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        return value.filter(
          (item): item is Record<string, unknown> =>
            !!item && typeof item === "object"
        );
      }
    }
  }
  return [];
}

export async function getTrack(id: string): Promise<Track | null> {
  const client = getClient();
  try {
    const result = await client.query("GetTrack", { id });
    const row = unwrap(result);
    if (!row || !row.id) return null;
    return row as unknown as Track;
  } catch {
    return null;
  }
}

export async function isHelixAvailable(): Promise<boolean> {
  try {
    await mcpPost("mcp/init", {});
    return true;
  } catch {
    return false;
  }
}

export async function getRecentTracks(): Promise<Track[]> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;

    await mcpPost("mcp/n_from_type", {
      connection_id: connId,
      data: { node_type: "Track" },
    });

    const collected = await mcpPost("mcp/collect", {
      connection_id: connId,
      data: {},
    });

    const tracks = Array.isArray(collected) ? collected : [];
    return sortTracks(normalizeTracks(tracks), "recent");
  } catch (err) {
    reportHelixUnavailable("getRecentTracks", err);
    return [];
  }
}

export async function addTrack(params: {
  title: string;
  artist: string;
  filepath: string;
  original_filename: string;
  file_hash: string;
  status: string;
  upload_date: string;
}): Promise<string> {
  const client = getClient();
  const result = await client.query("AddTrack", params);
  const row = unwrap(result);
  return (row as any)?.id ?? "";
}

export async function updateTrackAnalysis(params: {
  id: string;
  duration_sec: number;
  bpm: number;
  key: string;
  energy: number;
  status: string;
}): Promise<void> {
  const client = getClient();
  await client.query("UpdateTrackAnalysis", params);
}

export async function updateTrackStatus(
  id: string,
  status: string
): Promise<void> {
  const client = getClient();
  await client.query("UpdateTrackStatus", { id, status });
}

export async function updateTrackError(
  id: string,
  error: string
): Promise<void> {
  const client = getClient();
  await client.query("UpdateTrackError", { id, error });
}

export async function addTrackEmbedding(
  trackId: string,
  embedding: number[]
): Promise<void> {
  const client = getClient();
  await client.query("AddTrackEmbedding", {
    track_id: trackId,
    embedding,
  });
}

export async function findNeighbors(
  embedding: number[],
  k: number
): Promise<Track[]> {
  const client = getClient();
  const result = await client.query("FindNeighbors", { embedding, k });
  return unwrapList(result) as unknown as Track[];
}

export async function addAudioEmbedding(
  trackId: string,
  embedding: number[]
): Promise<void> {
  const client = getClient();
  await client.query("AddAudioEmbedding", {
    track_id: trackId,
    embedding,
  });
}

export async function findAudioNeighbors(
  embedding: number[],
  k: number
): Promise<Track[]> {
  const client = getClient();
  const result = await client.query("FindAudioNeighbors", { embedding, k });
  return unwrapList(result) as unknown as Track[];
}

export async function searchTracks(query: string, limit = 20): Promise<Track[]> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;
    await mcpPost("mcp/search_keyword", {
      connection_id: connId,
      data: { query, label: "Track", limit },
    });
    const collected = await mcpPost("mcp/collect", {
      connection_id: connId,
      data: {},
    });
    const tracks = Array.isArray(collected) ? collected : [];
    return normalizeTracks(tracks);
  } catch (err) {
    reportHelixUnavailable("searchTracks", err);
    return [];
  }
}

export async function getAllTracks(
  sort: "recent" | "alpha" = "recent",
  offset = 0,
  limit = 25
): Promise<Track[]> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;

    await mcpPost("mcp/n_from_type", {
      connection_id: connId,
      data: { node_type: "Track" },
    });

    if (sort === "recent") {
      await mcpPost("mcp/order_by", {
        connection_id: connId,
        data: { properties: "upload_date", order: "desc" },
      });
    } else {
      await mcpPost("mcp/order_by", {
        connection_id: connId,
        data: { properties: "title", order: "asc" },
      });
    }

    const collected = await mcpPost("mcp/collect", {
      connection_id: connId,
      data: {
        range: { start: offset, end: offset + limit },
      },
    });

    const tracks = Array.isArray(collected) ? collected : [];
    return normalizeTracks(tracks);
  } catch (err) {
    reportHelixUnavailable("getAllTracks", err);
    const fallback = await getRecentTracks();
    const sorted = sortTracks(fallback, sort);
    return sorted.slice(offset, offset + limit);
  }
}

export async function findTrackByHash(
  hash: string
): Promise<Track | null> {
  try {
    const connId = (await mcpPost("mcp/init", {})) as string;

    await mcpPost("mcp/n_from_type", {
      connection_id: connId,
      data: { node_type: "Track" },
    });

    await mcpPost("mcp/filter_items", {
      connection_id: connId,
      data: {
        properties: [{ key: "file_hash", operation: "==", value: hash }],
      },
    });

    const collected = await mcpPost("mcp/collect", {
      connection_id: connId,
      data: {},
    });

    const tracks = Array.isArray(collected) ? collected : [];
    const match = tracks.find(
      (t: any) => t && t.id && typeof t.file_hash === "string" && t.file_hash === hash
    );
    return match ? (match as unknown as Track) : null;
  } catch {
    return null;
  }
}

export async function addSimilarEdge(params: {
  from_id: string;
  to_id: string;
  score: number;
  basis: string;
  model_version: string;
}): Promise<void> {
  const client = getClient();
  await client.query("AddSimilarEdge", params);
}


export async function getSimilarTracks(trackId: string): Promise<Track[]> {
  const client = getClient();
  try {
    const result = await client.query("GetSimilarTracks", { id: trackId });
    return unwrapList(result) as unknown as Track[];
  } catch {
    return [];
  }
}
