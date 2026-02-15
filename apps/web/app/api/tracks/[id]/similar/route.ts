import { NextRequest, NextResponse } from "next/server";
import { getSimilarTracks } from "@/lib/helix";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const tracks = await getSimilarTracks(id);
    return NextResponse.json({ results: tracks });
  } catch (err) {
    console.error(`Failed to fetch similar tracks for ${id}:`, err);
    return NextResponse.json(
      { error: "Failed to fetch similar tracks" },
      { status: 500 }
    );
  }
}
