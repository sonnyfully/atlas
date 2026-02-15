export const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";

// Track status lifecycle
export type TrackStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR";

// Track as stored in HelixDB
export interface Track {
  id: string;
  title: string;
  artist: string;
  filepath: string;
  original_filename: string;
  file_hash: string;
  status: TrackStatus;
  duration_sec: number;
  bpm: number;
  key: string;
  energy: number;
  upload_date: string;
  error: string;
}

// Audio URL helper — single abstraction point for serving audio
export function audioUrl(trackId: string): string {
  return `/api/audio/${trackId}`;
}

// Ingest API response
export interface IngestResponse {
  id: string;
  status: TrackStatus;
  duplicate: boolean;
}

// Similar track result with score and basis
export interface SimilarTrackResult {
  track: Track;
  score: number;
  basis: "text" | "audio" | "hybrid";
}
