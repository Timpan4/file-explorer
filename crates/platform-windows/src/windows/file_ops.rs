use file_explorer_core::directory::{DirectoryItemKind, ExplorerError};
use file_explorer_core::file_operations::{
    FileConflictResolution, FileOperationConflict, FileOperationFailure, FileOperationItem,
    FileOperationProgress, StartFileOperationRequest,
};
use std::collections::BTreeSet;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

pub struct FileOperationExecutionReport {
    pub completed: Vec<FileOperationItem>,
    pub skipped: Vec<FileOperationItem>,
    pub failed: Vec<FileOperationFailure>,
    pub affected_parent_paths: Vec<String>,
    pub affected_descendant_paths: Vec<String>,
}

pub enum FileOperationExecution {
    Completed(FileOperationExecutionReport),
    Cancelled(FileOperationExecutionReport),
}

struct ExecutionAccumulator {
    completed: Vec<FileOperationItem>,
    skipped: Vec<FileOperationItem>,
    failed: Vec<FileOperationFailure>,
    affected_parent_paths: BTreeSet<String>,
    affected_descendant_paths: BTreeSet<String>,
}

struct PreparedSource {
    source_path: PathBuf,
    source_display_path: String,
    source_canonical_path: String,
    source_parent_canonical_path: Option<String>,
    name: String,
    kind: DirectoryItemKind,
}

pub fn execute_file_operation<C, R, P>(
    request: &StartFileOperationRequest,
    mut should_cancel: C,
    mut resolve_conflict: R,
    mut report_progress: P,
) -> Result<FileOperationExecution, ExplorerError>
where
    C: FnMut() -> bool,
    R: FnMut(FileOperationConflict) -> Option<FileConflictResolution>,
    P: FnMut(FileOperationProgress),
{
    let destination_directory = parse_destination_directory(&request.destination_directory)?;
    let destination_parent_canonical_path =
        super::fs::canonicalize_folder_path(destination_directory.to_string_lossy().as_ref())?;
    let mut accumulator = ExecutionAccumulator {
        completed: Vec::new(),
        skipped: Vec::new(),
        failed: Vec::new(),
        affected_parent_paths: BTreeSet::new(),
        affected_descendant_paths: BTreeSet::new(),
    };
    let total_items = request.source_paths.len();
    let default_conflict_resolution = request
        .default_conflict_resolution
        .unwrap_or(FileConflictResolution::Ask);

    for (index, source_path) in request.source_paths.iter().enumerate() {
        if should_cancel() {
            return Ok(FileOperationExecution::Cancelled(accumulator.into_report()));
        }

        let processed_items = index + 1;
        let prepared_source = match prepare_source(source_path) {
            Ok(source) => source,
            Err(error) => {
                accumulator.failed.push(FileOperationFailure {
                    source_path: source_path.clone(),
                    destination_path: None,
                    name: source_name_fallback(source_path),
                    kind: None,
                    code: error.code,
                    message: error.message,
                });
                report_progress(progress_event(request, processed_items, total_items, None));
                continue;
            }
        };

        let mut destination_path = destination_directory.join(&prepared_source.name);
        let destination_existed = destination_path.exists();

        if destination_existed {
            let destination_canonical_path =
                super::fs::canonicalize_existing_path(destination_path.to_string_lossy().as_ref())
                    .ok();

            if request.kind == file_explorer_core::file_operations::FileOperationKind::Move
                && destination_canonical_path.as_deref()
                    == Some(prepared_source.source_canonical_path.as_str())
            {
                accumulator
                    .skipped
                    .push(operation_item(&prepared_source, &destination_path));
                report_progress(progress_event(
                    request,
                    processed_items,
                    total_items,
                    Some(prepared_source.source_display_path.clone()),
                ));
                continue;
            }

            let conflict_resolution = if default_conflict_resolution == FileConflictResolution::Ask
            {
                let conflict = FileOperationConflict {
                    operation_id: request.operation_id.clone(),
                    conflict_id: format!("{}:{}", request.operation_id, index + 1),
                    source_path: prepared_source.source_display_path.clone(),
                    destination_path: destination_path.to_string_lossy().to_string(),
                    name: prepared_source.name.clone(),
                    kind: prepared_source.kind.clone(),
                };

                match resolve_conflict(conflict) {
                    Some(resolution) => resolution,
                    None => {
                        return Ok(FileOperationExecution::Cancelled(accumulator.into_report()))
                    }
                }
            } else {
                default_conflict_resolution
            };

            match conflict_resolution {
                FileConflictResolution::Ask => {
                    return Err(ExplorerError::new(
                        "file_operation_unresolved_conflict",
                        "A file operation conflict was not resolved.",
                    ));
                }
                FileConflictResolution::Skip => {
                    accumulator
                        .skipped
                        .push(operation_item(&prepared_source, &destination_path));
                    report_progress(progress_event(
                        request,
                        processed_items,
                        total_items,
                        Some(prepared_source.source_display_path.clone()),
                    ));
                    continue;
                }
                FileConflictResolution::Replace => {
                    if let Some(destination_canonical_path) = destination_canonical_path {
                        accumulator
                            .affected_descendant_paths
                            .insert(destination_canonical_path);
                    }
                    remove_existing_path(&destination_path)?;
                }
                FileConflictResolution::KeepBoth => {
                    destination_path = allocate_keep_both_path(&destination_path)?;
                }
            }
        }

        let result = match request.kind {
            file_explorer_core::file_operations::FileOperationKind::Copy => {
                copy_path(&prepared_source.source_path, &destination_path)
            }
            file_explorer_core::file_operations::FileOperationKind::Move => {
                move_path(&prepared_source.source_path, &destination_path)
            }
        };

        match result {
            Ok(()) => {
                accumulator
                    .affected_parent_paths
                    .insert(destination_parent_canonical_path.clone());

                if request.kind == file_explorer_core::file_operations::FileOperationKind::Move {
                    if let Some(source_parent) = &prepared_source.source_parent_canonical_path {
                        accumulator
                            .affected_parent_paths
                            .insert(source_parent.clone());
                    }

                    if prepared_source.kind == DirectoryItemKind::Directory {
                        accumulator
                            .affected_descendant_paths
                            .insert(prepared_source.source_canonical_path.clone());
                    }
                }

                if prepared_source.kind == DirectoryItemKind::Directory {
                    if let Ok(destination_canonical_path) = super::fs::canonicalize_existing_path(
                        destination_path.to_string_lossy().as_ref(),
                    ) {
                        accumulator
                            .affected_descendant_paths
                            .insert(destination_canonical_path);
                    }
                }

                accumulator
                    .completed
                    .push(operation_item(&prepared_source, &destination_path));
            }
            Err(error) => {
                accumulator.failed.push(FileOperationFailure {
                    source_path: prepared_source.source_display_path.clone(),
                    destination_path: Some(destination_path.to_string_lossy().to_string()),
                    name: prepared_source.name.clone(),
                    kind: Some(prepared_source.kind.clone()),
                    code: error.code,
                    message: error.message,
                });
            }
        }

        report_progress(progress_event(
            request,
            processed_items,
            total_items,
            Some(prepared_source.source_display_path),
        ));
    }

    Ok(FileOperationExecution::Completed(accumulator.into_report()))
}

