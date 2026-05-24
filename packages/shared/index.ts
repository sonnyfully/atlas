export const HELIX_URL = process.env.HELIX_URL ?? "http://localhost:6969";

// Track status lifecycle
export type TrackStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR";

// Track as stored in HelixDB
export interface Track {
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
  brightness: number;
  loudness: number;
  complexity: number;
  bpm_confidence: number;
  key_confidence: number;
  analysis_version: string;
  embedding_version: string;
  upload_date: string;
  error: string;
  scene_id?: string;
  scene_name?: string;
  scene_color?: string;
}

// Audio URL helper — single abstraction point for serving audio
export function audioUrl(trackId: string): string {
  return `/api/audio/${trackId}`;
}

// Ingest API response
export interface IngestResponse {
  id: string;
  status: TrackStatus;
  duplicate: boolean;
}

export type SimilarityBasis = "audio" | "audio_features";
export type CollisionReason =
  | "TIMBRE_CLOSE"
  | "VIBE_COMPLEMENT"
  | "BPM_COMPATIBLE"
  | "KEY_COMPATIBLE"
  | "CROSS_SCENE";

export interface SimilarEdge {
  id?: string;
  from_id: string;
  to_id: string;
  score: number;
  basis: SimilarityBasis;
  model_version: string;
  updated_at?: string;
  build_seq?: number;
}

export interface SceneAdjacencyEdge {
  id?: string;
  from_scene_id: string;
  to_scene_id: string;
  score: number;
  basis: SimilarityBasis;
  build_seq: number;
}

export interface CollisionEdge {
  id?: string;
  from_id: string;
  to_id: string;
  score: number;
  reasons: CollisionReason[];
  bpm_delta: number;
  key_relation: string;
  build_seq: number;
}

export interface AtlasBuild {
  id: string;
  build_id: string;
  build_seq: number;
  version_hash: string;
  generated_at: string;
  status: string;
  ready_track_count: number;
  similar_edge_count: number;
  scene_count: number;
  similarity_basis: SimilarityBasis;
  model_version: string;
}

export interface PersistedScene {
  id: string;
  stable_id: string;
  name: string;
  build_id: string;
  build_seq: number;
  centroid_x: number;
  centroid_y: number;
  color: string;
  track_count: number;
  updated_at: string;
  track_ids: string[];
}

export interface PersistedSceneMembership {
  id?: string;
  track_id: string;
  scene_node_id: string;
  scene_id: string;
  scene_name: string;
  scene_color: string;
  membership_score: number;
  build_seq: number;
}

export interface SceneSummary {
  id: string;
  name: string;
  color: string;
  centroid: {
    x: number;
    y: number;
  };
  track_count: number;
  adjacent_scene_count: number;
}

export interface SceneListResponse {
  build: AtlasBuild | null;
  scenes: SceneSummary[];
}

// Similar track result with edge metadata
export interface SimilarTrackResult {
  track: Track;
  score: number;
  basis: SimilarityBasis;
  model_version: string;
  updated_at?: string;
  build_seq?: number;
}

export interface SimilarTracksResponse {
  source_id: string;
  results: SimilarTrackResult[];
}

export interface CollisionTrackResult {
  track: Track;
  score: number;
  reasons: CollisionReason[];
  reason_labels: string[];
  bpm_delta: number;
  key_relation: string;
  build_seq: number;
}

export interface TrackSceneHome {
  scene: AtlasScene;
  membership_score: number;
  build_seq: number;
  descriptor: string;
}

export interface SceneMemberResult {
  track: Track;
  membership_score: number;
  build_seq: number;
}

export interface AdjacentSceneResult {
  scene: AtlasScene;
  score: number;
  basis: SimilarityBasis;
  build_seq: number;
}

export interface SceneDetailResponse {
  build: AtlasBuild | null;
  scene: SceneSummary | null;
  members: SceneMemberResult[];
  adjacent_scenes: AdjacentSceneResult[];
}

export type TrackDnaSectionState =
  | "ready"
  | "not_ready"
  | "no_active_build"
  | "no_graph_data"
  | "ready_empty";

export interface TrackDnaSectionStatus {
  state: TrackDnaSectionState;
  message: string;
}

export interface TrackDnaSectionStates {
  scene_home: TrackDnaSectionStatus;
  adjacent_scenes: TrackDnaSectionStatus;
  similar_tracks: TrackDnaSectionStatus;
  collisions: TrackDnaSectionStatus;
}

export interface TrackDnaResponse extends Partial<Track> {
  status: TrackStatus;
  track: Track;
  build: AtlasBuild | null;
  analysis: AtlasTrackAnalysisV1;
  provenance: AtlasTrackProvenanceV1;
  placement_summary: string;
  section_states: TrackDnaSectionStates;
  scene_home: TrackSceneHome | null;
  adjacent_scenes: AdjacentSceneResult[];
  similar_tracks: SimilarTrackResult[];
  collisions: CollisionTrackResult[];
}

export interface AtlasScene {
  id: string;
  name: string;
  color: string;
  centroid_x: number;
  centroid_y: number;
  track_count: number;
}

export interface AtlasMapNode {
  id: string;
  track: Track;
  x: number;
  y: number;
  degree: number;
  scene_id?: string;
  scene_name?: string;
  scene_color?: string;
}

export interface AtlasMapEdge extends SimilarEdge {}

export interface AtlasMapMeta {
  build_id: string;
  generated_at: string;
  min_score: number;
  ready_track_count: number;
  edge_count: number;
  scene_count: number;
}

export interface AtlasMapResponse {
  schema_version: "atlas-map-v1";
  min_tracks_required: number;
  min_edges_required: number;
  status: "ready" | "not_enough_data" | "unavailable";
  nodes: AtlasMapNode[];
  edges: AtlasMapEdge[];
  scenes: AtlasScene[];
  meta?: AtlasMapMeta;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface AtlasWorldV1 {
  world_size: number;
  version_hash: string;
}

export interface AtlasTrackAnalysisV1 {
  energy: number;
  tempo: number;
  duration: number;
  key_index: number;
  valence: number;
  complexity: number;
  brightness: number;
  loudness: number;
  mood_x: number;
  mood_y: number;
}

export interface AtlasTrackFeatureContributionV1 {
  name: string;
  value: number;
  z?: number;
}

export interface AtlasTrackProvenanceV1 {
  top_features?: AtlasTrackFeatureContributionV1[];
  similarity_context?: {
    within_scene_rank?: number;
    cross_scene_neighbors?: number;
  };
  reason_codes?: string[];
}

export interface AtlasMapTrackV1 {
  id: string;
  title: string;
  artist: string;
  scene_id: string;
  pos: { x: number; y: number };
  analysis: AtlasTrackAnalysisV1;
  bpm?: number;
  key?: number | string;
  duration_s?: number;
  artwork_url?: string;
  bridge_score?: number;
  collision_score?: number;
  similar_neighbor_ids?: string[];
  provenance?: AtlasTrackProvenanceV1;
}

export interface AtlasMapSceneV1 {
  id: string;
  name?: string;
  centroid_pos: { x: number; y: number };
  size: number;
}

export interface AtlasSceneGraphEdgeV1 {
  from_scene_id: string;
  to_scene_id: string;
  weight: number;
  type?: "bridge" | "collision" | "adjacent";
}

export interface AtlasMapV1Response {
  world: AtlasWorldV1;
  tracks: AtlasMapTrackV1[];
  scenes: AtlasMapSceneV1[];
  scene_graph_edges: AtlasSceneGraphEdgeV1[];
}
