# Step 3 & 4 Implementation Plan: Ingestion, Analysis & "Truthy" UI

## 1. Objectives (Step 3 & 4)

*   **Reliable Ingestion**: A robust `POST /api/ingest` endpoint that accepts audio files, saves them locally (dev), and initializes a HelixDB `Track` entry.
*   **Incremental Analysis**: A pipeline that moves a track through `Pending -> Analyzed -> Embedded -> Complete`.
*   **Single Source of Truth**: The `apps/web` UI fetches strictly from HelixDB using the `helix-ts` SDK; no mock JSONs.
*   **Visual Validation**: A "Track DNA" card in the UI that reflects real data (BPM, Key, Energy) extracted from the file.
*   **Helix-Native Workflow**: Usage of `db/schema.hx` and `db/queries.hx` as the canonical definitions, validated via MCP.

## 2. Data Flow Overview

```mermaid
graph LR
    User[User Upload] -->|POST /ingest| API[Next.js API]
    API -->|Save File| FS[Local Filesystem /data/uploads]
    API -->|Create Track (Pending)| Helix[HelixDB]
    API -->|Trigger| Worker[Analysis Worker]
    
    subgraph "Analysis Pipeline"
        Worker -->|Read File| Metadata[Extract Metadata (Duration/Format)]
        Worker -->|Compute| Features[Audio Features (BPM/Key/Energy)]
        Worker -->|Generate| Embed[Embeddings (Mock or Local Model)]
        Worker -->|Update| Helix
    end
    
    Helix -->|Query: GetTrack| UI[Track Page UI]
    Helix -->|Query: FindNeighbors| UI
```

### Write Stages
1.  **Upload**: Write `Track` node with `status: "PENDING"`, `filepath`, `original_filename`.
2.  **Analysis**: Update `Track` with `bpm`, `key`, `features` (JSON/Props).
3.  **Embedding**: Write `Track_Vector` node and link `[:HAS_EMBEDDING]` to `Track`.
4.  **Completion**: Update `Track` status to `READY`.

## 3. DB & Query Updates

### Schema Updates (`db/schema.hx`)
We need to expand the `Track` node and clarify the `Track_Vector`.

```graphql
N::Track {
    title: String,
    artist: String,
    filepath: String,            # Local path or S3 key
    file_hash: String,           # For idempotency
    status: String,              # PENDING, PROCESSING, READY, ERROR
    # Basic Analysis
    duration_sec: F64,
    bpm: F64,
    key: String,
    energy: F64,
    upload_date: String
}

# Keep Scene as is for now
N::Scene {
    name: String
}

# Renaming for clarity if possible, or keeping generic
V::Track_Vector {
    embedding: [F64] # 384d or 768d depending on model
}

# Edges
E::HAS_EMBEDDING { From: Track, To: Track_Vector }
E::IN_SCENE { From: Track, To: Scene }
E::SIMILAR_TO { From: Track, To: Track, Properties: { score: F64 } }
```

### Query Updates (`db/queries.hx`)

*   **`CreateTrack`**: Accepts file info, returns ID.
*   **`UpdateTrackMetadata`**: Sets BPM, Key, Duration.
*   **`UpdateTrackStatus`**: Transitions state.
*   **`AddTrackEmbedding`**: (Existing, update to match vector dim).
*   **`GetTrackFull`**: Fetches Track + Vector ID (if exists).
*   **`GetRecentTracks`**: Lists tracks by `upload_date` desc.

## 4. Upload & Storage Plan

*   **Storage**:
    *   **Dev**: Local filesystem directory: `projects/atlas/data/uploads`. Gitignored.
    *   **Prod**: (Future) S3/R2 compatible bucket.
*   **API Route (`apps/web/app/api/ingest/route.ts`)**:
    *   Use `formData()` to receive files.
    *   Validate MIME type (`audio/mpeg`, `audio/wav`, `audio/mp4`).
    *   Generate a unique filename (UUID + ext) to prevent collisions.
    *   Calculate SHA-256 hash of file content for de-duplication (idempotency check).
    *   **Action**: Write file to disk -> Call Helix `CreateTrack` -> Return ID -> Trigger Analysis (async or background).

