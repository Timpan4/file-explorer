use file_explorer_core::directory::{DirectoryItemKind, ExplorerError};
use file_explorer_core::file_operations::{
    FileConflictResolution, FileOperationConflict, FileOperationFailure, FileOperationItem,
    FileOperationKind, FileOperationProgress, StartFileOperationRequest,
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
        let mut replace_existing = false;

        if prepared_source.kind == DirectoryItemKind::Directory
            && path_matches_or_is_descendant(
                &destination_parent_canonical_path,
                &prepared_source.source_canonical_path,
            )
        {
            accumulator.failed.push(FileOperationFailure {
                source_path: prepared_source.source_display_path.clone(),
                destination_path: Some(destination_path.to_string_lossy().to_string()),
                name: prepared_source.name.clone(),
                kind: Some(prepared_source.kind.clone()),
                code: "file_operation_destination_inside_source".to_string(),
                message: format!(
                    "Cannot copy or move '{}' into itself or one of its subfolders.",
                    prepared_source.source_display_path
                ),
            });
            report_progress(progress_event(
                request,
                processed_items,
                total_items,
                Some(prepared_source.source_display_path.clone()),
            ));
            continue;
        }

        if destination_existed {
            let destination_canonical_path =
                super::fs::canonicalize_existing_path(destination_path.to_string_lossy().as_ref())
                    .ok();

            if request.kind == FileOperationKind::Move
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
                        if request.kind == FileOperationKind::Copy
                            && destination_canonical_path
                                == prepared_source.source_canonical_path
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

                        accumulator
                            .affected_descendant_paths
                            .insert(destination_canonical_path);
                    }
                    replace_existing = true;
                }
                FileConflictResolution::KeepBoth => {
                    destination_path = allocate_keep_both_path(&destination_path)?;
                }
            }
        }

        let result = if replace_existing {
            replace_path(
                &prepared_source.source_path,
                &destination_path,
                request.kind,
                &mut should_cancel,
            )
        } else {
            match request.kind {
            FileOperationKind::Copy => {
                copy_path(
                    &prepared_source.source_path,
                    &destination_path,
                    &mut should_cancel,
                )
            }
            FileOperationKind::Move => {
                move_path(
                    &prepared_source.source_path,
                    &destination_path,
                    &mut should_cancel,
                )
            }
            }
        };

        match result {
            Ok(()) => {
                accumulator
                    .affected_parent_paths
                    .insert(destination_parent_canonical_path.clone());

                if request.kind == FileOperationKind::Move {
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
            Err(error) if error.code == "file_operation_cancelled" => {
                accumulator
                    .affected_parent_paths
                    .insert(destination_parent_canonical_path.clone());
                if prepared_source.kind == DirectoryItemKind::Directory {
                    if let Ok(destination_canonical_path) = super::fs::canonicalize_existing_path(
                        destination_path.to_string_lossy().as_ref(),
                    ) {
                        accumulator
                            .affected_descendant_paths
                            .insert(destination_canonical_path);
                    }
                }

                return Ok(FileOperationExecution::Cancelled(accumulator.into_report()));
            }
            Err(error) => {
                mark_destination_if_present(
                    &mut accumulator,
                    &destination_parent_canonical_path,
                    &destination_path,
                    &prepared_source.kind,
                );
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

fn copy_path<C>(
    source_path: &Path,
    destination_path: &Path,
    should_cancel: &mut C,
) -> Result<(), ExplorerError>
where
    C: FnMut() -> bool,
{
    ensure_not_cancelled(should_cancel)?;

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
            ensure_not_cancelled(should_cancel)?;

            let entry = entry.map_err(|error| {
                ExplorerError::new(
                    "copy_directory_entry_failed",
                    format!(
                        "Could not read an entry in '{}': {error}",
                        source_path.display()
                    ),
                )
            })?;
            copy_path(
                &entry.path(),
                &destination_path.join(entry.file_name()),
                should_cancel,
            )?;
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

fn replace_path<C>(
    source_path: &Path,
    destination_path: &Path,
    kind: FileOperationKind,
    should_cancel: &mut C,
) -> Result<(), ExplorerError>
where
    C: FnMut() -> bool,
{
    ensure_not_cancelled(should_cancel)?;

    let staging_path = allocate_temporary_sibling_path(destination_path, "replacement")?;
    let backup_path = allocate_temporary_sibling_path(destination_path, "backup")?;

    if let Err(error) = copy_path(source_path, &staging_path, should_cancel) {
        remove_path_if_exists(&staging_path);
        return Err(error);
    }

    if let Err(error) = ensure_not_cancelled(should_cancel) {
        remove_path_if_exists(&staging_path);
        return Err(error);
    }

    rename_path(
        destination_path,
        &backup_path,
        "replace_target_backup_failed",
        "Could not stage existing replacement target",
    )
    .inspect_err(|_| remove_path_if_exists(&staging_path))?;

    if let Err(error) = rename_path(
        &staging_path,
        destination_path,
        "replace_target_failed",
        "Could not install replacement target",
    ) {
        let _ = fs::rename(&backup_path, destination_path);
        remove_path_if_exists(&staging_path);
        return Err(error);
    }

    remove_existing_path(&backup_path).map_err(|error| {
        ExplorerError::new(
            "replace_backup_cleanup_failed",
            format!(
                "Replaced '{}', but could not remove the staged backup: {}",
                destination_path.display(),
                error.message
            ),
        )
    })?;

    if kind == FileOperationKind::Move {
        remove_existing_path(source_path).map_err(|error| {
            ExplorerError::new(
                "move_failed",
                format!(
                    "Could not finish moving '{}' to '{}': copied the item, but removing the source failed with {}",
                    source_path.display(),
                    destination_path.display(),
                    error.message
                ),
            )
        })?;
    }

    Ok(())
}

fn move_path<C>(
    source_path: &Path,
    destination_path: &Path,
    should_cancel: &mut C,
) -> Result<(), ExplorerError>
where
    C: FnMut() -> bool,
{
    ensure_not_cancelled(should_cancel)?;

    match fs::rename(source_path, destination_path) {
            Ok(()) => Ok(()),
            Err(rename_error) => {
                copy_path(source_path, destination_path, should_cancel).map_err(|copy_error| {
                    if copy_error.code == "file_operation_cancelled" {
                        return copy_error;
                    }

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

fn ensure_not_cancelled<C>(should_cancel: &mut C) -> Result<(), ExplorerError>
where
    C: FnMut() -> bool,
{
    if should_cancel() {
        return Err(ExplorerError::new(
            "file_operation_cancelled",
            "File operation was cancelled.",
        ));
    }

    Ok(())
}

fn path_matches_or_is_descendant(path: &str, ancestor: &str) -> bool {
    let normalized_path = path.trim_end_matches(['\\', '/']).to_ascii_lowercase();
    let normalized_ancestor = ancestor.trim_end_matches(['\\', '/']).to_ascii_lowercase();
    let ancestor_with_separator = format!("{normalized_ancestor}\\");

    normalized_path == normalized_ancestor || normalized_path.starts_with(&ancestor_with_separator)
}

fn mark_destination_if_present(
    accumulator: &mut ExecutionAccumulator,
    destination_parent_canonical_path: &str,
    destination_path: &Path,
    kind: &DirectoryItemKind,
) {
    if !destination_path.exists() {
        return;
    }

    accumulator
        .affected_parent_paths
        .insert(destination_parent_canonical_path.to_string());

    if *kind == DirectoryItemKind::Directory {
        if let Ok(destination_canonical_path) =
            super::fs::canonicalize_existing_path(destination_path.to_string_lossy().as_ref())
        {
            accumulator
                .affected_descendant_paths
                .insert(destination_canonical_path);
        }
    }
}

fn allocate_temporary_sibling_path(
    destination_path: &Path,
    purpose: &str,
) -> Result<PathBuf, ExplorerError> {
    let parent = destination_path.parent().ok_or_else(|| {
        ExplorerError::new(
            "replace_temp_path_failed",
            format!(
                "Could not prepare a temporary replacement path for '{}'.",
                destination_path.display()
            ),
        )
    })?;
    let file_name = destination_path
        .file_name()
        .map(|name| name.to_string_lossy())
        .unwrap_or_else(|| "Item".into());

    for sequence in 1..=u16::MAX {
        let candidate = parent.join(format!(
            ".file-explorer-{purpose}-{sequence}-{file_name}"
        ));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(ExplorerError::new(
        "replace_temp_path_exhausted",
        format!(
            "Could not allocate a temporary replacement path for '{}'.",
            destination_path.display()
        ),
    ))
}

fn rename_path(
    source_path: &Path,
    destination_path: &Path,
    code: &str,
    action: &str,
) -> Result<(), ExplorerError> {
    fs::rename(source_path, destination_path).map_err(|error| {
        ExplorerError::new(
            code,
            format!(
                "{action} '{}' as '{}': {error}",
                source_path.display(),
                destination_path.display()
            ),
        )
    })
}

fn remove_path_if_exists(path: &Path) {
    if path.exists() {
        let _ = remove_existing_path(path);
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
