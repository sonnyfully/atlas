import {
  getActiveAtlasBuildRecord,
  getRecentTracks,
  getScenesForActiveBuild,
  isHelixAvailable,
} from "@/lib/helix";
import { TrackList } from "@/components/tracks/track-list";
import { QueuePanel } from "@/components/layout/queue-panel";
import { CommandBar } from "@/components/discover/command-bar";
import {
  SearchProvider,
  SearchResults,
} from "@/components/tracks/search-tracks";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDiscoverSubtitle(uploadCount: number, latestReadyAt: string | null): string | null {
  if (uploadCount <= 0) {
    return "Start with a live upload or open a seeded build once Atlas has real graph truth.";
  }

  let lastReadyLabel: string | null = null;
  if (latestReadyAt) {
    const date = new Date(latestReadyAt);
    if (!Number.isNaN(date.getTime())) {
      lastReadyLabel = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    }
  }

  return `Use the latest DNA card as the main story${lastReadyLabel ? ` • Last ready ${lastReadyLabel}` : ""}.`;
}

export default async function HomePage() {
  const [tracks, helixAvailable, activeBuild, scenes] = await Promise.all([
    getRecentTracks(),
    isHelixAvailable(),
    getActiveAtlasBuildRecord(),
    getScenesForActiveBuild(),
  ]);
  const analyzingCount = tracks.filter(
    (track) => track.status === "PENDING" || track.status === "PROCESSING",
  ).length;
  const readyTracks = tracks.filter((track) => track.status === "READY");
  const latestReadyAt =
    readyTracks.find((track) => track.upload_date)?.upload_date ?? null;
  const latestReadyTrack = readyTracks[0] ?? null;
  const subtitle = formatDiscoverSubtitle(tracks.length, latestReadyAt);

  return (
    <SearchProvider>
      <div className="space-y-6 px-6 py-6 lg:px-8">
        <CommandBar
          uploadCount={tracks.length}
          readyCount={readyTracks.length}
          activeBuildSeq={activeBuild?.build_seq ?? null}
          sceneCount={scenes.length}
          latestReadyTrackId={latestReadyTrack?.id ?? null}
          latestReadyAt={latestReadyAt}
          analyzingCount={analyzingCount}
          subtitle={subtitle}
        />

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <SearchResults>
              {!helixAvailable ? (
                <div className="surface-panel px-6 py-10 text-center">
                  <h2 className="text-h3 text-foreground">We can&apos;t load tracks right now</h2>
                  <p className="mt-2 text-body-sm text-muted-foreground">
                    Please try again in a moment.
                  </p>
                  <Link href="/" className="mt-5 inline-flex">
                    <Button variant="outline">Retry</Button>
                  </Link>
                </div>
              ) : tracks.length > 0 ? (
                <section className="surface-panel space-y-4 p-3">
                  <div className="px-2 pt-1">
                    <h2 className="text-h3 text-foreground">Recent Uploads</h2>
                    <p className="mt-1 text-body-sm text-muted-foreground">
                      Open the latest READY track first, or pivot to scenes and map while analysis is still running.
                    </p>
                  </div>
                  <TrackList tracks={tracks} />
                </section>
              ) : (
                <div className="surface-panel py-16 text-center">
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

          <QueuePanel tracks={tracks} />
        </div>
      </div>
    </SearchProvider>
  );
}
