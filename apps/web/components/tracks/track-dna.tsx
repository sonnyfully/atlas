import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TrackHero } from "@/components/tracks/track-hero";
import { getSceneAccent } from "@/lib/colors";
import {
  describeFeatureContribution,
  featureLabel,
} from "@/lib/track-dna";
import type {
  AtlasTrackFeatureContributionV1,
  AtlasTrackProvenanceV1,
  CollisionTrackResult,
  SimilarTrackResult,
  TrackDnaResponse,
  TrackDnaSectionStatus,
} from "@atlas/shared";

interface TrackDnaProps {
  dna: TrackDnaResponse;
}

const REASON_LABELS: Record<string, string> = {
  SCENE_BRIDGE: "Scene bridge",
  SCENE_COLLISION: "Collision-prone",
  SCENE_CORE: "Scene core",
  HIGH_ENERGY: "High energy",
  FAST_TEMPO: "Fast tempo",
};

function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code.replace(/_/g, " ");
}

function normalizedPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeAdjacentScene(score: number, provenance: AtlasTrackProvenanceV1): string {
  const crossSceneNeighbors = provenance.similarity_context?.cross_scene_neighbors ?? 0;
  if (score >= 0.75 && crossSceneNeighbors > 0) return "Closest crossover lane for this track.";
  if (score >= 0.75) return "Closest neighboring scene by persisted graph score.";
  if (score >= 0.55) return "Shared edge with meaningful overlap.";
  return "Outer-ring neighbor with lighter graph pull.";
}

function describeBpmFit(delta: number): string | null {
  if (!Number.isFinite(delta) || delta < 0) return null;
  if (delta < 0.5) return "Tempo aligned";
  if (delta < 10) return `${delta.toFixed(1)} BPM apart`;
  return `${Math.round(delta)} BPM apart`;
}

function describeKeyRelation(value: string): string | null {
  switch (value) {
    case "MATCH":
      return "Same key";
    case "FIFTH":
      return "Harmonic fifth";
    case "NEIGHBOR":
      return "Neighbor key";
    case "DISTANT":
      return "Distant key";
    default:
      return null;
  }
}

function statusToneClasses(status: TrackDnaSectionStatus["state"]): string {
  switch (status) {
    case "ready":
      return "border-border/70 bg-muted/35 text-muted-foreground";
    case "ready_empty":
      return "border-border/70 bg-muted/25 text-muted-foreground";
    case "not_ready":
      return "border-border/70 bg-muted/30 text-foreground";
    case "no_active_build":
    case "no_graph_data":
      return "border-border/70 bg-muted/20 text-foreground";
    default:
      return "border-border/70 bg-muted/25 text-muted-foreground";
  }
}

function statusLabel(status: TrackDnaSectionStatus["state"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "ready_empty":
      return "Empty";
    case "not_ready":
      return "Pending";
    case "no_active_build":
      return "No build";
    case "no_graph_data":
      return "Missing graph";
    default:
      return "Unavailable";
  }
}

