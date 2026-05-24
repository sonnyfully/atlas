"use client";

import Link from "next/link";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CoverArt } from "@/components/tracks/cover-art";
import { useSceneAccent } from "@/lib/colors";
import { usePlayer } from "@/lib/player-context";
import { formatDuration, cn } from "@/lib/utils";
import type { SimilarTrackResult, Track } from "@atlas/shared";

type TrackWithScene = Track & {
  scene_name?: string;
  scene?: string;
  scene_id?: string;
};

interface TrackRowCompactProps {
  track: Track;
  similarity?: Pick<SimilarTrackResult, "score" | "basis">;
}

export function TrackRowCompact({ track, similarity }: TrackRowCompactProps) {
  const sceneTrack = track as TrackWithScene;
  const sceneName = sceneTrack.scene_name ?? sceneTrack.scene;
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const sceneAccent = useSceneAccent(sceneTrack.scene_id, track.id || track.artist);
  const isActive = currentTrack?.id === track.id;
  const isThisPlaying = isActive && isPlaying;
  const isProcessing =
    track.status === "PENDING" || track.status === "PROCESSING";

  return (
    <div
      style={sceneAccent.cssVars}
      className={cn(
        "group flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5",
        "transition-interactive duration-fast ease-out hover:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)]",
        isActive && "scene-selected bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.12)]",
        isProcessing && "opacity-60",
      )}
    >
      {isProcessing ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={isThisPlaying ? "Pause track" : "Play track"}
          className="h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-primary"
          onClick={() => togglePlay(track)}
        >
          {isThisPlaying ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3 ml-0.5" />
          )}
        </Button>
      )}
      <CoverArt trackId={track.id} size={32} className="h-8 w-8 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/track/${track.id}`}
          className={cn(
            "block truncate text-caption font-medium text-foreground transition-interactive duration-fast ease-out hover:text-foreground/85",
            isActive && "font-semibold",
          )}
        >
          {track.title}
        </Link>
        <p className="truncate text-caption text-muted-foreground">
          {track.artist}
        </p>
        {sceneName && (
          <div className="mt-0.5">
            <Badge variant="scene" className="h-5 px-1.5 py-0 text-[10px]">
              {sceneName}
            </Badge>
          </div>
        )}
        {similarity && (
          <div className="mt-0.5 flex items-center gap-1.5">
            <Badge variant="scene" className="h-5 px-1.5 py-0 text-[10px]">
              {Math.round(similarity.score * 100)}%
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px] capitalize">
              {similarity.basis}
            </Badge>
          </div>
        )}
      </div>
      <span className="text-caption font-mono text-muted-foreground tabular-nums">
        {track.duration_sec > 0
          ? formatDuration(Math.round(track.duration_sec))
          : "--:--"}
      </span>
    </div>
  );
}
