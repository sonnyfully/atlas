# Atlas 3D Sound Map — Context (Planet-Skim v1) — Expanded

> **Status:** Active spec for the primary map surface as of 2026-04-05.  
> **Implementation status:** substantially implemented, with persistence / hardening gaps still remaining.  
> **Scope:** 300–2,000 tracks, Helix-truthful relationships, scene-to-scene arcs, right-rail DNA card, bottom player integration, toroidal wrap with curved visual patch.

## Current implementation notes

- This spec now maps to the live atlas v1 path:
  - `GET /api/atlas/map?v=1`
  - `/map`
  - `apps/web/components/map/atlas-map-v1.tsx`
- Implemented today:
  - stable world payload
  - deterministic positions
  - computed scenes
  - scene graph edges
  - bridge / collision scores
  - provenance payload
  - player integration
- Still incomplete relative to the idealized spec:
  - scene assignments are not yet the canonical persisted graph truth
  - no durable background execution model for rebuilds / analysis
  - 2,000-track performance target still needs stronger automated evidence

---

## 0) Goals, Constraints, and Product Intent

### Goals
- Make the sound map feel like **exploring a world** (glide + horizon + fog).
- Preserve meaning from **HelixDB embeddings + audio analysis**.
- Keep UX **fast, legible, and non-overwhelming** at 300–2,000 nodes.
- Make it **useful for artists**:
  - Find “where my track sits”
  - Identify “bridge tracks” that connect scenes
  - Surface “collisions” (unexpected cross-scene similarity)
  - Explain “why” via provenance

### Hard Constraints
- **Backend truth is authoritative**: client renders server-provided positioning, clustering, graph edges, and artist metrics.
- **No altitude encoding in v1** (nodes are not elevated for meaning).
- **No track-to-track edge spaghetti** (scene graph only in v1).
- **Determinism**:
  - stable `pos` across reloads
  - deterministic color mapping from analysis

### Future-facing but not in v1
- Guided tour camera mode
- Track-to-track neighbor arcs on hover/selection
- Floating anchored selection card near node
- True sphere topology (if ever desired)

---

## 1) Primary Metaphor & Topology

### Metaphor
- **Scenes = continents**
- **Tracks = cities**
- **Scene graph edges = flight paths**

### Topology (v1)
- Underlying topology: **toroidal wrap** (infinite repeating map)
- Visual metaphor: **curved “globe-skim” patch** with atmospheric horizon

**Why this works**
- Toroidal wrap gives infinite navigation without edge UX.
- Curved patch + fog + constrained pitch gives the “skimming a globe” sensation without the complexity of true spherical projection.

---

## 2) Backend Truth Contract

### 2.1 Endpoint
`GET /api/atlas/map?v=1`

**Single payload** should be enough to render map + right rail content (except audio streaming).

### 2.2 Response Shape (canonical)

#### `world`
- `world_size: number`  
  Defines wrap range. All `pos` values are in `[0, world_size)`.
- `version_hash: string`  
  Changes when projection/clusters/edges materially change (used for caching).

#### `tracks[]` (required)
- `id: string`
- `title: string`
- `artist: string`
- `scene_id: string`
- `pos: { x: number, y: number }` *(server computed stable projection)*
- `analysis: object` *(audio analysis used for deterministic colors + DNA)*
- `bpm?: number`
- `key?: string`
- `duration_s?: number`
- `artwork_url?: string` *(optional)*

Artist metrics (server-computed; recommended v1):
- `bridge_score?: number`
- `collision_score?: number`

Optional provenance payload (recommended):
- `provenance?: {
    top_features?: Array<{ name: string, value: number, z?: number }>,
    similarity_context?: { within_scene_rank?: number, cross_scene_neighbors?: number },
    reason_codes?: string[]
  }`

Optional neighbors (for v1.1 hover arcs; not required v1):
- `neighbors?: Array<{ id: string, sim: number }>`

#### `scenes[]` (required)
- `id: string`
- `name?: string` *(default “Drift 1”, user renameable later)*
- `centroid_pos: { x: number, y: number }`
- `size: number`
- Optional: `stats?: { cohesion?: number }`

#### `scene_graph_edges[]` (required)
- `from_scene_id: string`
- `to_scene_id: string`
- `weight: number`
- Optional: `type?: "bridge" | "collision" | "adjacent"`

