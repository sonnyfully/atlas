import { parseFile } from "music-metadata";
import {
  updateTrackAnalysis,
  updateTrackError,
  addTrackEmbedding,
  addAudioEmbedding,
  findNeighbors,
  findAudioNeighbors,
  addSimilarEdge,
} from "@/lib/helix";
import {
  generateTextEmbedding,
  generateAudioEmbedding,
  buildMetadataText,
  TEXT_EMBEDDING_VERSION,
  AUDIO_EMBEDDING_VERSION,
} from "@atlas/shared/embeddings";

// ── Audio Analysis Pipeline ─────────────────────────────────
// Extracts metadata + features from an audio file, generates a
// metadata-based embedding vector, and writes everything to Helix.

const KNN_LIMIT = 10;
const TEXT_WEIGHT = 0.4;
const AUDIO_WEIGHT = 0.6;

// Try to detect BPM from ID3 tags or filename patterns
function extractBpmHint(
  tags: unknown,
  filename: string
): number {
  // Check common ID3 BPM fields
  const t = tags as any;
  const bpmTag = t?.bpm ?? t?.TBPM ?? t?.["TXXX:BPM"];
  if (bpmTag) {
    const parsed = parseFloat(String(bpmTag));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Try filename pattern: "Artist - Title [120BPM]" or "track_128bpm"
  const match = filename.match(/(\d{2,3})\s*bpm/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (parsed >= 60 && parsed <= 200) return parsed;
  }

  return 0;
}

// Try to detect key from ID3 tags or filename
function extractKeyHint(
  tags: unknown,
  filename: string
): string {
  const t = tags as any;
  const keyTag = t?.key ?? t?.TKEY ?? t?.initialKey ?? t?.["TXXX:KEY"];
  if (keyTag && typeof keyTag === "string") return keyTag;

  // Filename pattern: "Artist - Title [Am]" or "[Cmaj]"
  const match = filename.match(
    /\[([A-G][#b]?(?:m|min|maj)?)\]/i
  );
  if (match) return match[1];

  return "";
}

// Compute a rough energy proxy from available metadata.
// Falls back to a hash-based value if no tags exist.
function computeEnergyProxy(
  bpm: number,
  _durationSec: number,
  title: string
): number {
  if (bpm > 0) {
    // BPM-based heuristic: map 60-180 BPM to 0.2-0.9
    return Math.min(0.95, Math.max(0.1, (bpm - 60) / 150));
  }
  // Fallback: deterministic hash from title
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return 0.3 + ((hash & 0x7fff) / 0x7fff) * 0.5;
}

function rankScore(rank: number, k: number): number {
  return Math.max(0, 1 - rank / Math.max(1, k));
}

function mergeNeighborScores(
  trackId: string,
  textNeighbors: Array<{ id: string }>,
  audioNeighbors: Array<{ id: string }>
): Array<{
  id: string;
  score: number;
  basis: "text" | "audio" | "hybrid";
  modelVersion: string;
}> {
  const scoreByTrack = new Map<string, { text?: number; audio?: number }>();

  for (let i = 0; i < textNeighbors.length; i++) {
    const id = textNeighbors[i]?.id;
    if (!id || id === trackId) continue;
    const entry = scoreByTrack.get(id) ?? {};
    entry.text = Math.max(entry.text ?? 0, rankScore(i, KNN_LIMIT));
    scoreByTrack.set(id, entry);
  }

  for (let i = 0; i < audioNeighbors.length; i++) {
    const id = audioNeighbors[i]?.id;
    if (!id || id === trackId) continue;
    const entry = scoreByTrack.get(id) ?? {};
    entry.audio = Math.max(entry.audio ?? 0, rankScore(i, KNN_LIMIT));
    scoreByTrack.set(id, entry);
  }

  return Array.from(scoreByTrack.entries())
    .map(([id, scores]) => {
      const hasText = typeof scores.text === "number";
      const hasAudio = typeof scores.audio === "number";
      if (hasText && hasAudio) {
        return {
          id,
          score: (scores.text ?? 0) * TEXT_WEIGHT + (scores.audio ?? 0) * AUDIO_WEIGHT,
          basis: "hybrid" as const,
          modelVersion: `${TEXT_EMBEDDING_VERSION}+${AUDIO_EMBEDDING_VERSION}`,
        };
      }
      if (hasAudio) {
        return {
          id,
          score: scores.audio ?? 0,
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

export async function analyzeTrack(
  trackId: string,
  filepath: string,
  originalFilename: string
): Promise<void> {
  try {
    // 1. Parse audio metadata
    const metadata = await parseFile(filepath);

    const durationSec = metadata.format.duration ?? 0;
    const title =
      metadata.common.title ?? originalFilename.replace(/\.[^.]+$/, "");
    const artist = metadata.common.artist ?? "Unknown";

    // 2. Extract / estimate features
    const bpm = extractBpmHint(
      metadata.native?.["ID3v2.3"]?.[0] ?? {},
      originalFilename
    );
    const key = extractKeyHint(
      metadata.native?.["ID3v2.3"]?.[0] ?? {},
      originalFilename
    );
    const energy = computeEnergyProxy(bpm, durationSec, title);

    // 3. Update track analysis in Helix
    await updateTrackAnalysis({
      id: trackId,
      duration_sec: durationSec,
      bpm,
      key,
      energy,
      status: "PROCESSING",
    });

    // 4. Generate real text embedding and store it
    const metadataText = buildMetadataText(title, artist, key, bpm, energy);
    const textEmbedding = await generateTextEmbedding(metadataText);
    await addTrackEmbedding(trackId, textEmbedding);
    const textNeighbors = await findNeighbors(textEmbedding, KNN_LIMIT);

    let audioNeighbors: Array<{ id: string }> = [];
    try {
      const audioEmbedding = await generateAudioEmbedding(filepath);
      await addAudioEmbedding(trackId, audioEmbedding);
      audioNeighbors = await findAudioNeighbors(audioEmbedding, KNN_LIMIT);
    } catch (audioErr) {
      console.warn(`Audio embedding failed for ${trackId}; continuing with text-only similarity`, audioErr);
    }

    const merged = mergeNeighborScores(
      trackId,
      textNeighbors as Array<{ id: string }>,
      audioNeighbors
    );

    for (const neighbor of merged) {
      if (!neighbor.id) continue;
      await addSimilarEdge({
        from_id: trackId,
        to_id: neighbor.id,
        score: neighbor.score,
        basis: neighbor.basis,
        model_version: neighbor.modelVersion,
      });
    }

    // 5. Mark as READY
    await updateTrackAnalysis({
      id: trackId,
      duration_sec: durationSec,
      bpm,
      key,
      energy,
      status: "READY",
    });
  } catch (err) {
    console.error(`Analysis failed for track ${trackId}:`, err);
    const message =
      err instanceof Error ? err.message : "Unknown analysis error";
    await updateTrackError(trackId, message);
  }
}
