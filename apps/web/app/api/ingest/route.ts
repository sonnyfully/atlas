import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { addTrack, findTrackByHash } from "@/lib/helix";
import { analyzeTrack } from "@/lib/analyze";
import type { IngestResponse } from "@atlas/shared";

const UPLOAD_DIR = join(process.cwd(), "..", "..", "data", "uploads");
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
  "audio/ogg",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".aac",
  ".flac",
  ".ogg",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send a file with key 'file'." },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.has(file.type) && file.type !== "application/octet-stream") {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: ${[...ALLOWED_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file extension: ${ext}` },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Read file bytes
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Compute SHA-256 hash for idempotency
    const hash = createHash("sha256").update(bytes).digest("hex");

    // Check for duplicate
    const existing = await findTrackByHash(hash);
    if (existing) {
      return NextResponse.json({
        id: existing.id,
        status: existing.status,
        duplicate: true,
      } satisfies IngestResponse);
    }

    // Save file to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const uniqueName = `${randomUUID()}${ext}`;
    const filepath = join(UPLOAD_DIR, uniqueName);
    await writeFile(filepath, bytes);

    // Extract basic info from filename (DJ naming convention: "Artist - Title")
    const baseName = file.name.replace(/\.[^.]+$/, "");
    let title = baseName;
    let artist = "Unknown";
    const dashMatch = baseName.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
      artist = dashMatch[1].trim();
      title = dashMatch[2].trim();
    }

    // Create track in Helix
    const trackId = await addTrack({
      title,
      artist,
      filepath,
      original_filename: file.name,
      file_hash: hash,
      status: "PENDING",
      upload_date: new Date().toISOString(),
    });

    // Fire analysis (don't await — return response immediately)
    analyzeTrack(trackId, filepath, file.name).catch((err) => {
      console.error(`Background analysis failed for ${trackId}:`, err);
    });

    return NextResponse.json({
      id: trackId,
      status: "PENDING",
      duplicate: false,
    } satisfies IngestResponse);
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: "Internal server error during ingestion" },
      { status: 500 }
    );
  }
}
