use super::file_ops::FileOperationQueue;
use super::navigation_pipeline::NavigationPipeline;
use file_explorer_core::directory::{
    CancelReason, CreateFolderRequest, CreateFolderResponse, DeleteToRecycleBinFailure,
    DeleteToRecycleBinRequest, DeleteToRecycleBinResponse, DeleteToRecycleBinSuccess,
    DirectoryItemKind, ExplorerError, ExplorerStreamEvent, NativeIconBatchRequest,
    NativeIconBatchResponse, NavigationRequest, OpenPathRequest, RenameRequest, RenameResponse,
    SidebarRoot, SidebarRootKind,
};
use file_explorer_core::explorer::snapshot_cache::DirectorySnapshotCache;
use file_explorer_core::file_operations::{
    CancelFileOperationRequest, FileOperationEvent, ResolveFileOperationConflictRequest,
    StartFileOperationRequest,
};
use file_explorer_core::jobs::{JobHandle, JobRegistry};
use file_explorer_platform_windows::windows::{fs, icons};
use std::collections::BTreeSet;
use std::sync::Arc;
use tauri::ipc::Channel;

pub struct ExplorerService {
    jobs: JobRegistry,
    snapshots: Arc<DirectorySnapshotCache>,
    file_operations: Arc<FileOperationQueue>,
    navigation_pipeline: NavigationPipeline,
}

impl ExplorerService {
    pub fn new() -> Self {
        let snapshots = Arc::new(DirectorySnapshotCache::new());
        Self {
            jobs: JobRegistry::new(),
            snapshots: Arc::clone(&snapshots),
            file_operations: Arc::new(FileOperationQueue::new(Arc::clone(&snapshots))),
            navigation_pipeline: NavigationPipeline::new(Arc::clone(&snapshots)),
        }
    }

    pub fn start_navigation(
        self: &Arc<Self>,
        request: NavigationRequest,
        on_event: Channel<ExplorerStreamEvent>,
    ) -> Result<(), ExplorerError> {
        if request.path.trim().is_empty() {
            return Err(ExplorerError::new(
                "invalid_path",
                "Navigation path cannot be empty.",
            ));
        }

        self.jobs
            .cancel_tab(&request.tab_id, CancelReason::Superseded);

        let job = JobHandle::new();
        self.jobs
            .insert(request.tab_id.clone(), request.job_id.clone(), job.clone());

        let service = Arc::clone(self);
        let job_id = request.job_id.clone();

        tauri::async_runtime::spawn(async move {
            service
                .navigation_pipeline
                .stream_directory(request, job, on_event)
                .await;
            service.jobs.remove(&job_id);
        });

        Ok(())
    }

    pub fn cancel_job(&self, job_id: &str) -> Result<(), ExplorerError> {
        let Some(job) = self.jobs.get(job_id) else {
            return Err(ExplorerError::new(
                "job_not_found",
                format!("No navigation job with id '{job_id}' is active."),
            ));
        };

        job.cancel(CancelReason::Explicit);
        Ok(())
    }

    pub fn list_sidebar_roots(&self) -> Result<Vec<SidebarRoot>, ExplorerError> {
        let mut roots = vec![SidebarRoot {
            id: "home".to_string(),
            label: "Home".to_string(),
            path: home_dir(),
            kind: SidebarRootKind::Favorite,
            icon_data_url: icons::icon_for_sidebar_path(&home_dir()),
        }];

        roots.extend(fs::list_drive_roots()?);

        Ok(roots)
    }

    pub fn hydrate_directory_icons(
        &self,
        request: NativeIconBatchRequest,
    ) -> Result<NativeIconBatchResponse, ExplorerError> {
        Ok(fs::hydrate_directory_icons(&request.items))
    }

