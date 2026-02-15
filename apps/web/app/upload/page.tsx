"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, CheckCircle2, AlertCircle, Loader2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IngestResponse } from "@atlas/shared";
import Link from "next/link";

interface UploadResult {
  filename: string;
  response?: IngestResponse;
  error?: string;
  uploading: boolean;
}

export default function UploadPage() {
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const idx = results.length;
    setResults((prev) => [
      ...prev,
      { filename: file.name, uploading: true },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setResults((prev) =>
          prev.map((r, i) =>
            i === idx ? { ...r, uploading: false, error: data.error } : r
          )
        );
        return;
      }

      setResults((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, uploading: false, response: data } : r
        )
      );
    } catch (err) {
      setResults((prev) =>
        prev.map((r, i) =>
          i === idx
            ? {
                ...r,
                uploading: false,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : r
        )
      );
    }
  }, [results.length]);

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
    <div className="px-6 lg:px-8 py-8 max-w-2xl mx-auto">
      <h1 className="text-h2 text-foreground mb-6">Upload Tracks</h1>

      {/* Drop zone */}
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
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
          onChange={(e) => handleFiles(e.target.files)}
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
        <div className="mt-6 space-y-3">
          <h2 className="text-h4 text-foreground">Uploads</h2>
          {results.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 py-3">
                <Music className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium">
                    {r.filename}
                  </p>
                  {r.response?.duplicate && (
                    <p className="text-caption text-muted-foreground">
                      Already uploaded
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.uploading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {r.error && (
                    <span className="flex items-center gap-1 text-caption text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {r.error}
                    </span>
                  )}
                  {r.response && !r.error && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <Link href={`/track/${r.response.id}`}>
                        <Button variant="ghost" size="sm" className="text-caption">
                          View
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
