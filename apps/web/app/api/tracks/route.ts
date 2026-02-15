import { NextRequest, NextResponse } from "next/server";
import { getRecentTracks, getAllTracks } from "@/lib/helix";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sort = req.nextUrl.searchParams.get("sort");
    const offsetParam = req.nextUrl.searchParams.get("offset");
    const limitParam = req.nextUrl.searchParams.get("limit");

    // If sort/offset/limit params are present, use paginated query
    if (sort || offsetParam || limitParam) {
      const sortMode = sort === "alpha" ? "alpha" : "recent";
      const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0;
      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 25, 1), 100) : 25;

      const tracks = await getAllTracks(sortMode, offset, limit);
      return NextResponse.json(tracks);
    }

    // Default: return all recent tracks (backward compat)
    const tracks = await getRecentTracks();
    return NextResponse.json(tracks);
  } catch (err) {
    console.error("Failed to fetch tracks:", err);
    return NextResponse.json(
      { error: "Failed to fetch tracks" },
      { status: 500 }
    );
  }
}
