#[mcp]
QUERY AddTrack(title: String, artist: String, filepath: String, original_filename: String, file_hash: String, status: String, upload_date: String) =>
    track <- AddN<Track>({
        title: title,
        artist: artist,
        filepath: filepath,
        original_filename: original_filename,
        file_hash: file_hash,
        status: status,
        duration_sec: 0.0,
        bpm: 0.0,
        key: "",
        energy: 0.0,
        brightness: 0.0,
        loudness: 0.0,
        complexity: 0.0,
        bpm_confidence: 0.0,
        key_confidence: 0.0,
        analysis_version: "",
        embedding_version: "",
        upload_date: upload_date,
        error: ""
    })
    RETURN track

#[mcp]
QUERY GetTrack(id: ID) =>
    track <- N<Track>(id)
    RETURN track

#[mcp]
QUERY UpdateTrackAnalysis(id: ID, duration_sec: F64, bpm: F64, key: String, energy: F64, brightness: F64, loudness: F64, complexity: F64, bpm_confidence: F64, key_confidence: F64, analysis_version: String, embedding_version: String, status: String) =>
    updated <- N<Track>(id)::UPDATE({
        duration_sec: duration_sec,
        bpm: bpm,
        key: key,
        energy: energy,
        brightness: brightness,
        loudness: loudness,
        complexity: complexity,
        bpm_confidence: bpm_confidence,
        key_confidence: key_confidence,
        analysis_version: analysis_version,
        embedding_version: embedding_version,
        status: status
    })
    RETURN updated

#[mcp]
QUERY UpdateTrackStatus(id: ID, status: String) =>
    updated <- N<Track>(id)::UPDATE({
        status: status
    })
    RETURN updated

#[mcp]
QUERY UpdateTrackError(id: ID, error: String) =>
    updated <- N<Track>(id)::UPDATE({
        status: "ERROR",
        error: error
    })
    RETURN updated

#[mcp]
QUERY AddScene(name: String) =>
    scene <- AddN<Scene>({
        stable_id: "",
        name: name,
        build_id: "",
        build_seq: 0,
        centroid_x: 0.0,
        centroid_y: 0.0,
        color: "#f97316",
        track_count: 0,
        updated_at: ""
    })
    RETURN scene

#[mcp]
QUERY AddSceneDetailed(stable_id: String, name: String, build_id: String, build_seq: I64, centroid_x: F64, centroid_y: F64, color: String, track_count: I64, updated_at: String) =>
    scene <- AddN<Scene>({
        stable_id: stable_id,
        name: name,
        build_id: build_id,
        build_seq: build_seq,
        centroid_x: centroid_x,
        centroid_y: centroid_y,
        color: color,
        track_count: track_count,
        updated_at: updated_at
    })
    RETURN scene

#[mcp]
QUERY CreateAtlasBuild(build_id: String, build_seq: I64, version_hash: String, generated_at: String, ready_track_count: I64, similar_edge_count: I64, scene_count: I64, similarity_basis: String, model_version: String) =>
    build <- AddN<Atlas_Build>({
        build_id: build_id,
        build_seq: build_seq,
        version_hash: version_hash,
        generated_at: generated_at,
        status: "PENDING",
        ready_track_count: ready_track_count,
        similar_edge_count: similar_edge_count,
        scene_count: scene_count,
        similarity_basis: similarity_basis,
        model_version: model_version
    })
    RETURN build

#[mcp]
QUERY GetLatestAtlasBuild() =>
    build <- N<Atlas_Build>::ORDER<Desc>(_::{build_seq})::FIRST
    RETURN build

#[mcp]
QUERY GetActiveAtlasBuild() =>
    build <- N<Atlas_Build>::WHERE(_::{status}::EQ("ACTIVE"))::ORDER<Desc>(_::{build_seq})::FIRST
    RETURN build

#[mcp]
QUERY MarkAtlasBuildActive(id: ID) =>
    build <- N<Atlas_Build>(id)::UPDATE({
        status: "ACTIVE"
    })
    RETURN build

#[mcp]
QUERY MarkAtlasBuildSuperseded(id: ID) =>
    build <- N<Atlas_Build>(id)::UPDATE({
        status: "SUPERSEDED"
    })
    RETURN build

