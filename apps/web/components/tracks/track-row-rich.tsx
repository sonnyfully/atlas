"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Loader2, MoreHorizontal, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Waveform } from "@/components/tracks/waveform";
import { LikeButton } from "@/components/tracks/like-button";
import { CoverArt } from "@/components/tracks/cover-art";
import { useSceneAccent } from "@/lib/colors";
import { TRANSITION_OPACITY } from "@/lib/motion";
import { usePlayer } from "@/lib/player-context";
import { cn, formatDuration } from "@/lib/utils";
import type { Track } from "@atlas/shared";

interface TrackRowRichProps {
  track: Track;
  index?: number;
}

type TrackWithScene = Track & {
  scene_name?: string;
  scene?: string;
  scene_id?: string;
};

export function TrackRowRich({ track, index }: TrackRowRichProps) {
  const { currentTrack, isPlaying, progress, togglePlay, seek, addToQueue } = usePlayer();
  const sceneTrack = track as TrackWithScene;
  const sceneName = sceneTrack.scene_name ?? sceneTrack.scene;
  const sceneAccent = useSceneAccent(sceneTrack.scene_id, track.id || track.artist);
  const isActive = currentTrack?.id === track.id;
  const isThisPlaying = isActive && isPlaying;
  const isProcessing = track.status === "PENDING" || track.status === "PROCESSING";
  const isReady = track.status === "READY";
  const [liked, setLiked] = React.useState(false);

  const onRowPlay = () => {
    togglePlay(track);
  };

  const statusBadge = (() => {
    if (track.status === "PENDING") return { label: "Uploading", variant: "secondary" as const };
    if (track.status === "PROCESSING") return { label: "Processing", variant: "secondary" as const };
    if (track.status === "ERROR") return { label: "Failed", variant: "destructive" as const };
    if (!isReady) return { label: "Not ready", variant: "secondary" as const };
    return null;
  })();

  return (
    <div
      role="button"
      tabIndex={0}
      style={sceneAccent.cssVars}
      aria-label={`Play ${track.title}`}
      aria-pressed={isActive}
      onClick={onRowPlay}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onRowPlay();
        }
      }}
      className={cn(
        "group relative grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-transparent px-3 py-2.5",
        "lg:grid-cols-[auto_auto_minmax(0,1fr)_180px_auto] xl:grid-cols-[auto_auto_minmax(0,1.15fr)_220px_auto]",
        "focus-ring transition-interactive duration-fast ease-out hover:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)]",
        isActive && "scene-selected bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.12)]",
        isProcessing && "opacity-65",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-1 left-0 w-1 rounded-r bg-scene transition-opacity duration-fast ease-out motion-reduce:transition-none",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="w-6 text-center text-caption font-mono text-muted-foreground">
        {index !== undefined ? index + 1 : ""}
      </div>

      <button
        type="button"
        className={cn(
          "focus-ring relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          "text-muted-foreground transition-interactive duration-fast ease-out hover:text-foreground",
        )}
        aria-label={isThisPlaying ? "Pause track" : "Play track"}
        onClick={(event) => {
          event.stopPropagation();
          onRowPlay();
        }}
      >
        <CoverArt trackId={track.id} size={40} className="h-10 w-10 rounded-sm" />
        <span className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/30 opacity-0 transition-opacity duration-fast ease-out group-hover:opacity-100">
          {isThisPlaying ? <Pause className="h-3.5 w-3.5 text-white" /> : <Play className="ml-0.5 h-3.5 w-3.5 text-white" />}
        </span>
      </button>

      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className={cn("truncate text-body-sm font-semibold text-foreground")} title={track.title}>
            {track.title}
          </p>
          {statusBadge && (
            <Badge variant={statusBadge.variant} className="h-5 shrink-0 text-[10px]">
              {statusBadge.label}
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p
            className="max-w-[10rem] truncate text-caption text-muted-foreground sm:max-w-[12rem]"
            title={track.artist}
          >
            {track.artist}
          </p>
          {track.bpm > 0 && (
            <Badge variant="scene" className="h-5 shrink-0 px-1.5 py-0 text-[10px]">
              {Math.round(track.bpm)} BPM
            </Badge>
          )}
          {track.key && track.key.trim().length > 0 && (
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 py-0 text-[10px]">
              {track.key}
            </Badge>
          )}
          {sceneName && (
            <Badge
              variant="scene"
              className="inline-flex h-5 max-w-[6.75rem] items-center px-1.5 py-0 text-[10px]"
              title={sceneName}
            >
              <span className="truncate">{sceneName}</span>
            </Badge>
          )}
        </div>
      </div>

      <div
        className="hidden w-[180px] lg:block xl:w-[220px]"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {isProcessing ? (
          <div className="flex h-8 items-center rounded-sm bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)] px-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Waveform
            trackId={track.id}
            progress={isActive ? progress : 0}
            barCount={58}
            height={30}
            onSeek={isActive ? seek : undefined}
            sceneTinted
            className="h-8"
          />
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span
          aria-label={`Duration ${formatDuration(Math.round(track.duration_sec || 0))}`}
          className="w-14 text-right text-caption font-mono text-muted-foreground tabular-nums"
        >
          {track.duration_sec > 0 ? formatDuration(Math.round(track.duration_sec)) : "--:--"}
        </span>

        <div
          onClickCapture={(event) => event.stopPropagation()}
          onPointerDownCapture={(event) => event.stopPropagation()}
        >
          <LikeButton
            size="sm"
            ariaLabel={track.title || "track"}
            liked={liked}
            onLikedChange={setLiked}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open track actions"
              className={cn(
                "h-11 w-11 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
                TRANSITION_OPACITY,
              )}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem
              onClick={(event) => {
                event.stopPropagation();
                addToQueue(track);
              }}
            >
              Add to Queue
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/track/${track.id}`}>View DNA card</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute right-24 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-full border border-border/80 bg-surface-1/95 px-1.5 py-1 shadow-surface transition-opacity duration-fast ease-out xl:flex",
          isActive
            ? "pointer-events-auto opacity-100"
            : "opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
        )}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-caption"
          onClick={() => setLiked((prev) => !prev)}
          aria-label={liked ? `Unlike ${track.title}` : `Like ${track.title}`}
        >
          <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
          Like
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-caption"
          onClick={() => addToQueue(track)}
        >
          <Plus className="h-3.5 w-3.5" />
          Queue
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-caption">
          <Link href={`/track/${track.id}`}>
            View DNA
          </Link>
        </Button>
      </div>
    </div>
  );
}
