import { NextRequest, NextResponse } from "next/server";
import { getTrackDna } from "@/lib/helix";
import { resolveTrackRoute } from "./route-logic";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const response = await resolveTrackRoute({ id, getTrackDna });
  return NextResponse.json(response.body, { status: response.status });
}
