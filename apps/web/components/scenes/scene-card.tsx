import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { SceneSummary } from "@atlas/shared";

interface SceneCardProps {
  scene: SceneSummary;
}

export function SceneCard({ scene }: SceneCardProps) {
  return (
    <Link
      href={`/scenes/${scene.id}`}
      className="group overflow-hidden rounded-2xl border border-border/70 bg-surface-1 shadow-surface transition hover:-translate-y-0.5 hover:border-border"
    >
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: scene.color }}
      />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">
              {scene.name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Persisted scene centroid with Helix-backed adjacent links.
            </p>
          </div>
          <div
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: scene.color }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="scene">{scene.track_count} tracks</Badge>
          <Badge variant="scene">{scene.adjacent_scene_count} adjacent</Badge>
          <Badge variant="outline">ID {scene.id}</Badge>
        </div>
      </div>
    </Link>
  );
}
