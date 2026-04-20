use crate::windows::icons;
use chrono::{DateTime, Local};
use file_explorer_core::directory::{
    DirectoryItemKind, DirectoryItemStub, ExplorerError, NativeIconBatchResponse,
    NativeIconRequestItem, NativeIconResult, NativeIconState, SidebarRoot, SidebarRootKind,
    SortDirection, SortField, SortSpec,
};
use std::cmp::Ordering;
use std::fs;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_HIDDEN;
use windows::Win32::UI::Shell::{
    SHFileOperationW, ShellExecuteW, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT,
    FO_DELETE, SHFILEOPSTRUCTW,
};

pub fn list_drive_roots() -> Result<Vec<SidebarRoot>, ExplorerError> {
    let mut roots = Vec::new();

    for drive_letter in b'C'..=b'Z' {
        let drive = format!("{}:\\", drive_letter as char);
        if Path::new(&drive).exists() {
            roots.push(SidebarRoot {
                id: format!("drive-{drive_letter}"),
                label: drive.clone(),
                path: drive,
                kind: SidebarRootKind::Drive,
                icon_data_url: icons::icon_for_sidebar_path(&format!(
                    "{}:\\",
                    drive_letter as char
                )),
            });
        }
    }

    if roots.is_empty() {
        return Err(ExplorerError::new(
            "no_roots",
            "No accessible Windows drive roots were found.",
        ));
    }

    Ok(roots)
}

pub fn canonicalize_folder_path(path: &str) -> Result<String, ExplorerError> {
    canonicalize_existing_path(path)
}

pub fn canonicalize_existing_path(path: &str) -> Result<String, ExplorerError> {
    let canonical_path = fs::canonicalize(path).map_err(|error| {
        ExplorerError::new(
            "canonicalize_failed",
            format!("Failed to canonicalize '{path}': {error}"),
        )
    })?;

    Ok(canonical_path.to_string_lossy().to_ascii_lowercase())
}

pub fn rename_directory_item(
    source_path: &str,
    target_name: &str,
) -> Result<PathBuf, ExplorerError> {
    let source = PathBuf::from(source_path);
    let parent = source.parent().ok_or_else(|| {
        ExplorerError::new(
            "rename_parent_missing",
            format!("'{source_path}' does not have a parent folder to rename within."),
        )
    })?;
    let parsed_target_name = parse_rename_target_name(target_name)?;
    let renamed_path = parent.join(parsed_target_name);

    fs::rename(&source, &renamed_path).map_err(|error| {
        ExplorerError::new(
            "rename_failed",
            format!(
                "Failed to rename '{source_path}' to '{}': {error}",
                renamed_path.display()
            ),
        )
    })?;

    Ok(renamed_path)
}

