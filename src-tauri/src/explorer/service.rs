use file_explorer_core::directory::{
    CancelReason, CancelledEvent, CreateFolderRequest, CreateFolderResponse,
    DeleteToRecycleBinFailure, DeleteToRecycleBinRequest, DeleteToRecycleBinResponse,
    DeleteToRecycleBinSuccess, DirectoryItemKind, DirectoryItemStub, ExplorerError,
    ExplorerStreamEvent, FailedEvent, NativeIconBatchRequest, NativeIconBatchResponse,
    NavigationRequest, OpenPathRequest, RenameRequest, RenameResponse, SidebarRoot,
    SidebarRootKind, SnapshotChunk, SnapshotCompleted, SnapshotStarted,
};
use file_explorer_core::jobs::{JobHandle, JobRegistry};
use file_explorer_platform_windows::windows::{fs, icons};
use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::ipc::Channel;

#[derive(Clone)]
struct CachedDirectorySnapshot {
    items: Arc<Vec<DirectoryItemStub>>,
}

struct ResolvedDirectorySnapshot {
    items: Arc<Vec<DirectoryItemStub>>,
    cache_hit: bool,
    resolve_snapshot_ms: u128,
    enumerate_fs_ms: Option<u128>,
    snapshot_build_ms: Option<u128>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DirectoryCacheKey {
    canonical_path: String,
    include_hidden: bool,
}

impl DirectoryCacheKey {
    fn new(path: &str, include_hidden: bool) -> Result<Self, ExplorerError> {
        Ok(Self {
            canonical_path: fs::canonicalize_folder_path(path)?,
            include_hidden,
        })
    }
}

struct DirectorySnapshotCache {
    inner: Mutex<HashMap<DirectoryCacheKey, CachedDirectorySnapshot>>,
}

impl DirectorySnapshotCache {
    fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    fn get(&self, key: &DirectoryCacheKey) -> Option<CachedDirectorySnapshot> {
        self.inner
            .lock()
            .ok()
            .and_then(|guard| guard.get(key).cloned())
    }

    fn insert(&self, key: DirectoryCacheKey, items: Arc<Vec<DirectoryItemStub>>) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.insert(key, CachedDirectorySnapshot { items });
        }
    }

    fn invalidate_for_rename(&self, parent_path: &str, renamed_directory_path: Option<&str>) {
        self.invalidate_paths([parent_path], renamed_directory_path);
    }

    fn invalidate_paths<'a>(
        &self,
        parent_paths: impl IntoIterator<Item = &'a str>,
        descendant_roots: impl IntoIterator<Item = &'a str>,
    ) {
        let invalid_parent_paths = parent_paths.into_iter().collect::<Vec<_>>();
        let invalid_descendant_roots = descendant_roots.into_iter().collect::<Vec<_>>();

        if let Ok(mut guard) = self.inner.lock() {
            guard.retain(|key, _| {
                if invalid_parent_paths
                    .iter()
                    .any(|path| key.canonical_path == *path)
                {
                    return false;
                }

                !invalid_descendant_roots
                    .iter()
                    .any(|path| path_matches_or_is_descendant(&key.canonical_path, path))
            });
        }
    }
}

pub struct ExplorerService {
    jobs: JobRegistry,
    snapshots: DirectorySnapshotCache,
}

