"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Compass,
  Disc3,
  Music4,
  Network,
  Play,
  RefreshCw,
  Sparkles,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { readAnalysisNumber } from "@/lib/atlas-color";
import { getSceneAccent, useSceneAccent } from "@/lib/colors";
import { usePlayer } from "@/lib/player-context";
import { cn } from "@/lib/utils";
import type {
  AtlasMapTrackV1,
  AtlasMapV1Response,
  AtlasMapSceneV1,
  AtlasSceneGraphEdgeV1,
  Track,
} from "@atlas/shared";
import { SoundMapScene } from "@/components/map/3d/SoundMapScene";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDuration(seconds?: number): string {
  if (!Number.isFinite(seconds) || !seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function asTrack(track: AtlasMapTrackV1): Track {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    filepath: "",
    original_filename: track.title,
    file_hash: track.id,
    status: "READY",
    duration_sec: track.duration_s ?? 0,
    bpm: track.bpm ?? 0,
    key: typeof track.key === "string" ? track.key : String(track.key ?? ""),
    energy: readAnalysisNumber(track.analysis, "energy", 0.5),
    brightness: readAnalysisNumber(track.analysis, "brightness", 0.5),
    loudness: readAnalysisNumber(track.analysis, "loudness", 0.5),
    complexity: readAnalysisNumber(track.analysis, "complexity", 0.5),
    bpm_confidence: 0,
    key_confidence: 0,
    analysis_version: "atlas-map-v1",
    embedding_version: "",
    upload_date: "",
    error: "",
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input);
}

function validateTrack(input: unknown): input is AtlasMapTrackV1 {
  if (!isRecord(input)) return false;
  if (typeof input.id !== "string") return false;
  if (typeof input.title !== "string") return false;
  if (typeof input.artist !== "string") return false;
  if (typeof input.scene_id !== "string") return false;
  if (!isRecord(input.pos)) return false;
  if (typeof input.pos.x !== "number" || typeof input.pos.y !== "number") return false;
  if (!isRecord(input.analysis)) return false;
  return true;
}

function validateScene(input: unknown): input is AtlasMapSceneV1 {
  if (!isRecord(input)) return false;
  if (typeof input.id !== "string") return false;
  if (!isRecord(input.centroid_pos)) return false;
  if (typeof input.centroid_pos.x !== "number") return false;
  if (typeof input.centroid_pos.y !== "number") return false;
  if (typeof input.size !== "number") return false;
  return true;
}

function parsePayload(input: unknown): AtlasMapV1Response | null {
  if (!isRecord(input)) return null;
  if (!isRecord(input.world)) return null;
  if (typeof input.world.world_size !== "number") return null;
  if (typeof input.world.version_hash !== "string") return null;
  if (!Array.isArray(input.tracks) || !input.tracks.every(validateTrack)) return null;
  if (!Array.isArray(input.scenes) || !input.scenes.every(validateScene)) return null;
  if (!Array.isArray(input.scene_graph_edges)) return null;

  for (const edge of input.scene_graph_edges) {
    if (!isRecord(edge)) return null;
    if (typeof edge.from_scene_id !== "string") return null;
    if (typeof edge.to_scene_id !== "string") return null;
    if (typeof edge.weight !== "number") return null;
  }

  return input as unknown as AtlasMapV1Response;
}

function dedupeEdges(edges: AtlasSceneGraphEdgeV1[]): AtlasSceneGraphEdgeV1[] {
  const deduped = new Map<string, AtlasSceneGraphEdgeV1>();
  for (const edge of edges) {
    const a = edge.from_scene_id < edge.to_scene_id ? edge.from_scene_id : edge.to_scene_id;
    const b = edge.from_scene_id < edge.to_scene_id ? edge.to_scene_id : edge.from_scene_id;
    const key = `${a}:${b}`;
    const previous = deduped.get(key);
    if (!previous || edge.weight > previous.weight) {
      deduped.set(key, edge);
    }
  }
  return Array.from(deduped.values());
}

function MetricChip({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === "") return null;
  return (
    <div className="rounded-full border border-slate-200 bg-white/92 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600 backdrop-blur-md">
      {label} · {value}
    </div>
  );
}

function HeroStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Music4;
}) {
  return (
    <div className="min-w-[122px] rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2 text-slate-300/58">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-2 text-[1.7rem] font-semibold tracking-[-0.04em] text-slate-50">{value}</p>
    </div>
  );
}

function InspectorStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">{children}</p>;
}

function FeatureMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-500">
        <span>{label}</span>
        <span className="text-slate-900">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ff7a1a,#ffc68a)]"
          style={{ width: `${clamp(value, 0, 1) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface AdjacentSceneItem {
  scene: AtlasMapSceneV1;
  weight: number;
  type?: AtlasSceneGraphEdgeV1["type"];
}

interface SceneStats {
  trackCount: number;
  avgEnergy: number;
  avgBridge: number;
  avgCollision: number;
  avgBpm: number;
}

export function AtlasMapV1() {
  const { play, currentTrack } = usePlayer();
  const cacheRef = useRef(new Map<string, AtlasMapV1Response>());
  const etagRef = useRef<string | null>(null);

  const [payload, setPayload] = useState<AtlasMapV1Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);

  const fetchMap = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/atlas/map?v=1", {
        cache: "no-store",
        headers: etagRef.current ? { "If-None-Match": etagRef.current } : undefined,
      });

      if (response.status === 304) {
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Map request failed (${response.status})`);
      }

      const json = (await response.json()) as unknown;
      const parsed = parsePayload(json);
      if (!parsed) {
        throw new Error("Invalid atlas payload schema.");
      }

      const existing = cacheRef.current.get(parsed.world.version_hash);
      if (existing) {
        setPayload(existing);
      } else {
        cacheRef.current.set(parsed.world.version_hash, parsed);
        setPayload(parsed);
      }

      const nextEtag = response.headers.get("etag");
      if (nextEtag) etagRef.current = nextEtag;
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Failed to load map";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMap();
  }, [fetchMap]);

  const trackById = useMemo(() => {
    const map = new Map<string, AtlasMapTrackV1>();
    for (const track of payload?.tracks ?? []) {
      map.set(track.id, track);
    }
    return map;
  }, [payload?.tracks]);

  const sceneById = useMemo(() => {
    const map = new Map<string, AtlasMapSceneV1>();
    for (const scene of payload?.scenes ?? []) {
      map.set(scene.id, scene);
    }
    return map;
  }, [payload?.scenes]);

  useEffect(() => {
    if (!payload) return;
    if (selectedId && !payload.tracks.some((track) => track.id === selectedId)) {
      setSelectedId(null);
    }
    if (selectedSceneId && !payload.scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(null);
    }
  }, [payload, selectedId, selectedSceneId]);

  useEffect(() => {
    setHighlightedIds([]);
  }, [selectedId, selectedSceneId, payload?.world.version_hash]);

  const dedupedEdges = useMemo(
    () => dedupeEdges(payload?.scene_graph_edges ?? []),
    [payload?.scene_graph_edges]
  );

  const sceneMembers = useMemo(() => {
    const map = new Map<string, AtlasMapTrackV1[]>();
    for (const scene of payload?.scenes ?? []) {
      map.set(scene.id, []);
    }

    for (const track of payload?.tracks ?? []) {
      if (!map.has(track.scene_id)) {
        map.set(track.scene_id, []);
      }
      map.get(track.scene_id)?.push(track);
    }

    for (const tracks of map.values()) {
      tracks.sort((a, b) => {
        const scoreA = (a.bridge_score ?? 0) + (a.collision_score ?? 0);
        const scoreB = (b.bridge_score ?? 0) + (b.collision_score ?? 0);
        return scoreB - scoreA || a.title.localeCompare(b.title);
      });
    }

    return map;
  }, [payload?.scenes, payload?.tracks]);

  const adjacencyByScene = useMemo(() => {
    const map = new Map<string, AdjacentSceneItem[]>();
    for (const scene of payload?.scenes ?? []) {
      map.set(scene.id, []);
    }

    for (const edge of dedupedEdges) {
      const fromScene = sceneById.get(edge.from_scene_id);
      const toScene = sceneById.get(edge.to_scene_id);
      if (!fromScene || !toScene) continue;

      map.get(fromScene.id)?.push({ scene: toScene, weight: edge.weight, type: edge.type });
      map.get(toScene.id)?.push({ scene: fromScene, weight: edge.weight, type: edge.type });
    }

    for (const items of map.values()) {
      items.sort((a, b) => b.weight - a.weight || a.scene.id.localeCompare(b.scene.id));
    }

    return map;
  }, [dedupedEdges, payload?.scenes, sceneById]);

  const sceneStats = useMemo(() => {
    const map = new Map<string, SceneStats>();
    for (const scene of payload?.scenes ?? []) {
      const members = sceneMembers.get(scene.id) ?? [];
      const divisor = Math.max(members.length, 1);

      map.set(scene.id, {
        trackCount: members.length,
        avgEnergy:
          members.reduce((sum, track) => sum + readAnalysisNumber(track.analysis, "energy", 0.5), 0) / divisor,
        avgBridge:
          members.reduce((sum, track) => sum + (track.bridge_score ?? 0), 0) / divisor,
        avgCollision:
          members.reduce((sum, track) => sum + (track.collision_score ?? 0), 0) / divisor,
        avgBpm:
          members.reduce((sum, track) => sum + (Number.isFinite(track.bpm) ? (track.bpm ?? 0) : 0), 0) / divisor,
      });
    }
    return map;
  }, [payload?.scenes, sceneMembers]);

  const selectedTrack = selectedId ? trackById.get(selectedId) ?? null : null;
  const hoveredTrack = hoveredId ? trackById.get(hoveredId) ?? null : null;
  const selectedScene = selectedTrack
    ? sceneById.get(selectedTrack.scene_id) ?? null
    : selectedSceneId
      ? sceneById.get(selectedSceneId) ?? null
      : null;
  const hoveredScene = hoveredTrack
    ? sceneById.get(hoveredTrack.scene_id) ?? null
    : hoveredSceneId
      ? sceneById.get(hoveredSceneId) ?? null
      : null;

  const inspectorScene = selectedTrack
    ? sceneById.get(selectedTrack.scene_id) ?? null
    : selectedScene;
  const inspectorSceneId = inspectorScene?.id ?? null;
  const inspectorNeighbors = inspectorSceneId ? adjacencyByScene.get(inspectorSceneId) ?? [] : [];
  const inspectorSceneTracks = inspectorSceneId ? sceneMembers.get(inspectorSceneId) ?? [] : [];
  const inspectorSceneStats = inspectorSceneId ? sceneStats.get(inspectorSceneId) ?? null : null;
  const highlightedSet = useMemo(() => new Set(highlightedIds), [highlightedIds]);
  const nowPlayingId = currentTrack?.id ?? null;
  const shellAccent = useSceneAccent(undefined, "atlas-world-shell");
  const sceneAccent = useSceneAccent(
    inspectorScene?.id ?? hoveredScene?.id,
    selectedTrack?.id ?? hoveredTrack?.id ?? "atlas-map"
  );

  const onPlay = useCallback(() => {
    if (!selectedTrack) return;
    play(asTrack(selectedTrack));
  }, [play, selectedTrack]);

  const onSelectTrack = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;
      const track = trackById.get(id);
      if (track) {
        setSelectedSceneId(track.scene_id);
      }
    },
    [trackById]
  );

  const onSelectScene = useCallback(
    (id: string | null) => {
      setSelectedSceneId(id);
      if (!id) {
        setSelectedId(null);
        return;
      }

      const activeTrack = selectedId ? trackById.get(selectedId) ?? null : null;
      if (activeTrack && activeTrack.scene_id !== id) {
        setSelectedId(null);
      }
    },
    [selectedId, trackById]
  );

  const onFindSimilar = useCallback(() => {
    if (!payload || !selectedTrack) return;

    if (Array.isArray(selectedTrack.similar_neighbor_ids) && selectedTrack.similar_neighbor_ids.length > 0) {
      setHighlightedIds([
        ...new Set([selectedTrack.id, ...selectedTrack.similar_neighbor_ids.slice(0, 20)]),
      ]);
      return;
    }

    const neighboringScenes = new Set<string>([selectedTrack.scene_id]);
    for (const edge of payload.scene_graph_edges) {
      if (edge.from_scene_id === selectedTrack.scene_id) {
        neighboringScenes.add(edge.to_scene_id);
      } else if (edge.to_scene_id === selectedTrack.scene_id) {
        neighboringScenes.add(edge.from_scene_id);
      }
    }

    setHighlightedIds(
      payload.tracks.filter((track) => neighboringScenes.has(track.scene_id)).map((track) => track.id)
    );
  }, [payload, selectedTrack]);

  const onClearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedSceneId(null);
    setHighlightedIds([]);
  }, []);

  const hasEnoughTracks = (payload?.tracks.length ?? 0) >= 3;

  useEffect(() => {
    if (hasEnoughTracks) return;
    setHoveredId(null);
    setHoveredSceneId(null);
    setSelectedId(null);
    setSelectedSceneId(null);
    setHighlightedIds([]);
  }, [hasEnoughTracks]);

  const hoverSceneAccent = hoveredScene ? getSceneAccent(hoveredScene.id) : null;

  return (
    <div className="relative min-h-full overflow-hidden px-4 py-4 md:px-6 md:py-6 lg:px-8" style={shellAccent.cssVars}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.05),transparent_22%),linear-gradient(180deg,#ffffff_0%,#fbfbfc_46%,#f8fafc_100%)]" />

      <div className="relative space-y-4">
        <section className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] md:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-slate-500">Atlas Map</p>
            <h1 className="mt-2 text-[clamp(1.6rem,3vw,2.35rem)] font-semibold tracking-[-0.05em] text-slate-950">
              Map of sound
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <MetricChip label="Tracks" value={payload?.tracks.length ?? "—"} />
            <MetricChip label="Scenes" value={payload?.scenes.length ?? "—"} />
            <MetricChip label="Links" value={payload ? dedupedEdges.length : "—"} />
            <Button
              variant="outline"
              className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={() => void fetchMap()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-slate-200 bg-slate-50 text-slate-900 hover:bg-white"
            >
              <Link href="/tracks">Library</Link>
            </Button>
          </div>
        </section>

        {loading && !payload ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500">
            Loading the atlas cartography layer...
          </div>
        ) : error && !payload ? (
          <div className="rounded-[28px] border border-red-500/24 bg-red-500/8 px-5 py-4 text-sm text-slate-950">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span>{error}</span>
            </div>
          </div>
        ) : payload ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <div className="rounded-[34px] border border-slate-200 bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.08)] md:p-3">
                {hasEnoughTracks ? (
                  <div className="relative">
                    <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-wrap gap-2 md:left-5 md:top-5">
                      <MetricChip label="Focus" value={selectedTrack ? "Track" : inspectorScene ? "Scene" : "World"} />
                      <MetricChip label="World" value={payload.world.world_size} />
                    </div>

                    <SoundMapScene
                      payload={payload}
                      selectedId={selectedId}
                      selectedSceneId={inspectorSceneId}
                      hoveredId={hoveredId}
                      hoveredSceneId={hoveredScene?.id ?? null}
                      highlightedIds={highlightedSet}
                      nowPlayingId={nowPlayingId}
                      onHover={setHoveredId}
                      onSelect={onSelectTrack}
                      onHoverScene={setHoveredSceneId}
                      onSelectScene={onSelectScene}
                      onClearSelection={onClearSelection}
                    />

                    {hoveredTrack ? (
                      <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-md rounded-[20px] border border-slate-200 bg-[rgba(255,255,255,0.9)] px-4 py-3 backdrop-blur-xl md:bottom-5 md:left-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Track</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">{hoveredTrack.title}</p>
                        <p className="text-sm text-slate-600">{hoveredTrack.artist}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <MetricChip label="Scene" value={sceneById.get(hoveredTrack.scene_id)?.name ?? "Mapped Scene"} />
                          <MetricChip label="BPM" value={hoveredTrack.bpm ? Math.round(hoveredTrack.bpm) : undefined} />
                          <MetricChip
                            label="Bridge"
                            value={
                              typeof hoveredTrack.bridge_score === "number"
                                ? formatPercent(hoveredTrack.bridge_score)
                                : undefined
                            }
                          />
                          <MetricChip
                            label="Collision"
                            value={
                              typeof hoveredTrack.collision_score === "number"
                                ? formatPercent(hoveredTrack.collision_score)
                                : undefined
                            }
                          />
                        </div>
                      </div>
                    ) : hoveredScene ? (
                      <div
                        className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-sm rounded-[20px] border border-slate-200 bg-[rgba(255,255,255,0.9)] px-4 py-3 backdrop-blur-xl md:bottom-5 md:left-5"
                        style={hoverSceneAccent?.cssVars}
                      >
                        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Scene</p>
                        <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">
                          {hoveredScene.name ?? "Mapped Scene"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <MetricChip label="Tracks" value={sceneStats.get(hoveredScene.id)?.trackCount ?? hoveredScene.size} />
                          <MetricChip label="Links" value={adjacencyByScene.get(hoveredScene.id)?.length ?? 0} />
                          <MetricChip label="Avg Energy" value={formatPercent(sceneStats.get(hoveredScene.id)?.avgEnergy ?? null)} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-[min(78vh,920px)] min-h-[520px] items-center justify-center rounded-[28px] border border-slate-200 bg-white px-8 text-center">
                    <div className="max-w-lg space-y-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-slate-500">Atlas Offline</p>
                      <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                        Add a few finished tracks to wake the map.
                      </h2>
                      <div className="flex flex-wrap justify-center gap-2 pt-2">
                        <Link href="/upload">
                          <Button variant="outline" className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                            Upload Tracks
                          </Button>
                        </Link>
                        <Link href="/">
                          <Button variant="outline" className="border-slate-200 bg-slate-50 text-slate-900 hover:bg-white">
                            Back Home
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside
              className="h-fit overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] xl:sticky xl:top-6"
              style={sceneAccent.cssVars}
            >
              {!selectedTrack && !inspectorScene ? (
                <div className="space-y-4">
                  <div>
                    <SectionLabel>Inspector</SectionLabel>
                    <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                      Select a scene or track.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Context appears here when something on the map is active.
                    </p>
                  </div>
                </div>
              ) : selectedTrack ? (
                <div className="space-y-6">
                  <div>
                    <SectionLabel>Track Inspector</SectionLabel>
                    <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-slate-950">{selectedTrack.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{selectedTrack.artist}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="scene" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                        {inspectorScene?.name ?? "Mapped Scene"}
                      </Badge>
                      {typeof selectedTrack.bridge_score === "number" ? (
                        <Badge variant="scene" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                          Bridge {formatPercent(selectedTrack.bridge_score)}
                        </Badge>
                      ) : null}
                      {typeof selectedTrack.collision_score === "number" ? (
                        <Badge variant="scene" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                          Collision {formatPercent(selectedTrack.collision_score)}
                        </Badge>
                      ) : null}
                      {selectedTrack.id === nowPlayingId ? (
                        <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-700">
                          Now Playing
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InspectorStat label="Duration" value={formatDuration(selectedTrack.duration_s)} />
                    <InspectorStat label="Tempo" value={selectedTrack.bpm ? `${Math.round(selectedTrack.bpm)} BPM` : "—"} />
                    <InspectorStat label="Key" value={selectedTrack.key ? String(selectedTrack.key) : "—"} />
                    <InspectorStat label="Scene Rank" value={selectedTrack.provenance?.similarity_context?.within_scene_rank ?? "—"} />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="gap-2" onClick={onPlay}>
                      <Play className="h-4 w-4" />
                      Play
                    </Button>
                    <Button variant="scene" className="gap-2" onClick={onFindSimilar}>
                      <Sparkles className="h-4 w-4" />
                      Highlight Nearby
                    </Button>
                    <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                      <Link href={`/track/${selectedTrack.id}`}>Open DNA</Link>
                    </Button>
                    <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                      <Link href={`/scenes/${selectedTrack.scene_id}`}>Open Scene</Link>
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <SectionLabel>Placement Signals</SectionLabel>
                    {selectedTrack.provenance?.top_features?.length ? (
                      <div className="space-y-3">
                        {selectedTrack.provenance.top_features.slice(0, 5).map((feature) => (
                          <FeatureMeter key={`${selectedTrack.id}-${feature.name}`} label={feature.name} value={feature.value} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">Provenance detail is still sparse for this track.</p>
                    )}
                  </div>

                  {inspectorScene ? (
                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <SectionLabel>Scene Context</SectionLabel>
                          <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                            {inspectorScene.name ?? "Mapped Scene"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {inspectorSceneStats?.trackCount ?? inspectorScene.size} tracks · {inspectorNeighbors.length} adjacent paths
                          </p>
                        </div>
                        <Disc3 className="mt-1 h-5 w-5 text-slate-400" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <InspectorStat label="Avg Energy" value={formatPercent(inspectorSceneStats?.avgEnergy ?? null)} />
                        <InspectorStat label="Avg Bridge" value={formatPercent(inspectorSceneStats?.avgBridge ?? null)} />
                        <InspectorStat label="Avg Collision" value={formatPercent(inspectorSceneStats?.avgCollision ?? null)} />
                        <InspectorStat
                          label="Avg Tempo"
                          value={inspectorSceneStats?.avgBpm ? `${Math.round(inspectorSceneStats.avgBpm)} BPM` : "—"}
                        />
                      </div>

                      {inspectorNeighbors.length ? (
                        <div className="space-y-2">
                          <SectionLabel>Nearest Routes</SectionLabel>
                          {inspectorNeighbors.slice(0, 4).map((item) => (
                            <Link
                              key={`${inspectorScene.id}-${item.scene.id}`}
                              href={`/scenes/${item.scene.id}`}
                              className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
                            >
                              <span>{item.scene.name ?? "Adjacent Scene"}</span>
                              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                {formatPercent(item.weight)}
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : inspectorScene ? (
                <div className="space-y-6">
                  <div>
                    <SectionLabel>Scene Inspector</SectionLabel>
                    <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.05em] text-slate-950">
                      {inspectorScene.name ?? "Mapped Scene"}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      A local territory of related tracks and adjacent paths.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InspectorStat label="Tracks" value={inspectorSceneStats?.trackCount ?? inspectorScene.size} />
                    <InspectorStat label="Links" value={inspectorNeighbors.length} />
                    <InspectorStat label="Avg Energy" value={formatPercent(inspectorSceneStats?.avgEnergy ?? null)} />
                    <InspectorStat label="Avg Tempo" value={inspectorSceneStats?.avgBpm ? `${Math.round(inspectorSceneStats.avgBpm)} BPM` : "—"} />
                  </div>

                  <Button asChild variant="outline" className="w-full border-slate-200 bg-white text-slate-900 hover:bg-slate-50">
                    <Link href={`/scenes/${inspectorScene.id}`}>Open Scene Detail</Link>
                  </Button>

                  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <SectionLabel>Adjacent Scenes</SectionLabel>
                    {inspectorNeighbors.length ? (
                      inspectorNeighbors.slice(0, 6).map((item) => (
                        <Link
                          key={`${inspectorScene.id}-${item.scene.id}`}
                          href={`/scenes/${item.scene.id}`}
                          className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
                        >
                          <span>{item.scene.name ?? "Adjacent Scene"}</span>
                          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                            {formatPercent(item.weight)}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">This scene doesn’t expose adjacent paths yet.</p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <SectionLabel>Representative Tracks</SectionLabel>
                    {inspectorSceneTracks.length ? (
                      inspectorSceneTracks.slice(0, 6).map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          className={cn(
                            "w-full rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50",
                            selectedId === track.id && "border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.35)] bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.08)]"
                          )}
                          onClick={() => onSelectTrack(track.id)}
                        >
                          <p className="truncate text-sm font-medium text-slate-950">{track.title}</p>
                          <p className="truncate text-xs text-slate-600">{track.artist}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-slate-600">No track members are available for this scene yet.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
