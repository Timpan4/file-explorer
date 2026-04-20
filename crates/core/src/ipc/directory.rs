use serde::{Deserialize, Serialize};

pub type JobId = String;
pub type SnapshotToken = String;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRequest {
    pub job_id: JobId,
    pub tab_id: String,
    pub path: String,
    pub query: Option<String>,
    pub sort: Option<SortSpec>,
    pub include_hidden: Option<bool>,
    pub force_refresh: Option<bool>,
    pub viewport_hint: Option<ViewportHint>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortSpec {
    pub field: SortField,
    pub direction: SortDirection,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortField {
    Name,
    Type,
    ModifiedAt,
    Size,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewportHint {
    pub start: usize,
    pub count: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelRequest {
    pub job_id: JobId,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameRequest {
    pub source_path: String,
    pub target_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResponse {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPathRequest {
    pub target_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderRequest {
    pub parent_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderResponse {
    pub path: String,
    pub name: String,
    pub parent_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteToRecycleBinRequest {
    pub target_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteToRecycleBinSuccess {
    pub path: String,
    pub name: String,
    pub parent_path: String,
    pub kind: DirectoryItemKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteToRecycleBinFailure {
    pub path: String,
    pub name: String,
    pub parent_path: Option<String>,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteToRecycleBinResponse {
    pub deleted: Vec<DeleteToRecycleBinSuccess>,
    pub failed: Vec<DeleteToRecycleBinFailure>,
    pub affected_parent_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidebarRoot {
    pub id: String,
    pub label: String,
    pub path: String,
    pub kind: SidebarRootKind,
    pub icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SidebarRootKind {
    Favorite,
    Drive,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryItemStub {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: DirectoryItemKind,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
    pub hidden: bool,
    pub readonly: bool,
    pub icon_data_url: Option<String>,
    pub native_icon_state: NativeIconState,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DirectoryItemKind {
    File,
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeIconState {
    Pending,
    Loading,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeIconBatchRequest {
    pub items: Vec<NativeIconRequestItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeIconRequestItem {
    pub path: String,
    pub kind: DirectoryItemKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeIconBatchResponse {
    pub items: Vec<NativeIconResult>,
    pub icon_lookup_total_ms: u128,
    pub icon_lookup_count: usize,
    pub icon_encode_total_ms: u128,
    pub total_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeIconResult {
    pub path: String,
    pub icon_data_url: Option<String>,
    pub native_icon_state: NativeIconState,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotStarted {
    pub job_id: JobId,
    pub path: String,
    pub query: String,
    pub snapshot_token: SnapshotToken,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotChunk {
    pub job_id: JobId,
    pub snapshot_token: SnapshotToken,
    pub items: Vec<DirectoryItemStub>,
    pub total_known: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCompleted {
    pub job_id: JobId,
    pub query: String,
    pub snapshot_token: SnapshotToken,
    pub total_items: usize,
    pub duration_ms: u128,
    pub cache_hit: bool,
    pub resolve_snapshot_ms: u128,
    pub enumerate_fs_ms: Option<u128>,
    pub enumerate_entries_ms: Option<u128>,
    pub icon_lookup_total_ms: Option<u128>,
    pub icon_lookup_count: Option<usize>,
    pub icon_encode_total_ms: Option<u128>,
    pub snapshot_build_ms: Option<u128>,
    pub project_ms: u128,
    pub first_chunk_send_ms: Option<u128>,
    pub all_chunks_sent_ms: u128,
    pub total_backend_ms: u128,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelledEvent {
    pub job_id: JobId,
    pub reason: CancelReason,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CancelReason {
    Explicit,
    Superseded,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedEvent {
    pub job_id: JobId,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
#[allow(clippy::large_enum_variant)]
pub enum ExplorerStreamEvent {
    SnapshotStarted(SnapshotStarted),
    SnapshotChunk(SnapshotChunk),
    SnapshotCompleted(SnapshotCompleted),
    Cancelled(CancelledEvent),
    Failed(FailedEvent),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerError {
    pub code: String,
    pub message: String,
}

impl ExplorerError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}
