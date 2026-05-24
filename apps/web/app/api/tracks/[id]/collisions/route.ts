import { NextRequest, NextResponse } from "next/server";
import { getTrackCollisions } from "@/lib/helix";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const results = await getTrackCollisions(id, 20);
    return NextResponse.json({
      source_id: id,
      results,
    });
  } catch (err) {
    console.error(`Failed to fetch collisions for ${id}:`, err);
    return NextResponse.json(
      {
        error: {
          code: "COLLISION_FETCH_FAILED",
          message: "Failed to fetch track collisions.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
