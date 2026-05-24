import { NextResponse } from "next/server";
import type { SceneListResponse } from "@atlas/shared";
import { getActiveAtlasBuildRecord, getScenesForActiveBuild } from "@/lib/helix";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [build, scenes] = await Promise.all([
      getActiveAtlasBuildRecord(),
      getScenesForActiveBuild(),
    ]);

    return NextResponse.json({
      build,
      scenes,
    } satisfies SceneListResponse);
  } catch (err) {
    console.error("Failed to fetch scenes:", err);
    return NextResponse.json(
      {
        error: {
          code: "SCENES_FETCH_FAILED",
          message: "Failed to fetch scenes.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