impl ExecutionAccumulator {
    fn into_report(self) -> FileOperationExecutionReport {
        FileOperationExecutionReport {
            completed: self.completed,
            skipped: self.skipped,
            failed: self.failed,
            affected_parent_paths: self.affected_parent_paths.into_iter().collect(),
            affected_descendant_paths: self.affected_descendant_paths.into_iter().collect(),
        }
    }
}

fn parse_destination_directory(destination_directory: &str) -> Result<PathBuf, ExplorerError> {
    let trimmed = destination_directory.trim();
    if trimmed.is_empty() {
        return Err(ExplorerError::new(
            "invalid_operation_destination",
            "Choose a destination folder before pasting items.",
        ));
    }

    let path = PathBuf::from(trimmed);
    if !path.is_dir() {
        return Err(ExplorerError::new(
            "invalid_operation_destination",
            format!("'{}' is not a folder.", path.display()),
        ));
    }

    Ok(path)
}

fn prepare_source(source_path: &str) -> Result<PreparedSource, ExplorerError> {
    let (source_path, kind) = super::fs::inspect_existing_path(source_path)?;
    let source_canonical_path =
        super::fs::canonicalize_existing_path(source_path.to_string_lossy().as_ref())?;
    let source_parent_canonical_path = source_path.parent().and_then(|parent| {
        super::fs::canonicalize_folder_path(parent.to_string_lossy().as_ref()).ok()
    });
    let name = source_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| source_path.to_string_lossy().to_string());

    Ok(PreparedSource {
        source_display_path: source_path.to_string_lossy().to_string(),
        source_path,
        source_canonical_path,
        source_parent_canonical_path,
        name,
        kind,
    })
}