    pub fn rename_directory_item(
        &self,
        request: RenameRequest,
    ) -> Result<RenameResponse, ExplorerError> {
        let source_path = request.source_path.trim();
        if source_path.is_empty() {
            return Err(ExplorerError::new(
                "invalid_rename_source",
                "Rename source path cannot be empty.",
            ));
        }

        let parent_path = std::path::Path::new(source_path)
            .parent()
            .ok_or_else(|| {
                ExplorerError::new(
                    "rename_parent_missing",
                    format!("'{source_path}' does not have a parent folder to rename within."),
                )
            })?
            .to_string_lossy()
            .to_string();
        let canonical_parent_path = fs::canonicalize_folder_path(&parent_path)?;
        let renamed_directory_path = if std::path::Path::new(source_path).is_dir() {
            Some(fs::canonicalize_existing_path(source_path)?)
        } else {
            None
        };
        let renamed_path = fs::rename_directory_item(source_path, &request.target_name)?;

        self.snapshots
            .invalidate_for_rename(&canonical_parent_path, renamed_directory_path.as_deref());

        Ok(RenameResponse {
            path: renamed_path.to_string_lossy().to_string(),
            name: renamed_path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| request.target_name.trim().to_string()),
        })
    }

    pub fn open_directory_item(&self, request: OpenPathRequest) -> Result<(), ExplorerError> {
        fs::open_directory_item(&request.target_path)
    }

    pub fn create_directory(
        &self,
        request: CreateFolderRequest,
    ) -> Result<CreateFolderResponse, ExplorerError> {
        let parent_path = request.parent_path.trim();
        if parent_path.is_empty() {
            return Err(ExplorerError::new(
                "invalid_directory_parent",
                "Choose a parent folder before creating a new folder.",
            ));
        }

        let canonical_parent_path = fs::canonicalize_folder_path(parent_path)?;
        let created_path = fs::create_directory(parent_path)?;

        self.snapshots
            .invalidate_paths([canonical_parent_path.as_str()], std::iter::empty());

        Ok(CreateFolderResponse {
            path: created_path.to_string_lossy().to_string(),
            name: created_path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| "New Folder".to_string()),
            parent_path: parent_path.to_string(),
        })
    }

    pub fn delete_to_recycle_bin(
        &self,
        request: DeleteToRecycleBinRequest,
    ) -> Result<DeleteToRecycleBinResponse, ExplorerError> {
        if request.target_paths.is_empty() {
            return Err(ExplorerError::new(
                "delete_selection_empty",
                "Select at least one item before deleting.",
            ));
        }

        let mut deleted = Vec::new();
        let mut failed = Vec::new();
        let mut affected_parent_paths = BTreeSet::new();
        let mut deleted_directory_paths = Vec::new();

        for target_path in request.target_paths {
            let target_name = std::path::Path::new(&target_path)
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| target_path.clone());
            let parent_path = std::path::Path::new(&target_path)
                .parent()
                .map(|parent| parent.to_string_lossy().to_string());
            let canonical_parent_path = parent_path
                .as_deref()
                .and_then(|parent| fs::canonicalize_folder_path(parent).ok());

            let inspected = fs::inspect_existing_path(&target_path).and_then(|(path, kind)| {
                let canonical_path = fs::canonicalize_existing_path(&target_path)?;
                let resolved_parent_path = path
                    .parent()
                    .map(|parent| fs::canonicalize_folder_path(&parent.to_string_lossy()))
                    .transpose()?
                    .ok_or_else(|| {
                        ExplorerError::new(
                            "delete_parent_missing",
                            format!(
                                "'{}' does not have a parent folder to delete from.",
                                target_path
                            ),
                        )
                    })?;

                Ok((path, kind, canonical_path, resolved_parent_path))
            });

            let (parsed_target_path, kind, canonical_target_path, canonical_parent_path) =
                match inspected {
                    Ok(result) => result,
                    Err(error) => {
                        if let Some(parent_path) = canonical_parent_path.clone() {
                            affected_parent_paths.insert(parent_path);
                        }

                        failed.push(DeleteToRecycleBinFailure {
                            path: target_path,
                            name: target_name,
                            parent_path,
                            code: error.code,
                            message: error.message,
                        });
                        continue;
                    }
                };

            match fs::delete_to_recycle_bin(parsed_target_path.to_string_lossy().as_ref()) {
                Ok(()) => {
                    affected_parent_paths.insert(canonical_parent_path.clone());
                    if kind == DirectoryItemKind::Directory {
                        deleted_directory_paths.push(canonical_target_path.clone());
                    }

                    deleted.push(DeleteToRecycleBinSuccess {
                        path: parsed_target_path.to_string_lossy().to_string(),
                        name: target_name,
                        parent_path: canonical_parent_path,
                        kind,
                    });
                }
                Err(error) => {
                    reconcile_delete_race_invalidation(
                        &mut affected_parent_paths,
                        &mut deleted_directory_paths,
                        &canonical_parent_path,
                        &kind,
                        &canonical_target_path,
                        &error,
                    );

                    failed.push(DeleteToRecycleBinFailure {
                        path: parsed_target_path.to_string_lossy().to_string(),
                        name: target_name,
                        parent_path,
                        code: error.code,
                        message: error.message,
                    });
                }
            }
        }

        if !affected_parent_paths.is_empty() || !deleted_directory_paths.is_empty() {
            self.snapshots.invalidate_paths(
                affected_parent_paths.iter().map(String::as_str),
                deleted_directory_paths.iter().map(String::as_str),
            );
        }

        Ok(DeleteToRecycleBinResponse {
            deleted,
            failed,
            affected_parent_paths: affected_parent_paths.into_iter().collect(),
        })
    }

    pub fn start_file_operation(
        self: &Arc<Self>,
        request: StartFileOperationRequest,
        on_event: Channel<FileOperationEvent>,
    ) -> Result<(), ExplorerError> {
        self.file_operations.enqueue(request, on_event)
    }

    pub fn cancel_file_operation(
        &self,
        request: CancelFileOperationRequest,
    ) -> Result<(), ExplorerError> {
        self.file_operations.cancel(request)
    }

    pub fn resolve_file_operation_conflict(
        &self,
        request: ResolveFileOperationConflictRequest,
    ) -> Result<(), ExplorerError> {
        self.file_operations.resolve_conflict(request)
    }

}

