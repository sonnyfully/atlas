import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Track } from "@atlas/shared";

interface TrackDnaProps {
  track: Track;
}

function AttributeBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-muted-foreground">{label}</span>
        <span className="text-caption font-mono text-muted-foreground tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export function TrackDna({ track }: TrackDnaProps) {
  const isReady = track.status === "READY";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">Track DNA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isReady ? (
          <div className="py-4 text-center text-body-sm text-muted-foreground">
            {track.status === "ERROR"
              ? "Analysis failed"
              : "Analyzing track..."}
          </div>
        ) : (
          <>
            {/* Text attributes */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <span className="text-caption text-muted-foreground">Key</span>
                <p className="text-body-sm font-medium">
                  {track.key || "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">
                  Status
                </span>
                <p className="text-body-sm font-medium capitalize">
                  {track.status.toLowerCase()}
                </p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">
                  Tempo
                </span>
                <p className="text-body-sm font-medium font-mono tabular-nums">
                  {track.bpm > 0
                    ? `${Math.round(track.bpm)} BPM`
                    : "Unknown"}
                </p>
              </div>
            </div>

            <Separator />

            {/* Attribute bars */}
            <div className="space-y-4">
              <AttributeBar label="Energy" value={track.energy} />
            </div>

            <Separator />

            {/* File info */}
            <div>
              <span className="mb-2 block text-caption text-muted-foreground">
                File Info
              </span>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {track.original_filename}
                </Badge>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
