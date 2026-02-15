"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackRow } from "@/components/tracks/track-row";
import type { Track } from "@atlas/shared";

export function LoadMoreButton({
  sort,
  initialCount,
}: {
  sort: string;
  initialCount: number;
}) {
  const [extraTracks, setExtraTracks] = useState<Track[]>([]);
  const [offset, setOffset] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tracks?sort=${sort}&offset=${offset}&limit=25`
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      const tracks: Track[] = Array.isArray(data) ? data : [];
      setExtraTracks((prev) => [...prev, ...tracks]);
      setOffset((prev) => prev + tracks.length);
      if (tracks.length < 25) setHasMore(false);
    } catch (err) {
      console.error("Load more failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {extraTracks.length > 0 && (
        <div className="space-y-0.5">
          {extraTracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={initialCount + i}
            />
          ))}
        </div>
      )}
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
