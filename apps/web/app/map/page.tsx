import { Compass } from "lucide-react";

export default function MapPage() {
  return (
    <div className="px-6 lg:px-8 py-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-h2 text-foreground">Sound Map</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Explore tracks and scenes plotted by sonic similarity.
        </p>
      </div>

      <div className="relative w-full aspect-[16/10] rounded-lg border border-border bg-muted/50 overflow-hidden flex items-center justify-center">
        <div className="text-center space-y-3">
          <Compass className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-body-sm text-muted-foreground">
            Sound Map will be available once enough tracks are uploaded and scenes are generated.
          </p>
        </div>
      </div>
    </div>
  );
}
