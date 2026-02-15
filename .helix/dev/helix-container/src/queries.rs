
// DEFAULT CODE
// use helix_db::helix_engine::traversal_core::config::Config;

// pub fn config() -> Option<Config> {
//     None
// }



use bumpalo::Bump;
use heed3::RoTxn;
use helix_macros::{handler, tool_call, mcp_handler, migration};
use helix_db::{
    helix_engine::{
        reranker::{
            RerankAdapter,
            fusion::{RRFReranker, MMRReranker, DistanceMethod},
        },
        traversal_core::{
            config::{Config, GraphConfig, VectorConfig},
            ops::{
                bm25::search_bm25::SearchBM25Adapter,
                g::G,
                in_::{in_::InAdapter, in_e::InEdgesAdapter, to_n::ToNAdapter, to_v::ToVAdapter},
                out::{
                    from_n::FromNAdapter, from_v::FromVAdapter, out::OutAdapter, out_e::OutEdgesAdapter,
                },
                source::{
                    add_e::AddEAdapter,
                    add_n::AddNAdapter,
                    e_from_id::EFromIdAdapter,
                    e_from_type::EFromTypeAdapter,
                    n_from_id::NFromIdAdapter,
                    n_from_index::NFromIndexAdapter,
                    n_from_type::NFromTypeAdapter,
                    v_from_id::VFromIdAdapter,
                    v_from_type::VFromTypeAdapter
                },
                util::{
                    dedup::DedupAdapter, drop::Drop, exist::Exist, filter_mut::FilterMut,
                    filter_ref::FilterRefAdapter, map::MapAdapter, paths::{PathAlgorithm, ShortestPathAdapter},
                    range::RangeAdapter, update::UpdateAdapter, order::OrderByAdapter,
                    aggregate::AggregateAdapter, group_by::GroupByAdapter, count::CountAdapter,
                    upsert::UpsertAdapter,
                },
                vectors::{
                    brute_force_search::BruteForceSearchVAdapter, insert::InsertVAdapter,
                    search::SearchVAdapter,
                },
            },
            traversal_value::TraversalValue,
        },
        types::{GraphError, SecondaryIndex},
        vector_core::vector::HVector,
    },
    helix_gateway::{
        embedding_providers::{EmbeddingModel, get_embedding_model},
        router::router::{HandlerInput, IoContFn},
        mcp::mcp::{MCPHandlerSubmission, MCPToolInput, MCPHandler}
    },
    node_matches, props, embed, embed_async,
    field_addition_from_old_field, field_type_cast, field_addition_from_value,
    protocol::{
        response::Response,
        value::{casting::{cast, CastType}, Value},
        format::Format,
    },
    utils::{
        id::{ID, uuid_str},
        items::{Edge, Node},
        properties::ImmutablePropertiesMap,
    },
};
use sonic_rs::{Deserialize, Serialize, json};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use chrono::{DateTime, Utc};

// Re-export scalar types for generated code
type I8 = i8;
type I16 = i16;
type I32 = i32;
type I64 = i64;
type U8 = u8;
type U16 = u16;
type U32 = u32;
type U64 = u64;
type U128 = u128;
type F32 = f32;
type F64 = f64;
    
