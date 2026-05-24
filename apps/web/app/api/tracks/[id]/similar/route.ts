import { NextRequest, NextResponse } from "next/server";
import { getSimilarTrackResults } from "@/lib/helix";
import type { SimilarTracksResponse } from "@atlas/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const results = await getSimilarTrackResults(id, 20);
    return NextResponse.json({
      source_id: id,
      results,
    } satisfies SimilarTracksResponse);
  } catch (err) {
    console.error(`Failed to fetch similar tracks for ${id}:`, err);
    return NextResponse.json(
      {
        error: {
          code: "SIMILAR_FETCH_FAILED",
          message: "Failed to fetch similar tracks.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
