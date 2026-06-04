use file_explorer_core::explorer::snapshot_cache::DirectorySnapshotCache;
use file_explorer_core::directory::ExplorerError;
use file_explorer_core::file_operations::{
    CancelFileOperationRequest, FileConflictId, FileConflictResolution, FileOperationCancelled,
    FileOperationCompleted, FileOperationEvent, FileOperationFailed, FileOperationId,
    FileOperationQueued, FileOperationStarted, ResolveFileOperationConflictRequest,
    StartFileOperationRequest,
};
use file_explorer_platform_windows::windows::file_ops::{
    execute_file_operation, FileOperationExecution, FileOperationExecutionReport,
};
use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use tauri::ipc::Channel;

pub(super) struct FileOperationQueue {
    state: Mutex<FileOperationQueueState>,
    snapshots: Arc<DirectorySnapshotCache>,
}

struct FileOperationQueueState {
    pending: VecDeque<QueuedFileOperation>,
    active: Option<ActiveFileOperation>,
}

struct QueuedFileOperation {
    request: StartFileOperationRequest,
    on_event: Channel<FileOperationEvent>,
}

struct ActiveFileOperation {
    operation_id: FileOperationId,
    control: Arc<FileOperationControl>,
}

struct FileOperationControl {
    cancelled: AtomicBool,
    conflict_resolutions: Mutex<HashMap<FileConflictId, FileConflictResolution>>,
    conflict_resolved: Condvar,
}

impl FileOperationQueue {
    pub(super) fn new(snapshots: Arc<DirectorySnapshotCache>) -> Self {
        Self {
            state: Mutex::new(FileOperationQueueState {
                pending: VecDeque::new(),
                active: None,
            }),
            snapshots,
        }
    }

    pub(super) fn enqueue(
        self: &Arc<Self>,
        request: StartFileOperationRequest,
        on_event: Channel<FileOperationEvent>,
    ) -> Result<(), ExplorerError> {
        validate_request(&request)?;

        let queue_position = {
            let mut state = self.lock_state()?;
            let queue_position = state.pending.len() + usize::from(state.active.is_some()) + 1;
            send_event(
                &on_event,
                FileOperationEvent::Queued(FileOperationQueued {
                    operation_id: request.operation_id.clone(),
                    kind: request.kind,
                    queue_position,
                }),
            )?;
            state
                .pending
                .push_back(QueuedFileOperation { request, on_event });
            queue_position
        };

        if queue_position == 1 {
            self.start_next();
        }

        Ok(())
    }

    pub(super) fn cancel(&self, request: CancelFileOperationRequest) -> Result<(), ExplorerError> {
        let cancelled_pending = {
            let mut state = self.lock_state()?;
            if let Some(active) = state.active.as_ref() {
                if active.operation_id == request.operation_id {
                    active.control.cancel();
                    return Ok(());
                }
            }

            state
                .pending
                .iter()
                .position(|operation| operation.request.operation_id == request.operation_id)
                .and_then(|index| state.pending.remove(index))
        };

        if let Some(operation) = cancelled_pending {
            let _ =
                operation
                    .on_event
                    .send(FileOperationEvent::Cancelled(FileOperationCancelled {
                        operation_id: operation.request.operation_id,
                        kind: operation.request.kind,
                        completed: Vec::new(),
                        skipped: Vec::new(),
                        failed: Vec::new(),
                        affected_parent_paths: Vec::new(),
                    }));
            return Ok(());
        }

        Err(ExplorerError::new(
            "file_operation_not_found",
            format!(
                "No queued file operation with id '{}' was found.",
                request.operation_id
            ),
        ))
    }