impl ExplorerService {
    pub fn new() -> Self {
        Self {
            jobs: JobRegistry::new(),
            snapshots: DirectorySnapshotCache::new(),
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

        tauri::async_runtime::spawn(async move {
            service.stream_directory(request, job, on_event).await;
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

    async fn stream_directory(
        self: Arc<Self>,
        request: NavigationRequest,
        job: JobHandle,
        on_event: Channel<ExplorerStreamEvent>,
    ) {
        let started_at = Instant::now();
        let snapshot_token = format!("{}:{}", request.job_id, started_at.elapsed().as_nanos());
        let include_hidden = request.include_hidden.unwrap_or(false);
        let applied_query = request.query.clone().unwrap_or_default();

        if on_event
            .send(ExplorerStreamEvent::SnapshotStarted(SnapshotStarted {
                job_id: request.job_id.clone(),
                path: request.path.clone(),
                query: applied_query.clone(),
                snapshot_token: snapshot_token.clone(),
            }))
            .is_err()
        {
            self.jobs.remove(&request.job_id);
            return;
        }

        let resolved_snapshot = match self.resolve_snapshot(&request, include_hidden) {
            Ok(snapshot) => snapshot,
            Err(error) => {
                let _ = on_event.send(ExplorerStreamEvent::Failed(FailedEvent {
                    job_id: request.job_id.clone(),
                    code: error.code,
                    message: error.message,
                }));
                self.jobs.remove(&request.job_id);
                return;
            }
        };

        if job.is_cancelled() {
            let _ = on_event.send(ExplorerStreamEvent::Cancelled(CancelledEvent {
                job_id: request.job_id.clone(),
                reason: job.cancel_reason().unwrap_or(CancelReason::Explicit),
            }));
            self.jobs.remove(&request.job_id);
            return;
        }

        let project_started_at = Instant::now();
        let entries = fs::project_directory_snapshot(
            resolved_snapshot.items.as_ref(),
            request.query.as_deref(),
            request.sort.clone(),
        );
        let project_ms = project_started_at.elapsed().as_millis();
        let total_items = entries.len();
        let chunk_size = request
            .viewport_hint
            .as_ref()
            .map(|hint| hint.count.clamp(25, 250))
            .unwrap_or(120);
        let start_index = request
            .viewport_hint
            .as_ref()
            .map(|hint| hint.start.min(total_items))
            .unwrap_or(0);

        let mut first_chunk_send_ms = None;
        for chunk in entries[start_index..].chunks(chunk_size) {
            if job.is_cancelled() {
                let _ = on_event.send(ExplorerStreamEvent::Cancelled(CancelledEvent {
                    job_id: request.job_id.clone(),
                    reason: job.cancel_reason().unwrap_or(CancelReason::Explicit),
                }));
                self.jobs.remove(&request.job_id);
                return;
            }

            if on_event
                .send(ExplorerStreamEvent::SnapshotChunk(SnapshotChunk {
                    job_id: request.job_id.clone(),
                    snapshot_token: snapshot_token.clone(),
                    items: chunk.to_vec(),
                    total_known: Some(total_items),
                }))
                .is_err()
            {
                self.jobs.remove(&request.job_id);
                return;
            }

            if first_chunk_send_ms.is_none() {
                first_chunk_send_ms = Some(started_at.elapsed().as_millis());
            }
        }

        let all_chunks_sent_ms = started_at.elapsed().as_millis();

        let _ = on_event.send(ExplorerStreamEvent::SnapshotCompleted(SnapshotCompleted {
            job_id: request.job_id.clone(),
            query: applied_query,
            snapshot_token,
            total_items,
            duration_ms: started_at.elapsed().as_millis(),
            cache_hit: resolved_snapshot.cache_hit,
            resolve_snapshot_ms: resolved_snapshot.resolve_snapshot_ms,
            enumerate_fs_ms: resolved_snapshot.enumerate_fs_ms,
            enumerate_entries_ms: None,
            icon_lookup_total_ms: None,
            icon_lookup_count: None,
            icon_encode_total_ms: None,
            snapshot_build_ms: resolved_snapshot.snapshot_build_ms,
            project_ms,
            first_chunk_send_ms,
            all_chunks_sent_ms,
            total_backend_ms: started_at.elapsed().as_millis(),
        }));

        self.jobs.remove(&request.job_id);
    }

    fn resolve_snapshot(
        &self,
        request: &NavigationRequest,
        include_hidden: bool,
    ) -> Result<ResolvedDirectorySnapshot, ExplorerError> {
        let resolve_started_at = Instant::now();
        let cache_key = DirectoryCacheKey::new(&request.path, include_hidden)?;
        let force_refresh = request.force_refresh.unwrap_or(false);

        if !force_refresh {
            if let Some(cached_snapshot) = self.snapshots.get(&cache_key) {
                return Ok(ResolvedDirectorySnapshot {
                    items: cached_snapshot.items,
                    cache_hit: true,
                    resolve_snapshot_ms: resolve_started_at.elapsed().as_millis(),
                    enumerate_fs_ms: None,
                    snapshot_build_ms: Some(resolve_started_at.elapsed().as_millis()),
                });
            }
        }

        let enumerate_started_at = Instant::now();
        let items = Arc::new(fs::read_directory_snapshot(&request.path, include_hidden)?);
        let enumerate_fs_ms = enumerate_started_at.elapsed().as_millis();
        self.snapshots.insert(cache_key, Arc::clone(&items));

        Ok(ResolvedDirectorySnapshot {
            items,
            cache_hit: false,
            resolve_snapshot_ms: resolve_started_at.elapsed().as_millis(),
            enumerate_fs_ms: Some(enumerate_fs_ms),
            snapshot_build_ms: Some(resolve_started_at.elapsed().as_millis()),
        })
    }
}

fn home_dir() -> String {
    std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string())
}

fn path_matches_or_is_descendant(path: &str, ancestor: &str) -> bool {
    let ancestor_with_separator = format!("{ancestor}\\");
    path == ancestor || path.starts_with(&ancestor_with_separator)
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
        let key = DirectoryCacheKey {
            canonical_path: r"c:\\temp".to_string(),
            include_hidden: false,
        };

        cache.insert(key.clone(), cached_items("first"));
        cache.insert(key.clone(), cached_items("second"));

        let cached_snapshot = cache.get(&key).expect("cache entry should exist");
        assert_eq!(cached_snapshot.items[0].name, "second");
    }

    #[test]
    fn snapshot_cache_invalidates_parent_and_descendants_after_rename() {
        let cache = DirectorySnapshotCache::new();
        let parent_key = DirectoryCacheKey {
            canonical_path: r"c:\temp".to_string(),
            include_hidden: false,
        };
        let renamed_directory_key = DirectoryCacheKey {
            canonical_path: r"c:\temp\reports".to_string(),
            include_hidden: false,
        };
        let descendant_key = DirectoryCacheKey {
            canonical_path: r"c:\temp\reports\2026".to_string(),
            include_hidden: false,
        };
        let unaffected_key = DirectoryCacheKey {
            canonical_path: r"c:\temp\archive".to_string(),
            include_hidden: false,
        };

        cache.insert(parent_key.clone(), cached_items("parent"));
        cache.insert(renamed_directory_key.clone(), cached_items("reports"));
        cache.insert(descendant_key.clone(), cached_items("descendant"));
        cache.insert(unaffected_key.clone(), cached_items("archive"));

        cache.invalidate_for_rename(
            &parent_key.canonical_path,
            Some(&renamed_directory_key.canonical_path),
        );

        assert!(cache.get(&parent_key).is_none());
        assert!(cache.get(&renamed_directory_key).is_none());
        assert!(cache.get(&descendant_key).is_none());
        assert!(cache.get(&unaffected_key).is_some());
    }

    #[test]
    fn snapshot_cache_invalidates_multiple_parents() {
        let cache = DirectorySnapshotCache::new();
        let left_key = DirectoryCacheKey {
            canonical_path: r"c:\temp\left".to_string(),
            include_hidden: false,
        };
        let right_key = DirectoryCacheKey {
            canonical_path: r"c:\temp\right".to_string(),
            include_hidden: false,
        };
        let unaffected_key = DirectoryCacheKey {
            canonical_path: r"c:\temp\keep".to_string(),
            include_hidden: false,
        };

        cache.insert(left_key.clone(), cached_items("left"));
        cache.insert(right_key.clone(), cached_items("right"));
        cache.insert(unaffected_key.clone(), cached_items("keep"));

        cache.invalidate_paths(
            [
                left_key.canonical_path.as_str(),
                right_key.canonical_path.as_str(),
            ],
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

        let parent_key = DirectoryCacheKey {
            canonical_path: fs::canonicalize_folder_path(temp_dir.to_string_lossy().as_ref())
                .expect("canonical parent"),
            include_hidden: false,
        };
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
        assert_eq!(result.affected_parent_paths[0], parent_key.canonical_path);
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

        let parent_key = DirectoryCacheKey {
            canonical_path: fs::canonicalize_folder_path(temp_dir.to_string_lossy().as_ref())
                .expect("canonical parent"),
            include_hidden: false,
        };
        let deleted_directory_key = DirectoryCacheKey {
            canonical_path: fs::canonicalize_existing_path(
                deleted_directory.to_string_lossy().as_ref(),
            )
            .expect("canonical target"),
            include_hidden: false,
        };
        let descendant_key = DirectoryCacheKey {
            canonical_path: fs::canonicalize_existing_path(
                descendant_directory.to_string_lossy().as_ref(),
            )
            .expect("canonical descendant"),
            include_hidden: false,
        };
        let unaffected_key = DirectoryCacheKey {
            canonical_path: fs::canonicalize_existing_path(
                unaffected_directory.to_string_lossy().as_ref(),
            )
            .expect("canonical unaffected"),
            include_hidden: false,
        };

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
            vec![parent_key.canonical_path.clone()]
        );

        assert!(service.snapshots.get(&parent_key).is_none());
        assert!(service.snapshots.get(&deleted_directory_key).is_none());
        assert!(service.snapshots.get(&descendant_key).is_none());
        assert!(service.snapshots.get(&unaffected_key).is_some());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}