function SectionStateNote({
  status,
  compact = false,
}: {
  status: TrackDnaSectionStatus;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${statusToneClasses(status.state)} ${
        compact ? "text-caption" : "text-body-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{statusLabel(status.state)}</span>
        <Badge variant="outline">{statusLabel(status.state)}</Badge>
      </div>
      <p className="mt-2">{status.message}</p>
    </div>
  );
}

function AttributeBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-sm text-muted-foreground">{label}</span>
        <span className="text-caption font-mono text-muted-foreground tabular-nums">
          {normalizedPercent(value)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-scene transition-[width] duration-medium ease-out motion-reduce:transition-none"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

function CollisionCard({ item }: { item: CollisionTrackResult }) {
  const bpmFit = describeBpmFit(item.bpm_delta);
  const keyRelation = describeKeyRelation(item.key_relation);

  return (
    <div className="rounded-xl border border-border/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/track/${item.track.id}`}
            className="block truncate text-body-sm font-medium transition hover:text-primary"
          >
            {item.track.title}
          </Link>
          <p className="truncate text-caption text-muted-foreground">{item.track.artist}</p>
        </div>
        <Badge variant="scene">{Math.round(item.score * 100)}%</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.reason_labels.map((label) => (
          <Badge key={`${item.track.id}-${label}`} variant="outline">
            {label}
          </Badge>
        ))}
      </div>

      <div className="mt-3 space-y-1 text-caption text-muted-foreground">
        {bpmFit && <p>{bpmFit}</p>}
        {keyRelation && <p>{keyRelation}</p>}
        {item.track.scene_id && item.track.scene_name && (
          <p>
            Scene{" "}
            <Link
              href={`/scenes/${item.track.scene_id}`}
              className="transition hover:text-primary"
            >
              {item.track.scene_name}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function SimilarTrackCard({ item }: { item: SimilarTrackResult }) {
  return (
    <div className="rounded-xl border border-border/70 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/track/${item.track.id}`}
            className="block truncate text-body-sm font-medium transition hover:text-primary"
          >
            {item.track.title}
          </Link>
          <p className="truncate text-caption text-muted-foreground">{item.track.artist}</p>
        </div>
        <Badge variant="scene">{Math.round(item.score * 100)}%</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline">Basis: {item.basis}</Badge>
        {item.model_version && <Badge variant="outline">Model: {item.model_version}</Badge>}
        {item.track.scene_name && <Badge variant="outline">Scene: {item.track.scene_name}</Badge>}
      </div>
    </div>
  );
}

function TopFeatureCard({ feature }: { feature: AtlasTrackFeatureContributionV1 }) {
  return (
    <div className="rounded-xl border border-border/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm font-medium">{featureLabel(feature.name)}</p>
        <Badge variant="outline">{normalizedPercent(feature.value)}</Badge>
      </div>
      <p className="mt-2 text-caption text-muted-foreground">
        {describeFeatureContribution(feature)}
      </p>
    </div>
  );
}

export function TrackActionRail({ dna }: TrackDnaProps) {
  const sceneId = dna.scene_home?.scene.id;
  const hasCollisions = dna.collisions.length > 0 || dna.section_states.collisions.state !== "not_ready";
  const hasSimilar = dna.similar_tracks.length > 0 || dna.section_states.similar_tracks.state !== "not_ready";

  return (
    <Card variant="scene">
      <CardContent className="flex flex-wrap gap-2 pt-6">
        <Link href="/">
          <Button variant="outline" size="sm">
            Back Home
          </Button>
        </Link>
        <Link href={sceneId ? `/scenes/${sceneId}` : "/scenes"}>
          <Button variant="outline" size="sm">
            {sceneId ? "Open Scene" : "Browse Scenes"}
          </Button>
        </Link>
        <Link href="/map">
          <Button variant="outline" size="sm">
            Open Map
          </Button>
        </Link>
        {hasCollisions ? (
          <a href="#collision-lab">
            <Button variant="scene" size="sm">
              Jump to Collisions
            </Button>
          </a>
        ) : null}
        {hasSimilar ? (
          <a href="#similarity-context">
            <Button variant="scene" size="sm">
              Jump to Similarity
            </Button>
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TrackDnaStoryContent({ dna }: TrackDnaProps) {
  const track = dna.track;
  const isReady = track.status === "READY";
  const topFeatures = dna.provenance.top_features ?? [];
  const reasonCodes = dna.provenance.reason_codes ?? [];

  if (!isReady) {
    return (
      <Card variant="scene">
        <CardHeader>
          <CardTitle>Track DNA</CardTitle>
          <CardDescription>
            Atlas has the identity shell live now and will fill in feature, scene, collision, and
            similarity context as analysis completes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-5 py-4">
            <p className="text-caption uppercase tracking-[0.2em] text-muted-foreground">
              Placement Summary
            </p>
            <p className="mt-2 text-body-sm text-foreground">{dna.placement_summary}</p>
            {track.status === "ERROR" && track.error ? (
              <p className="mt-3 text-caption text-destructive">{track.error}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 px-4 py-3">
              <p className="text-caption text-muted-foreground">Status</p>
              <p className="text-body-sm font-medium capitalize">{track.status.toLowerCase()}</p>
            </div>
            <div className="rounded-xl border border-border/70 px-4 py-3">
              <p className="text-caption text-muted-foreground">Build</p>
              <p className="text-body-sm font-medium">
                {dna.build ? `#${dna.build.build_seq}` : "No active build"}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <SectionStateNote status={dna.section_states.scene_home} compact />
            <SectionStateNote status={dna.section_states.similar_tracks} compact />
            <SectionStateNote status={dna.section_states.adjacent_scenes} compact />
            <SectionStateNote status={dna.section_states.collisions} compact />
          </div>

          <Separator />

          <div>
            <p className="text-caption text-muted-foreground">File</p>
            <p className="text-body-sm font-medium break-all">{track.original_filename}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="scene" id="core-traits">
          <CardHeader>
            <CardTitle>Core Traits</CardTitle>
            <CardDescription>
              What this track is, and why Atlas positions it where it does.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-5 py-4">
              <p className="text-caption uppercase tracking-[0.2em] text-muted-foreground">
                Placement Summary
              </p>
              <p className="mt-2 text-body-sm text-foreground">{dna.placement_summary}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 px-4 py-3">
                <p className="text-caption text-muted-foreground">Tempo</p>
                <p className="text-body-sm font-medium font-mono tabular-nums">
                  {track.bpm > 0 ? `${Math.round(track.bpm)} BPM` : "Unknown"}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 px-4 py-3">
                <p className="text-caption text-muted-foreground">Key</p>
                <p className="text-body-sm font-medium">{track.key || "Unknown"}</p>
              </div>
              <div className="rounded-xl border border-border/70 px-4 py-3">
                <p className="text-caption text-muted-foreground">Build</p>
                <p className="text-body-sm font-medium">
                  {dna.build ? `#${dna.build.build_seq}` : "No active build"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AttributeBar label="Energy" value={dna.analysis.energy} />
              <AttributeBar label="Brightness" value={dna.analysis.brightness} />
              <AttributeBar label="Loudness" value={dna.analysis.loudness} />
              <AttributeBar label="Valence" value={dna.analysis.valence} />
              <AttributeBar label="Complexity" value={dna.analysis.complexity} />
              <AttributeBar label="Tempo Drive" value={dna.analysis.tempo} />
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <p className="text-caption text-muted-foreground">Top Differentiators</p>
                <p className="text-body-sm text-foreground">
                  {topFeatures.length > 0
                    ? describeFeatureContribution(topFeatures[0])
                    : "Atlas uses the current analysis cohort to explain this placement."}
                </p>
              </div>
              {topFeatures.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {topFeatures.map((feature) => (
                    <TopFeatureCard key={feature.name} feature={feature} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="scene" id="scene-home">
          <CardHeader>
            <CardTitle>Scene Home</CardTitle>
            <CardDescription>
              Where the track lives, and how confidently Atlas places it there.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {dna.scene_home ? (
              <>
                <div>
                  <Link
                    href={`/scenes/${dna.scene_home.scene.id}`}
                    className="text-lg font-semibold transition hover:text-primary"
                  >
                    {dna.scene_home.scene.name}
                  </Link>
                  <p className="mt-2 text-body-sm text-foreground">{dna.scene_home.descriptor}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-caption text-muted-foreground">Membership</p>
                    <p className="text-body-sm font-medium">
                      {normalizedPercent(dna.scene_home.membership_score)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-caption text-muted-foreground">Cross-scene neighbors</p>
                    <p className="text-body-sm font-medium">
                      {dna.provenance.similarity_context?.cross_scene_neighbors ?? 0}
                    </p>
                  </div>
                </div>

                {reasonCodes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {reasonCodes.map((code) => (
                      <Badge key={code} variant="outline">
                        {reasonLabel(code)}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <SectionStateNote status={dna.section_states.scene_home} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="scene" id="nearby-world">
        <CardHeader>
          <CardTitle>Nearby World</CardTitle>
          <CardDescription>
            Persisted adjacent scenes that explain the track&apos;s surrounding territory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dna.adjacent_scenes.length === 0 ? (
            <SectionStateNote status={dna.section_states.adjacent_scenes} />
          ) : (
            <>
              {dna.section_states.adjacent_scenes.state !== "ready" && (
                <SectionStateNote status={dna.section_states.adjacent_scenes} compact />
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {dna.adjacent_scenes.map((item) => (
                  <div
                    key={item.scene.id}
                    className="rounded-xl border border-border/70 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/scenes/${item.scene.id}`}
                        className="text-body-sm font-medium transition hover:text-primary"
                      >
                        {item.scene.name}
                      </Link>
                      <Badge variant="scene">{Math.round(item.score * 100)}%</Badge>
                    </div>
                    <p className="mt-2 text-caption text-muted-foreground">
                      {describeAdjacentScene(item.score, dna.provenance)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="scene" id="collision-lab">
        <CardHeader>
          <CardTitle>Collision Lab</CardTitle>
          <CardDescription>
            Persisted collision pairs that show where this track creates interesting crossover
            pull.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dna.collisions.length === 0 ? (
            <SectionStateNote status={dna.section_states.collisions} />
          ) : (
            <>
              {dna.section_states.collisions.state !== "ready" && (
                <SectionStateNote status={dna.section_states.collisions} compact />
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {dna.collisions.slice(0, 5).map((item) => (
                  <CollisionCard key={item.track.id} item={item} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="scene" id="similarity-context">
        <CardHeader>
          <CardTitle>Similarity Context</CardTitle>
          <CardDescription>
            Persisted nearest neighbors that frame the track&apos;s local atlas neighborhood.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="scene">
              Basis: {dna.similar_tracks[0]?.basis ?? dna.build?.similarity_basis ?? "audio"}
            </Badge>
            {dna.similar_tracks[0]?.model_version && (
              <Badge variant="outline">Model: {dna.similar_tracks[0].model_version}</Badge>
            )}
            {dna.provenance.similarity_context?.within_scene_rank && (
              <Badge variant="outline">
                Scene rank #{dna.provenance.similarity_context.within_scene_rank}
              </Badge>
            )}
          </div>

          {dna.similar_tracks.length === 0 ? (
            <SectionStateNote status={dna.section_states.similar_tracks} />
          ) : (
            <>
              {dna.section_states.similar_tracks.state !== "ready" && (
                <SectionStateNote status={dna.section_states.similar_tracks} compact />
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {dna.similar_tracks.map((item) => (
                  <SimilarTrackCard key={item.track.id} item={item} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function TrackDna({ dna }: TrackDnaProps) {
  const track = dna.track;
  const sceneAccent = getSceneAccent(track.id || track.artist);

  return (
    <div className="space-y-8" style={sceneAccent.cssVars}>
      <Card variant="scene">
        <CardContent className="pt-6">
          <TrackHero track={track} />
        </CardContent>
      </Card>

      <TrackActionRail dna={dna} />

      <TrackDnaStoryContent dna={dna} />
    </div>
  );
}
