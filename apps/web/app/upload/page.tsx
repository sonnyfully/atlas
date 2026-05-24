"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, AlertCircle, Loader2, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getSceneAccent, useSceneAccent } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { IngestResponse, TrackDnaResponse } from "@atlas/shared";
import Link from "next/link";

interface UploadResult {
  id: string;
  filename: string;
  response?: IngestResponse;
  track?: TrackDnaResponse;
  error?: string;
  uploading: boolean;
}

interface SafeApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorMessage: string | null;
}

function truncateForMessage(value: string, max = 180): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

async function readApiResponse<T>(
  response: Response,
  fallbackLabel: string
): Promise<SafeApiResult<T>> {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  const bodyText = rawText.trim();
  const bodySnippet = bodyText ? truncateForMessage(bodyText) : "";
  const statusLabel = `${fallbackLabel} (${response.status})`;

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawText) as T | { error?: unknown; message?: unknown };
      if (!response.ok) {
        const apiError =
          typeof (parsed as { error?: unknown }).error === "string"
            ? (parsed as { error: string }).error
            : typeof (parsed as { message?: unknown }).message === "string"
              ? (parsed as { message: string }).message
              : bodySnippet;
        return {
          ok: false,
          status: response.status,
          data: null,
          errorMessage: apiError ? `${statusLabel}: ${apiError}` : statusLabel,
        };
      }

      return {
        ok: true,
        status: response.status,
        data: parsed as T,
        errorMessage: null,
      };
    } catch {
      return {
        ok: false,
        status: response.status,
        data: null,
        errorMessage: bodySnippet
          ? `${statusLabel}: invalid JSON response: ${bodySnippet}`
          : `${statusLabel}: invalid JSON response`,
      };
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      errorMessage: bodySnippet ? `${statusLabel}: ${bodySnippet}` : statusLabel,
    };
  }

  return {
    ok: false,
    status: response.status,
    data: null,
    errorMessage: bodySnippet
      ? `${statusLabel}: expected JSON but received: ${bodySnippet}`
      : `${statusLabel}: expected JSON response`,
  };
}

function shouldPollTrack(result: UploadResult): boolean {
  if (!result.response?.id || result.uploading || result.error) return false;
  if (!result.track) return true;
  if (result.track.status === "PENDING" || result.track.status === "PROCESSING") return true;
  return result.track.status === "READY" && !result.track.scene_home;
}

function describeUploadState(result: UploadResult): {
  label: string;
  message: string;
  tone: "scene" | "outline" | "secondary" | "destructive";
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
} {
  if (result.uploading) {
    return {
      label: "Uploading",
      message: "Sending the file to Atlas and creating its initial track record.",
      tone: "secondary",
    };
  }

  if (result.error) {
    return {
      label: "Failed",
      message: result.error,
      tone: "destructive",
    };
  }

  if (!result.response?.id) {
    return {
      label: "Queued",
      message: "Atlas received the file and is preparing its track record.",
      tone: "outline",
    };
  }

  if (!result.track) {
    return {
      label: result.response.duplicate ? "Reused" : "Queued",
      message: result.response.duplicate
        ? "Atlas reused the existing track and is fetching its current DNA state."
        : "Atlas saved the upload and is about to start analysis.",
      tone: "outline",
      primaryHref: `/track/${result.response.id}`,
      primaryLabel: "Open Track",
    };
  }

  if (result.track.status === "PENDING") {
    return {
      label: "Queued",
      message: "The upload is stored. Analysis will start next.",
      tone: "outline",
      primaryHref: `/track/${result.track.track.id}`,
      primaryLabel: "Open Track",
    };
  }

  if (result.track.status === "PROCESSING") {
    return {
      label: "Analyzing",
      message: "Atlas is extracting musical features, embeddings, and the first DNA story.",
      tone: "secondary",
      primaryHref: `/track/${result.track.track.id}`,
      primaryLabel: "Watch DNA",
    };
  }

  if (result.track.status === "ERROR") {
    return {
      label: "Failed",
      message: result.track.track.error || "Atlas could not finish analysis for this upload.",
      tone: "destructive",
      primaryHref: `/track/${result.track.track.id}`,
      primaryLabel: "Inspect Track",
    };
  }

  if (result.track.scene_home?.scene?.id) {
    return {
      label: result.response.duplicate ? "Ready in library" : "Ready in Atlas",
      message:
        result.track.placement_summary ||
        "Atlas finished analysis and persisted scene placement for this track.",
      tone: "scene",
      primaryHref: `/track/${result.track.track.id}`,
      primaryLabel: "Open DNA",
      secondaryHref: `/scenes/${result.track.scene_home.scene.id}`,
      secondaryLabel: "Open Scene",
    };
  }

  if (result.track.build) {
    return {
      label: "Graph pending",
      message:
        "Analysis is complete. Atlas is waiting for persisted scene placement and collision context to land in the active build.",
      tone: "outline",
      primaryHref: `/track/${result.track.track.id}`,
      primaryLabel: "Open DNA",
    };
  }

  return {
    label: "Awaiting build",
    message:
      "Analysis is complete. Run the Atlas prep or rebuild flow to publish scene, adjacency, and collision context.",
    tone: "outline",
    primaryHref: `/track/${result.track.track.id}`,
    primaryLabel: "Open DNA",
  };
}