    pub(super) fn resolve_conflict(
        &self,
        request: ResolveFileOperationConflictRequest,
    ) -> Result<(), ExplorerError> {
        if request.resolution == FileConflictResolution::Ask {
            return Err(ExplorerError::new(
                "invalid_conflict_resolution",
                "Choose skip, replace, or keep both to resolve a file conflict.",
            ));
        }

        let control = {
            let state = self.lock_state()?;
            let Some(active) = state.active.as_ref() else {
                return Err(ExplorerError::new(
                    "file_operation_not_active",
                    "There is no active file operation conflict to resolve.",
                ));
            };

            if active.operation_id != request.operation_id {
                return Err(ExplorerError::new(
                    "file_operation_not_active",
                    format!("File operation '{}' is not active.", request.operation_id),
                ));
            }

            Arc::clone(&active.control)
        };

        control.resolve(request.conflict_id, request.resolution);
        Ok(())
    }

    fn start_next(self: &Arc<Self>) {
        let next_operation = {
            let Ok(mut state) = self.state.lock() else {
                return;
            };

            if state.active.is_some() {
                return;
            }

            let Some(operation) = state.pending.pop_front() else {
                return;
            };

            let control = Arc::new(FileOperationControl::new());
            state.active = Some(ActiveFileOperation {
                operation_id: operation.request.operation_id.clone(),
                control: Arc::clone(&control),
            });

            Some((operation, control))
        };

        let Some((operation, control)) = next_operation else {
            return;
        };

        let queue = Arc::clone(self);
        std::thread::spawn(move || {
            queue.run_operation(operation, control);
        });
    }

    fn run_operation(
        self: Arc<Self>,
        operation: QueuedFileOperation,
        control: Arc<FileOperationControl>,
    ) {
        let request = operation.request;
        let on_event = operation.on_event;

        if on_event
            .send(FileOperationEvent::Started(FileOperationStarted {
                operation_id: request.operation_id.clone(),
                kind: request.kind,
                total_items: request.source_paths.len(),
            }))
            .is_err()
        {
            control.cancel();
        }

        let execution = execute_file_operation(
            &request,
            || control.is_cancelled(),
            |conflict| {
                if on_event
                    .send(FileOperationEvent::Conflict(conflict.clone()))
                    .is_err()
                {
                    control.cancel();
                    return None;
                }

                control.wait_for_resolution(&conflict.conflict_id)
            },
            |progress| {
                if on_event
                    .send(FileOperationEvent::Progress(progress))
                    .is_err()
                {
                    control.cancel();
                }
            },
        );

        match execution {
            Ok(FileOperationExecution::Completed(report)) => {
                self.invalidate_snapshots(&report);
                let _ = on_event.send(FileOperationEvent::Completed(completed_event(
                    &request, report,
                )));
            }
            Ok(FileOperationExecution::Cancelled(report)) => {
                self.invalidate_snapshots(&report);
                let _ = on_event.send(FileOperationEvent::Cancelled(cancelled_event(
                    &request, report,
                )));
            }
            Err(error) => {
                let _ = on_event.send(FileOperationEvent::Failed(FileOperationFailed {
                    operation_id: request.operation_id.clone(),
                    kind: request.kind,
                    code: error.code,
                    message: error.message,
                }));
            }
        }

        self.finish_operation(&request.operation_id);
    }

    fn finish_operation(self: &Arc<Self>, operation_id: &str) {
        if let Ok(mut state) = self.state.lock() {
            if state
                .active
                .as_ref()
                .is_some_and(|active| active.operation_id == operation_id)
            {
                state.active = None;
            }
        }

        self.start_next();
    }

    fn invalidate_snapshots(&self, report: &FileOperationExecutionReport) {
        if report.affected_parent_paths.is_empty() && report.affected_descendant_paths.is_empty() {
            return;
        }

        self.snapshots.invalidate_paths(
            report.affected_parent_paths.iter().map(String::as_str),
            report.affected_descendant_paths.iter().map(String::as_str),
        );
    }

    fn lock_state(
        &self,
    ) -> Result<std::sync::MutexGuard<'_, FileOperationQueueState>, ExplorerError> {
        self.state.lock().map_err(|_| {
            ExplorerError::new(
                "file_operation_queue_unavailable",
                "File operation queue state is unavailable.",
            )
        })
    }
}

