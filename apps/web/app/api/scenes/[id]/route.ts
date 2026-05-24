import { NextRequest, NextResponse } from "next/server";
import type { SceneDetailResponse } from "@atlas/shared";
import {
  getActiveAtlasBuildRecord,
  getAdjacentScenes,
  getSceneByStableId,
  getSceneMembers,
} from "@/lib/helix";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const build = await getActiveAtlasBuildRecord();
    if (!build) {
      return NextResponse.json({
        build: null,
        scene: null,
        members: [],
        adjacent_scenes: [],
      } satisfies SceneDetailResponse);
    }

    const scene = await getSceneByStableId(id);
    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    const [members, adjacentScenes] = await Promise.all([
      getSceneMembers(id),
      getAdjacentScenes(id, 6),
    ]);

    return NextResponse.json({
      build,
      scene,
      members,
      adjacent_scenes: adjacentScenes,
    } satisfies SceneDetailResponse);
  } catch (err) {
    console.error(`Failed to fetch scene ${id}:`, err);
    return NextResponse.json(
      {
        error: {
          code: "SCENE_FETCH_FAILED",
          message: "Failed to fetch scene.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}
