use super::directory::DirectoryItemKind;
use serde::{Deserialize, Serialize};

pub type FileOperationId = String;
pub type FileConflictId = String;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationKind {
    Copy,
    Move,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileConflictResolution {
    Ask,
    Skip,
    Replace,
    KeepBoth,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFileOperationRequest {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub source_paths: Vec<String>,
    pub destination_directory: String,
    pub default_conflict_resolution: Option<FileConflictResolution>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelFileOperationRequest {
    pub operation_id: FileOperationId,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveFileOperationConflictRequest {
    pub operation_id: FileOperationId,
    pub conflict_id: FileConflictId,
    pub resolution: FileConflictResolution,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationQueued {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub queue_position: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationStarted {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub total_items: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationProgress {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub processed_items: usize,
    pub total_items: usize,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationConflict {
    pub operation_id: FileOperationId,
    pub conflict_id: FileConflictId,
    pub source_path: String,
    pub destination_path: String,
    pub name: String,
    pub kind: DirectoryItemKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationItem {
    pub source_path: String,
    pub destination_path: String,
    pub name: String,
    pub kind: DirectoryItemKind,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationFailure {
    pub source_path: String,
    pub destination_path: Option<String>,
    pub name: String,
    pub kind: Option<DirectoryItemKind>,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationCompleted {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub completed: Vec<FileOperationItem>,
    pub skipped: Vec<FileOperationItem>,
    pub failed: Vec<FileOperationFailure>,
    pub affected_parent_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationCancelled {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub completed: Vec<FileOperationItem>,
    pub skipped: Vec<FileOperationItem>,
    pub failed: Vec<FileOperationFailure>,
    pub affected_parent_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationFailed {
    pub operation_id: FileOperationId,
    pub kind: FileOperationKind,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum FileOperationEvent {
    Queued(FileOperationQueued),
    Started(FileOperationStarted),
    Progress(FileOperationProgress),
    Conflict(FileOperationConflict),
    Completed(FileOperationCompleted),
    Cancelled(FileOperationCancelled),
    Failed(FileOperationFailed),
}
