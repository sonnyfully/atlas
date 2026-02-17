import { notFound } from "next/navigation";
import { getCoverUrl } from "@/lib/covers";

const SAMPLE_IDS = [
  "1f10966f-517f-6fd8-8724-010203040506",
  "1f10ba89-e89d-6c2f-bdd8-010203040506",
  "atlas-dev-alpha",
  "atlas-dev-beta",
  "atlas-dev-gamma",
  "atlas-dev-delta",
];

const SIZES = [32, 40, 64, 96, 160, 240];

export default function DevCoversPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Blobtoon Preview</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic SVG covers served by <code>/api/cover/blobtoon/[trackId].svg</code>
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Sizes</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SIZES.map((size) => (
            <div key={size} className="space-y-2">
              <img
                src={getCoverUrl(SAMPLE_IDS[0], { s: size })}
                alt=""
                width={size}
                height={size}
                className="aspect-square rounded-md border border-border object-cover"
              />
              <p className="text-xs text-muted-foreground">{size}px</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-foreground">Variation by Track</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {SAMPLE_IDS.map((trackId) => (
            <div key={trackId} className="space-y-2">
              <img
                src={getCoverUrl(trackId, { s: 96 })}
                alt=""
                width={96}
                height={96}
                className="aspect-square rounded-md border border-border object-cover"
              />
              <p className="truncate text-xs text-muted-foreground">{trackId}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