fn copy_path(source_path: &Path, destination_path: &Path) -> Result<(), ExplorerError> {
    let metadata = fs::symlink_metadata(source_path).map_err(|error| {
        ExplorerError::new(
            "copy_source_metadata_failed",
            format!("Could not inspect '{}': {error}", source_path.display()),
        )
    })?;

    if metadata.is_dir() {
        fs::create_dir(destination_path).map_err(|error| {
            ExplorerError::new(
                "copy_directory_failed",
                format!("Could not create '{}': {error}", destination_path.display()),
            )
        })?;

        let entries = fs::read_dir(source_path).map_err(|error| {
            ExplorerError::new(
                "copy_directory_read_failed",
                format!("Could not read '{}': {error}", source_path.display()),
            )
        })?;

        for entry in entries {
            let entry = entry.map_err(|error| {
                ExplorerError::new(
                    "copy_directory_entry_failed",
                    format!(
                        "Could not read an entry in '{}': {error}",
                        source_path.display()
                    ),
                )
            })?;
            copy_path(&entry.path(), &destination_path.join(entry.file_name()))?;
        }

        return Ok(());
    }

    fs::copy(source_path, destination_path).map_err(|error| {
        ExplorerError::new(
            "copy_file_failed",
            format!(
                "Could not copy '{}' to '{}': {error}",
                source_path.display(),
                destination_path.display()
            ),
        )
    })?;

    Ok(())
}

fn move_path(source_path: &Path, destination_path: &Path) -> Result<(), ExplorerError> {
    match fs::rename(source_path, destination_path) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            copy_path(source_path, destination_path).map_err(|copy_error| {
                ExplorerError::new(
                    "move_failed",
                    format!(
                        "Could not move '{}' to '{}': rename failed with {rename_error}; copy fallback failed with {}",
                        source_path.display(),
                        destination_path.display(),
                        copy_error.message
                    ),
                )
            })?;

            if let Err(remove_error) = remove_existing_path(source_path) {
                let _ = remove_existing_path(destination_path);
                return Err(ExplorerError::new(
                    "move_failed",
                    format!(
                        "Could not finish moving '{}' to '{}': copied the item, but removing the source failed with {}",
                        source_path.display(),
                        destination_path.display(),
                        remove_error.message
                    ),
                ));
            }

            Ok(())
        }
    }
}

fn remove_existing_path(path: &Path) -> Result<(), ExplorerError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        ExplorerError::new(
            "replace_target_metadata_failed",
            format!("Could not inspect '{}': {error}", path.display()),
        )
    })?;

    let result = if metadata.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };

    result.map_err(|error| {
        ExplorerError::new(
            "replace_target_failed",
            format!("Could not replace '{}': {error}", path.display()),
        )
    })
}

fn allocate_keep_both_path(destination_path: &Path) -> Result<PathBuf, ExplorerError> {
    for sequence in 1..=u16::MAX {
        let candidate = keep_both_path(destination_path, sequence);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(ExplorerError::new(
        "file_operation_name_exhausted",
        format!(
            "Could not allocate a unique copy name for '{}'.",
            destination_path.display()
        ),
    ))
}

fn keep_both_path(destination_path: &Path, sequence: u16) -> PathBuf {
    let file_name = destination_path
        .file_name()
        .map(OsString::from)
        .unwrap_or_else(|| OsString::from("Item"));
    let file_name = file_name.to_string_lossy();
    let suffix = if sequence == 1 {
        " - Copy".to_string()
    } else {
        format!(" - Copy ({sequence})")
    };

    let candidate_name = match (destination_path.file_stem(), destination_path.extension()) {
        (Some(stem), Some(extension)) if !stem.to_string_lossy().is_empty() => format!(
            "{}{}.{}",
            stem.to_string_lossy(),
            suffix,
            extension.to_string_lossy()
        ),
        _ => format!("{file_name}{suffix}"),
    };

    destination_path.with_file_name(candidate_name)
}

fn operation_item(source: &PreparedSource, destination_path: &Path) -> FileOperationItem {
    FileOperationItem {
        source_path: source.source_display_path.clone(),
        destination_path: destination_path.to_string_lossy().to_string(),
        name: source.name.clone(),
        kind: source.kind.clone(),
    }
}

fn progress_event(
    request: &StartFileOperationRequest,
    processed_items: usize,
    total_items: usize,
    current_path: Option<String>,
) -> FileOperationProgress {
    FileOperationProgress {
        operation_id: request.operation_id.clone(),
        kind: request.kind,
        processed_items,
        total_items,
        current_path,
    }
}

fn source_name_fallback(source_path: &str) -> String {
    Path::new(source_path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| source_path.to_string())
}

#[cfg(test)]
#[path = "file_ops_tests.rs"]
mod tests;
