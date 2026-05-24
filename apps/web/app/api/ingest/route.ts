import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join, extname } from "path";
import { addTrack, findTrackByHash, isHelixAvailable } from "@/lib/helix";
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
  let savedFilepath = "";
  const ingestLog = (phase: string, detail?: Record<string, unknown>) => {
    console.info("[ingest]", phase, detail ?? {});
  };

  try {
    ingestLog("formData:start");
    const formData = await request.formData();
    ingestLog("formData:ready");
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      ingestLog("validate:missing-file");
      return NextResponse.json(
        { error: "No file provided. Send a file with key 'file'." },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.has(file.type) && file.type !== "application/octet-stream") {
      ingestLog("validate:bad-mime", { fileType: file.type, filename: file.name });
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Accepted: ${[...ALLOWED_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      ingestLog("validate:bad-extension", { extension: ext, filename: file.name });
      return NextResponse.json(
        { error: `Unsupported file extension: ${ext}` },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      ingestLog("validate:file-too-large", { fileSize: file.size, filename: file.name });
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      ingestLog("validate:empty-file", { filename: file.name });
      return NextResponse.json(
        { error: "File is empty." },
        { status: 400 }
      );
    }

    // Ingest requires Helix because Track metadata is the source of truth.
    ingestLog("helix:check");
    const helixUp = await isHelixAvailable();
    if (!helixUp) {
      ingestLog("helix:unreachable");
      return NextResponse.json(
        {
          error:
            "HelixDB is not reachable at HELIX_URL. Start Helix with `bash scripts/init_db.sh` and retry upload.",
        },
        { status: 503 }
      );
    }

    // Read file bytes
    ingestLog("file:read-bytes", { filename: file.name, fileSize: file.size });
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Compute SHA-256 hash for idempotency
    const hash = createHash("sha256").update(bytes).digest("hex");

    // Check for duplicate
    ingestLog("helix:duplicate-check", { hash });
    const existing = await findTrackByHash(hash);
    if (existing) {
      ingestLog("helix:duplicate-hit", { trackId: existing.id, hash });
      return NextResponse.json({
        id: existing.id,
        status: existing.status,
        duplicate: true,
      } satisfies IngestResponse);
    }

    // Save file to disk
    ingestLog("disk:mkdir", { uploadDir: UPLOAD_DIR });
    await mkdir(UPLOAD_DIR, { recursive: true });
    const uniqueName = `${randomUUID()}${ext}`;
    const filepath = join(UPLOAD_DIR, uniqueName);
    savedFilepath = filepath;
    ingestLog("disk:write", { filepath });
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
    ingestLog("helix:create-track", { filepath, filename: file.name, hash, artist, title });
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
    ingestLog("analysis:kickoff", { trackId, filepath });
    analyzeTrack(trackId, filepath, file.name).catch((err) => {
      console.error(`Background analysis failed for ${trackId}:`, err);
    });

    ingestLog("response:success", { trackId });
    return NextResponse.json({
      id: trackId,
      status: "PENDING",
      duplicate: false,
    } satisfies IngestResponse);
  } catch (err) {
    console.error("Ingest error:", err);
    if (savedFilepath) {
      try {
        ingestLog("disk:cleanup", { filepath: savedFilepath });
        await unlink(savedFilepath);
      } catch {
        // best effort cleanup
      }
    }
    const message = err instanceof Error ? err.message : "Unknown ingest error";
    if (message.includes("Helix")) {
      return NextResponse.json(
        { error: message },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: `Internal server error during ingestion: ${message}` },
      { status: 500 }
    );
  }
}
