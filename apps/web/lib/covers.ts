import { BLOBTOON_VERSION, clampCoverSize } from "./blobtoon";

interface CoverUrlOptions {
  v?: number;
  s?: number;
}

export function getCoverUrl(trackId: string, options: CoverUrlOptions = {}): string {
  const version = Math.max(1, Math.floor(options.v ?? BLOBTOON_VERSION));
  const params = new URLSearchParams({
    v: String(version),
  });

  if (typeof options.s === "number" && Number.isFinite(options.s)) {
    params.set("s", String(clampCoverSize(options.s)));
  }

  const safeTrackId = encodeURIComponent(trackId);
  return `/api/cover/blobtoon/${safeTrackId}.svg?${params.toString()}`;
}
