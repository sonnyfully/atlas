import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SceneExplorer } from "@/components/scenes/scene-explorer";
import { TrackRowCompact } from "@/components/tracks/track-row-compact";
import {
  getActiveAtlasBuildRecord,
  getAdjacentEdgesByBuildSeq,
  getAdjacentScenes,
  getSceneByStableId,
  getSceneMembers,
  getScenesForActiveBuild,
} from "@/lib/helix";

export const dynamic = "force-dynamic";

interface ScenePageProps {
  params: Promise<{ id: string }>;
}

export default async function ScenePage({ params }: ScenePageProps) {
  const { id } = await params;
  const build = await getActiveAtlasBuildRecord();

  if (!build) {
    return (
      <div className="space-y-4 px-6 py-8 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Scene Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          No active scene build yet
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This page will light up once Atlas has an active build with persisted scenes.
        </p>
      </div>
    );
  }

  const [scene, members, adjacentScenes, allScenes, adjacentEdges] = await Promise.all([
    getSceneByStableId(id),
    getSceneMembers(id),
    getAdjacentScenes(id, 6),
    getScenesForActiveBuild(),
    getAdjacentEdgesByBuildSeq(build.build_seq),
  ]);

  if (!scene) notFound();

  const neighborhoodIds = new Set([scene.id, ...adjacentScenes.map((item) => item.scene.id)]);
  const neighborhoodScenes = allScenes.filter((item) => neighborhoodIds.has(item.id));
  const neighborhoodEdges = adjacentEdges.filter(
    (edge) => neighborhoodIds.has(edge.from_scene_id) && neighborhoodIds.has(edge.to_scene_id)
  );

  return (
    <div className="space-y-8 px-6 py-8 lg:px-8">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Link href="/scenes" className="text-sm text-muted-foreground transition hover:text-foreground">
              &lt;- Back to scenes
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="scene">Build #{build.build_seq}</Badge>
              <Badge variant="scene">{scene.track_count} tracks</Badge>
              <Badge variant="scene">{scene.adjacent_scene_count} adjacent scenes</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {scene.name}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Atlas persisted this scene at centroid {(scene.centroid.x * 100).toFixed(1)}% x {(scene.centroid.y * 100).toFixed(1)}% in the current world, with members and adjacency read directly from Helix.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">Home</Button>
            </Link>
            <Link href="/map">
              <Button variant="outline" size="sm">Open Map</Button>
            </Link>
            {members[0] ? (
              <Link href={`/track/${members[0].track.id}`}>
                <Button variant="scene" size="sm">Open Top DNA</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <SceneExplorer
        scenes={neighborhoodScenes}
        edges={neighborhoodEdges}
        activeSceneId={scene.id}
      />

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-2xl border border-border/70 bg-surface-1 p-4 shadow-surface">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Adjacent Scenes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nearby scenes ranked from persisted `ADJACENT` edges in the active build.
            </p>
          </div>

          {adjacentScenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No adjacent scenes persisted for this scene yet.
            </p>
          ) : (
            <div className="space-y-2">
              {adjacentScenes.map((item) => (
                <Link
                  key={item.scene.id}
                  href={`/scenes/${item.scene.id}`}
                  className="block rounded-xl border border-border/70 px-3 py-2 transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{item.scene.name}</span>
                    <Badge variant="scene">{Math.round(item.score * 100)}%</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.scene.track_count} track{item.scene.track_count === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Member Tracks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tracks sorted by persisted scene membership score, with direct DNA links for drill-down.
            </p>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No READY tracks are assigned to this scene.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.track.id}
                  className="rounded-2xl border border-border/70 bg-surface-1 p-2 shadow-surface"
                >
                  <div className="mb-2 flex items-center justify-end px-1">
                    <Badge variant="scene">
                      membership {member.membership_score.toFixed(2)}
                    </Badge>
                  </div>
                  <TrackRowCompact track={member.track} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
