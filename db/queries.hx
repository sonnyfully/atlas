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
        upload_date: upload_date,
        error: ""
    })
    RETURN track

#[mcp]
QUERY GetTrack(id: ID) =>
    track <- N<Track>(id)
    RETURN track

#[mcp]
QUERY UpdateTrackAnalysis(id: ID, duration_sec: F64, bpm: F64, key: String, energy: F64, status: String) =>
    updated <- N<Track>(id)::UPDATE({
        duration_sec: duration_sec,
        bpm: bpm,
        key: key,
        energy: energy,
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
        name: name
    })
    RETURN scene

#[mcp]
QUERY AddTrackEmbedding(track_id: ID, embedding: [F64]) =>
    vec <- AddV<Track_Vector>(embedding)
    edge <- AddE<HAS_EMBEDDING>::From(track_id)::To(vec)
    RETURN vec

#[mcp]
QUERY FindNeighbors(embedding: [F64], k: I64) =>
    similar <- SearchV<Track_Vector>(embedding, k)
    neighbors <- similar::In<HAS_EMBEDDING>
    RETURN neighbors

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
QUERY AddSimilarEdge(from_id: ID, to_id: ID, score: F64, basis: String, model_version: String) =>
    edge <- AddE<SIMILAR_TO>::From(from_id)::To(to_id)
    updated <- edge::UPDATE({
        score: score,
        basis: basis,
        model_version: model_version
    })
    RETURN updated

#[mcp]
QUERY GetSimilarTracks(id: ID) =>
    similar <- N<Track>(id)::Out<SIMILAR_TO>
    RETURN similar

#[mcp]
QUERY GetTrackEmbedding(track_id: ID) =>
    vec <- N<Track>(track_id)::Out<HAS_EMBEDDING>
    RETURN vec
