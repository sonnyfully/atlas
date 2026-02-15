# Interfaces
## API Routes (table-like bullets)
- `GET /api/tracks`: list tracks; supports pagination/sort/search params.
- `GET /api/tracks/:id`: fetch one track by id.
- `GET /api/tracks/:id/similar`: fetch similarity results for a track.
- `POST /api/ingest`: upload/ingest media and create processing job.
- `GET /api/audio/:id`: stream audio/media for playback.

## DB Schema (high-level entities + key fields)
- `Track`: `id`, `title`, `artist`, `status`, `durationSec`, `bpm`, `createdAt`, `updatedAt`.
- `TrackEmbedding` (optional): `trackId`, `vector`, `modelVersion`, `createdAt`.
- `SimilarityEdge` (optional): `fromTrackId`, `toTrackId`, `score`, `basis`, `createdAt`.
- `IngestJob` (optional): `id`, `trackId`, `status`, `errorCode`, `startedAt`, `finishedAt`.

## Types (core DTOs in pseudocode)
```txt
TrackDTO {
  id: string
  title: string
  artist?: string
  status: "uploading" | "processing" | "ready" | "failed"
  durationSec?: number
  bpm?: number
  audioUrl?: string
}

TrackListResponse {
  items: TrackDTO[]
  nextCursor?: string
}

ErrorResponse {
  error: {
    code: string
    message: string
    retryable?: boolean
  }
}
```

## Error Conventions (one standard shape)
- Use one envelope for all non-2xx responses:
- `{ "error": { "code": "<MACHINE_CODE>", "message": "<user-safe message>", "retryable": <bool> } }`
- Never expose stack traces or provider internals to clients.