impl FileOperationControl {
    fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
            conflict_resolutions: Mutex::new(HashMap::new()),
            conflict_resolved: Condvar::new(),
        }
    }

    fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        self.conflict_resolved.notify_all();
    }

    fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    fn resolve(&self, conflict_id: FileConflictId, resolution: FileConflictResolution) {
        if let Ok(mut resolutions) = self.conflict_resolutions.lock() {
            resolutions.insert(conflict_id, resolution);
        }
        self.conflict_resolved.notify_all();
    }

    fn wait_for_resolution(&self, conflict_id: &str) -> Option<FileConflictResolution> {
        let mut resolutions = self
            .conflict_resolutions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        loop {
            if self.is_cancelled() {
                return None;
            }

            if let Some(resolution) = resolutions.remove(conflict_id) {
                return Some(resolution);
            }

            resolutions = self
                .conflict_resolved
                .wait(resolutions)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }
}

fn validate_request(request: &StartFileOperationRequest) -> Result<(), ExplorerError> {
    if request.operation_id.trim().is_empty() {
        return Err(ExplorerError::new(
            "invalid_file_operation_id",
            "File operation id cannot be empty.",
        ));
    }

    if request.source_paths.is_empty() {
        return Err(ExplorerError::new(
            "file_operation_sources_empty",
            "Select at least one item before copying or moving.",
        ));
    }

    if request.destination_directory.trim().is_empty() {
        return Err(ExplorerError::new(
            "invalid_operation_destination",
            "Choose a destination folder before pasting items.",
        ));
    }

    Ok(())
}

fn send_event(
    on_event: &Channel<FileOperationEvent>,
    event: FileOperationEvent,
) -> Result<(), ExplorerError> {
    on_event.send(event).map_err(|_| {
        ExplorerError::new(
            "file_operation_channel_closed",
            "File operation updates could not be delivered.",
        )
    })
}

fn completed_event(
    request: &StartFileOperationRequest,
    report: FileOperationExecutionReport,
) -> FileOperationCompleted {
    FileOperationCompleted {
        operation_id: request.operation_id.clone(),
        kind: request.kind,
        completed: report.completed,
        skipped: report.skipped,
        failed: report.failed,
        affected_parent_paths: report.affected_parent_paths,
    }
}

fn cancelled_event(
    request: &StartFileOperationRequest,
    report: FileOperationExecutionReport,
) -> FileOperationCancelled {
    FileOperationCancelled {
        operation_id: request.operation_id.clone(),
        kind: request.kind,
        completed: report.completed,
        skipped: report.skipped,
        failed: report.failed,
        affected_parent_paths: report.affected_parent_paths,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use file_explorer_core::file_operations::FileOperationKind;

    #[test]
    fn conflict_control_waits_for_resolution() {
        let control = Arc::new(FileOperationControl::new());
        let waiting_control = Arc::clone(&control);

        let handle = std::thread::spawn(move || waiting_control.wait_for_resolution("conflict-1"));
        control.resolve("conflict-1".to_string(), FileConflictResolution::KeepBoth);

        assert_eq!(
            handle.join().expect("thread should finish"),
            Some(FileConflictResolution::KeepBoth)
        );
    }

    #[test]
    fn conflict_control_returns_none_after_cancel() {
        let control = Arc::new(FileOperationControl::new());
        let waiting_control = Arc::clone(&control);

        let handle = std::thread::spawn(move || waiting_control.wait_for_resolution("conflict-1"));
        control.cancel();

        assert_eq!(handle.join().expect("thread should finish"), None);
    }

    #[test]
    fn validate_request_rejects_empty_sources() {
        let error = validate_request(&StartFileOperationRequest {
            operation_id: "operation-1".to_string(),
            kind: FileOperationKind::Copy,
            source_paths: Vec::new(),
            destination_directory: r"C:\".to_string(),
            default_conflict_resolution: None,
        })
        .expect_err("empty sources should fail");

        assert_eq!(error.code, "file_operation_sources_empty");
    }
}
