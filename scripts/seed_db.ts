import { HelixDB } from "helix-ts";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  generateTextEmbedding,
  generateAudioEmbedding,
  buildMetadataText,
  TEXT_EMBEDDING_VERSION,
  AUDIO_EMBEDDING_VERSION,
} from "../packages/shared/embeddings";

const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";
const KNN_LIMIT = 10;
const TEXT_WEIGHT = 0.4;
const AUDIO_WEIGHT = 0.6;
const MODEL_VERSION_HYBRID = `${TEXT_EMBEDDING_VERSION}+${AUDIO_EMBEDDING_VERSION}`;

type SeedTrack = {
  title: string;
  artist: string;
  bpm: number;
  key: string;
  energy: number;
  durationSec: number;
  toneHz: number;
};

const tracks: SeedTrack[] = [
  {
    title: "Midnight Drive",
    artist: "Neon Pulse",
    bpm: 124,
    key: "Am",
    energy: 0.66,
    durationSec: 242,
    toneHz: 220,
  },
  {
    title: "Deep Current",
    artist: "Submarina",
    bpm: 126,
    key: "Cm",
    energy: 0.71,
    durationSec: 228,
    toneHz: 196,
  },
  {
    title: "Rust Belt",
    artist: "Analog Choir",
    bpm: 108,
    key: "Em",
    energy: 0.44,
    durationSec: 255,
    toneHz: 164,
  },
  {
    title: "Solar Flare",
    artist: "Heliosphere",
    bpm: 132,
    key: "Gm",
    energy: 0.83,
    durationSec: 236,
    toneHz: 262,
  },
  {
    title: "Ghost Frequency",
    artist: "Neon Pulse",
    bpm: 121,
    key: "Dm",
    energy: 0.62,
    durationSec: 247,
    toneHz: 208,
  },
];

function makeSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function rankScore(rank: number, k: number): number {
  return Math.max(0, 1 - rank / Math.max(1, k));
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

async function writeSineWaveWav(
  filepath: string,
  options: { sampleRate: number; durationSeconds: number; frequencyHz: number }
): Promise<void> {
  const { sampleRate, durationSeconds, frequencyHz } = options;
  const numChannels = 1;
  const bitsPerSample = 16;
  const samples = Math.floor(sampleRate * durationSeconds);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const amplitude = 0.2;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude;
    const pcm = Math.max(-1, Math.min(1, value));
    buffer.writeInt16LE(Math.round(pcm * 32767), 44 + i * 2);
  }

  await writeFile(filepath, buffer);
}

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

function unwrapNeighbors(result: unknown): Array<{ id: string }> {
  if (Array.isArray(result)) {
    return result.filter((item): item is { id: string } => {
      return !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string";
    });
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        return value.filter((item): item is { id: string } => {
          return !!item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string";
        });
      }
    }
  }
  return [];
}

async function seed() {
  const client = new HelixDB(HELIX_URL);

  console.log("Seeding Atlas DB...\n");

  const audioDir = join(process.cwd(), "data", "seed_audio");
  await mkdir(audioDir, { recursive: true });

  const trackIds: string[] = [];
  const textEmbeddings = new Map<string, number[]>();
  const audioEmbeddings = new Map<string, number[]>();

  for (const track of tracks) {
    const slug = makeSlug(track.title);
    const filename = `${slug}.wav`;
    const filepath = join(audioDir, filename);

    await writeSineWaveWav(filepath, {
      sampleRate: 16000,
      durationSeconds: 4,
      frequencyHz: track.toneHz,
    });

    const created = await client.query("AddTrack", {
      title: track.title,
      artist: track.artist,
      filepath,
      original_filename: filename,
      file_hash: `seed_${slug}`,
      status: "PROCESSING",
      upload_date: new Date().toISOString(),
    });

    const trackId = unwrapNodeId(created);
    if (!trackId) {
      throw new Error(`Failed to create track ${track.title}`);
    }
    trackIds.push(trackId);
    console.log(`  Added track: "${track.title}" -> ${trackId}`);

    await client.query("UpdateTrackAnalysis", {
      id: trackId,
      duration_sec: track.durationSec,
      bpm: track.bpm,
      key: track.key,
      energy: track.energy,
      status: "PROCESSING",
    });

    const metadataText = buildMetadataText(
      track.title,
      track.artist,
      track.key,
      track.bpm,
      track.energy
    );
    const textEmbedding = await generateTextEmbedding(metadataText);
    await client.query("AddTrackEmbedding", {
      track_id: trackId,
      embedding: textEmbedding,
    });
    textEmbeddings.set(trackId, textEmbedding);

    const audioEmbedding = await generateAudioEmbedding(filepath);
    await client.query("AddAudioEmbedding", {
      track_id: trackId,
      embedding: audioEmbedding,
    });
    audioEmbeddings.set(trackId, audioEmbedding);

    await client.query("UpdateTrackStatus", {
      id: trackId,
      status: "READY",
    });
    console.log(`  Embedded text+audio for "${track.title}"`);
  }

  console.log("\nComputing hybrid similarities...");
  for (const trackId of trackIds) {
    const textEmbedding = textEmbeddings.get(trackId);
    const audioEmbedding = audioEmbeddings.get(trackId);
    if (!textEmbedding || !audioEmbedding) continue;

    const textNeighborsRaw = await client.query("FindNeighbors", {
      embedding: textEmbedding,
      k: KNN_LIMIT,
    });
    const audioNeighborsRaw = await client.query("FindAudioNeighbors", {
      embedding: audioEmbedding,
      k: KNN_LIMIT,
    });

    const merged = mergeNeighborScores(
      trackId,
      unwrapNeighbors(textNeighborsRaw),
      unwrapNeighbors(audioNeighborsRaw)
    );

    for (const neighbor of merged) {
      await client.query("AddSimilarEdge", {
        from_id: trackId,
        to_id: neighbor.id,
        score: neighbor.score,
        basis: neighbor.basis,
        model_version: neighbor.modelVersion,
      });
    }
    console.log(`  Added ${merged.length} hybrid edges for ${trackId}`);
  }

  const scene = await client.query("AddScene", { name: "Late Night Electronics" });
  const sceneId = unwrapNodeId(scene);
  console.log(`\n  Added scene: "Late Night Electronics" -> ${sceneId}`);

  console.log("\nSeeding complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
