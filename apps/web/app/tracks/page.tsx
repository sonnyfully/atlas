import { getAllTracks } from "@/lib/helix";
import { TrackList } from "@/components/tracks/track-list";
import { LibraryTabs } from "./library-tabs";
import { LoadMoreButton } from "./load-more";

export const dynamic = "force-dynamic";

export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; offset?: string }>;
}) {
  const params = await searchParams;
  const sort = params.sort === "alpha" ? "alpha" : "recent";
  const tracks = await getAllTracks(sort, 0, 25);

  return (
    <div className="px-6 lg:px-8 py-8">
      <h1 className="mb-6 text-h2 text-foreground">Library</h1>
      <LibraryTabs activeSort={sort} />
      <div className="mt-6">
        {tracks.length > 0 ? (
          <TrackList tracks={tracks} />
        ) : (
          <p className="py-8 text-center text-body-sm text-muted-foreground">
            No tracks in your library yet.
          </p>
        )}
        {tracks.length >= 25 && <LoadMoreButton sort={sort} initialCount={tracks.length} />}
      </div>
    </div>
  );
}
