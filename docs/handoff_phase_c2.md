# Handover: Phase C2 - Audio Embeddings

## Context
We are implementing "Similar Tracks" using real embeddings. 
- **Phase C1 (Completed)**: Text embeddings (all-MiniLM-L6-v2) for metadata similarity.
- **Phase C2 (In Progress)**: Audio embeddings (CLAP) for vibe/timbre similarity.

## Current Progress (Phase C2)

### ✅ Completed & Deployed
- **Dependencies**: `@huggingface/transformers` is installed and working.
- **Shared Service**: `packages/shared/embeddings.ts` now includes `generateAudioEmbedding()` using the `Xenova/clap-htsat-unfused` (CLAP) model. It processes audio files into 512-dim vectors.
- **Database Schema**: `db/schema.hx` updated with `V::Audio_Vector` and `E::HAS_AUDIO_EMBEDDING`.
- **Database Queries**: `db/queries.hx` updated with `AddAudioEmbedding` and `FindAudioNeighbors`.
- **Deployment**: `scripts/init_db.sh` has been run; the local HelixDB (http://localhost:6969) is up to date with the new schema and 13 queries.

### ✅ Remaining Tasks Completed
1. **Helix Helpers**: `apps/web/lib/helix.ts` now includes:
   - `addAudioEmbedding(trackId, embedding)`
   - `findAudioNeighbors(embedding, k)`
   - Result unwrapping for neighbor queries that return wrapped arrays.
2. **Analysis Pipeline**: `apps/web/lib/analyze.ts` now:
   - Generates text embedding + audio embedding for uploads.
   - Stores both vectors (`HAS_EMBEDDING`, `HAS_AUDIO_EMBEDDING`).
   - Computes weighted hybrid similarity (`0.4 * text + 0.6 * audio`).
   - Writes `SIMILAR_TO` with basis-aware metadata:
     - `basis: "hybrid"` when both signals exist
     - `basis: "audio"` or `"text"` as fallback
3. **Backfill Script**: Added `scripts/backfill_audio_embeddings.ts`.
   - Finds READY tracks with text vectors but no audio vectors.
   - Generates/stores audio vectors.
   - Writes updated similarity edges from merged text+audio neighbors.
4. **Seed Script**: `scripts/seed_db.ts` now:
   - Generates synthetic `.wav` files into `data/seed_audio/`.
   - Computes/stores both text and audio embeddings.
   - Creates hybrid `SIMILAR_TO` edges for seeded tracks.
5. **Verification Tooling**:
   - Added API route `GET /api/tracks/[id]/similar`.
   - Updated `scripts/test_upload.sh` to verify relationships after upload completes.

---

## Detailed Plan for Phase C2

### Model Choice: CLAP
We chose **CLAP** (`Xenova/clap-htsat-unfused`) because it runs locally via Transformers.js (ONNX), matches our existing stack, and is highly effective for musical timbre similarity. 

### Hybrid Similarity Logic
When a track is analyzed:
1. Generate Text Embedding -> `FindNeighbors` -> `text_results`
2. Generate Audio Embedding -> `FindAudioNeighbors` -> `audio_results`
3. Merge results and compute a weighted score.
4. Create `SIMILAR_TO` edges with:
   - `score`: The combined weight.
   - `basis`: "hybrid" (or "audio"/"text" if one is missing).
   - `model_version`: e.g., `"v1-text-minilm+v1-audio-clap"`.

### Schema Reference
```hx
V::Audio_Vector { embedding: [F64] }
E::HAS_AUDIO_EMBEDDING { From: Track, To: Audio_Vector }
E::SIMILAR_TO { score: F64, basis: String, model_version: String }
```

### Acceptance Criteria
- [x] New uploads generate both text and audio vectors.
- [x] `SIMILAR_TO` edges appear in the graph for new uploads.
- [x] The "Similar Tracks" UI component (already in `apps/web/app/track/[id]/page.tsx`) shows results.
- [x] Model weights (~300MB) are cached locally in `~/.cache/huggingface`.

## Files Updated in C2 so far:
- `packages/shared/embeddings.ts`
- `db/schema.hx`
- `db/queries.hx`
- `task.md`
- `c2_implementation_plan.md`