### 2.3 Server Responsibilities (v1)
- **Projection**: embeddings -> stable 2D positions (`pos.x/y`)
- **Clustering**: tracks -> scenes (`scene_id`) + centroids
- **Scene graph**: edges between scenes with weights
- **Artist metrics**: bridge/collision scores + (ideally) provenance reasons
- Persist results so the map does not reshuffle per request.

### 2.4 Client Responsibilities (v1)
- Fetch + cache payload
- Render using instancing/LOD
- Handle camera + selection/hover state
- Show DNA card + route actions to backend/player
- Never compute “truth” relationships that could contradict Helix

---

## 3) Visual System

### 3.1 World Rendering (globe-skim illusion)
Render a visually curved surface patch:
- A plane (or mesh grid) with shader-based curvature (bend away from camera)
- Atmospheric fog/haze that increases with distance
- Subtle vignette/horizon glow

**Camera stance**
- Slight downward tilt, constrained pitch range
- Low “altitude” relative to surface so horizon reads

### 3.2 Continents (scene landmass)
v1 uses **implied landmass**:
- **Scene aura blobs**: soft radial gradients centered at `scene.centroid_pos`, radius scaled by `scene.size`.
- Optional **density underlay**: low-res splat/heat texture or shader accumulation.

Design notes:
- Avoid “literal terrain” until later. Keep it calm and legible.
- Continents should be visible primarily at zoom-out.

### 3.3 Nodes (tracks) with LOD
All nodes are GPU instanced.

**LOD0 (far)**
- Tiny emissive points/sprites
- No labels
- Minimal selection affordances (glow ring only if selected/now-playing)

**LOD1 (mid)**
- City-light dot + halo ring
- Hover snapping enabled
- Tooltip may appear (minimal)

**LOD2 (near)**
- Dot + ring + subtle “spire” visual (still no meaning)
- Labels for hovered/selected (strictly limited)
- More pronounced bridge/collision glyphs

### 3.4 Node Breathing (alive feel)
All nodes “breathe” subtly:
- Deterministic phase: `phase = hash(track.id) mod 2π`
- `breath = sin(time * speed + phase) * amplitude`
- Apply to glow intensity + micro scale
- Selected/now-playing slightly stronger amplitude

### 3.5 Deterministic Color Mapping (audio analysis-driven)
Colors reflect track characteristics deterministically.

**Inputs**: audio analysis features (canonical examples)
- energy
- valence (or mood vector)
- spectral centroid / brightness
- rhythmic complexity
- tempo

**Mapping**
- Hue derived from mood/valence direction or stable transform of mood embedding.
- Saturation from energy/complexity.
- Value from brightness/loudness.

**Fallback**
- If missing analysis: derive hue from stable hash of `track.id`, keep saturation/value in safe range.

**Scene color**
- Can be derived from average of member colors or remain neutral, using a faint tint.

### 3.6 Scene-to-Scene Flight Paths
Only scene graph edges are drawn in v1.

- Render curves between scene centroids.
- Slightly elevated above surface (purely visual).
- Weight -> opacity/thickness (clamped).
- Fade out at close zoom.

Optional animation (very subtle):
- slow shimmer along curve
- pulse when a scene is focused/selected

---

## 4) Interaction & UX

### 4.1 Camera Model (Drone Skim v1)
- **Drag**: pan along surface
- **Scroll**: zoom
- **Pitch**: constrained; prevent flips
- **Damping**: inertia for premium feel
- **Wrap**: seamless toroidal wrap as user pans

v1 principle: user retains control; click does not reposition camera (yet).

### 4.2 Hover (magnetic)
- Hover selects nearest node within radius.
- Soft snap / magnetic effect.
- Tooltip:
  - title, artist
  - chips: bpm, key, scene
  - icons/badges for bridge/collision if present

### 4.3 Click Selection
On click:
- Set `selectedTrackId`.
- Highlight selected node persistently.
- Open/update right rail DNA card.

Selection highlight states:
- Selected: bright ring + stronger glow + slightly stronger breathing
- Now-playing: distinct ring style (e.g., double ring) + consistent indicator
- Bridge/collision: small glyph overlay or ring modulation

---

## 5) Right Rail DNA Card (v1)

### 5.1 Layout
Right rail is stable, does not cover world. It should feel like a “control panel”.

### 5.2 Content sections
1. **Header**
   - Title + artist
   - Optional artwork thumbnail
2. **DNA Summary**
   - 4–8 key features (energy, mood, brightness, tempo, etc.)
3. **Scene Membership**
   - Scene name + small scene descriptor (optional)