pub fn open_directory_item(target_path: &str) -> Result<(), ExplorerError> {
    let parsed_target_path = parse_existing_non_directory_path(target_path, "open")?;
    let operation = wide_null_terminated("open");
    let file = wide_null_terminated(parsed_target_path.as_os_str());

    let result = unsafe {
        ShellExecuteW(
            Some(HWND(std::ptr::null_mut())),
            PCWSTR(operation.as_ptr()),
            PCWSTR(file.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
        )
    };

    let status_code = result.0 as isize;
    if status_code <= 32 {
        return Err(open_shell_error(target_path, status_code));
    }

    Ok(())
}

pub fn create_directory(parent_path: &str) -> Result<PathBuf, ExplorerError> {
    let parsed_parent_path = parse_existing_directory_path(parent_path, "create a folder in")?;
    create_directory_with_explorer_name(&parsed_parent_path)
}

pub fn delete_to_recycle_bin(target_path: &str) -> Result<(), ExplorerError> {
    let parsed_target_path = parse_existing_path(target_path, "delete")?;

    if let Some(result) = run_delete_to_recycle_bin_hook(&parsed_target_path) {
        return result;
    }

    let from = wide_double_null_terminated(parsed_target_path.as_os_str());
    let mut file_operation = SHFILEOPSTRUCTW {
        hwnd: HWND(std::ptr::null_mut()),
        wFunc: FO_DELETE,
        pFrom: PCWSTR(from.as_ptr()),
        pTo: PCWSTR::null(),
        fFlags: (FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_NOERRORUI | FOF_SILENT).0 as u16,
        fAnyOperationsAborted: Default::default(),
        hNameMappings: Default::default(),
        lpszProgressTitle: PCWSTR::null(),
    };

    let result = unsafe { SHFileOperationW(&mut file_operation) };
    if result != 0 {
        return Err(delete_shell_error(target_path, result));
    }

    if file_operation.fAnyOperationsAborted.as_bool() {
        return Err(ExplorerError::new(
            "delete_cancelled",
            format!(
                "Windows cancelled moving '{}' to the Recycle Bin.",
                target_path
            ),
        ));
    }

    Ok(())
}

type DeleteToRecycleBinHook = dyn Fn(&Path) -> Result<(), ExplorerError> + Send + Sync + 'static;

static DELETE_TO_RECYCLE_BIN_HOOK: OnceLock<Mutex<Option<Box<DeleteToRecycleBinHook>>>> =
    OnceLock::new();

pub struct DeleteToRecycleBinHookGuard;

impl Drop for DeleteToRecycleBinHookGuard {
    fn drop(&mut self) {
        clear_delete_to_recycle_bin_hook();
    }
}

pub fn install_delete_to_recycle_bin_hook<F>(hook: F) -> DeleteToRecycleBinHookGuard
where
    F: Fn(&Path) -> Result<(), ExplorerError> + Send + Sync + 'static,
{
    let hook_slot = DELETE_TO_RECYCLE_BIN_HOOK.get_or_init(|| Mutex::new(None));
    *hook_slot
        .lock()
        .expect("delete hook mutex should not be poisoned") = Some(Box::new(hook));
    DeleteToRecycleBinHookGuard
}

fn clear_delete_to_recycle_bin_hook() {
    let hook_slot = DELETE_TO_RECYCLE_BIN_HOOK.get_or_init(|| Mutex::new(None));
    *hook_slot
        .lock()
        .expect("delete hook mutex should not be poisoned") = None;
}

fn run_delete_to_recycle_bin_hook(target_path: &Path) -> Option<Result<(), ExplorerError>> {
    let hook_slot = DELETE_TO_RECYCLE_BIN_HOOK.get_or_init(|| Mutex::new(None));
    hook_slot
        .lock()
        .expect("delete hook mutex should not be poisoned")
        .as_ref()
        .map(|hook| hook(target_path))
}

pub fn inspect_existing_path(
    target_path: &str,
) -> Result<(PathBuf, DirectoryItemKind), ExplorerError> {
    let parsed_target_path = parse_existing_path(target_path, "inspect")?;
    let metadata = parsed_target_path.metadata().map_err(|error| {
        ExplorerError::new(
            "path_metadata_unavailable",
            format!(
                "Could not inspect '{}': {error}",
                parsed_target_path.display()
            ),
        )
    })?;

    let kind = if metadata.is_dir() {
        DirectoryItemKind::Directory
    } else if metadata.is_file() {
        DirectoryItemKind::File
    } else {
        DirectoryItemKind::Other
    };

    Ok((parsed_target_path, kind))
}

pub fn read_directory_snapshot(
    path: &str,
    include_hidden: bool,
) -> Result<Vec<DirectoryItemStub>, ExplorerError> {
    let directory = fs::read_dir(path).map_err(|error| {
        ExplorerError::new(
            "read_dir_failed",
            format!("Failed to read '{path}': {error}"),
        )
    })?;

    let mut items = Vec::new();

    for entry_result in directory {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        let path_buf = entry.path();
        let path_str = path_buf.to_string_lossy().to_string();
        let name = entry.file_name().to_string_lossy().to_string();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        let metadata = match path_buf.symlink_metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        let hidden = has_hidden_attribute(&metadata);
        if hidden && !include_hidden {
            continue;
        }

        let kind = if file_type.is_symlink() {
            DirectoryItemKind::Symlink
        } else if file_type.is_dir() {
            DirectoryItemKind::Directory
        } else if file_type.is_file() {
            DirectoryItemKind::File
        } else {
            DirectoryItemKind::Other
        };

        let modified_at = metadata.modified().ok().map(|time| {
            let date_time: DateTime<Local> = DateTime::from(time);
            date_time.format("%Y-%m-%d %H:%M").to_string()
        });
        items.push(DirectoryItemStub {
            id: path_str.clone(),
            name,
            path: path_str,
            kind,
            size: if file_type.is_file() {
                Some(metadata.len())
            } else {
                None
            },
            modified_at,
            hidden,
            readonly: metadata.permissions().readonly(),
            icon_data_url: None,
            native_icon_state: NativeIconState::Pending,
        });
    }

    Ok(items)
}

pub fn hydrate_directory_icons(items: &[NativeIconRequestItem]) -> NativeIconBatchResponse {
    let started_at = Instant::now();
    let mut results = Vec::with_capacity(items.len());
    let mut icon_lookup_total_ms = 0;
    let mut icon_lookup_count = 0;
    let mut icon_encode_total_ms = 0;

    for item in items {
        let lookup = icons::hydrate_directory_item_icon(&item.path, &item.kind);
        icon_lookup_total_ms += lookup.metrics.lookup_ms;
        icon_lookup_count += lookup.metrics.lookup_count;
        icon_encode_total_ms += lookup.metrics.encode_ms;
        let native_icon_state = if lookup.icon_data_url.is_some() {
            NativeIconState::Ready
        } else {
            NativeIconState::Failed
        };

        results.push(NativeIconResult {
            path: item.path.clone(),
            icon_data_url: lookup.icon_data_url,
            native_icon_state,
        });
    }

    NativeIconBatchResponse {
        items: results,
        icon_lookup_total_ms,
        icon_lookup_count,
        icon_encode_total_ms,
        total_ms: started_at.elapsed().as_millis(),
    }
}

pub fn project_directory_snapshot(
    items: &[DirectoryItemStub],
    query: Option<&str>,
    sort: Option<SortSpec>,
) -> Vec<DirectoryItemStub> {
    let normalized_query = normalize_query(query);
    let mut projected_items = items
        .iter()
        .filter(|item| matches_query(item, normalized_query.as_deref()))
        .cloned()
        .collect::<Vec<_>>();

    sort_directory_items(&mut projected_items, &sort.unwrap_or(default_sort_spec()));
    projected_items
}

fn normalize_query(query: Option<&str>) -> Option<String> {
    let trimmed_query = query.unwrap_or_default().trim();
    if trimmed_query.is_empty() {
        return None;
    }

    Some(trimmed_query.to_ascii_lowercase())
}

fn matches_query(item: &DirectoryItemStub, normalized_query: Option<&str>) -> bool {
    let Some(normalized_query) = normalized_query else {
        return true;
    };

    format!(
        "{} {} {}",
        item.name,
        searchable_kind_label(&item.kind),
        item.path
    )
    .to_ascii_lowercase()
    .contains(normalized_query)
}

fn sort_directory_items(items: &mut [DirectoryItemStub], sort_spec: &SortSpec) {
    items.sort_by(|left, right| compare_directory_items(left, right, sort_spec));
}

fn compare_directory_items(
    left: &DirectoryItemStub,
    right: &DirectoryItemStub,
    sort_spec: &SortSpec,
) -> Ordering {
    let left_is_folder_group = matches!(
        left.kind,
        DirectoryItemKind::Directory | DirectoryItemKind::Symlink
    );
    let right_is_folder_group = matches!(
        right.kind,
        DirectoryItemKind::Directory | DirectoryItemKind::Symlink
    );

    let directory_bias = match (left_is_folder_group, right_is_folder_group) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => Ordering::Equal,
    };

    if directory_bias != Ordering::Equal {
        return directory_bias;
    }

    let ordering = match sort_spec.field {
        SortField::Name => left
            .name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase()),
        SortField::Type => type_label(&left.kind).cmp(type_label(&right.kind)),
        SortField::ModifiedAt => left.modified_at.cmp(&right.modified_at),
        SortField::Size => left.size.cmp(&right.size),
    };

    let ordering = if ordering == Ordering::Equal {
        left.name
            .to_ascii_lowercase()
            .cmp(&right.name.to_ascii_lowercase())
    } else {
        ordering
    };

    match sort_spec.direction {
        SortDirection::Asc => ordering,
        SortDirection::Desc => ordering.reverse(),
    }
}