#[mcp]
QUERY AddAudioEmbedding(track_id: ID, embedding: [F64]) =>
    vec <- AddV<Audio_Vector>(embedding)
    edge <- AddE<HAS_AUDIO_EMBEDDING>::From(track_id)::To(vec)
    RETURN vec

#[mcp]
QUERY FindAudioNeighbors(embedding: [F64], k: I64) =>
    similar <- SearchV<Audio_Vector>(embedding, k)
    neighbors <- similar::In<HAS_AUDIO_EMBEDDING>
    RETURN neighbors

#[mcp]
QUERY AddSimilarEdge(from_id: ID, to_id: ID, score: F64, basis: String, model_version: String, updated_at: String, build_seq: I64) =>
    source <- N<Track>(from_id)
    target <- N<Track>(to_id)
    edge <- AddE<SIMILAR_TO>({
        score: score,
        basis: basis,
        model_version: model_version,
        updated_at: updated_at,
        build_seq: build_seq
    })::From(source)::To(target)
    RETURN edge

#[mcp]
QUERY AddTrackToScene(track_id: ID, scene_id: ID, membership_score: F64, build_seq: I64) =>
    track <- N<Track>(track_id)
    scene <- N<Scene>(scene_id)
    edge <- AddE<IN_SCENE>({
        membership_score: membership_score,
        build_seq: build_seq
    })::From(track)::To(scene)
    RETURN edge

#[mcp]
QUERY AddAdjacentEdge(from_scene_id: ID, to_scene_id: ID, score: F64, basis: String, build_seq: I64) =>
    source <- N<Scene>(from_scene_id)
    target <- N<Scene>(to_scene_id)
    edge <- AddE<ADJACENT>({
        score: score,
        basis: basis,
        build_seq: build_seq
    })::From(source)::To(target)
    RETURN edge

#[mcp]
QUERY AddCollisionEdge(from_id: ID, to_id: ID, score: F64, reasons: [String], bpm_delta: F64, key_relation: String, build_seq: I64) =>
    source <- N<Track>(from_id)
    target <- N<Track>(to_id)
    edge <- AddE<COLLIDES_WITH>({
        score: score,
        reasons: reasons,
        bpm_delta: bpm_delta,
        key_relation: key_relation,
        build_seq: build_seq
    })::From(source)::To(target)
    RETURN edge

#[mcp]
QUERY GetScenesByBuildSeq(build_seq: I64) =>
    scenes <- N<Scene>::WHERE(_::{build_seq}::EQ(build_seq))
    RETURN scenes

#[mcp]
QUERY GetSceneMembershipsByBuildSeq(build_seq: I64) =>
    edges <- E<IN_SCENE>::WHERE(_::{build_seq}::EQ(build_seq))
    RETURN edges

#[mcp]
QUERY GetSimilarEdgesByBuildSeq(build_seq: I64) =>
    edges <- E<SIMILAR_TO>::WHERE(_::{build_seq}::EQ(build_seq))
    RETURN edges

#[mcp]
QUERY GetAdjacentEdgesByBuildSeq(build_seq: I64) =>
    edges <- E<ADJACENT>::WHERE(_::{build_seq}::EQ(build_seq))
    RETURN edges

#[mcp]
QUERY GetCollisionEdgesByBuildSeq(build_seq: I64) =>
    edges <- E<COLLIDES_WITH>::WHERE(_::{build_seq}::EQ(build_seq))
    RETURN edges

#[mcp]
QUERY GetTrackScenes(track_id: ID) =>
    scenes <- N<Track>(track_id)::Out<IN_SCENE>
    RETURN scenes

#[mcp]
QUERY GetAdjacentScenes(scene_id: ID) =>
    scenes <- N<Scene>(scene_id)::Out<ADJACENT>
    RETURN scenes

#[mcp]
QUERY GetSimilarTracks(id: ID) =>
    similar <- N<Track>(id)::Out<SIMILAR_TO>
    RETURN similar

#[mcp]
QUERY GetTrackCollisionEdges(track_id: ID) =>
    collisions <- N<Track>(track_id)::Out<COLLIDES_WITH>
    RETURN collisions

#[mcp]
QUERY GetTrackAudioEmbedding(track_id: ID) =>
    vec <- N<Track>(track_id)::Out<HAS_AUDIO_EMBEDDING>
    RETURN vec
