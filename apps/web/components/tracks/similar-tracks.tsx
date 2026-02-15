import { getSimilarTracks } from "@/lib/helix";
import { TrackRowCompact } from "./track-row-compact";

interface SimilarTracksProps {
    trackId: string;
}

export async function SimilarTracks({ trackId }: SimilarTracksProps) {
    const similarTracks = await getSimilarTracks(trackId);

    if (similarTracks.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Similar Tracks</h2>
            <div className="space-y-2">
                {similarTracks.slice(0, 5).map((track) => (
                    <TrackRowCompact key={track.id} track={track} />
                ))}
            </div>
        </div>
    );
}