fn default_sort_spec() -> SortSpec {
    SortSpec {
        field: SortField::Type,
        direction: SortDirection::Asc,
    }
}

fn parse_rename_target_name(target_name: &str) -> Result<&str, ExplorerError> {
    let trimmed_target_name = target_name.trim();
    if trimmed_target_name.is_empty() {
        return Err(ExplorerError::new(
            "invalid_rename_target",
            "Rename target cannot be empty.",
        ));
    }

    if trimmed_target_name == "." || trimmed_target_name == ".." {
        return Err(ExplorerError::new(
            "invalid_rename_target",
            "Rename target must stay within the current folder.",
        ));
    }

    if trimmed_target_name
        .chars()
        .any(|character| character == '\\' || character == '/')
    {
        return Err(ExplorerError::new(
            "invalid_rename_target",
            "Rename target cannot include path separators.",
        ));
    }

    if trimmed_target_name.ends_with(' ') || trimmed_target_name.ends_with('.') {
        return Err(ExplorerError::new(
            "invalid_rename_target",
            "Rename target cannot end with a space or period.",
        ));
    }

    if trimmed_target_name
        .chars()
        .any(|character| matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
    {
        return Err(ExplorerError::new(
            "invalid_rename_target",
            "Rename target contains characters Windows does not allow.",
        ));
    }

    let uppercase_name = trimmed_target_name.to_ascii_uppercase();
    let reserved_device_name = uppercase_name
        .split_once('.')
        .map(|(stem, _)| stem)
        .unwrap_or(&uppercase_name);
    if matches!(
        reserved_device_name,
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    ) {
        return Err(ExplorerError::new(
            "invalid_rename_target",
            "Rename target uses a reserved Windows device name.",
        ));
    }

    Ok(trimmed_target_name)
}

#[cfg(test)]
fn allocate_new_folder_name(parent_path: &Path) -> Result<String, ExplorerError> {
    if !parent_path.is_dir() {
        return Err(ExplorerError::new(
            "create_directory_parent_invalid",
            format!("'{}' is not a folder.", parent_path.display()),
        ));
    }

    for index in 1..=u16::MAX {
        let candidate = explorer_new_folder_name(index);
        if !parent_path.join(&candidate).exists() {
            return Ok(candidate);
        }
    }

    Err(ExplorerError::new(
        "create_directory_name_exhausted",
        format!(
            "Could not allocate a unique Explorer-style folder name in '{}'.",
            parent_path.display()
        ),
    ))
}

fn create_directory_with_explorer_name(parent_path: &Path) -> Result<PathBuf, ExplorerError> {
    create_directory_with_explorer_name_using(parent_path, |path| fs::create_dir(path))
}

fn create_directory_with_explorer_name_using<F>(
    parent_path: &Path,
    mut create_dir: F,
) -> Result<PathBuf, ExplorerError>
where
    F: FnMut(&Path) -> std::io::Result<()>,
{
    for sequence in 1..=u16::MAX {
        let folder_name = explorer_new_folder_name(sequence);
        let created_path = parent_path.join(&folder_name);

        match create_dir(&created_path) {
            Ok(()) => return Ok(created_path),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(ExplorerError::new(
                    "create_directory_failed",
                    format!(
                        "Could not create '{}' in '{}': {error}",
                        folder_name,
                        parent_path.display()
                    ),
                ))
            }
        }
    }

    Err(ExplorerError::new(
        "create_directory_name_exhausted",
        format!(
            "Could not allocate a unique Explorer-style folder name in '{}'.",
            parent_path.display()
        ),
    ))
}

