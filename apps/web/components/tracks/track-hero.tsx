"use client";

import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/tracks/waveform";
import { LikeButton } from "@/components/tracks/like-button";
import { CoverArt } from "@/components/tracks/cover-art";
import { useSceneAccent } from "@/lib/colors";
import { usePlayer } from "@/lib/player-context";
import { formatDuration, cn } from "@/lib/utils";
import type { Track } from "@atlas/shared";

type TrackWithScene = Track & {
  scene_name?: string;
  scene?: string;
  scene_id?: string;
};

interface TrackHeroProps {
  track: Track;
}

export function TrackHero({ track }: TrackHeroProps) {
  const sceneTrack = track as TrackWithScene;
  const sceneName = sceneTrack.scene_name ?? sceneTrack.scene;
  const { currentTrack, isPlaying, progress, togglePlay, seek, error } = usePlayer();
  const sceneAccent = useSceneAccent(sceneTrack.scene_id, track.id || track.artist);
  const isActive = currentTrack?.id === track.id;
  const isThisPlaying = isActive && isPlaying;
  const isProcessing =
    track.status === "PENDING" || track.status === "PROCESSING";

  return (
    <section className="space-y-6" style={sceneAccent.cssVars}>
      {/* Header row */}
      <div className="flex gap-6">
        {/* Cover */}
        <div className="relative h-48 w-48 shrink-0">
          <CoverArt
            trackId={track.id}
            size={192}
            loading="eager"
            className="h-full w-full rounded-md border border-border/70 shadow-surface"
          />
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/60" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
          <div>
            <h1 className="text-h1 truncate">{track.title}</h1>
            <p className="mt-1 text-h4 text-muted-foreground font-normal">
              {track.artist}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sceneName && (
                <Badge variant="scene">{sceneName}</Badge>
              )}
              {track.status === "READY" && track.key && (
                <Badge variant="scene">{track.key}</Badge>
              )}
              {track.status === "READY" && track.bpm > 0 && (
                <Badge variant="scene">
                  {Math.round(track.bpm)} BPM
                </Badge>
              )}
              {isProcessing && (
                <Badge variant="outline">Analyzing...</Badge>
              )}
              {track.status === "ERROR" && (
                <Badge variant="destructive">Error</Badge>
              )}
              {error && isActive && (
                <Badge variant="destructive">Playback unavailable</Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              className="h-11 w-11 rounded-full"
              size="icon"
              aria-label={isThisPlaying ? "Pause track" : "Play track"}
              onClick={() => togglePlay(track)}
              disabled={isProcessing}
            >
              {isThisPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <LikeButton ariaLabel={track.title || "track"} />
            <span className="ml-auto text-body-sm font-mono text-muted-foreground tabular-nums">
              {track.duration_sec > 0
                ? formatDuration(Math.round(track.duration_sec))
                : "--:--"}
            </span>
          </div>
        </div>
      </div>

      {/* Full-width waveform */}
      {!isProcessing && (
        <Waveform
          trackId={track.id}
          progress={isActive ? progress : 0}
          barCount={120}
          height={64}
          onSeek={(pos) => {
            if (!isActive) togglePlay(track);
            seek(pos);
          }}
          sceneTinted
          className={cn(!isActive && "opacity-70")}
        />
      )}
    </section>
  );
}