4. **Artist Signals**
   - Bridge badge (if above threshold)
   - Collision badge (if above threshold)
5. **Why / Provenance**
   - Explain placement with server-provided provenance:
     - within-scene rank, cross-scene neighbor count, top features, similarity scores
     - reason codes (human-readable mapping)

### 5.3 Required actions (v1)
- **Play**
  - Starts playback; syncs with bottom player bar
- **Find Similar**
  - Highlights similar region/tracks (v1 can be scene-based)
  - Optionally recenters “focus reticle” without hard snapping camera
- **Why / Provenance**
  - Expands provenance section with numbers + human explanation
- **Start a Path**
  - Adds track to a “Journey” list (path builder)

---

## 6) Bottom Playback Bar Integration (v1)
- Global playback bar persists.
- Clicking a node selects it but does not auto-play.
- Clicking **Play** from DNA card triggers playback and updates bottom bar.
- Now-playing track is indicated on the map:
  - special ring
  - slightly stronger breathing
  - optional subtle “trail” when moving camera (later)

---

## 7) “Meaningful for Artists” (Bridge + Collision)

### 7.1 Bridge Tracks (required)
Definition: tracks that connect scenes (high connector importance).

Presentation:
- Visual: double halo ring or dedicated glyph
- Card: “Bridge Track” badge + explanation under Why/Provenance

### 7.2 Collisions (required)
Definition: surprising similarity across distant scenes.

Presentation:
- Visual: subtle shimmer / accent ring
- Card: “Collision” badge + explanation (what makes it a collision)

**Truth constraint**
- Both metrics must be computed on server (or validated) so they remain Helix-truthful.

---

## 8) Performance & LOD Requirements

### Targets
- 300–2,000 tracks: smooth pan/zoom and hover
- Minimal CPU per frame; avoid allocations in render loop

### Rules
- Nodes: InstancedMesh or GPU sprites (one draw call where possible)
- Labels: strict cap; only hovered + selected + optional top N nearest
- Scene arcs: merged geometry; avoid React-per-edge
- Auras/density: shader or low-res texture; avoid per-pixel CPU loops

### LOD behavior
- Far: scenes and arcs dominant; no labels
- Mid: hover snapping, tooltips
- Near: richer node visuals; arcs fade

---

## 9) State Model (Frontend)

### Required state
- `data: MapV1Response | null`
- `camera: { pos, zoom, pitch, yaw }`
- `hoveredTrackId: string | null`
- `selectedTrackId: string | null`
- `nowPlayingTrackId: string | null`
- `ui: { rightRailOpen: boolean, provenanceExpanded: boolean, pathBuilderOpen: boolean }`
- `path: Array<{ trackId: string, addedAt: number }>`

### Derived state
- `selectedTrack`, `selectedScene`, `sceneEdgesForScene`
- `visibleLOD` based on zoom
- `wrapTransform` for node placement relative to camera

---

## 10) Acceptance Criteria (v1)
1. Drone-skim navigation feels intuitive; pitch constraints prevent disorientation.
2. Toroidal wrap works seamlessly; no visible “edge jump”.
3. Zoomed-out view shows continent-like scene structure (auras + density).
4. Nodes breathe subtly; selected/now-playing are clearly differentiated.
5. Scene-to-scene flight paths are visible at far/mid zoom and fade at near zoom.
6. Hover is magnetic and stable; tooltip shows meaningful info.
7. Click selection updates right rail DNA card.
8. DNA card provides actions:
   - Play
   - Find Similar
   - Why/Provenance (with numbers, not vibes)
   - Start a Path (adds to journey list)
9. Colors are deterministic and reflect audio analysis; stable across reloads.
10. Bridge and collision badges appear and are explainable via provenance.
11. Performance is smooth for 300–2,000 tracks.

---

## 11) Recommended Stack & Libraries
- Rendering: `three.js` + `@react-three/fiber`
- Controls: custom camera controller (avoid heavy generic orbit controls)
- Postprocessing: minimal bloom (only selected/now-playing), fog, subtle vignette
- Data: typed fetch with caching keyed by `world.version_hash`

---

## 12) Glossary
- **Track DNA**: compact representation of track characteristics (analysis + embeddings) used for artist understanding.
- **Scene**: cluster of tracks in embedding space; can be renamed/merged later.
- **Collision**: unexpected cross-scene similarity.
- **Bridge track**: track connecting scenes; important connector in graph terms.
