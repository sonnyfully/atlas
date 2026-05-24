"use client";

import { Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CoverArt } from "@/components/tracks/cover-art";
import { getSceneAccent, useSceneAccent } from "@/lib/colors";
import { usePlayer } from "@/lib/player-context";
import { cn, formatDuration } from "@/lib/utils";
import type { Track } from "@atlas/shared";

type TrackWithScene = Track & {
  scene_name?: string;
  scene?: string;
  scene_id?: string;
  reason?: string;
  rationale?: string;
};

function metaForTrack(track: TrackWithScene): string[] {
  const parts: string[] = [];
  if (track.bpm > 0) parts.push(`${Math.round(track.bpm)} BPM`);
  if (track.key && track.key.trim().length > 0) parts.push(track.key);
  return parts;
}

export function NowPlayingCard({
  track,
  isPlaying,
  onToggle,
}: {
  track: TrackWithScene;
  isPlaying: boolean;
  onToggle: () => void;
}) {
  const sceneAccent = useSceneAccent(track.scene_id, track.id || track.artist);
  const sceneName = track.scene_name ?? track.scene;
  const reason = track.reason ?? track.rationale;
  const meta = metaForTrack(track);

  return (
    <div
      style={sceneAccent.cssVars}
      className="surface-panel surface-panel-interactive rounded-lg p-3"
    >
      <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
        Now Playing
      </p>
      <button
        type="button"
        className="focus-ring flex w-full items-center gap-3 rounded-md p-1 text-left transition-interactive duration-fast ease-out hover:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)]"
        onClick={onToggle}
      >
        <CoverArt trackId={track.id} size={48} className="h-12 w-12 shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold text-foreground" title={track.title}>
            {track.title}
          </p>
          <p className="truncate text-caption text-muted-foreground" title={track.artist}>
            {track.artist}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {meta.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{meta.join(" • ")}</span>
            )}
            {sceneName && (
              <Badge variant="scene" className="h-5 px-1.5 py-0 text-[10px]">
                {sceneName}
              </Badge>
            )}
          </div>
          {reason && <p className="mt-1 text-[11px] text-muted-foreground">{reason}</p>}
        </div>
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </span>
      </button>
    </div>
  );
}

export function UpNextRow({
  track,
  active,
  onSelect,
}: {
  track: TrackWithScene;
  active: boolean;
  onSelect: () => void;
}) {
  const sceneAccent = getSceneAccent(track.scene_id ?? track.id);
  const sceneName = track.scene_name ?? track.scene;

  return (
    <button
      type="button"
      style={sceneAccent.cssVars}
      className={cn(
        "focus-ring flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-interactive duration-fast ease-out",
        "hover:bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.1)]",
        active && "scene-selected border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.35)]",
      )}
      onClick={onSelect}
    >
      <CoverArt trackId={track.id} size={36} className="h-9 w-9 shrink-0 rounded-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-caption font-medium text-foreground" title={track.title}>
          {track.title}
        </p>
        <p className="truncate text-caption text-muted-foreground" title={track.artist}>
          {track.artist}
        </p>
        {sceneName && (
          <div className="mt-1">
            <Badge variant="scene" className="h-5 px-1.5 py-0 text-[10px]">
              {sceneName}
            </Badge>
          </div>
        )}
      </div>
      <span className="text-caption font-mono text-muted-foreground">
        {track.duration_sec > 0 ? formatDuration(Math.round(track.duration_sec)) : "--:--"}
      </span>
    </button>
  );
}

export function QueuePanel(_: { tracks: Track[] }) {
  const { currentTrack, isPlaying, queue, togglePlay } = usePlayer();
  const upNext = queue.filter((track) => track.id !== currentTrack?.id).slice(0, 8);

  return (
    <aside className="hidden w-80 shrink-0 lg:block">
      <div className="surface-panel space-y-5 rounded-xl p-4">
        <section>
          {!currentTrack ? (
            <p className="rounded-md border border-dashed border-border/80 px-3 py-4 text-body-sm text-muted-foreground">
              Select a track to start playback.
            </p>
          ) : (
            <NowPlayingCard
              track={currentTrack as TrackWithScene}
              isPlaying={isPlaying}
              onToggle={() => togglePlay(currentTrack)}
            />
          )}
        </section>

        <section>
          <h3 className="mb-2 text-body-sm font-semibold text-foreground">Up Next</h3>
          <div className="space-y-1">
            {upNext.length === 0 && (
              <p className="rounded-md border border-dashed border-border/80 px-3 py-4 text-body-sm text-muted-foreground">
                Add tracks to queue from a row action.
              </p>
            )}
            {upNext.map((track) => (
              <UpNextRow
                key={track.id}
                track={track as TrackWithScene}
                active={currentTrack?.id === track.id}
                onSelect={() => togglePlay(track)}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
