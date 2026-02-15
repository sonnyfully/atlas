import { notFound } from "next/navigation";
import { getTrack } from "@/lib/helix";
import { TrackHero } from "@/components/tracks/track-hero";
import { TrackDna } from "@/components/tracks/track-dna";
import { Separator } from "@/components/ui/separator";
import { TrackStatusPoller } from "@/components/tracks/track-status-poller";
import { SimilarTracks } from "@/components/tracks/similar-tracks";

export const dynamic = "force-dynamic";

interface TrackPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { id } = await params;
  const track = await getTrack(id);

  if (!track) notFound();

  const isProcessing =
    track.status === "PENDING" || track.status === "PROCESSING";

  return (
    <div className="px-6 lg:px-8 py-8 max-w-4xl">
      <TrackHero track={track} />

      <Separator className="my-8" />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <SimilarTracks trackId={track.id} />
        {/* Track DNA */}
        <TrackDna track={track} />
      </div>

      {/* Auto-refresh when still processing */}
      {isProcessing && <TrackStatusPoller trackId={track.id} />}
    </div>
  );
}
