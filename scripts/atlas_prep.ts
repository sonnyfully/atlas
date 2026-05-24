import { readFile, readdir, stat } from "fs/promises";
import { basename, extname, resolve } from "path";

const BASE_URL = process.env.ATLAS_BASE_URL ?? "http://localhost:3000";
const DEFAULT_INPUTS = [resolve(process.cwd(), "data/seed_audio")];
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".mp4", ".aac", ".flac", ".ogg"]);
const MAX_WAIT_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

type TrackListRow = {
  id: string;
  status?: string;
  upload_date?: string;
};

type TrackDnaStatus = {
  id?: string;
  status?: string;
  placement_summary?: string;
  scene_home?: { scene?: { id?: string; name?: string } } | null;
  build?: { build_seq?: number } | null;
};

type SceneListResponse = {
  build?: { build_seq?: number; ready_track_count?: number; scene_count?: number } | null;
  scenes?: Array<{ id: string; name: string }>;
};

type AtlasMapResponse = {
  world?: { version_hash?: string };
  tracks?: unknown[];
  scenes?: unknown[];
  scene_graph_edges?: unknown[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function isAudioFile(path: string): boolean {
  return AUDIO_EXTENSIONS.has(extname(path).toLowerCase());
}

async function collectAudioFiles(entryPath: string): Promise<string[]> {
  const info = await stat(entryPath);
  if (info.isFile()) {
    return isAudioFile(entryPath) ? [entryPath] : [];
  }

  if (!info.isDirectory()) return [];

  const entries = await readdir(entryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => collectAudioFiles(resolve(entryPath, entry.name)))
  );
  return nested.flat();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function uploadFile(filePath: string): Promise<{ id: string; duplicate: boolean; status: string }> {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([bytes]), basename(filePath));

  return fetchJson<{ id: string; duplicate: boolean; status: string }>(`${BASE_URL}/api/ingest`, {
    method: "POST",
    body: form,
  });
}

async function waitForTrackReady(trackId: string): Promise<TrackDnaStatus> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const track = await fetchJson<TrackDnaStatus>(`${BASE_URL}/api/tracks/${trackId}`);
    const status = String(track.status ?? "");
    if (status === "READY" || status === "ERROR") {
      return track;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for track ${trackId} to finish analysis`);
}

async function triggerRebuild(): Promise<void> {
  await fetchJson(`${BASE_URL}/api/atlas/map?v=1&rebuild=1`);
}

function formatInputs(rawInputs: string[]): string {
  if (rawInputs.length === 0) return "(none)";
  return rawInputs.join(", ");
}

async function main(): Promise<void> {
  const rawInputs = process.argv.slice(2);
  const inputs = (rawInputs.length > 0 ? rawInputs : DEFAULT_INPUTS).map((entry) => resolve(entry));
  const collected = await Promise.all(inputs.map((entry) => collectAudioFiles(entry).catch(() => [])));
  const files = Array.from(new Set(collected.flat())).sort((a, b) => a.localeCompare(b));

  console.log("=== Atlas Prep ===");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Inputs: ${formatInputs(inputs)}`);
  console.log(`Audio files discovered: ${files.length}`);

  if (files.length === 0) {
    console.log("No seed audio files found. Rebuilding from the existing library only.");
  }

  const uploadedIds: string[] = [];
  for (const filePath of files) {
    const result = await uploadFile(filePath);
    uploadedIds.push(result.id);
    console.log(
      `${result.duplicate ? "Reused" : "Uploaded"} ${basename(filePath)} -> ${result.id} (${result.status})`
    );
  }

  const settled = new Map<string, TrackDnaStatus>();
  for (const trackId of new Set(uploadedIds)) {
    const track = await waitForTrackReady(trackId);
    settled.set(trackId, track);
    console.log(`Track ${trackId} -> ${track.status}`);
  }

  const failed = Array.from(settled.values()).filter((track) => track.status === "ERROR");
  if (failed.length > 0) {
    throw new Error(`Atlas prep stopped because ${failed.length} uploaded track(s) failed analysis`);
  }

  console.log("Triggering canonical rebuild...");
  await triggerRebuild();

  const [tracks, scenes, map] = await Promise.all([
    fetchJson<TrackListRow[]>(`${BASE_URL}/api/tracks`),
    fetchJson<SceneListResponse>(`${BASE_URL}/api/scenes`),
    fetchJson<AtlasMapResponse>(`${BASE_URL}/api/atlas/map?v=1`),
  ]);

  const latestReadyTrack = tracks.find((track) => track.status === "READY");
  const readyCount = tracks.filter((track) => track.status === "READY").length;
  const buildSeq = scenes.build?.build_seq ?? "none";
  const sceneCount = scenes.scenes?.length ?? 0;
  const mapSceneCount = map.scenes?.length ?? 0;
  const mapEdgeCount = map.scene_graph_edges?.length ?? 0;

  console.log("");
  console.log("=== Atlas Ready Summary ===");
  console.log(`Build: #${buildSeq}`);
  console.log(`READY tracks: ${readyCount}`);
  console.log(`Scenes: ${sceneCount}`);
  console.log(`Map scenes: ${mapSceneCount}`);
  console.log(`Map scene edges: ${mapEdgeCount}`);
  console.log(`World version: ${map.world?.version_hash ?? "unknown"}`);
  if (files.length > 0 && files.length < 3 && readyCount < 3) {
    console.log("Warning: fewer than 3 READY tracks are available, so scene/map storytelling will stay sparse.");
  }
  console.log("");
  console.log("Suggested URLs:");
  console.log(`- Home: ${BASE_URL}/`);
  console.log(`- Upload: ${BASE_URL}/upload`);
  if (latestReadyTrack?.id) {
    console.log(`- Latest DNA: ${BASE_URL}/track/${latestReadyTrack.id}`);
  }
  console.log(`- Scenes: ${BASE_URL}/scenes`);
  console.log(`- Map: ${BASE_URL}/map`);
}

main().catch((error) => {
  console.error("Atlas prep failed:", error);
  process.exit(1);
});
