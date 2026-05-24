N::Track {
    title: String,
    artist: String,
    filepath: String,
    original_filename: String,
    file_hash: String,
    status: String,
    duration_sec: F64,
    bpm: F64,
    key: String,
    energy: F64,
    brightness: F64,
    loudness: F64,
    complexity: F64,
    bpm_confidence: F64,
    key_confidence: F64,
    analysis_version: String,
    embedding_version: String,
    upload_date: String,
    error: String
}

N::Scene {
    stable_id: String,
    name: String,
    build_id: String,
    build_seq: I64,
    centroid_x: F64,
    centroid_y: F64,
    color: String,
    track_count: I64,
    updated_at: String
}

N::Atlas_Build {
    build_id: String,
    build_seq: I64,
    version_hash: String,
    generated_at: String,
    status: String,
    ready_track_count: I64,
    similar_edge_count: I64,
    scene_count: I64,
    similarity_basis: String,
    model_version: String
}

V::Audio_Vector {
    embedding: [F64]
}

E::HAS_AUDIO_EMBEDDING {
    From: Track,
    To: Audio_Vector,
    Properties: {
    }
}

E::IN_SCENE {
    From: Track,
    To: Scene,
    Properties: {
        membership_score: F64,
        build_seq: I64
    }
}

E::SIMILAR_TO {
    From: Track,
    To: Track,
    Properties: {
        score: F64,
        basis: String,
        model_version: String,
        updated_at: String,
        build_seq: I64
    }
}

E::ADJACENT {
    From: Scene,
    To: Scene,
    Properties: {
        score: F64,
        basis: String,
        build_seq: I64
    }
}

E::COLLIDES_WITH {
    From: Track,
    To: Track,
    Properties: {
        score: F64,
        reasons: [String],
        bpm_delta: F64,
        key_relation: String,
        build_seq: I64
    }
}
