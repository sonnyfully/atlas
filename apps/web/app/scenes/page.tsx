import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SceneCard } from "@/components/scenes/scene-card";
import { SceneExplorer } from "@/components/scenes/scene-explorer";
import {
  getActiveAtlasBuildRecord,
  getAdjacentEdgesByBuildSeq,
  getScenesForActiveBuild,
} from "@/lib/helix";

export const dynamic = "force-dynamic";

export default async function ScenesPage() {
  const [build, scenes] = await Promise.all([
    getActiveAtlasBuildRecord(),
    getScenesForActiveBuild(),
  ]);
  const adjacentEdges = build ? await getAdjacentEdgesByBuildSeq(build.build_seq) : [];

  if (!build || scenes.length === 0) {
    return (
      <div className="space-y-6 px-6 py-8 lg:px-8">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Scenes
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            No active scene build yet
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Upload more READY tracks or trigger a rebuild to persist scene summaries and adjacent-scene edges.
          </p>
        </div>
        <Link href="/upload">
          <Button variant="outline">Upload Tracks</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="scene">Build #{build.build_seq}</Badge>
              <Badge variant="scene">{scenes.length} scenes</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Scene Directory
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Browse the persisted scene graph for the active Atlas build. Use these pages as proof that scene membership and adjacency now live in Helix, not in the browser.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="outline">Home</Button>
            </Link>
            <Link href="/upload">
              <Button variant="outline">Upload</Button>
            </Link>
            <Link href="/map">
              <Button variant="outline">Open Map</Button>
            </Link>
          </div>
        </div>
      </div>

      <SceneExplorer scenes={scenes} edges={adjacentEdges} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} />
        ))}
      </div>
    </div>
  );
}
