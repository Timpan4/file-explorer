use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::directory::DirectoryItemStub;

#[derive(Clone)]
pub struct CachedDirectorySnapshot {
    pub items: Arc<Vec<DirectoryItemStub>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DirectoryCacheKey {
    canonical_path: String,
    include_hidden: bool,
}

impl DirectoryCacheKey {
    pub fn new(canonical_path: &str, include_hidden: bool) -> Self {
        Self {
            canonical_path: canonical_path.to_ascii_lowercase(),
            include_hidden,
        }
    }
}

pub struct DirectorySnapshotCache {
    inner: Mutex<HashMap<DirectoryCacheKey, CachedDirectorySnapshot>>,
}

impl DirectoryCacheKey {
    pub fn canonical_path(&self) -> &str {
        &self.canonical_path
    }

    pub fn include_hidden(&self) -> bool {
        self.include_hidden
    }
}

impl DirectorySnapshotCache {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn get(&self, key: &DirectoryCacheKey) -> Option<CachedDirectorySnapshot> {
        self.inner
            .lock()
            .ok()
            .and_then(|guard| guard.get(key).cloned())
    }

    pub fn insert(&self, key: DirectoryCacheKey, items: Arc<Vec<DirectoryItemStub>>) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.insert(key, CachedDirectorySnapshot { items });
        }
    }

    pub fn invalidate_for_rename(&self, parent_path: &str, renamed_directory_path: Option<&str>) {
        self.invalidate_paths([parent_path], renamed_directory_path);
    }

    pub fn invalidate_paths<'a>(
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

impl Default for DirectorySnapshotCache {
    fn default() -> Self {
        Self::new()
    }
}

pub fn path_matches_or_is_descendant(path: &str, ancestor: &str) -> bool {
    let ancestor_with_separator = format!("{ancestor}\\");
    path == ancestor || path.starts_with(&ancestor_with_separator)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::directory::DirectoryItemKind;

    fn cached_items(name: &str) -> Arc<Vec<crate::directory::DirectoryItemStub>> {
        Arc::new(vec![crate::directory::DirectoryItemStub {
            id: name.to_string(),
            name: name.to_string(),
            path: format!(r"C:\\Temp\\{name}"),
            kind: DirectoryItemKind::File,
            size: None,
            modified_at: None,
            hidden: false,
            readonly: false,
            icon_data_url: None,
            native_icon_state: crate::directory::NativeIconState::Pending,
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
            canonical_path: r"c:\\temp".to_string(),
            include_hidden: false,
        };
        let renamed_directory_key = DirectoryCacheKey {
            canonical_path: r"c:\\temp\\reports".to_string(),
            include_hidden: false,
        };
        let descendant_key = DirectoryCacheKey {
            canonical_path: r"c:\\temp\\reports\\2026".to_string(),
            include_hidden: false,
        };
        let unaffected_key = DirectoryCacheKey {
            canonical_path: r"c:\\temp\\archive".to_string(),
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
            canonical_path: r"c:\\temp\\left".to_string(),
            include_hidden: false,
        };
        let right_key = DirectoryCacheKey {
            canonical_path: r"c:\\temp\\right".to_string(),
            include_hidden: false,
        };
        let unaffected_key = DirectoryCacheKey {
            canonical_path: r"c:\\temp\\keep".to_string(),
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
}