fn explorer_new_folder_name(sequence: u16) -> String {
    const BASE_NAME: &str = "New Folder";
    if sequence <= 1 {
        return BASE_NAME.to_string();
    }

    format!("{BASE_NAME} ({sequence})")
}

fn parse_existing_non_directory_path(
    target_path: &str,
    action_verb: &str,
) -> Result<PathBuf, ExplorerError> {
    let parsed_target_path = parse_existing_path(target_path, action_verb)?;
    if parsed_target_path.is_dir() {
        return Err(ExplorerError::new(
            "open_target_is_directory",
            format!(
                "'{}' is a folder. Folders should be navigated, not opened as files.",
                parsed_target_path.display()
            ),
        ));
    }

    Ok(parsed_target_path)
}

fn parse_existing_directory_path(
    target_path: &str,
    action_verb: &str,
) -> Result<PathBuf, ExplorerError> {
    let parsed_target_path = parse_existing_path(target_path, action_verb)?;
    if !parsed_target_path.is_dir() {
        return Err(ExplorerError::new(
            "invalid_directory_target",
            format!("'{}' is not a folder.", parsed_target_path.display()),
        ));
    }

    Ok(parsed_target_path)
}

fn parse_existing_path(target_path: &str, action_verb: &str) -> Result<PathBuf, ExplorerError> {
    let trimmed_target_path = target_path.trim();
    if trimmed_target_path.is_empty() {
        return Err(ExplorerError::new(
            "invalid_path",
            format!("Choose an item to {action_verb}."),
        ));
    }

    let parsed_target_path = PathBuf::from(trimmed_target_path);
    if !parsed_target_path.exists() {
        return Err(ExplorerError::new(
            "path_not_found",
            format!("'{}' no longer exists.", parsed_target_path.display()),
        ));
    }

    Ok(parsed_target_path)
}

