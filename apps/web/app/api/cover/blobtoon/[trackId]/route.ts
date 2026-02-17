import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { getTrack } from "@/lib/helix";
import {
  BLOBTOON_VERSION,
  clampCoverSize,
  generateBlobtoonSvg,
  seedFromTrackIdentity,
} from "@/lib/blobtoon";

function buildEtag(seed: number, version: number, size: number): string {
  const digest = createHash("sha1")
    .update(`${seed}|${version}|${size}`)
    .digest("hex")
    .slice(0, 20);
  return `"blobtoon-${digest}"`;
}

function ifNoneMatchMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const normalize = (value: string) => value.replace(/^W\//, "");
  const expected = normalize(etag);
  return ifNoneMatch
    .split(",")
    .map((tag) => normalize(tag.trim()))
    .some((tag) => tag === expected);
}

function commonHeaders(etag: string): HeadersInit {
  return {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "public,max-age=31536000,immutable",
    "X-Content-Type-Options": "nosniff",
    ETag: etag,
  };
}

function normalizeTrackId(rawTrackId: string): string {
  return rawTrackId.endsWith(".svg") ? rawTrackId.slice(0, -4) : rawTrackId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId: routeId } = await params;
  const trackId = normalizeTrackId(routeId);
  if (!trackId) {
    return new Response("Invalid track id", { status: 400 });
  }

  const url = new URL(request.url);
  const size = clampCoverSize(Number(url.searchParams.get("s")));
  const version = Math.max(
    1,
    Number.parseInt(url.searchParams.get("v") ?? "", 10) || BLOBTOON_VERSION
  );

  let fileHash: string | undefined;
  try {
    const track = await getTrack(trackId);
    if (track?.file_hash) fileHash = track.file_hash;
  } catch {
    // Fallback to track id seed below.
  }

  const seed = seedFromTrackIdentity(trackId, fileHash);
  const etag = buildEtag(seed, version, size);
  const headers = commonHeaders(etag);

  if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  const svg = generateBlobtoonSvg({ seed, size, version });
  return new Response(svg, {
    status: 200,
    headers,
  });
}