## 5. Analysis & Embedding Pipeline (v0)

To keep dependencies minimal and JS-native for Step 3:

*   **Library**: `music-metadata` (Node.js) to extract Duration, Bitrate, Format, and ID3 tags (Title/Artist).
*   **Audio Features**:
    *   *Option A (Simple)*: Use `music-metadata` only. It provides distinct tags but not signal processing (energy/transition).
    *   *Option B (Better)*: `meyda` or `essentia.js` (WebAssembly) for client-side or server-side analysis.
    *   **Decision for v0**: Use `music-metadata` for basic tags. Mock "Energy" and "BPM" if not found in tags, or use a lightweight BPM detector library (`web-audio-api` headless is hard in Node).
    *   *Fallback*: Determine BPM/Key from filename if present (standard DJ format), otherwise placeholder.
*   **Embeddings**:
    *   *Approach*: `Xenova/transformers.js` (Node compatible).
    *   *Model*: `Xenova/all-MiniLM-L6-v2` (Text-based embedding of metadata "Title Artist Genre") OR a random vector if strict audio-based embedding is too heavy for v0.
    *   **Plan**: Generate a "Metadata Embedding" using `transformers.js` locally. This guarantees a vector exists for the graph without needing complex Python audio DSP yet.
*   **Execution**:
    *   Run as a function called immediately after upload in the API route (for simplicity in v0).
    *   Wrap in `try/catch` to update `status="ERROR"` on failure.

## 6. MCP Usage Plan

1.  **Draft Query**: Write a new query in `db/queries.hx`.
2.  **Test via MCP**: Use the `helix-mcp-server` (if available via `run_command` or extension) or write a small script `scripts/test_mcp.ts` to execute the specific query against the running Helix instance.
3.  **Commit**: Once validated, keep it in `db/queries.hx`.
4.  **Codegen**: (Optional) If there's a purely typed generator, run it. Otherwise, manually update generic TS types in `packages/shared/types` to match.

## 7. Step 4 UI/API Plan

*   **Framework**: Next.js App Router (`apps/web`).
*   **Pages**:
    *   `/upload`: Simple drag-and-drop zone.
    *   `/tracks`: Grid of "Track Cards" (Cover art placeholder, Title, Artist, BPM badge).
    *   `/tracks/[id]`: Detail view.
*   **Track DNA Component**:
    *   Visualizer for `Energy`, `BPM`, `Key`.
    *   "Status" indicator (Analyzing... -> Ready).
    *   "Similar Tracks" list (fetching `SIMILAR_TO` edges).
*   **State**: SWR or React Query for polling `GetTrack` status if pending.

## 8. Acceptance Checks

- [ ] **Upload**: `curl -F "file=@test.mp3" http://localhost:3000/api/ingest` returns 200 and a Track ID.
- [ ] **Storage**: File exists in `data/uploads/`.
- [ ] **Helix**: Querying `GetTrack(id)` returns the correct Title/Artist and `status="READY"`.
- [ ] **Vector**: `GetTrack(id)` shows an associated `Track_Vector`.
- [ ] **UI**: Visiting `http://localhost:3000/tracks` shows the new track.
- [ ] **Idempotency**: Uploading the exact same file again returns the *existing* Track ID (based on hash check) and does not duplicate.

## 9. Risks & Decision Points

*   **Risk**: Node.js audio analysis is weak compared to Python.
    *   *Mitigation*: Use `transformers.js` on *text metadata* for the "vibe" vector initially. It's robust and provides "similar titles/artists" capabilities immediately.
*   **Risk**: HelixDB local persistence.
    *   *Mitigation*: Ensure `data/helix` or similar is mounted/persisted so restarts don't wipe the graph.
*   **Decision**: Synchronous vs Async.
    *   *Decision*: Async-ish. Return response to UI immediately after file write. Process analysis in the "background" (without awaiting the promise), or use a simple in-memory queue.
