"use client";

import Link from "next/link";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/lib/player-context";
import { formatDuration, cn, trackCoverColor } from "@/lib/utils";
import type { Track } from "@atlas/shared";

interface TrackRowCompactProps {
  track: Track;
}

export function TrackRowCompact({ track }: TrackRowCompactProps) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isActive = currentTrack?.id === track.id;
  const isThisPlaying = isActive && isPlaying;
  const isProcessing =
    track.status === "PENDING" || track.status === "PROCESSING";

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent",
        isActive && "bg-accent",
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
      <div
        className="h-8 w-8 shrink-0 rounded-sm"
        style={{ backgroundColor: trackCoverColor(track.id) }}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/track/${track.id}`}
          className={cn(
            "block truncate text-caption font-medium hover:text-primary transition-colors",
            isActive ? "text-primary" : "text-foreground",
          )}
        >
          {track.title}
        </Link>
        <p className="truncate text-caption text-muted-foreground">
          {track.artist}
        </p>
      </div>
      <span className="text-caption font-mono text-muted-foreground tabular-nums">
        {track.duration_sec > 0
          ? formatDuration(Math.round(track.duration_sec))
          : "--:--"}
      </span>
    </div>
  );
}
