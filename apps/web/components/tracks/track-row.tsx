"use client";

import { Play, Pause, MoreHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/tracks/waveform";
import { LikeButton } from "@/components/tracks/like-button";
import { CoverArt } from "@/components/tracks/cover-art";
import { usePlayer } from "@/lib/player-context";
import { formatDuration, cn } from "@/lib/utils";
import type { Track } from "@atlas/shared";

interface TrackRowProps {
  track: Track;
  index?: number;
}

export function TrackRow({ track, index }: TrackRowProps) {
  const { currentTrack, isPlaying, progress, togglePlay, seek, addToQueue } = usePlayer();
  const isActive = currentTrack?.id === track.id;
  const isThisPlaying = isActive && isPlaying;
  const isProcessing = track.status === "PENDING" || track.status === "PROCESSING";
  const isReady = track.status === "READY";

  const onRowPlay = () => {
    if (!isReady && !isActive) {
      togglePlay(track);
      return;
    }
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
        "group relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isActive && "bg-accent/80",
        isProcessing && "opacity-60",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-1 left-0 w-1 rounded-r bg-primary transition-opacity",
          isActive ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Index / Play button */}
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-11 w-11 rounded-full",
                isThisPlaying
                  ? "text-primary opacity-100"
                  : "text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100",
                isActive && "md:opacity-100",
              )}
              aria-label={isThisPlaying ? "Pause track" : "Play track"}
              onClick={(event) => {
                event.stopPropagation();
                onRowPlay();
              }}
            >
              {isThisPlaying ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            {!isActive && (
              <span
                aria-hidden="true"
                className="absolute text-caption font-mono text-muted-foreground group-hover:hidden"
              >
                {index !== undefined ? index + 1 : ""}
              </span>
            )}
          </>
        )}
      </div>

      <CoverArt trackId={track.id} size={40} className="h-10 w-10 shrink-0 rounded-sm" />

      {/* Title / Artist / BPM */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-body-sm font-medium transition-colors",
            isActive ? "text-primary" : "text-foreground",
          )}
          title={track.title}
        >
          {track.title}
        </p>
        <div className="flex items-center gap-2">
          <p className="truncate text-caption text-muted-foreground" title={track.artist}>
            {track.artist}
          </p>
          {track.bpm > 0 && (
            <Badge variant="outline" className="h-5 border-border px-1.5 py-0 text-[10px]">
              {Math.round(track.bpm)} BPM
            </Badge>
          )}
        </div>
      </div>

      {statusBadge && (
        <Badge variant={statusBadge.variant} className="text-[10px]">
          {statusBadge.label}
        </Badge>
      )}

      {!isProcessing && (
        <div
          className={cn(
            "hidden max-w-[200px] min-w-[100px] flex-1 transition-opacity lg:block",
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Waveform
            trackId={track.id}
            progress={isActive ? progress : 0}
            barCount={50}
            height={32}
            onSeek={isActive ? seek : undefined}
          />
        </div>
      )}

      <span
        aria-label={`Duration ${formatDuration(Math.round(track.duration_sec || 0))}`}
        className="w-12 text-right text-caption font-mono text-muted-foreground tabular-nums"
      >
        {track.duration_sec > 0
          ? formatDuration(Math.round(track.duration_sec))
          : "--:--"}
      </span>

      <div
        onClickCapture={(event) => event.stopPropagation()}
        onPointerDownCapture={(event) => event.stopPropagation()}
      >
        <LikeButton size="sm" ariaLabel={track.title || "track"} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open track actions"
            className="h-11 w-11 text-muted-foreground opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
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
          <DropdownMenuItem onClick={(event) => event.stopPropagation()}>
            View DNA card
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(event) => event.stopPropagation()}>
            Find similar tracks
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(event) => event.stopPropagation()}>
            Copy link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
