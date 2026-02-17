"use client";

import Link from "next/link";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { CoverArt } from "@/components/tracks/cover-art";
import { usePlayer } from "@/lib/player-context";
import { formatDuration, cn } from "@/lib/utils";

export function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    progress,
    volume,
    muted,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    error,
    buffering,
  } = usePlayer();

  if (!currentTrack) {
    return (
      <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-border bg-background px-4">
        <p className="text-body-sm text-muted-foreground">Select a track to play.</p>
      </footer>
    );
  }

  const duration = currentTrack.duration_sec || 300;
  const elapsed = Math.floor(progress * duration);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-border bg-background px-4 gap-4">
      {/* Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous track"
          className="h-11 w-11 text-muted-foreground hover:text-foreground"
          onClick={prev}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          className="h-11 w-11 rounded-full"
          onClick={() => togglePlay()}
        >
          {buffering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next track"
          className="h-11 w-11 text-muted-foreground hover:text-foreground"
          onClick={next}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Track info */}
      <div className="hidden sm:flex items-center gap-3 min-w-0 w-48 shrink-0">
        <Link href={`/track/${currentTrack.id}`} className="shrink-0">
          <CoverArt trackId={currentTrack.id} size={40} className="h-10 w-10 rounded-sm" />
        </Link>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-body-sm font-medium",
              error ? "text-destructive" : isPlaying ? "text-primary" : "text-foreground",
            )}
          >
            {currentTrack.title}
          </p>
          {error ? (
            <p className="flex items-center gap-2 text-caption text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate">Playback unavailable</span>
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => togglePlay(currentTrack)}
              >
                Try again
              </button>
            </p>
          ) : (
            <p className="truncate text-caption text-muted-foreground">
              {currentTrack.artist}
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <span className="w-10 text-right text-caption font-mono text-muted-foreground tabular-nums">
          {formatDuration(elapsed)}
        </span>
        <Slider
          value={[progress * 100]}
          max={100}
          step={0.1}
          onValueChange={([v]) => seek(v / 100)}
          className="flex-1 [&_[data-orientation=horizontal]>.bg-primary]:bg-primary"
        />
        <span className="w-10 text-caption font-mono text-muted-foreground tabular-nums">
          {formatDuration(Math.round(duration))}
        </span>
      </div>

      {/* Volume */}
      <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          className="h-11 w-11 text-muted-foreground"
          onClick={toggleMute}
        >
          {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          onValueChange={([v]) => setVolume(v / 100)}
          className="flex-1"
        />
      </div>
    </footer>
  );
}