fn open_shell_error(target_path: &str, status_code: isize) -> ExplorerError {
    let (code, message) = match status_code {
        2 | 3 => (
            "path_not_found",
            format!("'{}' no longer exists.", target_path),
        ),
        5 => (
            "open_access_denied",
            format!("Windows denied access to '{}'.", target_path),
        ),
        31 => (
            "open_no_association",
            format!("No Windows app is associated with '{}'.", target_path),
        ),
        _ => (
            "open_failed",
            format!("Windows could not open '{}'.", target_path),
        ),
    };

    ExplorerError::new(code, message)
}

fn delete_shell_error(target_path: &str, status_code: i32) -> ExplorerError {
    let (code, message) = match status_code {
        2 | 3 => (
            "path_not_found",
            format!("'{}' no longer exists.", target_path),
        ),
        5 => (
            "delete_access_denied",
            format!("Windows denied access to '{}'.", target_path),
        ),
        _ => (
            "delete_failed",
            format!(
                "Windows could not move '{}' to the Recycle Bin.",
                target_path
            ),
        ),
    };

    ExplorerError::new(code, message)
}

fn wide_null_terminated(value: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    value
        .as_ref()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

fn wide_double_null_terminated(value: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    value
        .as_ref()
        .encode_wide()
        .chain(std::iter::once(0))
        .chain(std::iter::once(0))
        .collect()
}

fn has_hidden_attribute(metadata: &fs::Metadata) -> bool {
    metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN.0 != 0
}

#[cfg(test)]
fn file_attributes_are_hidden(file_attributes: u32) -> bool {
    file_attributes & FILE_ATTRIBUTE_HIDDEN.0 != 0
}

fn searchable_kind_label(kind: &DirectoryItemKind) -> &'static str {
    match kind {
        DirectoryItemKind::Directory => "directory",
        DirectoryItemKind::File => "file",
        DirectoryItemKind::Symlink => "symlink",
        DirectoryItemKind::Other => "other",
    }
}