fn home_dir() -> String {
    std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
}

fn reconcile_delete_race_invalidation(
    affected_parent_paths: &mut BTreeSet<String>,
    deleted_directory_paths: &mut Vec<String>,
    canonical_parent_path: &str,
    kind: &DirectoryItemKind,
    canonical_target_path: &str,
    error: &ExplorerError,
) {
    if error.code != "path_not_found" {
        return;
    }

    affected_parent_paths.insert(canonical_parent_path.to_string());
    if *kind == DirectoryItemKind::Directory {
        deleted_directory_paths.push(canonical_target_path.to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use file_explorer_core::directory::DirectoryItemStub;
    use file_explorer_core::explorer::snapshot_cache::DirectoryCacheKey;

    fn cached_items(name: &str) -> Arc<Vec<DirectoryItemStub>> {
        Arc::new(vec![DirectoryItemStub {
            id: name.to_string(),
            name: name.to_string(),
            path: format!(r"C:\\Temp\\{name}"),
            kind: DirectoryItemKind::File,
            size: None,
            modified_at: None,
            hidden: false,
            readonly: false,
            icon_data_url: None,
            native_icon_state: file_explorer_core::directory::NativeIconState::Pending,
        }])
    }

    #[test]
    fn snapshot_cache_replaces_existing_entry_during_revalidation() {
        let cache = DirectorySnapshotCache::new();
        let key = DirectoryCacheKey::new(r"c:\temp", false);

        cache.insert(key.clone(), cached_items("first"));
        cache.insert(key.clone(), cached_items("second"));

        let cached_snapshot = cache.get(&key).expect("cache entry should exist");
        assert_eq!(cached_snapshot.items[0].name, "second");
    }

    #[test]
    fn snapshot_cache_invalidates_parent_and_descendants_after_rename() {
        let cache = DirectorySnapshotCache::new();
        let parent_key = DirectoryCacheKey::new(r"c:\temp", false);
        let renamed_directory_key = DirectoryCacheKey::new(r"c:\temp\reports", false);
        let descendant_key = DirectoryCacheKey::new(r"c:\temp\reports\2026", false);
        let unaffected_key = DirectoryCacheKey::new(r"c:\temp\archive", false);

        cache.insert(parent_key.clone(), cached_items("parent"));
        cache.insert(renamed_directory_key.clone(), cached_items("reports"));
        cache.insert(descendant_key.clone(), cached_items("descendant"));
        cache.insert(unaffected_key.clone(), cached_items("archive"));

        cache.invalidate_for_rename(
            parent_key.canonical_path(),
            Some(renamed_directory_key.canonical_path()),
        );

        assert!(cache.get(&parent_key).is_none());
        assert!(cache.get(&renamed_directory_key).is_none());
        assert!(cache.get(&descendant_key).is_none());
        assert!(cache.get(&unaffected_key).is_some());
    }

    #[test]
    fn snapshot_cache_invalidates_multiple_parents() {
        let cache = DirectorySnapshotCache::new();
        let left_key = DirectoryCacheKey::new(r"c:\temp\left", false);
        let right_key = DirectoryCacheKey::new(r"c:\temp\right", false);
        let unaffected_key = DirectoryCacheKey::new(r"c:\temp\keep", false);

        cache.insert(left_key.clone(), cached_items("left"));
        cache.insert(right_key.clone(), cached_items("right"));
        cache.insert(unaffected_key.clone(), cached_items("keep"));

        cache.invalidate_paths(
            [left_key.canonical_path(), right_key.canonical_path()],
            std::iter::empty(),
        );

        assert!(cache.get(&left_key).is_none());
        assert!(cache.get(&right_key).is_none());
        assert!(cache.get(&unaffected_key).is_some());
    }

    #[test]
    fn delete_missing_target_still_reports_affected_parent_for_refresh() {
        let service = ExplorerService::new();
        let temp_dir =
            std::env::temp_dir().join(format!("file-explorer-delete-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).expect("temp dir should exist");

        let parent_key = DirectoryCacheKey::new(
            &fs::canonicalize_folder_path(temp_dir.to_string_lossy().as_ref())
                .expect("canonical parent"),
            false,
        );
        service
            .snapshots
            .insert(parent_key.clone(), cached_items("stale-parent"));

        let missing_target = temp_dir.join("Missing.txt");
        let result = service
            .delete_to_recycle_bin(DeleteToRecycleBinRequest {
                target_paths: vec![missing_target.to_string_lossy().to_string()],
            })
            .expect("missing target should return structured result");

        assert!(result.deleted.is_empty());
        assert_eq!(result.failed.len(), 1);
        assert_eq!(result.failed[0].code, "path_not_found");
        assert_eq!(result.affected_parent_paths.len(), 1);
        assert_eq!(result.affected_parent_paths[0], parent_key.canonical_path());
        assert!(service.snapshots.get(&parent_key).is_none());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn delete_race_after_inspection_invalidates_parent_and_deleted_directory_snapshots() {
        let service = ExplorerService::new();
        let temp_dir = std::env::temp_dir().join(format!(
            "file-explorer-delete-race-test-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp_dir);
        std::fs::create_dir_all(&temp_dir).expect("temp dir should exist");

        let deleted_directory = temp_dir.join("reports");
        let descendant_directory = deleted_directory.join("2026");
        let unaffected_directory = temp_dir.join("keep");
        std::fs::create_dir_all(&descendant_directory).expect("descendant dir should exist");
        std::fs::create_dir_all(&unaffected_directory).expect("unaffected dir should exist");

        let parent_key = DirectoryCacheKey::new(
            &fs::canonicalize_folder_path(temp_dir.to_string_lossy().as_ref())
                .expect("canonical parent"),
            false,
        );
        let deleted_directory_key = DirectoryCacheKey::new(
            &fs::canonicalize_existing_path(deleted_directory.to_string_lossy().as_ref())
                .expect("canonical target"),
            false,
        );
        let descendant_key = DirectoryCacheKey::new(
            &fs::canonicalize_existing_path(descendant_directory.to_string_lossy().as_ref())
                .expect("canonical descendant"),
            false,
        );
        let unaffected_key = DirectoryCacheKey::new(
            &fs::canonicalize_existing_path(unaffected_directory.to_string_lossy().as_ref())
                .expect("canonical unaffected"),
            false,
        );

        service
            .snapshots
            .insert(parent_key.clone(), cached_items("parent"));
        service
            .snapshots
            .insert(deleted_directory_key.clone(), cached_items("reports"));
        service
            .snapshots
            .insert(descendant_key.clone(), cached_items("reports-child"));
        service
            .snapshots
            .insert(unaffected_key.clone(), cached_items("keep"));

        let _delete_hook = fs::install_delete_to_recycle_bin_hook(|path| {
            std::fs::remove_dir_all(path).expect("hook should remove target directory");
            Err(ExplorerError::new(
                "path_not_found",
                "target disappeared after inspection",
            ))
        });

        let result = service
            .delete_to_recycle_bin(DeleteToRecycleBinRequest {
                target_paths: vec![deleted_directory.to_string_lossy().to_string()],
            })
            .expect("delete race should return structured result");

        assert!(result.deleted.is_empty());
        assert_eq!(result.failed.len(), 1);
        assert_eq!(result.failed[0].code, "path_not_found");
        assert_eq!(
            result.affected_parent_paths,
            vec![parent_key.canonical_path().to_string()]
        );

        assert!(service.snapshots.get(&parent_key).is_none());
        assert!(service.snapshots.get(&deleted_directory_key).is_none());
        assert!(service.snapshots.get(&descendant_key).is_none());
        assert!(service.snapshots.get(&unaffected_key).is_some());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
