"use client";

import { useMemo, useCallback } from "react";
import { cn, generateWaveform } from "@/lib/utils";

interface WaveformProps {
  trackId: string;
  progress?: number; // 0–1
  barCount?: number;
  height?: number; // px
  onSeek?: (position: number) => void;
  className?: string;
  sceneTinted?: boolean;
}

export function Waveform({
  trackId,
  progress = 0,
  barCount = 80,
  height = 48,
  onSeek,
  className,
  sceneTinted = false,
}: WaveformProps) {
  const bars = useMemo(
    () => generateWaveform(trackId, barCount),
    [trackId, barCount],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(1, x)));
    },
    [onSeek],
  );

  return (
    <div
      role={onSeek ? "slider" : "img"}
      aria-label="Waveform"
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      className={cn(
        "flex items-end gap-px rounded-sm",
        sceneTinted
          ? "bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.12)]"
          : "bg-muted",
        onSeek && "cursor-pointer",
        className,
      )}
      style={{ height }}
      onClick={handleClick}
    >
      {bars.map((h, i) => {
        const filled = i / barCount < progress;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors duration-fast ease-out motion-reduce:transition-none",
              filled
                ? sceneTinted
                  ? "bg-scene"
                  : "bg-primary"
                : "bg-muted-foreground/40",
            )}
            style={{ height: `${h * 100}%`, minWidth: 2 }}
          />
        );
      })}
    </div>
  );
}
