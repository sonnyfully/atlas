import { getRecentTracks, isHelixAvailable } from "@/lib/helix";
import { TrackList } from "@/components/tracks/track-list";
import { RightRail } from "@/components/layout/right-rail";
import {
  SearchProvider,
  SearchInput,
  SearchResults,
} from "@/components/tracks/search-tracks";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [tracks, helixAvailable] = await Promise.all([
    getRecentTracks(),
    isHelixAvailable(),
  ]);

  return (
    <SearchProvider>
      <div className="px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-h2 text-foreground">Discover</h1>
          <div className="flex items-center gap-3">
            <SearchInput />
            <Link href="/upload">
              <Button variant="outline" size="sm" className="h-11 gap-2 px-4">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-8">
          {/* Main feed — swapped for search results when active */}
          <div className="min-w-0 flex-1">
            <SearchResults>
              {!helixAvailable ? (
                <div className="rounded-lg border border-border bg-muted/20 px-6 py-10 text-center">
                  <h2 className="text-h3 text-foreground">We can&apos;t load tracks right now</h2>
                  <p className="mt-2 text-body-sm text-muted-foreground">
                    Please try again in a moment.
                  </p>
                  <Link href="/" className="mt-5 inline-flex">
                    <Button variant="outline">Retry</Button>
                  </Link>
                </div>
              ) : tracks.length > 0 ? (
                <TrackList title="Recent Uploads" tracks={tracks} />
              ) : (
                <div className="py-16 text-center">
                  <h2 className="text-h3 text-foreground">No uploads yet</h2>
                  <p className="mb-5 mt-2 text-body-sm text-muted-foreground">
                    Upload a track to start building its DNA.
                  </p>
                  <Link href="/upload">
                    <Button variant="outline" className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload
                    </Button>
                  </Link>
                </div>
              )}
            </SearchResults>
          </div>

          {/* Right rail */}
          <RightRail tracks={tracks} />
        </div>
      </div>
    </SearchProvider>
  );
}