fn type_label(kind: &DirectoryItemKind) -> &'static str {
    match kind {
        DirectoryItemKind::Directory => "Folder",
        DirectoryItemKind::File => "File",
        DirectoryItemKind::Symlink => "Shortcut",
        DirectoryItemKind::Other => "Other",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(name: &str, path: &str, kind: DirectoryItemKind) -> DirectoryItemStub {
        DirectoryItemStub {
            id: path.to_string(),
            name: name.to_string(),
            path: path.to_string(),
            kind,
            size: None,
            modified_at: None,
            hidden: false,
            readonly: false,
            icon_data_url: None,
            native_icon_state: NativeIconState::Pending,
        }
    }

    #[test]
    fn has_hidden_attribute_checks_windows_hidden_flag() {
        assert!(file_attributes_are_hidden(FILE_ATTRIBUTE_HIDDEN.0));
        assert!(!file_attributes_are_hidden(0));
    }

    #[test]
    fn project_directory_snapshot_filters_without_mutating_source_items() {
        let items = vec![
            item("Alpha", r"C:\\Work\\Alpha.txt", DirectoryItemKind::File),
            item("Beta", r"C:\\Work\\Beta", DirectoryItemKind::Directory),
        ];

        let projected = project_directory_snapshot(&items, Some("beta"), None);

        assert_eq!(projected, vec![items[1].clone()]);
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn project_directory_snapshot_keeps_directories_grouped_when_sorting_by_name_desc() {
        let items = vec![
            item("alpha.txt", r"C:\\Work\\alpha.txt", DirectoryItemKind::File),
            item("Zoo", r"C:\\Work\\Zoo", DirectoryItemKind::Directory),
            item("Beta", r"C:\\Work\\Beta", DirectoryItemKind::Directory),
        ];

        let projected = project_directory_snapshot(
            &items,
            None,
            Some(SortSpec {
                field: SortField::Name,
                direction: SortDirection::Desc,
            }),
        );

        assert_eq!(projected[0].name, "Zoo");
        assert_eq!(projected[1].name, "Beta");
        assert_eq!(projected[2].name, "alpha.txt");
    }

    #[test]
    fn rename_target_rejects_path_separators() {
        let error = parse_rename_target_name(r"Next\Folder").expect_err("separator should fail");

        assert_eq!(error.code, "invalid_rename_target");
    }

    #[test]
    fn rename_target_rejects_parent_navigation_names() {
        let error = parse_rename_target_name("..").expect_err("parent navigation should fail");

        assert_eq!(error.code, "invalid_rename_target");
    }

    #[test]
    fn rename_target_rejects_windows_reserved_characters() {
        let error =
            parse_rename_target_name("report?.txt").expect_err("reserved character should fail");

        assert_eq!(error.code, "invalid_rename_target");
    }

    #[test]
    fn rename_target_rejects_windows_reserved_device_names() {
        let error =
            parse_rename_target_name("con.txt").expect_err("reserved device name should fail");

        assert_eq!(error.code, "invalid_rename_target");
    }

    #[test]
    fn new_folder_name_uses_explorer_sequence() {
        let temp_dir =
            std::env::temp_dir().join(format!("file-explorer-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).expect("temp root");
        fs::create_dir_all(temp_dir.join("New Folder")).expect("first folder");
        fs::create_dir_all(temp_dir.join("New Folder (2)")).expect("second folder");

        let next_name = allocate_new_folder_name(&temp_dir).expect("next name");

        assert_eq!(next_name, "New Folder (3)");
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn create_directory_retries_after_already_exists_error() {
        let temp_dir =
            std::env::temp_dir().join(format!("file-explorer-create-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).expect("temp dir");

        let mut already_exists_injected = false;
        let created_path = create_directory_with_explorer_name_using(&temp_dir, |path| {
            if !already_exists_injected && path.file_name().is_some_and(|name| name == "New Folder")
            {
                already_exists_injected = true;
                return Err(std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    "simulated explorer race",
                ));
            }

            fs::create_dir(path)
        })
        .expect("retry should advance to the next Explorer-style name");

        assert!(already_exists_injected);
        assert_eq!(
            created_path.file_name().and_then(|name| name.to_str()),
            Some("New Folder (2)")
        );
        assert!(created_path.is_dir());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn parse_existing_non_directory_path_rejects_directories() {
        let temp_dir =
            std::env::temp_dir().join(format!("file-explorer-test-dir-{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).expect("temp dir");

        let error = parse_existing_non_directory_path(temp_dir.to_string_lossy().as_ref(), "open")
            .expect_err("directory should fail");

        assert_eq!(error.code, "open_target_is_directory");
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
