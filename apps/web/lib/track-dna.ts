import type {
  AdjacentSceneResult,
  AtlasBuild,
  AtlasTrackFeatureContributionV1,
  AtlasTrackProvenanceV1,
  CollisionTrackResult,
  SimilarTrackResult,
  Track,
  TrackDnaSectionStates,
  TrackDnaSectionStatus,
  TrackSceneHome,
} from "@atlas/shared";

const FEATURE_LABELS: Record<string, string> = {
  energy: "Energy",
  tempo: "Tempo",
  valence: "Valence",
  complexity: "Complexity",
  brightness: "Brightness",
  loudness: "Loudness",
};

function sectionStatus(
  state: TrackDnaSectionStatus["state"],
  message: string
): TrackDnaSectionStatus {
  return { state, message };
}

export function featureLabel(name: string): string {
  return FEATURE_LABELS[name] ?? name.replace(/_/g, " ");
}

export function describeFeatureContribution(feature: AtlasTrackFeatureContributionV1): string {
  const label = featureLabel(feature.name);
  const z = feature.z ?? 0;
  if (z >= 0.6) return `${label} stands out strongly in this atlas cohort.`;
  if (z <= -0.6) return `${label} sits lower than the cohort baseline.`;
  return `${label} helps define the track's placement.`;
}

export function buildTrackPlacementSummary(args: {
  track: Pick<Track, "status">;
  provenance: AtlasTrackProvenanceV1;
  sceneHome: TrackSceneHome | null;
}): string {
  const { track, provenance, sceneHome } = args;
  const topFeature = provenance.top_features?.[0];

  if (track.status === "ERROR") {
    return "Analysis did not complete, so Atlas cannot place this track in the graph yet.";
  }

  if (track.status !== "READY") {
    return "Analysis is still running. Atlas will place this track once its audio profile and graph relationships are ready.";
  }

  if (sceneHome && topFeature) {
    return `${featureLabel(topFeature.name)} is the clearest driver here; Atlas places this track in ${sceneHome.scene.name} as ${sceneHome.descriptor.toLowerCase()}.`;
  }

  if (sceneHome) {
    return `Atlas places this track in ${sceneHome.scene.name} as ${sceneHome.descriptor.toLowerCase()}.`;
  }

  if (topFeature) {
    return `${describeFeatureContribution(topFeature)} Graph placement will fill in once the active build persists this track's neighborhood.`;
  }

  return "Atlas has the audio profile for this track, but its graph placement is not available yet.";
}

export function buildTrackDnaSectionStates(args: {
  track: Pick<Track, "status">;
  build: AtlasBuild | null;
  sceneHome: TrackSceneHome | null;
  adjacentScenes: AdjacentSceneResult[];
  similarTracks: SimilarTrackResult[];
  collisions: CollisionTrackResult[];
}): TrackDnaSectionStates {
  const { track, build, sceneHome, adjacentScenes, similarTracks, collisions } = args;

  if (track.status === "ERROR") {
    return {
      scene_home: sectionStatus(
        "not_ready",
        "Scene placement is unavailable because analysis did not complete."
      ),
      adjacent_scenes: sectionStatus(
        "not_ready",
        "Nearby scenes are unavailable because analysis did not complete."
      ),
      similar_tracks: sectionStatus(
        "not_ready",
        "Similarity context is unavailable because analysis did not complete."
      ),
      collisions: sectionStatus(
        "not_ready",
        "Collision pairs are unavailable because analysis did not complete."
      ),
    };
  }

  if (track.status !== "READY") {
    return {
      scene_home: sectionStatus(
        "not_ready",
        "Scene placement appears after analysis completes."
      ),
      adjacent_scenes: sectionStatus(
        "not_ready",
        "Nearby scenes unlock after this track is analyzed and placed."
      ),
      similar_tracks: sectionStatus(
        "not_ready",
        "Similarity context appears after analysis completes."
      ),
      collisions: sectionStatus(
        "not_ready",
        "Collision pairs appear after Atlas finishes analysis and graph placement."
      ),
    };
  }

  if (!build) {
    return {
      scene_home: sectionStatus(
        "no_active_build",
        "Track analysis is ready, but Atlas does not have an active graph build yet."
      ),
      adjacent_scenes: sectionStatus(
        "no_active_build",
        "Nearby scenes will appear after Atlas publishes an active graph build."
      ),
      similar_tracks: sectionStatus(
        "no_active_build",
        "Persisted similar-track edges will appear after the next active graph build."
      ),
      collisions: sectionStatus(
        "no_active_build",
        "Collision pairs will appear after the next active graph build."
      ),
    };
  }

  const sceneHomeState = sceneHome
    ? sectionStatus("ready", "Atlas has a persisted home scene for this track.")
    : sectionStatus(
        "no_graph_data",
        "The active build has not persisted a scene assignment for this track yet."
      );

  const adjacentScenesState = !sceneHome
    ? sectionStatus(
        "no_graph_data",
        "Nearby scenes unlock after Atlas persists this track's home scene."
      )
    : adjacentScenes.length > 0
      ? sectionStatus("ready", `Atlas found ${adjacentScenes.length} nearby scenes.`)
      : sectionStatus(
          "ready_empty",
          "This scene has no persisted adjacent-scene edges yet."
        );

  const similarTracksState =
    build.similar_edge_count <= 0
      ? sectionStatus(
          "no_graph_data",
          "The active build has not published persisted similar-track edges yet."
        )
      : similarTracks.length > 0
        ? sectionStatus("ready", `Atlas found ${similarTracks.length} persisted neighbors.`)
        : sectionStatus(
            "ready_empty",
            "This track has no persisted similar neighbors in the active build yet."
          );

  const collisionsState =
    !sceneHome && collisions.length === 0
      ? sectionStatus(
          "no_graph_data",
          "Collision pairs depend on this track landing in the persisted graph first."
        )
      : build.similar_edge_count <= 0 && collisions.length === 0
        ? sectionStatus(
            "no_graph_data",
            "Collision pairs are waiting on persisted similarity graph truth."
          )
        : collisions.length > 0
          ? sectionStatus("ready", `Atlas found ${collisions.length} persisted collision pairs.`)
          : sectionStatus(
              "ready_empty",
              "No persisted collision pairs passed the current build for this track."
            );

  return {
    scene_home: sceneHomeState,
    adjacent_scenes: adjacentScenesState,
    similar_tracks: similarTracksState,
    collisions: collisionsState,
  };
}
