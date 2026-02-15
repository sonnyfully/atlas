import { NextRequest } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { getTrack } from "@/lib/helix";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".webm": "audio/webm",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch track from HelixDB
  const track = await getTrack(id);
  if (!track) {
    return new Response("Track not found", { status: 404 });
  }

  if (track.status !== "READY") {
    return new Response("Track not ready", { status: 422 });
  }

  // Verify file exists on disk
  let fileSize: number;
  try {
    const fileStat = await stat(track.filepath);
    fileSize = fileStat.size;
  } catch {
    return new Response("Audio file not found on disk", { status: 404 });
  }

  const ext = extname(track.filepath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    // Parse range header: "bytes=start-end"
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      return new Response("Invalid range", { status: 416 });
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = createReadStream(track.filepath, { start, end });
    const webStream = nodeReadableToWeb(nodeStream);

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(chunkSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // Full file response
  const nodeStream = createReadStream(track.filepath);
  const webStream = nodeReadableToWeb(nodeStream);

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** Convert a Node.js Readable stream to a Web ReadableStream */
function nodeReadableToWeb(
  nodeStream: ReturnType<typeof createReadStream>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: string | Buffer) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      nodeStream.on("end", () => {
        controller.close();
      });
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
