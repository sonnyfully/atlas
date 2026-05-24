"use client";

import { useEffect, useMemo } from "react";
import type { Track } from "@atlas/shared";
import { TrackRowRich } from "@/components/tracks/track-row-rich";
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
      {tracks.length === 0 ? (
        <div className="surface-panel px-6 py-10 text-center">
          <p className="text-body-sm text-muted-foreground">No tracks to show yet.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tracks.filter((t) => t && t.id).map((track, i) => (
            <TrackRowRich key={track.id} track={track} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
