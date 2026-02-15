"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface TrackStatusPollerProps {
  trackId: string;
  intervalMs?: number;
}

export function TrackStatusPoller({
  trackId,
  intervalMs = 2000,
}: TrackStatusPollerProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/tracks/${trackId}`);
        if (!res.ok) return;
        const track = await res.json();
        if (track.status === "READY" || track.status === "ERROR") {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Silently retry
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [trackId, intervalMs, router]);

  return null;
}
