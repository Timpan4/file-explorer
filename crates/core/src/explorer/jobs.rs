use crate::directory::CancelReason;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct JobHandle {
    cancelled: Arc<AtomicBool>,
    reason: Arc<Mutex<Option<CancelReason>>>,
}

impl JobHandle {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            reason: Arc::new(Mutex::new(None)),
        }
    }

    pub fn cancel(&self, reason: CancelReason) {
        self.cancelled.store(true, Ordering::Relaxed);
        if let Ok(mut guard) = self.reason.lock() {
            *guard = Some(reason);
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    pub fn cancel_reason(&self) -> Option<CancelReason> {
        self.reason.lock().ok().and_then(|guard| guard.clone())
    }
}

impl Default for JobHandle {
    fn default() -> Self {
        Self::new()
    }
}

pub struct JobRegistry {
    inner: Mutex<HashMap<String, JobHandle>>,
    active_by_tab: Mutex<HashMap<String, String>>,
}

impl JobRegistry {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            active_by_tab: Mutex::new(HashMap::new()),
        }
    }

    pub fn cancel_tab(&self, tab_id: &str, reason: CancelReason) {
        let Some(job_id) = self
            .active_by_tab
            .lock()
            .ok()
            .and_then(|guard| guard.get(tab_id).cloned())
        else {
            return;
        };

        if let Ok(guard) = self.inner.lock() {
            if let Some(handle) = guard.get(&job_id) {
                handle.cancel(reason);
            }
        }
    }

    pub fn insert(&self, tab_id: String, job_id: String, handle: JobHandle) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.insert(job_id.clone(), handle);
        }

        if let Ok(mut guard) = self.active_by_tab.lock() {
            guard.insert(tab_id, job_id);
        }
    }

    pub fn get(&self, job_id: &str) -> Option<JobHandle> {
        self.inner
            .lock()
            .ok()
            .and_then(|guard| guard.get(job_id).cloned())
    }

    pub fn remove(&self, job_id: &str) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.remove(job_id);
        }

        if let Ok(mut guard) = self.active_by_tab.lock() {
            guard.retain(|_, active_job_id| active_job_id != job_id);
        }
    }
}

impl Default for JobRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_tab_cancels_the_latest_job_for_that_tab() {
        let registry = JobRegistry::new();
        let first = JobHandle::new();
        let second = JobHandle::new();

        registry.insert("tab-1".to_string(), "job-1".to_string(), first.clone());
        registry.insert("tab-1".to_string(), "job-2".to_string(), second.clone());

        registry.cancel_tab("tab-1", CancelReason::Superseded);

        assert!(!first.is_cancelled());
        assert!(second.is_cancelled());
        assert!(matches!(
            second.cancel_reason(),
            Some(CancelReason::Superseded)
        ));
    }

    #[test]
    fn removing_an_old_job_keeps_the_latest_tab_job_active() {
        let registry = JobRegistry::new();
        let first = JobHandle::new();
        let second = JobHandle::new();

        registry.insert("tab-1".to_string(), "job-1".to_string(), first.clone());
        registry.insert("tab-1".to_string(), "job-2".to_string(), second.clone());
        registry.remove("job-1");

        registry.cancel_tab("tab-1", CancelReason::Explicit);

        assert!(!first.is_cancelled());
        assert!(second.is_cancelled());
        assert!(matches!(
            second.cancel_reason(),
            Some(CancelReason::Explicit)
        ));
    }

    #[test]
    fn removing_the_active_job_clears_tab_cancellation_target() {
        let registry = JobRegistry::new();
        let handle = JobHandle::new();

        registry.insert("tab-1".to_string(), "job-1".to_string(), handle.clone());
        registry.remove("job-1");

        registry.cancel_tab("tab-1", CancelReason::Explicit);

        assert!(!handle.is_cancelled());
        assert!(registry.get("job-1").is_none());
    }
}
