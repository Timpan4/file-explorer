use file_explorer_core::directory::{
    CancelReason, CancelledEvent, DirectoryItemStub, ExplorerError, ExplorerStreamEvent,
    FailedEvent, NavigationRequest, SnapshotChunk, SnapshotCompleted, SnapshotStarted,
};
use file_explorer_core::explorer::snapshot_cache::{DirectoryCacheKey, DirectorySnapshotCache};
use file_explorer_core::jobs::JobHandle;
use file_explorer_core::projection;
use file_explorer_platform_windows::windows::fs;
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;

#[derive(Debug, Clone)]
pub(super) struct ResolvedDirectorySnapshot {
    items: Arc<Vec<DirectoryItemStub>>,
    cache_hit: bool,
    resolve_snapshot_ms: u128,
    enumerate_fs_ms: Option<u128>,
    snapshot_build_ms: Option<u128>,
}

pub(super) struct NavigationPipeline {
    snapshots: Arc<DirectorySnapshotCache>,
}

impl NavigationPipeline {
    pub(super) fn new(snapshots: Arc<DirectorySnapshotCache>) -> Self {
        Self { snapshots }
    }

    pub(super) async fn stream_directory(
        &self,
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
                return;
            }
        };

        if job.is_cancelled() {
            let _ = on_event.send(ExplorerStreamEvent::Cancelled(CancelledEvent {
                job_id: request.job_id.clone(),
                reason: job.cancel_reason().unwrap_or(CancelReason::Explicit),
            }));
            return;
        }

        let project_started_at = Instant::now();
        let entries = projection::project_directory_snapshot(
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
    }

    fn resolve_snapshot(
        &self,
        request: &NavigationRequest,
        include_hidden: bool,
    ) -> Result<ResolvedDirectorySnapshot, ExplorerError> {
        let resolve_started_at = Instant::now();
        let canonical_path = fs::canonicalize_folder_path(&request.path)?;
        let cache_key = DirectoryCacheKey::new(&canonical_path, include_hidden);
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
        let items = Arc::new(fs::read_directory_snapshot(&canonical_path, include_hidden)?);
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
