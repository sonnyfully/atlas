# CONTEXT.md

## One‑paragraph summary
Track Atlas is a SoundCloud‑esque web app that builds a “map of sound.” You upload (or link) tracks, the system analyzes them into embeddings + musical features, and then uses HelixDB (graph + vector) to: (1) place each track into a micro‑scene (“pocket”), (2) show adjacent scenes you can explore or market to, and (3) surface “collision pairs” — tracks that blend unexpectedly well (great for DJs, mashups, and discovery). Every track gets a shareable **Track DNA card**: a compact fingerprint of timbre, vibe, mix traits, and its nearest scene neighborhoods.

## What makes it novel
- **Scenes, not just “similar tracks.”** It builds a *cartography* of micro‑genres / vibe pockets and how they connect.
- **Collision pairs.** It finds “surprising compatibility” (timbre‑close, vibe‑adjacent, DJ‑friendly).
- **Track DNA cards.** A new, social, shareable object that summarizes a track’s identity + where it lives on the map.
- **Graph + vector together.** Vectors power similarity; the graph powers navigation, adjacency, and explainable recommendations.

## Target users
- **DJs:** build crates, find unexpected blends, plan set arcs.
- **Producers/Artists:** understand their sound “neighborhood,” find adjacent scenes to pitch to, generate teaser insights.
- **Curious listeners:** explore sound by texture/vibe rather than rigid genres.

## MVP promise
In a few clicks: upload a track → see its DNA card → explore its scene + adjacent scenes → preview top collision pairs.

## What it is not (initially)
- Not a replacement for SoundCloud.
- Not a full streaming platform.
- Not a rights/monetization product in v1.

---

# TECH_SPEC.md

## System overview
A hybrid pipeline:
- **Local (your M4 Mac):** ingest, slice audio, compute basic musical + mix features, caching.
- **Cloud:** compute high‑quality embeddings at scale (batched), return vectors.
- **HelixDB:** store tracks + vectors + relationships (scenes, adjacency, collisions).
- **Web app:** SoundCloud‑like UI that reads from the API.

## Core entities
### Track
Stores metadata and analysis outputs.
- `id`, `title`, `artist`, `source` (local/url), `url`, `cover_url`
- `duration`
- Features (examples): `bpm`, `key`, `loudness`, `energy`, `brightness`, `warmth`, `punch`, `air`, `stereo_width`, `dynamic_range`
- Vectors:
  - `timbre_vec` (texture/instrumentation)
  - `vibe_vec` (style/mood/scene)

### Scene
A micro‑genre / vibe pocket discovered by clustering.
- `id`, `name`, `descriptor`
- `centroid_vec` (optional)

### (Optional v2) Clip
Beat‑synced or fixed window segments for finer retrieval.
- `track_id`, `start`, `end`, `clip_vec`

## Graph relationships (HelixDB)
- `Track -[:IN_SCENE {confidence, score}]-> Scene`
- `Scene -[:ADJACENT {sim}]-> Scene`
- `Track -[:SIMILAR {sim}]-> Track` (cached kNN neighborhood)
- `Track -[:COLLIDES_WITH {score, type, reasons[]}]-> Track`

## Key queries
1) **Sounds like this** (vector kNN):
- Input: track id or embedding
- Output: top K similar tracks + short reasons

2) **Scene map**:
- Input: scene id
- Output: top tracks in scene + adjacent scenes + representative “centroid” DNA

3) **Collision pairs**:
- Input: track id
- Output: top collision candidates (timbre close, vibe adjacent, BPM/key compatible), with explanations

4) **Track DNA card**:
- Input: track id
- Output: compact “fingerprint” payload + scene assignment + adjacent scenes + collision highlights

## Analysis pipeline (hybrid)
### Local steps
- Ingest track (file/url)
- Normalize / decode audio
- Compute basic features (tempo/key estimate, loudness, spectral traits)
- Slice into clips (optional v1; recommended v2)
- Cache outputs to disk (`/data/cache/{track_id}.json`)

### Cloud steps
- Send audio (or mel spectrograms / clips) in batches
- Receive embeddings
- Persist embeddings to cache + HelixDB

### Clustering (HDBSCAN)
- Run HDBSCAN over `vibe_vec` (or pooled clip vectors)
- Output: scene labels + membership probabilities
- Create Scene nodes, IN_SCENE edges
- Create ADJACENT scene edges by centroid similarity

### Collision edge generation
- Candidate pool from timbre kNN
- Filter by BPM/key compatibility rules
- Prefer “timbre close, vibe not identical”
- Store top N `COLLIDES_WITH` edges per track with `reasons[]`

## API surface (suggested)
- `GET /tracks` (paged)
- `GET /tracks/:id` (includes DNA card payload)
- `GET /tracks/:id/similar`
- `GET /tracks/:id/collisions`
- `GET /scenes` (paged)
- `GET /scenes/:id` (tracks + adjacent scenes)
- `GET /atlas/neighborhood?track_id=...` (graph payload for UI)
- `POST /ingest` (submit new track)

## Repo structure (suggested)
- `apps/web` — Next.js UI
- `apps/api` — API server (TS)
- `services/ingest-worker` — local audio analysis + cloud embedding client
- `packages/shared` — shared types, utilities
- `data/cache` — local analysis cache (gitignored)

## Quality + reliability notes
- Make ingest **idempotent** (safe to re-run).
- Cache aggressively (don’t re-embed the same audio).
- Precompute neighborhoods + collisions for instant UI.

---

# BUILD_PLAN.md

## Phase 0 — Define the product (1 short session)
**Milestones**
- Decide the MVP screens: Home, Track page, Scene page, Collision view.
- Lock the Track DNA card format (what fields it shows).
- Agree the presentation story: “upload → DNA → scene → adjacent scenes → collision pairs.”

## Phase 1 — MVP: Track DNA + “sounds like this”
**Milestones**
- Basic ingest for 200–500 local tracks.
- A Track page that looks SoundCloud‑esque.
- DNA card renders from real computed features + embeddings.
- Similar‑track search works and feels instant.

## Phase 2 — The Atlas: scenes + adjacency
**Milestones**
- Run HDBSCAN and create scene labels.
- Scene pages exist (“top tracks in this pocket”).
- Adjacent scenes show as a small map/list.
- DNA card now includes: “this track lives in…” + “nearest scenes.”

## Phase 3 — Collision Lab (the viral feature)
**Milestones**
- Collision pairs computed and stored.
- Track page shows 3–5 great collisions with short explanations.
- A simple Collision view to browse + preview pairs.

## Phase 4 — Polish + submission package
**Milestones**
- Shareable DNA card export (image or link).
- A clean README + presentation runbook.
- Two short pitch writeups: one for HelixDB (graph+vector showcase), one for SoundCloud (new discovery surface).

## Nice-to-haves (later)
- Clip-level atlas (finer navigation)
- Time-stamped comment intelligence
- “Set path” generator between scenes
- User accounts + saved crates
