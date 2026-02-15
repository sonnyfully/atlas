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
    upload_date: String,
    error: String
}

N::Scene {
    name: String
}

V::Track_Vector {
    embedding: [F64]
}

V::Audio_Vector {
    embedding: [F64]
}

E::HAS_EMBEDDING {
    From: Track,
    To: Track_Vector,
    Properties: {
    }
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
    }
}

E::SIMILAR_TO {
    From: Track,
    To: Track,
    Properties: {
        score: F64,
        basis: String,
        model_version: String
    }
}