pub fn config() -> Option<Config> {
return Some(Config {
vector_config: Some(VectorConfig {
m: Some(16),
ef_construction: Some(128),
ef_search: Some(768),
}),
graph_config: Some(GraphConfig {
secondary_indices: None,
}),
db_max_size_gb: Some(20),
mcp: Some(true),
bm25: Some(true),
schema: Some(r#"{
  "schema": {
    "nodes": [
      {
        "name": "Track",
        "properties": {
          "original_filename": "String",
          "key": "String",
          "id": "ID",
          "label": "String",
          "title": "String",
          "file_hash": "String",
          "bpm": "F64",
          "artist": "String",
          "filepath": "String",
          "status": "String",
          "duration_sec": "F64",
          "energy": "F64",
          "upload_date": "String",
          "error": "String"
        }
      },
      {
        "name": "Scene",
        "properties": {
          "id": "ID",
          "label": "String",
          "name": "String"
        }
      }
    ],
    "vectors": [
      {
        "name": "Track_Vector",
        "properties": {
          "score": "F64",
          "embedding": "Array(F64)",
          "id": "ID",
          "label": "String",
          "data": "Array(F64)"
        }
      },
      {
        "name": "Audio_Vector",
        "properties": {
          "embedding": "Array(F64)",
          "score": "F64",
          "id": "ID",
          "data": "Array(F64)",
          "label": "String"
        }
      }
    ],
    "edges": [
      {
        "name": "HAS_EMBEDDING",
        "from": "Track",
        "to": "Track_Vector",
        "properties": {}
      },
      {
        "name": "HAS_AUDIO_EMBEDDING",
        "from": "Track",
        "to": "Audio_Vector",
        "properties": {}
      },
      {
        "name": "IN_SCENE",
        "from": "Track",
        "to": "Scene",
        "properties": {}
      },
      {
        "name": "SIMILAR_TO",
        "from": "Track",
        "to": "Track",
        "properties": {
          "score": "F64",
          "basis": "String",
          "model_version": "String"
        }
      }
    ]
  },
  "queries": [
    {
      "name": "AddTrackEmbedding",
      "parameters": {
        "track_id": "ID",
        "embedding": "Array(F64)"
      },
      "returns": [
        "vec"
      ]
    },
    {
      "name": "AddScene",
      "parameters": {
        "name": "String"
      },
      "returns": [
        "scene"
      ]
    },
    {
      "name": "AddSimilarEdge",
      "parameters": {
        "model_version": "String",
        "basis": "String",
        "from_id": "ID",
        "to_id": "ID",
        "score": "F64"
      },
      "returns": [
        "updated"
      ]
    },
    {
      "name": "GetTrackEmbedding",
      "parameters": {
        "track_id": "ID"
      },
      "returns": [
        "vec"
      ]
    },
    {
      "name": "AddTrack",
      "parameters": {
        "file_hash": "String",
        "title": "String",
        "artist": "String",
        "status": "String",
        "upload_date": "String",
        "filepath": "String",
        "original_filename": "String"
      },
      "returns": [
        "track"
      ]
    },
    {
      "name": "GetTrack",
      "parameters": {
        "id": "ID"
      },
      "returns": [
        "track"
      ]
    },
    {
      "name": "UpdateTrackError",
      "parameters": {
        "error": "String",
        "id": "ID"
      },
      "returns": [
        "updated"
      ]
    },
    {
      "name": "UpdateTrackStatus",
      "parameters": {
        "status": "String",
        "id": "ID"
      },
      "returns": [
        "updated"
      ]
    },
    {
      "name": "FindNeighbors",
      "parameters": {
        "k": "I64",
        "embedding": "Array(F64)"
      },
      "returns": [
        "neighbors"
      ]
    },
    {
      "name": "AddAudioEmbedding",
      "parameters": {
        "track_id": "ID",
        "embedding": "Array(F64)"
      },
      "returns": [
        "vec"
      ]
    },
    {
      "name": "FindAudioNeighbors",
      "parameters": {
        "k": "I64",
        "embedding": "Array(F64)"
      },
      "returns": [
        "neighbors"
      ]
    },
    {
      "name": "GetSimilarTracks",
      "parameters": {
        "id": "ID"
      },
      "returns": [
        "similar"
      ]
    },
    {
      "name": "UpdateTrackAnalysis",
      "parameters": {
        "energy": "F64",
        "duration_sec": "F64",
        "status": "String",
        "id": "ID",
        "bpm": "F64",
        "key": "String"
      },
      "returns": [
        "updated"
      ]
    }
  ]
}"#.to_string()),
embedding_model: Some("text-embedding-ada-002".to_string()),
graphvis_node_label: None,
})
}
pub struct Track {
    pub title: String,
    pub artist: String,
    pub filepath: String,
    pub original_filename: String,
    pub file_hash: String,
    pub status: String,
    pub duration_sec: f64,
    pub bpm: f64,
    pub key: String,
    pub energy: f64,
    pub upload_date: String,
    pub error: String,
}

pub struct Scene {
    pub name: String,
}

pub struct HAS_EMBEDDING {
    pub from: Track,
    pub to: Track_Vector,
}

pub struct HAS_AUDIO_EMBEDDING {
    pub from: Track,
    pub to: Audio_Vector,
}

pub struct IN_SCENE {
    pub from: Track,
    pub to: Scene,
}

pub struct SIMILAR_TO {
    pub from: Track,
    pub to: Track,
    pub score: f64,
    pub basis: String,
    pub model_version: String,
}

pub struct Track_Vector {
    pub embedding: Vec<f64>,
}

pub struct Audio_Vector {
    pub embedding: Vec<f64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddTrackEmbeddingInput {

pub track_id: ID,
pub embedding: Vec<f64>
}
#[derive(Serialize, Default)]
pub struct AddTrackEmbeddingVecReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub data: &'a [f64],
    pub score: f64,
    pub embedding: Option<&'a Value>,
}

