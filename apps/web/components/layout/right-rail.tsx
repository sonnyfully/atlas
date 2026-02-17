"use client";

import { Pause, Play } from "lucide-react";
import { CoverArt } from "@/components/tracks/cover-art";
import { usePlayer } from "@/lib/player-context";
import { cn, formatDuration } from "@/lib/utils";
import type { Track } from "@atlas/shared";

interface RightRailProps {
  tracks: Track[];
}

export function RightRail(_: RightRailProps) {
  const { currentTrack, isPlaying, queue, togglePlay } = usePlayer();
  const upNext = queue.filter((track) => track.id !== currentTrack?.id).slice(0, 6);

  return (
    <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
      <section>
        <h3 className="mb-3 text-body-sm font-semibold text-foreground">Queue</h3>
        {!currentTrack ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-body-sm text-muted-foreground">
            Select a track to start playback.
          </p>
        ) : (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Now Playing
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md p-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => togglePlay(currentTrack)}
            >
              <CoverArt
                trackId={currentTrack.id}
                size={32}
                className="h-8 w-8 shrink-0 rounded-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-primary" title={currentTrack.title}>
                  {currentTrack.title}
                </p>
                <p className="truncate text-caption text-muted-foreground" title={currentTrack.artist}>
                  {currentTrack.artist}
                </p>
              </div>
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </span>
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-body-sm font-semibold text-foreground">Up Next</h3>
        <div className="space-y-1">
          {upNext.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-body-sm text-muted-foreground">
              Add tracks to queue from a row menu.
            </p>
          )}
          {upNext.map((track) => (
            <button
              key={track.id}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentTrack?.id === track.id && "bg-accent",
              )}
              onClick={() => togglePlay(track)}
            >
              <CoverArt trackId={track.id} size={32} className="h-8 w-8 shrink-0 rounded-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption font-medium text-foreground" title={track.title}>
                  {track.title}
                </p>
                <p className="truncate text-caption text-muted-foreground" title={track.artist}>
                  {track.artist}
                </p>
              </div>
              <span className="text-caption font-mono text-muted-foreground">
                {track.duration_sec > 0 ? formatDuration(Math.round(track.duration_sec)) : "--:--"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
