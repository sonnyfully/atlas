"use client";

import { useEffect, useMemo } from "react";
import type { Track } from "@atlas/shared";
import { TrackRow } from "@/components/tracks/track-row";
import { usePlayer } from "@/lib/player-context";

interface TrackListProps {
  tracks: Track[];
  title?: string;
}

export function TrackList({ tracks, title }: TrackListProps) {
  const { setQueue } = usePlayer();
  const readyTracks = useMemo(
    () =>
      tracks.filter((track): track is Track => {
        return Boolean(track?.id) && track.status === "READY";
      }),
    [tracks],
  );

  useEffect(() => {
    setQueue(readyTracks);
  }, [readyTracks, setQueue]);

  return (
    <section>
      {title && (
        <h2 className="mb-4 text-h3 text-foreground">{title}</h2>
      )}
      <div className="space-y-0.5">
        {tracks.filter((t) => t && t.id).map((track, i) => (
          <TrackRow key={track.id} track={track} index={i} />
        ))}
      </div>
    </section>
  );
}
