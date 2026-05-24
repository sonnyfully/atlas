import Link from "next/link";
import type { SceneAdjacencyEdge, SceneSummary } from "@atlas/shared";
import { cn } from "@/lib/utils";

interface SceneExplorerProps {
  scenes: SceneSummary[];
  edges: SceneAdjacencyEdge[];
  activeSceneId?: string;
}

export function SceneExplorer({
  scenes,
  edges,
  activeSceneId,
}: SceneExplorerProps) {
  if (scenes.length === 0) return null;

  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const dedupedEdges = new Map<string, SceneAdjacencyEdge>();
  for (const edge of edges) {
    if (!sceneIds.has(edge.from_scene_id) || !sceneIds.has(edge.to_scene_id)) continue;
    const a = edge.from_scene_id < edge.to_scene_id ? edge.from_scene_id : edge.to_scene_id;
    const b = edge.from_scene_id < edge.to_scene_id ? edge.to_scene_id : edge.from_scene_id;
    const key = `${a}:${b}`;
    const previous = dedupedEdges.get(key);
    if (!previous || edge.score > previous.score) {
      dedupedEdges.set(key, edge);
    }
  }

  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.10),transparent_38%),linear-gradient(180deg,rgba(10,10,15,0.96),rgba(10,10,15,0.88))] shadow-surface">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Scene Explorer</p>
        <p className="text-xs text-muted-foreground">
          Persisted centroids and adjacent-scene edges from the active build.
        </p>
      </div>

      <div className="relative aspect-[16/10] w-full">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="scene-edge" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(250,250,250,0.12)" />
              <stop offset="100%" stopColor="rgba(249,115,22,0.4)" />
            </linearGradient>
          </defs>
          {Array.from(dedupedEdges.values()).map((edge) => {
            const from = sceneById.get(edge.from_scene_id);
            const to = sceneById.get(edge.to_scene_id);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.from_scene_id}:${edge.to_scene_id}`}
                x1={from.centroid.x * 100}
                y1={from.centroid.y * 100}
                x2={to.centroid.x * 100}
                y2={to.centroid.y * 100}
                stroke="url(#scene-edge)"
                strokeWidth={0.25 + edge.score * 0.45}
                strokeOpacity={0.35 + edge.score * 0.4}
              />
            );
          })}
        </svg>

        {scenes.map((scene) => {
          const isActive = scene.id === activeSceneId;
          return (
            <Link
              key={scene.id}
              href={`/scenes/${scene.id}`}
              className={cn(
                "group absolute flex min-w-28 -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border px-3 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm transition hover:-translate-y-[52%]",
                isActive
                  ? "border-white/30 bg-white/14"
                  : "border-white/12 bg-white/8 hover:bg-white/12"
              )}
              style={{
                left: `${scene.centroid.x * 100}%`,
                top: `${scene.centroid.y * 100}%`,
              }}
            >
              <span
                className="mb-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: scene.color }}
              />
              <span className="text-sm font-medium text-white">{scene.name}</span>
              <span className="text-[11px] text-white/70">
                {scene.track_count} track{scene.track_count === 1 ? "" : "s"} · {scene.adjacent_scene_count} links
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
