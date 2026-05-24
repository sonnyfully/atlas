import { notFound } from "next/navigation";
import { getTrackDna } from "@/lib/helix";
import { TrackDna } from "@/components/tracks/track-dna";
import { TrackStatusPoller } from "@/components/tracks/track-status-poller";

export const dynamic = "force-dynamic";

interface TrackPageProps {
  params: Promise<{ id: string }>;
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { id } = await params;
  const dna = await getTrackDna(id);

  if (!dna) notFound();

  const track = dna.track;

  const isProcessing =
    track.status === "PENDING" || track.status === "PROCESSING";

  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl">
      <TrackDna dna={dna} />

      {/* Auto-refresh when still processing */}
      {isProcessing && <TrackStatusPoller trackId={track.id} />}
    </div>
  );
}
