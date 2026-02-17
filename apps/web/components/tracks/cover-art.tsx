"use client";

import { useEffect, useMemo, useState } from "react";
import { getCoverUrl } from "@/lib/covers";
import { cn, trackCoverColor } from "@/lib/utils";

interface CoverArtProps {
  trackId: string;
  size: number;
  className?: string;
  alt?: string;
  loading?: "eager" | "lazy";
}

export function CoverArt({
  trackId,
  size,
  className,
  alt = "",
  loading = "lazy",
}: CoverArtProps) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => getCoverUrl(trackId, { s: size }), [size, trackId]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className={cn("relative aspect-square overflow-hidden", className)}
      style={{ backgroundColor: trackCoverColor(trackId) }}
    >
      {!failed && (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          loading={loading}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
