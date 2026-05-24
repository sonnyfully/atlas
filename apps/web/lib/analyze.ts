import { parseFile, type IAudioMetadata } from "music-metadata";
import {
  updateTrackAnalysis,
  updateTrackError,
  addAudioEmbedding,
  findAudioNeighbors,
} from "@/lib/helix";
import {
  ANALYSIS_VERSION,
  buildFallbackAudioFeatures,
  estimateAudioFeatures,
  normalizeMusicalKey,
} from "@/lib/audio-analysis";
import {
  decodeAudioFile,
  generateAudioEmbeddingWithDetails,
} from "@atlas/shared/embeddings";
import { scheduleAtlasRefresh } from "@/lib/atlas-refresh";

const KNN_LIMIT = 10;

export interface NumericHint {
  value: number;
  confidence: number;
}

export interface StringHint {
  value: string;
  confidence: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function validBpm(value: number): number {
  return Number.isFinite(value) && value >= 60 && value <= 200 ? value : 0;
}

function parseNumeric(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function findNativeTag(metadata: IAudioMetadata, names: string[]): unknown {
  for (const tagList of Object.values(metadata.native ?? {})) {
    if (!Array.isArray(tagList)) continue;
    for (const item of tagList) {
      const id = typeof item?.id === "string" ? item.id : "";
      if (names.some((name) => name.toLowerCase() === id.toLowerCase())) {
        return item?.value;
      }
    }
  }
  return undefined;
}

export function extractBpmHint(metadata: IAudioMetadata, filename: string): NumericHint {
  const commonTags = metadata.common as unknown as Record<string, unknown>;
  const commonBpm = validBpm(parseNumeric(commonTags?.bpm));
  if (commonBpm > 0) {
    return { value: commonBpm, confidence: 0.92 };
  }

  const nativeBpm = validBpm(
    parseNumeric(findNativeTag(metadata, ["TBPM", "TXXX:BPM", "bpm", "TEMPO"]))
  );
  if (nativeBpm > 0) {
    return { value: nativeBpm, confidence: 0.86 };
  }

  const match = filename.match(/(\d{2,3})\s*bpm/i);
  if (match) {
    const parsed = validBpm(Number.parseInt(match[1]!, 10));
    if (parsed > 0) return { value: parsed, confidence: 0.55 };
  }

  return { value: 0, confidence: 0 };
}

export function extractKeyHint(metadata: IAudioMetadata, filename: string): StringHint {
  const commonTags = metadata.common as unknown as Record<string, unknown>;
  const commonKey = normalizeMusicalKey(
    parseString(commonTags?.initialKey) || parseString(commonTags?.key)
  );
  if (commonKey) {
    return { value: commonKey, confidence: 0.9 };
  }

  const nativeKey = normalizeMusicalKey(
    parseString(findNativeTag(metadata, ["TKEY", "TXXX:KEY", "initialKey", "key"]))
  );
  if (nativeKey) {
    return { value: nativeKey, confidence: 0.84 };
  }

  const match = filename.match(/\[([A-G][#b]?(?:m|min|maj|minor|major)?)\]/i);
  if (match) {
    const parsed = normalizeMusicalKey(match[1] ?? "");
    if (parsed) return { value: parsed, confidence: 0.5 };
  }

  return { value: "", confidence: 0 };
}

export function chooseBpm(metadataHint: NumericHint, audioHint: NumericHint): NumericHint {
  if (metadataHint.value > 0 && metadataHint.confidence >= 0.8) return metadataHint;
  if (audioHint.value > 0 && audioHint.confidence >= metadataHint.confidence) return audioHint;
  if (metadataHint.value > 0) return metadataHint;
  return audioHint;
}

export function chooseKey(metadataHint: StringHint, audioHint: StringHint): StringHint {
  if (metadataHint.value && metadataHint.confidence >= 0.8) return metadataHint;
  if (audioHint.value && audioHint.confidence >= metadataHint.confidence) return audioHint;
  if (metadataHint.value) return metadataHint;
  return audioHint;
}

export function fallbackEnergy(bpm: number, durationSec: number): number {
  const tempoDrive = clamp((bpm > 0 ? bpm : 120) / 180, 0, 1);
  const durationFactor = clamp(1 - (durationSec > 0 ? durationSec : 210) / 600, 0, 1);
  return clamp(0.26 + tempoDrive * 0.52 + durationFactor * 0.08, 0.18, 0.92);
}

export async function analyzeTrack(
  trackId: string,
  filepath: string,
  originalFilename: string
): Promise<void> {
  try {
    const metadata = await parseFile(filepath);
    const durationSec = metadata.format.duration ?? 0;

    let decodedAudio: Awaited<ReturnType<typeof decodeAudioFile>> | null = null;
    let audioFeatures:
      | ReturnType<typeof estimateAudioFeatures>
      | null = null;

    try {
      decodedAudio = await decodeAudioFile(filepath);
      audioFeatures = estimateAudioFeatures(decodedAudio);
    } catch (decodeErr) {
      console.warn(`Audio decode failed for ${trackId}; falling back to metadata-driven analysis`, decodeErr);
    }

    const bpmChoice = chooseBpm(extractBpmHint(metadata, originalFilename), {
      value: audioFeatures?.bpm ?? 0,
      confidence: audioFeatures?.bpm_confidence ?? 0,
    });
    const keyChoice = chooseKey(extractKeyHint(metadata, originalFilename), {
      value: audioFeatures?.key ?? "",
      confidence: audioFeatures?.key_confidence ?? 0,
    });

    const bpm = validBpm(bpmChoice.value);
    const key = normalizeMusicalKey(keyChoice.value);
    const energy = clamp(audioFeatures?.energy ?? fallbackEnergy(bpm, durationSec), 0, 1);
    const fallbackTraits = buildFallbackAudioFeatures({
      bpm,
      energy,
      durationSec,
    });

    let embeddingVersion = "";

    const baseAnalysis = {
      id: trackId,
      duration_sec: durationSec,
      bpm,
      key,
      energy,
      brightness: clamp(audioFeatures?.brightness ?? fallbackTraits.brightness, 0, 1),
      loudness: clamp(audioFeatures?.loudness ?? fallbackTraits.loudness, 0, 1),
      complexity: clamp(audioFeatures?.complexity ?? fallbackTraits.complexity, 0, 1),
      bpm_confidence: clamp(bpmChoice.confidence, 0, 1),
      key_confidence: clamp(keyChoice.confidence, 0, 1),
      analysis_version: ANALYSIS_VERSION,
      embedding_version: embeddingVersion,
      status: "PROCESSING",
    } as const;

    await updateTrackAnalysis(baseAnalysis);

    if (decodedAudio) {
      try {
        const audioEmbedding = await generateAudioEmbeddingWithDetails(filepath, decodedAudio);
        embeddingVersion = audioEmbedding.model_version;
        await addAudioEmbedding(trackId, audioEmbedding.embedding);
        await findAudioNeighbors(audioEmbedding.embedding, KNN_LIMIT);
      } catch (audioErr) {
        console.warn(`Audio embedding failed for ${trackId}; embedding-backed similarity skipped`, audioErr);
      }
    }

    await updateTrackAnalysis({
      ...baseAnalysis,
      embedding_version: embeddingVersion,
      status: "READY",
    });
    scheduleAtlasRefresh();
  } catch (err) {
    console.error(`Analysis failed for track ${trackId}:`, err);
    const message =
      err instanceof Error ? err.message : "Unknown analysis error";
    await updateTrackError(trackId, message);
  }
}
