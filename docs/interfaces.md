# Interfaces

Last verified: 2026-04-05

## API Routes
- `GET /api/tracks`
- `GET /api/tracks/:id`
- `GET /api/tracks/:id/similar`
- `GET /api/tracks/:id/collisions`
- `GET /api/tracks/search?q=...&limit=...`
- `GET /api/scenes`
- `GET /api/scenes/:id`
- `POST /api/ingest`
- `GET /api/audio/:id`
- `GET /api/cover/blobtoon/:trackId.svg?v=1&s=<size>`
- `GET /api/atlas/map?v=1`

## Route Notes

### `POST /api/ingest`
- Request: `multipart/form-data` with `file`
- Success response:
```ts
interface IngestResponse {
  id: string;
  status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
  duplicate: boolean;
}
```
- Failure behavior:
  - `400` invalid file
  - `503` Helix unavailable
  - `500` unexpected ingest failure

### `GET /api/tracks/search`
- Query params:
  - `q` required
  - `limit` optional, clamped to `1..100`
- Success response:
```ts
interface TrackSearchResponse {
  results: Track[];
}
```

### `GET /api/tracks/:id/similar`
- Success response:
```ts
interface SimilarTracksResponse {
  source_id: string;
  results: SimilarTrackResult[];
}
```

### `GET /api/tracks/:id/collisions`
- Success response:
```ts
interface CollisionTracksResponse {
  source_id: string;
  results: CollisionTrackResult[];
}
```

### `GET /api/scenes`
- Success response:
```ts
interface SceneListResponse {
  build: AtlasBuild | null;
  scenes: SceneSummary[];
}
```

### `GET /api/scenes/:id`
- Success response:
```ts
interface SceneDetailResponse {
  build: AtlasBuild | null;
  scene: SceneSummary | null;
  members: SceneMemberResult[];
  adjacent_scenes: AdjacentSceneResult[];
}
```

### `GET /api/audio/:id`
- Success behavior:
  - `200` full-file stream
  - `206` range response when `Range` header is provided
- Failure behavior:
  - `404` track missing or file missing on disk
  - `422` track exists but is not `READY`

### `GET /api/cover/blobtoon/:trackId.svg`
- Query params:
  - `v` optional version integer
  - `s` optional requested size
- Behavior:
  - deterministic SVG payload
  - immutable cache headers
  - stable ETag and `304` support

### `GET /api/atlas/map?v=1`
- This is the primary map contract
- Optional query:
  - `rebuild=1` triggers a canonical rebuild before returning the payload
- Success response:
```ts
interface AtlasMapV1Response {
  world: AtlasWorldV1;
  tracks: AtlasMapTrackV1[];
  scenes: AtlasMapSceneV1[];
  scene_graph_edges: AtlasSceneGraphEdgeV1[];
}
```

## Core DTOs

### Track
```ts
type TrackStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR";

interface Track {
  id: string;
  title: string;
  artist: string;
  filepath: string;
  original_filename: string;
  file_hash: string;
  status: TrackStatus;
  duration_sec: number;
  bpm: number;
  key: string;
  energy: number;
  upload_date: string;
  error: string;
}
```

### Similarity
```ts
type SimilarityBasis = "audio";

interface SimilarEdge {
  id?: string;
  from_id: string;
  to_id: string;
  score: number;
  basis: SimilarityBasis;
  model_version: string;
  updated_at?: string;
}

interface SimilarTrackResult {
  track: Track;
  score: number;
  basis: SimilarityBasis;
  model_version: string;
  updated_at?: string;
}

interface SimilarTracksResponse {
  source_id: string;
  results: SimilarTrackResult[];
}
```

### Atlas 3D Map v1
```ts
interface AtlasWorldV1 {
  world_size: number;
  version_hash: string;
}

interface AtlasTrackFeatureContributionV1 {
  name: string;
  value: number;
  z?: number;
}

interface AtlasTrackProvenanceV1 {
  top_features?: AtlasTrackFeatureContributionV1[];
  similarity_context?: {
    within_scene_rank?: number;
    cross_scene_neighbors?: number;
  };
  reason_codes?: string[];
}

interface AtlasMapTrackV1 {
  id: string;
  title: string;
  artist: string;
  scene_id: string;
  pos: { x: number; y: number };
  analysis: Record<string, number | string>;
  bpm?: number;
  key?: number | string;
  duration_s?: number;
  artwork_url?: string;
  bridge_score?: number;
  collision_score?: number;
  similar_neighbor_ids?: string[];
  provenance?: AtlasTrackProvenanceV1;
}

interface AtlasMapSceneV1 {
  id: string;
  name?: string;
  centroid_pos: { x: number; y: number };
  size: number;
}

interface AtlasSceneGraphEdgeV1 {
  from_scene_id: string;
  to_scene_id: string;
  weight: number;
  type?: "bridge" | "collision" | "adjacent";
}

interface AtlasMapV1Response {
  world: AtlasWorldV1;
  tracks: AtlasMapTrackV1[];
  scenes: AtlasMapSceneV1[];
  scene_graph_edges: AtlasSceneGraphEdgeV1[];
}
```

## Error Envelope
```ts
interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}
```