export default function UploadPage() {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sceneAccent = useSceneAccent(undefined, "upload");

  const uploadFile = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    setResults((prev) => [
      ...prev,
      { id, filename: file.name, uploading: true },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const parsed = await readApiResponse<IngestResponse>(res, "Upload failed");

      if (!parsed.ok || !parsed.data) {
        setResults((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  uploading: false,
                  error: parsed.errorMessage ?? `Upload failed (${res.status})`,
                }
              : r
          )
        );
        return;
      }

      setResults((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, uploading: false, response: parsed.data ?? undefined } : r
        )
      );
    } catch (err) {
      setResults((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                uploading: false,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : r
        )
      );
    }
  }, []);

  useEffect(() => {
    const active = results.filter(shouldPollTrack);
    if (active.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      const next = await Promise.all(
        active.map(async (result) => {
          try {
            const res = await fetch(`/api/tracks/${result.response!.id}`, { cache: "no-store" });
            const parsed = await readApiResponse<TrackDnaResponse>(res, "Track status check failed");
            if (!parsed.ok || !parsed.data) return null;
            return {
              id: result.id,
              track: parsed.data,
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      setResults((prev) =>
        prev.map((result) => {
          const update = next.find((item) => item?.id === result.id);
          return update ? { ...result, track: update.track } : result;
        })
      );
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [results]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8 lg:px-8" style={sceneAccent.cssVars}>
      <div className="space-y-3">
        <p className="text-caption font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Live Ingest
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-h2 text-foreground">Upload Tracks</h1>
            <p className="mt-2 max-w-2xl text-body-sm text-muted-foreground">
              Use this route for the live ingest flow. Atlas moves each file from upload to analysis to DNA, then into persisted scene context once the build catches up.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="outline">Home</Button>
            </Link>
            <Link href="/scenes">
              <Button variant="outline">Scenes</Button>
            </Link>
            <Link href="/map">
              <Button variant="outline">Map</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-interactive duration-fast ease-out",
          isDragging
            ? "border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.65)] bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.08)]"
            : "border-border hover:border-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.45)]"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-body-sm font-medium text-foreground">
          Drop audio files here or click to browse
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          MP3, WAV, M4A, FLAC, OGG up to 100MB
        </p>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-h4 text-foreground">Upload Progress</h2>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Each row shows the current lifecycle stage and the next best action.
            </p>
          </div>
          {results.map((r) => {
            const summary = describeUploadState(r);
            return (
            <Card
              key={r.id}
              variant="scene"
              style={getSceneAccent(r.response?.id ?? r.filename).cssVars}
            >
              <CardContent className="space-y-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--scene-h)_var(--scene-s)_var(--scene-l)/0.12)]">
                      {r.uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : r.error ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Music className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-foreground">
                        {r.filename}
                      </p>
                      <p className="mt-1 text-body-sm text-muted-foreground">
                        {summary.message}
                      </p>
                      {r.response?.duplicate && (
                        <p className="mt-2 text-caption text-muted-foreground">
                          Atlas reused an existing upload for this file hash.
                        </p>
                      )}
                      {r.track?.placement_summary &&
                      r.track.status === "READY" &&
                      !r.error ? (
                        <p className="mt-2 text-caption text-foreground">
                          {r.track.placement_summary}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant={summary.tone}>{summary.label}</Badge>
                    {r.track?.build?.build_seq ? (
                      <Badge variant="outline">Build #{r.track.build.build_seq}</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {summary.primaryHref && summary.primaryLabel ? (
                    <Link href={summary.primaryHref}>
                      <Button size="sm" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        {summary.primaryLabel}
                      </Button>
                    </Link>
                  ) : null}
                  {summary.secondaryHref && summary.secondaryLabel ? (
                    <Link href={summary.secondaryHref}>
                      <Button size="sm" variant="outline">
                        {summary.secondaryLabel}
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
