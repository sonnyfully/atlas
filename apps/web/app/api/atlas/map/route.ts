import { NextRequest, NextResponse } from "next/server";
import { getAtlasMapV1 } from "@/lib/atlas-v1";
import { rebuildCanonicalAtlasBuild } from "@/lib/canonical-build";

export const dynamic = "force-dynamic";

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        retryable,
      },
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const version = request.nextUrl.searchParams.get("v");
  if (version !== "1") {
    return errorResponse(
      400,
      "UNSUPPORTED_ATLAS_VERSION",
      "Only /api/atlas/map?v=1 is supported."
    );
  }

  const forceRebuild = request.nextUrl.searchParams.get("rebuild") === "1";

  try {
    if (forceRebuild) {
      await rebuildCanonicalAtlasBuild();
    }
    const payload = await getAtlasMapV1({ forceRebuild });
    const etag = `"atlas-v1-${payload.world.version_hash}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
        },
      });
    }

    return NextResponse.json(payload, {
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("HELIX_UNAVAILABLE")) {
      return errorResponse(
        503,
        "HELIX_UNAVAILABLE",
        "Atlas map is unavailable because HelixDB is not reachable.",
        true
      );
    }

    console.error("Failed to build /api/atlas/map?v=1 payload:", error);
    return errorResponse(
      500,
      "ATLAS_MAP_BUILD_FAILED",
      "Failed to build atlas map payload.",
      true
    );
  }
}