#[handler(is_write)]
pub fn AddTrackEmbedding (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddTrackEmbeddingInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let vec = G::new_mut(&db, &arena, &mut txn)
.insert_v::<fn(&HVector, &RoTxn) -> bool>(&data.embedding, "Track_Vector", Some(ImmutablePropertiesMap::new(0, vec![].into_iter(), &arena))).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("HAS_EMBEDDING", None, *data.track_id, vec.id(), false, false).collect_to_obj()?;
let response = json!({
    "vec": AddTrackEmbeddingVecReturnType {
        id: uuid_str(vec.id(), &arena),
        label: vec.label(),
        data: vec.data(),
        score: vec.score(),
        embedding: vec.get_property("embedding"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct AddTrackEmbeddingMcpInput {
    connection_id: String,
    data: AddTrackEmbeddingInput,
}
#[mcp_handler]
pub fn AddTrackEmbeddingMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<AddTrackEmbeddingMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let vec = G::new_mut(&db, &arena, &mut txn)
.insert_v::<fn(&HVector, &RoTxn) -> bool>(&data.embedding, "Track_Vector", Some(ImmutablePropertiesMap::new(0, vec![].into_iter(), &arena))).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("HAS_EMBEDDING", None, *data.track_id, vec.id(), false, false).collect_to_obj()?;
let response = json!({
    "vec": AddTrackEmbeddingVecReturnType {
        id: uuid_str(vec.id(), &arena),
        label: vec.label(),
        data: vec.data(),
        score: vec.score(),
        embedding: vec.get_property("embedding"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddSceneInput {

pub name: String
}
#[derive(Serialize, Default)]
pub struct AddSceneSceneReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
}

#[handler(is_write)]
pub fn AddScene (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddSceneInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let scene = G::new_mut(&db, &arena, &mut txn)
.add_n("Scene", Some(ImmutablePropertiesMap::new(1, vec![("name", Value::from(&data.name))].into_iter(), &arena)), None).collect_to_obj()?;
let response = json!({
    "scene": AddSceneSceneReturnType {
        id: uuid_str(scene.id(), &arena),
        label: scene.label(),
        name: scene.get_property("name"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct AddSceneMcpInput {
    connection_id: String,
    data: AddSceneInput,
}
#[mcp_handler]
pub fn AddSceneMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<AddSceneMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let scene = G::new_mut(&db, &arena, &mut txn)
.add_n("Scene", Some(ImmutablePropertiesMap::new(1, vec![("name", Value::from(&data.name))].into_iter(), &arena)), None).collect_to_obj()?;
let response = json!({
    "scene": AddSceneSceneReturnType {
        id: uuid_str(scene.id(), &arena),
        label: scene.label(),
        name: scene.get_property("name"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddSimilarEdgeInput {

pub from_id: ID,
pub to_id: ID,
pub score: f64,
pub basis: String,
pub model_version: String
}
#[derive(Serialize, Default)]
pub struct AddSimilarEdgeUpdatedReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub from_node: &'a str,
    pub to_node: &'a str,
    pub basis: Option<&'a Value>,
    pub model_version: Option<&'a Value>,
}

#[handler(is_write)]
pub fn AddSimilarEdge (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddSimilarEdgeInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("SIMILAR_TO", None, *data.from_id, *data.to_id, false, false).collect_to_obj()?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("score", Value::from(&data.score)), ("basis", Value::from(&data.basis)), ("model_version", Value::from(&data.model_version))])
    .collect_to_obj()?};
let response = json!({
    "updated": AddSimilarEdgeUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        from_node: uuid_str(updated.from_node(), &arena),
        to_node: uuid_str(updated.to_node(), &arena),
        basis: updated.get_property("basis"),
        model_version: updated.get_property("model_version"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct AddSimilarEdgeMcpInput {
    connection_id: String,
    data: AddSimilarEdgeInput,
}
#[mcp_handler]
pub fn AddSimilarEdgeMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<AddSimilarEdgeMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("SIMILAR_TO", None, *data.from_id, *data.to_id, false, false).collect_to_obj()?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("score", Value::from(&data.score)), ("basis", Value::from(&data.basis)), ("model_version", Value::from(&data.model_version))])
    .collect_to_obj()?};
let response = json!({
    "updated": AddSimilarEdgeUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        from_node: uuid_str(updated.from_node(), &arena),
        to_node: uuid_str(updated.to_node(), &arena),
        basis: updated.get_property("basis"),
        model_version: updated.get_property("model_version"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetTrackEmbeddingInput {

pub track_id: ID
}
#[derive(Serialize, Default)]
pub struct GetTrackEmbeddingVecReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub data: &'a [f64],
    pub score: f64,
    pub embedding: Option<&'a Value>,
}

#[handler]
pub fn GetTrackEmbedding (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetTrackEmbeddingInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let vec = G::new(&db, &txn, &arena)
.n_from_id(&data.track_id)

.out_vec("HAS_EMBEDDING", false).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "vec": vec.iter().map(|vec| GetTrackEmbeddingVecReturnType {
        id: uuid_str(vec.id(), &arena),
        label: vec.label(),
        data: vec.data(),
        score: vec.score(),
        embedding: vec.get_property("embedding"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct GetTrackEmbeddingMcpInput {
    connection_id: String,
    data: GetTrackEmbeddingInput,
}
#[mcp_handler]
pub fn GetTrackEmbeddingMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<GetTrackEmbeddingMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let vec = G::new(&db, &txn, &arena)
.n_from_id(&data.track_id)

.out_vec("HAS_EMBEDDING", false).collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "vec": vec.iter().map(|vec| GetTrackEmbeddingVecReturnType {
        id: uuid_str(vec.id(), &arena),
        label: vec.label(),
        data: vec.data(),
        score: vec.score(),
        embedding: vec.get_property("embedding"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddTrackInput {

pub title: String,
pub artist: String,
pub filepath: String,
pub original_filename: String,
pub file_hash: String,
pub status: String,
pub upload_date: String
}
#[derive(Serialize, Default)]
pub struct AddTrackTrackReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler(is_write)]
pub fn AddTrack (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddTrackInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let track = G::new_mut(&db, &arena, &mut txn)
.add_n("Track", Some(ImmutablePropertiesMap::new(12, vec![("bpm", Value::from(0.0)), ("duration_sec", Value::from(0.0)), ("error", Value::from("")), ("filepath", Value::from(&data.filepath)), ("title", Value::from(&data.title)), ("status", Value::from(&data.status)), ("artist", Value::from(&data.artist)), ("key", Value::from("")), ("energy", Value::from(0.0)), ("original_filename", Value::from(&data.original_filename)), ("file_hash", Value::from(&data.file_hash)), ("upload_date", Value::from(&data.upload_date))].into_iter(), &arena)), None).collect_to_obj()?;
let response = json!({
    "track": AddTrackTrackReturnType {
        id: uuid_str(track.id(), &arena),
        label: track.label(),
        title: track.get_property("title"),
        artist: track.get_property("artist"),
        filepath: track.get_property("filepath"),
        original_filename: track.get_property("original_filename"),
        file_hash: track.get_property("file_hash"),
        status: track.get_property("status"),
        duration_sec: track.get_property("duration_sec"),
        bpm: track.get_property("bpm"),
        key: track.get_property("key"),
        energy: track.get_property("energy"),
        upload_date: track.get_property("upload_date"),
        error: track.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct AddTrackMcpInput {
    connection_id: String,
    data: AddTrackInput,
}
#[mcp_handler]
pub fn AddTrackMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<AddTrackMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let track = G::new_mut(&db, &arena, &mut txn)
.add_n("Track", Some(ImmutablePropertiesMap::new(12, vec![("bpm", Value::from(0.0)), ("duration_sec", Value::from(0.0)), ("error", Value::from("")), ("filepath", Value::from(&data.filepath)), ("title", Value::from(&data.title)), ("status", Value::from(&data.status)), ("artist", Value::from(&data.artist)), ("key", Value::from("")), ("energy", Value::from(0.0)), ("original_filename", Value::from(&data.original_filename)), ("file_hash", Value::from(&data.file_hash)), ("upload_date", Value::from(&data.upload_date))].into_iter(), &arena)), None).collect_to_obj()?;
let response = json!({
    "track": AddTrackTrackReturnType {
        id: uuid_str(track.id(), &arena),
        label: track.label(),
        title: track.get_property("title"),
        artist: track.get_property("artist"),
        filepath: track.get_property("filepath"),
        original_filename: track.get_property("original_filename"),
        file_hash: track.get_property("file_hash"),
        status: track.get_property("status"),
        duration_sec: track.get_property("duration_sec"),
        bpm: track.get_property("bpm"),
        key: track.get_property("key"),
        energy: track.get_property("energy"),
        upload_date: track.get_property("upload_date"),
        error: track.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetTrackInput {

pub id: ID
}
#[derive(Serialize, Default)]
pub struct GetTrackTrackReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler]
pub fn GetTrack (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetTrackInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let track = G::new(&db, &txn, &arena)
.n_from_id(&data.id).collect_to_obj()?;
let response = json!({
    "track": GetTrackTrackReturnType {
        id: uuid_str(track.id(), &arena),
        label: track.label(),
        title: track.get_property("title"),
        artist: track.get_property("artist"),
        filepath: track.get_property("filepath"),
        original_filename: track.get_property("original_filename"),
        file_hash: track.get_property("file_hash"),
        status: track.get_property("status"),
        duration_sec: track.get_property("duration_sec"),
        bpm: track.get_property("bpm"),
        key: track.get_property("key"),
        energy: track.get_property("energy"),
        upload_date: track.get_property("upload_date"),
        error: track.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct GetTrackMcpInput {
    connection_id: String,
    data: GetTrackInput,
}
#[mcp_handler]
pub fn GetTrackMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<GetTrackMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let track = G::new(&db, &txn, &arena)
.n_from_id(&data.id).collect_to_obj()?;
let response = json!({
    "track": GetTrackTrackReturnType {
        id: uuid_str(track.id(), &arena),
        label: track.label(),
        title: track.get_property("title"),
        artist: track.get_property("artist"),
        filepath: track.get_property("filepath"),
        original_filename: track.get_property("original_filename"),
        file_hash: track.get_property("file_hash"),
        status: track.get_property("status"),
        duration_sec: track.get_property("duration_sec"),
        bpm: track.get_property("bpm"),
        key: track.get_property("key"),
        energy: track.get_property("energy"),
        upload_date: track.get_property("upload_date"),
        error: track.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateTrackErrorInput {

pub id: ID,
pub error: String
}
#[derive(Serialize, Default)]
pub struct UpdateTrackErrorUpdatedReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpdateTrackError (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpdateTrackErrorInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
.n_from_id(&data.id)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("status", Value::from("ERROR")), ("error", Value::from(&data.error))])
    .collect_to_obj()?};
let response = json!({
    "updated": UpdateTrackErrorUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        title: updated.get_property("title"),
        artist: updated.get_property("artist"),
        filepath: updated.get_property("filepath"),
        original_filename: updated.get_property("original_filename"),
        file_hash: updated.get_property("file_hash"),
        status: updated.get_property("status"),
        duration_sec: updated.get_property("duration_sec"),
        bpm: updated.get_property("bpm"),
        key: updated.get_property("key"),
        energy: updated.get_property("energy"),
        upload_date: updated.get_property("upload_date"),
        error: updated.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct UpdateTrackErrorMcpInput {
    connection_id: String,
    data: UpdateTrackErrorInput,
}
#[mcp_handler]
pub fn UpdateTrackErrorMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<UpdateTrackErrorMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
.n_from_id(&data.id)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("status", Value::from("ERROR")), ("error", Value::from(&data.error))])
    .collect_to_obj()?};
let response = json!({
    "updated": UpdateTrackErrorUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        title: updated.get_property("title"),
        artist: updated.get_property("artist"),
        filepath: updated.get_property("filepath"),
        original_filename: updated.get_property("original_filename"),
        file_hash: updated.get_property("file_hash"),
        status: updated.get_property("status"),
        duration_sec: updated.get_property("duration_sec"),
        bpm: updated.get_property("bpm"),
        key: updated.get_property("key"),
        energy: updated.get_property("energy"),
        upload_date: updated.get_property("upload_date"),
        error: updated.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateTrackStatusInput {

pub id: ID,
pub status: String
}
#[derive(Serialize, Default)]
pub struct UpdateTrackStatusUpdatedReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpdateTrackStatus (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpdateTrackStatusInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
.n_from_id(&data.id)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("status", Value::from(&data.status))])
    .collect_to_obj()?};
let response = json!({
    "updated": UpdateTrackStatusUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        title: updated.get_property("title"),
        artist: updated.get_property("artist"),
        filepath: updated.get_property("filepath"),
        original_filename: updated.get_property("original_filename"),
        file_hash: updated.get_property("file_hash"),
        status: updated.get_property("status"),
        duration_sec: updated.get_property("duration_sec"),
        bpm: updated.get_property("bpm"),
        key: updated.get_property("key"),
        energy: updated.get_property("energy"),
        upload_date: updated.get_property("upload_date"),
        error: updated.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct UpdateTrackStatusMcpInput {
    connection_id: String,
    data: UpdateTrackStatusInput,
}
#[mcp_handler]
pub fn UpdateTrackStatusMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<UpdateTrackStatusMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
.n_from_id(&data.id)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("status", Value::from(&data.status))])
    .collect_to_obj()?};
let response = json!({
    "updated": UpdateTrackStatusUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        title: updated.get_property("title"),
        artist: updated.get_property("artist"),
        filepath: updated.get_property("filepath"),
        original_filename: updated.get_property("original_filename"),
        file_hash: updated.get_property("file_hash"),
        status: updated.get_property("status"),
        duration_sec: updated.get_property("duration_sec"),
        bpm: updated.get_property("bpm"),
        key: updated.get_property("key"),
        energy: updated.get_property("energy"),
        upload_date: updated.get_property("upload_date"),
        error: updated.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FindNeighborsInput {

pub embedding: Vec<f64>,
pub k: i64
}
#[derive(Serialize, Default)]
pub struct FindNeighborsNeighborsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler]
pub fn FindNeighbors (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<FindNeighborsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let similar = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.embedding, data.k.clone(), "Track_Vector", None).collect::<Result<Vec<_>, _>>()?;
    let neighbors = G::from_iter(&db, &txn, similar.iter().cloned(), &arena)

.in_node("HAS_EMBEDDING").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "neighbors": neighbors.iter().map(|neighbor| FindNeighborsNeighborsReturnType {
        id: uuid_str(neighbor.id(), &arena),
        label: neighbor.label(),
        title: neighbor.get_property("title"),
        artist: neighbor.get_property("artist"),
        filepath: neighbor.get_property("filepath"),
        original_filename: neighbor.get_property("original_filename"),
        file_hash: neighbor.get_property("file_hash"),
        status: neighbor.get_property("status"),
        duration_sec: neighbor.get_property("duration_sec"),
        bpm: neighbor.get_property("bpm"),
        key: neighbor.get_property("key"),
        energy: neighbor.get_property("energy"),
        upload_date: neighbor.get_property("upload_date"),
        error: neighbor.get_property("error"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct FindNeighborsMcpInput {
    connection_id: String,
    data: FindNeighborsInput,
}
#[mcp_handler]
pub fn FindNeighborsMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<FindNeighborsMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let similar = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.embedding, data.k.clone(), "Track_Vector", None).collect::<Result<Vec<_>, _>>()?;
    let neighbors = G::from_iter(&db, &txn, similar.iter().cloned(), &arena)

.in_node("HAS_EMBEDDING").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "neighbors": neighbors.iter().map(|neighbor| FindNeighborsNeighborsReturnType {
        id: uuid_str(neighbor.id(), &arena),
        label: neighbor.label(),
        title: neighbor.get_property("title"),
        artist: neighbor.get_property("artist"),
        filepath: neighbor.get_property("filepath"),
        original_filename: neighbor.get_property("original_filename"),
        file_hash: neighbor.get_property("file_hash"),
        status: neighbor.get_property("status"),
        duration_sec: neighbor.get_property("duration_sec"),
        bpm: neighbor.get_property("bpm"),
        key: neighbor.get_property("key"),
        energy: neighbor.get_property("energy"),
        upload_date: neighbor.get_property("upload_date"),
        error: neighbor.get_property("error"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddAudioEmbeddingInput {

pub track_id: ID,
pub embedding: Vec<f64>
}
#[derive(Serialize, Default)]
pub struct AddAudioEmbeddingVecReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub data: &'a [f64],
    pub score: f64,
    pub embedding: Option<&'a Value>,
}

#[handler(is_write)]
pub fn AddAudioEmbedding (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddAudioEmbeddingInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let vec = G::new_mut(&db, &arena, &mut txn)
.insert_v::<fn(&HVector, &RoTxn) -> bool>(&data.embedding, "Audio_Vector", Some(ImmutablePropertiesMap::new(0, vec![].into_iter(), &arena))).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("HAS_AUDIO_EMBEDDING", None, *data.track_id, vec.id(), false, false).collect_to_obj()?;
let response = json!({
    "vec": AddAudioEmbeddingVecReturnType {
        id: uuid_str(vec.id(), &arena),
        label: vec.label(),
        data: vec.data(),
        score: vec.score(),
        embedding: vec.get_property("embedding"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct AddAudioEmbeddingMcpInput {
    connection_id: String,
    data: AddAudioEmbeddingInput,
}
#[mcp_handler]
pub fn AddAudioEmbeddingMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<AddAudioEmbeddingMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let vec = G::new_mut(&db, &arena, &mut txn)
.insert_v::<fn(&HVector, &RoTxn) -> bool>(&data.embedding, "Audio_Vector", Some(ImmutablePropertiesMap::new(0, vec![].into_iter(), &arena))).collect_to_obj()?;
    let edge = G::new_mut(&db, &arena, &mut txn)
.add_edge("HAS_AUDIO_EMBEDDING", None, *data.track_id, vec.id(), false, false).collect_to_obj()?;
let response = json!({
    "vec": AddAudioEmbeddingVecReturnType {
        id: uuid_str(vec.id(), &arena),
        label: vec.label(),
        data: vec.data(),
        score: vec.score(),
        embedding: vec.get_property("embedding"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FindAudioNeighborsInput {

pub embedding: Vec<f64>,
pub k: i64
}
#[derive(Serialize, Default)]
pub struct FindAudioNeighborsNeighborsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler]
pub fn FindAudioNeighbors (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<FindAudioNeighborsInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let similar = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.embedding, data.k.clone(), "Audio_Vector", None).collect::<Result<Vec<_>, _>>()?;
    let neighbors = G::from_iter(&db, &txn, similar.iter().cloned(), &arena)

.in_node("HAS_AUDIO_EMBEDDING").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "neighbors": neighbors.iter().map(|neighbor| FindAudioNeighborsNeighborsReturnType {
        id: uuid_str(neighbor.id(), &arena),
        label: neighbor.label(),
        title: neighbor.get_property("title"),
        artist: neighbor.get_property("artist"),
        filepath: neighbor.get_property("filepath"),
        original_filename: neighbor.get_property("original_filename"),
        file_hash: neighbor.get_property("file_hash"),
        status: neighbor.get_property("status"),
        duration_sec: neighbor.get_property("duration_sec"),
        bpm: neighbor.get_property("bpm"),
        key: neighbor.get_property("key"),
        energy: neighbor.get_property("energy"),
        upload_date: neighbor.get_property("upload_date"),
        error: neighbor.get_property("error"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct FindAudioNeighborsMcpInput {
    connection_id: String,
    data: FindAudioNeighborsInput,
}
#[mcp_handler]
pub fn FindAudioNeighborsMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<FindAudioNeighborsMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let similar = G::new(&db, &txn, &arena)
.search_v::<fn(&HVector, &RoTxn) -> bool, _>(&data.embedding, data.k.clone(), "Audio_Vector", None).collect::<Result<Vec<_>, _>>()?;
    let neighbors = G::from_iter(&db, &txn, similar.iter().cloned(), &arena)

.in_node("HAS_AUDIO_EMBEDDING").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "neighbors": neighbors.iter().map(|neighbor| FindAudioNeighborsNeighborsReturnType {
        id: uuid_str(neighbor.id(), &arena),
        label: neighbor.label(),
        title: neighbor.get_property("title"),
        artist: neighbor.get_property("artist"),
        filepath: neighbor.get_property("filepath"),
        original_filename: neighbor.get_property("original_filename"),
        file_hash: neighbor.get_property("file_hash"),
        status: neighbor.get_property("status"),
        duration_sec: neighbor.get_property("duration_sec"),
        bpm: neighbor.get_property("bpm"),
        key: neighbor.get_property("key"),
        energy: neighbor.get_property("energy"),
        upload_date: neighbor.get_property("upload_date"),
        error: neighbor.get_property("error"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetSimilarTracksInput {

pub id: ID
}
#[derive(Serialize, Default)]
pub struct GetSimilarTracksSimilarReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler]
pub fn GetSimilarTracks (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetSimilarTracksInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let similar = G::new(&db, &txn, &arena)
.n_from_id(&data.id)

.out_node("SIMILAR_TO").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "similar": similar.iter().map(|similar| GetSimilarTracksSimilarReturnType {
        id: uuid_str(similar.id(), &arena),
        label: similar.label(),
        title: similar.get_property("title"),
        artist: similar.get_property("artist"),
        filepath: similar.get_property("filepath"),
        original_filename: similar.get_property("original_filename"),
        file_hash: similar.get_property("file_hash"),
        status: similar.get_property("status"),
        duration_sec: similar.get_property("duration_sec"),
        bpm: similar.get_property("bpm"),
        key: similar.get_property("key"),
        energy: similar.get_property("energy"),
        upload_date: similar.get_property("upload_date"),
        error: similar.get_property("error"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct GetSimilarTracksMcpInput {
    connection_id: String,
    data: GetSimilarTracksInput,
}
#[mcp_handler]
pub fn GetSimilarTracksMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<GetSimilarTracksMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let similar = G::new(&db, &txn, &arena)
.n_from_id(&data.id)

.out_node("SIMILAR_TO").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "similar": similar.iter().map(|similar| GetSimilarTracksSimilarReturnType {
        id: uuid_str(similar.id(), &arena),
        label: similar.label(),
        title: similar.get_property("title"),
        artist: similar.get_property("artist"),
        filepath: similar.get_property("filepath"),
        original_filename: similar.get_property("original_filename"),
        file_hash: similar.get_property("file_hash"),
        status: similar.get_property("status"),
        duration_sec: similar.get_property("duration_sec"),
        bpm: similar.get_property("bpm"),
        key: similar.get_property("key"),
        energy: similar.get_property("energy"),
        upload_date: similar.get_property("upload_date"),
        error: similar.get_property("error"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateTrackAnalysisInput {

pub id: ID,
pub duration_sec: f64,
pub bpm: f64,
pub key: String,
pub energy: f64,
pub status: String
}
#[derive(Serialize, Default)]
pub struct UpdateTrackAnalysisUpdatedReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub title: Option<&'a Value>,
    pub artist: Option<&'a Value>,
    pub filepath: Option<&'a Value>,
    pub original_filename: Option<&'a Value>,
    pub file_hash: Option<&'a Value>,
    pub status: Option<&'a Value>,
    pub duration_sec: Option<&'a Value>,
    pub bpm: Option<&'a Value>,
    pub key: Option<&'a Value>,
    pub energy: Option<&'a Value>,
    pub upload_date: Option<&'a Value>,
    pub error: Option<&'a Value>,
}

#[handler(is_write)]
pub fn UpdateTrackAnalysis (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<UpdateTrackAnalysisInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
.n_from_id(&data.id)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("duration_sec", Value::from(&data.duration_sec)), ("bpm", Value::from(&data.bpm)), ("key", Value::from(&data.key)), ("energy", Value::from(&data.energy)), ("status", Value::from(&data.status))])
    .collect_to_obj()?};
let response = json!({
    "updated": UpdateTrackAnalysisUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        title: updated.get_property("title"),
        artist: updated.get_property("artist"),
        filepath: updated.get_property("filepath"),
        original_filename: updated.get_property("original_filename"),
        file_hash: updated.get_property("file_hash"),
        status: updated.get_property("status"),
        duration_sec: updated.get_property("duration_sec"),
        bpm: updated.get_property("bpm"),
        key: updated.get_property("key"),
        energy: updated.get_property("energy"),
        upload_date: updated.get_property("upload_date"),
        error: updated.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}
#[derive(Deserialize, Clone)]
pub struct UpdateTrackAnalysisMcpInput {
    connection_id: String,
    data: UpdateTrackAnalysisInput,
}
#[mcp_handler]
pub fn UpdateTrackAnalysisMcp(input: &mut MCPToolInput) -> Result<Response, GraphError> {
let data = input.request.in_fmt.deserialize::<UpdateTrackAnalysisMcpInput>(&input.request.body)?;
let mut connections = input.mcp_connections.lock().map_err(|_| GraphError::Default)?;
let mut connection = match connections.remove_connection(&data.connection_id) {
    Some(conn) => conn,
    None => return Err(GraphError::Default),
};
drop(connections);
let db = Arc::clone(&input.mcp_backend.db);
let arena = Bump::new();
let data = &data.data;
let connections = Arc::clone(&input.mcp_connections);
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let updated = {let update_tr = G::new(&db, &txn, &arena)
.n_from_id(&data.id)
    .collect::<Result<Vec<_>, _>>()?;G::new_mut_from_iter(&db, &mut txn, update_tr.iter().cloned(), &arena)
    .update(&[("duration_sec", Value::from(&data.duration_sec)), ("bpm", Value::from(&data.bpm)), ("key", Value::from(&data.key)), ("energy", Value::from(&data.energy)), ("status", Value::from(&data.status))])
    .collect_to_obj()?};
let response = json!({
    "updated": UpdateTrackAnalysisUpdatedReturnType {
        id: uuid_str(updated.id(), &arena),
        label: updated.label(),
        title: updated.get_property("title"),
        artist: updated.get_property("artist"),
        filepath: updated.get_property("filepath"),
        original_filename: updated.get_property("original_filename"),
        file_hash: updated.get_property("file_hash"),
        status: updated.get_property("status"),
        duration_sec: updated.get_property("duration_sec"),
        bpm: updated.get_property("bpm"),
        key: updated.get_property("key"),
        energy: updated.get_property("energy"),
        upload_date: updated.get_property("upload_date"),
        error: updated.get_property("error"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
let mut connections = connections.lock().unwrap();
connections.add_connection(connection);
drop(connections);
Ok(helix_db::protocol::format::Format::Json.create_response(&response))
}


