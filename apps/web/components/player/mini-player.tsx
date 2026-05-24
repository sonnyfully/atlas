"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { useSceneAccent } from "@/lib/colors";
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
  const sceneAccent = useSceneAccent(undefined, currentTrack?.id ?? "mini-player");
  const progressWrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  const duration = currentTrack?.duration_sec || 300;
  const elapsed = Math.floor(progress * duration);
  const hoverTime = useMemo(() => {
    if (hoverProgress === null) return null;
    return Math.round(duration * hoverProgress);
  }, [duration, hoverProgress]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) {
        return;
      }

      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (!currentTrack) return;
        seek(Math.max(0, (elapsed - 5) / duration));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!currentTrack) return;
        seek(Math.min(1, (elapsed + 5) / duration));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentTrack, duration, elapsed, seek, togglePlay]);

  const onProgressPointerMove = (clientX: number) => {
    const rect = progressWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHoverProgress(ratio);
  };

  if (!currentTrack) {
    return (
      <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center border-t border-border/80 bg-background/92 px-4 backdrop-blur-sm">
        <p className="text-body-sm text-muted-foreground">Select a track to play.</p>
      </footer>
    );
  }

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[72px] items-center gap-4 border-t border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.25)] bg-background/92 px-4 backdrop-blur-sm"
      style={sceneAccent.cssVars}
    >
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
      <div className="hidden min-w-0 w-56 shrink-0 items-center gap-3 sm:flex">
        <Link href={`/track/${currentTrack.id}`} className="shrink-0">
          <CoverArt trackId={currentTrack.id} size={40} className="h-10 w-10 rounded-sm" />
        </Link>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-body-sm font-medium",
              error ? "text-destructive" : "text-foreground",
              isPlaying && "font-semibold",
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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          ref={progressWrapRef}
          className="relative flex-1 py-2"
          onMouseMove={(event) => onProgressPointerMove(event.clientX)}
          onMouseLeave={() => setHoverProgress(null)}
        >
          <Slider
            value={[progress * 100]}
            max={100}
            step={0.1}
            onValueChange={([v]) => seek(v / 100)}
            className={cn(
              "flex-1",
              "[&_[data-slot=slider-track]]:h-2.5 [&_[data-slot=slider-track]]:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.18)]",
              "[&_[data-slot=slider-range]]:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.68)]",
              "[&_[data-slot=slider-thumb]]:h-5 [&_[data-slot=slider-thumb]]:w-5 [&_[data-slot=slider-thumb]]:border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.55)]",
            )}
          />
          {hoverTime !== null && (
            <div
              className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-md border border-border/70 bg-surface-1 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-surface"
              style={{ left: `${(hoverProgress ?? 0) * 100}%` }}
            >
              {formatDuration(hoverTime)}
            </div>
          )}
        </div>
        <span className="w-24 text-right text-caption font-mono text-muted-foreground tabular-nums">
          {formatDuration(elapsed)} / {formatDuration(Math.round(duration))}
        </span>
      </div>

      {/* Volume */}
      <div className="hidden w-40 shrink-0 items-center gap-2 md:flex">
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
          className={cn(
            "flex-1",
            "[&_[data-slot=slider-track]]:h-2",
            "[&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-4",
          )}
        />
      </div>
    </footer>
  );
}
