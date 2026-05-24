"use client";

import Link from "next/link";
import { Compass, LayoutGrid, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/tracks/search-tracks";
import { useSceneAccent } from "@/lib/colors";

interface CommandBarProps {
  uploadCount: number;
  readyCount: number;
  activeBuildSeq?: number | null;
  sceneCount?: number;
  latestReadyTrackId?: string | null;
  latestReadyAt?: string | null;
  analyzingCount?: number;
  subtitle?: string | null;
}

export function CommandBar({
  uploadCount,
  readyCount,
  activeBuildSeq,
  sceneCount = 0,
  latestReadyTrackId,
  latestReadyAt,
  analyzingCount = 0,
  subtitle,
}: CommandBarProps) {
  const sceneAccent = useSceneAccent(undefined, latestReadyAt ?? "discover-command");
  const fallbackSubtitle = uploadCount > 0 ? `${uploadCount} upload${uploadCount === 1 ? "" : "s"}` : null;
  const renderedSubtitle = subtitle ?? fallbackSubtitle;
  const primaryHref = latestReadyTrackId ? `/track/${latestReadyTrackId}` : "/upload";
  const primaryLabel = latestReadyTrackId ? "Open Latest DNA" : "Upload Tracks";

  return (
    <header className="surface-panel space-y-4 px-4 py-4 lg:px-5" style={sceneAccent.cssVars}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Atlas Overview
            </p>
            <h1 className="mt-2 text-h1 text-foreground">Track Atlas</h1>
            {renderedSubtitle && (
              <p className="mt-2 max-w-2xl text-body-sm text-muted-foreground">
                {renderedSubtitle}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="scene">{readyCount} ready</Badge>
            <Badge variant="outline">{uploadCount} total uploads</Badge>
            <Badge variant="outline">{analyzingCount} analyzing</Badge>
            <Badge variant="outline">
              {activeBuildSeq ? `Build #${activeBuildSeq}` : "No active build"}
            </Badge>
            <Badge variant="outline">{sceneCount} scenes</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Link href={primaryHref}>
            <Button size="sm" className="h-11 gap-2 px-4">
              <Upload className="h-4 w-4" />
              {primaryLabel}
            </Button>
          </Link>
          <Link href="/scenes">
            <Button size="sm" variant="outline" className="h-11 gap-2 px-4">
              <LayoutGrid className="h-4 w-4" />
              Scenes
            </Button>
          </Link>
          <Link href="/map">
            <Button size="sm" variant="outline" className="h-11 gap-2 px-4">
              <Compass className="h-4 w-4" />
              Map
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchInput className="w-full" />
        <p className="text-caption text-muted-foreground">
          Track DNA is the hero. Scenes and map verify the persisted graph around it.
        </p>
      </div>
    </header>
  );
}
