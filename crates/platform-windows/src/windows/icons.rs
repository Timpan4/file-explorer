use base64::Engine;
use file_explorer_core::directory::{DirectoryItemKind, ExplorerError};
use image::codecs::png::PngEncoder;
use image::{ColorType, ImageEncoder};
use std::collections::{HashMap, VecDeque};
use std::ffi::c_void;
use std::mem::size_of;
use std::ptr::null_mut;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use windows::core::PCWSTR;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBRUSH, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::Win32::UI::Shell::{
    SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_SMALLICON, SHGFI_USEFILEATTRIBUTES,
};
use windows::Win32::UI::WindowsAndMessaging::{
    DestroyIcon, DrawIconEx, GetSystemMetrics, DI_NORMAL, HICON, SM_CXSMICON, SM_CYSMICON,
};

static ICON_CACHE: OnceLock<Mutex<IconCacheState>> = OnceLock::new();
const PATH_ICON_KEY_CACHE_LIMIT: usize = 4096;
const ICON_BLOB_CACHE_LIMIT: usize = 1024;

#[derive(Default)]
struct IconCacheState {
    sidebar_icons: HashMap<String, String>,
    icon_blob_cache: HashMap<String, String>,
    icon_blob_cache_order: VecDeque<String>,
    path_to_icon_key: HashMap<String, String>,
    path_to_icon_key_order: VecDeque<String>,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct IconLookupMetrics {
    pub lookup_ms: u128,
    pub lookup_count: usize,
    pub encode_ms: u128,
}

pub struct DirectoryItemIconLookup {
    pub icon_data_url: Option<String>,
    pub metrics: IconLookupMetrics,
}

pub fn icon_for_sidebar_path(path: &str) -> Option<String> {
    let key = icon_cache_key_for_path(path);
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(IconCacheState::default()));

    if let Ok(guard) = cache.lock() {
        if let Some(cached) = guard.sidebar_icons.get(&key) {
            return Some(cached.clone());
        }
    }

    let sidebar_query = query_for_real_path(path);
    let loaded = load_shell_icon(&sidebar_query, 0, false).ok()?;

    if let Ok(mut guard) = cache.lock() {
        guard.sidebar_icons.insert(key, loaded.data_url.clone());
    }

    Some(loaded.data_url)
}

pub fn hydrate_directory_item_icon(
    path: &str,
    kind: &DirectoryItemKind,
) -> DirectoryItemIconLookup {
    let query = icon_query_for_item(path, kind);
    icon_from_item_query(path, &query)
}

struct IconQuery {
    shell_query: String,
    attributes: u32,
    use_file_attributes: bool,
}

fn icon_query_for_item(path: &str, kind: &DirectoryItemKind) -> IconQuery {
    match kind {
        DirectoryItemKind::Directory => IconQuery {
            shell_query: query_for_real_path(path),
            attributes: 0,
            use_file_attributes: false,
        },
        DirectoryItemKind::File => IconQuery {
            shell_query: query_for_real_path(path),
            attributes: 0,
            use_file_attributes: false,
        },
        DirectoryItemKind::Symlink => IconQuery {
            shell_query: query_for_real_path(path),
            attributes: 0,
            use_file_attributes: false,
        },
        DirectoryItemKind::Other => IconQuery {
            shell_query: query_for_real_path(path),
            attributes: 0,
            use_file_attributes: false,
        },
    }
}

fn query_for_real_path(path: &str) -> String {
    path.to_string()
}

fn icon_from_item_query(path: &str, query: &IconQuery) -> DirectoryItemIconLookup {
    let normalized_path_key = normalized_item_path_key(path);
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(IconCacheState::default()));

    if let Ok(mut guard) = cache.lock() {
        if let Some(icon_key) = guard.path_to_icon_key.get(&normalized_path_key).cloned() {
            if let Some(cached) = guard.icon_blob_cache.get(&icon_key).cloned() {
                push_recent_key(&mut guard.path_to_icon_key_order, &normalized_path_key);
                push_recent_key(&mut guard.icon_blob_cache_order, &icon_key);

                return DirectoryItemIconLookup {
                    icon_data_url: Some(cached),
                    metrics: IconLookupMetrics::default(),
                };
            }
        }
    }

    let loaded = match load_shell_icon(
        &query.shell_query,
        query.attributes,
        query.use_file_attributes,
    ) {
        Ok(loaded) => loaded,
        Err(_) => {
            return DirectoryItemIconLookup {
                icon_data_url: None,
                metrics: IconLookupMetrics {
                    lookup_ms: 0,
                    lookup_count: 1,
                    encode_ms: 0,
                },
            }
        }
    };

    let icon_key = loaded
        .resolved_icon_key
        .clone()
        .unwrap_or_else(|| normalized_path_key.clone());

    if let Ok(mut guard) = cache.lock() {
        remember_path_icon_key(&mut guard, normalized_path_key, icon_key.clone());
        remember_icon_blob(&mut guard, icon_key, loaded.data_url.clone());
    }

    DirectoryItemIconLookup {
        icon_data_url: Some(loaded.data_url),
        metrics: loaded.metrics,
    }
}

fn icon_cache_key_for_path(path: &str) -> String {
    if path.ends_with(':') || path.ends_with(":\\") {
        format!("drive:{}", path.to_ascii_lowercase())
    } else {
        format!("dir:{}", path.to_ascii_lowercase())
    }
}

fn normalized_item_path_key(path: &str) -> String {
    format!("path:{}", path.to_ascii_lowercase())
}

fn remember_path_icon_key(cache: &mut IconCacheState, path_key: String, icon_key: String) {
    cache.path_to_icon_key.insert(path_key.clone(), icon_key);
    push_recent_key(&mut cache.path_to_icon_key_order, &path_key);

    while cache.path_to_icon_key.len() > PATH_ICON_KEY_CACHE_LIMIT {
        let Some(oldest_path_key) = cache.path_to_icon_key_order.pop_front() else {
            break;
        };

        cache.path_to_icon_key.remove(&oldest_path_key);
    }
}

fn remember_icon_blob(cache: &mut IconCacheState, icon_key: String, data_url: String) {
    cache.icon_blob_cache.insert(icon_key.clone(), data_url);
    push_recent_key(&mut cache.icon_blob_cache_order, &icon_key);

    while cache.icon_blob_cache.len() > ICON_BLOB_CACHE_LIMIT {
        let Some(oldest_icon_key) = cache.icon_blob_cache_order.pop_front() else {
            break;
        };

        cache.icon_blob_cache.remove(&oldest_icon_key);
    }
}

fn push_recent_key(order: &mut VecDeque<String>, key: &str) {
    if let Some(index) = order.iter().position(|existing| existing == key) {
        order.remove(index);
    }

    order.push_back(key.to_string());
}

struct LoadedShellIcon {
    data_url: String,
    resolved_icon_key: Option<String>,
    metrics: IconLookupMetrics,
}

fn load_shell_icon(
    query: &str,
    attributes: u32,
    use_file_attributes: bool,
) -> Result<LoadedShellIcon, ExplorerError> {
    let mut file_info = SHFILEINFOW::default();
    let mut flags = SHGFI_ICON | SHGFI_SMALLICON;

    if use_file_attributes {
        flags |= SHGFI_USEFILEATTRIBUTES;
    }

    let query_wide: Vec<u16> = query.encode_utf16().chain(std::iter::once(0)).collect();
    let lookup_started_at = Instant::now();

    let result = unsafe {
        SHGetFileInfoW(
            PCWSTR(query_wide.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(attributes),
            Some(&mut file_info),
            size_of::<SHFILEINFOW>() as u32,
            flags,
        )
    };
    let lookup_ms = lookup_started_at.elapsed().as_millis();

    if result == 0 || file_info.hIcon.0.is_null() {
        return Err(ExplorerError::new(
            "icon_lookup_failed",
            format!("Failed to load Windows shell icon for '{query}'."),
        ));
    }

    let encode_started_at = Instant::now();
    let png_result = unsafe { icon_to_png_bytes(file_info.hIcon) };
    unsafe {
        let _ = DestroyIcon(file_info.hIcon);
    }
    let png = png_result?;
    let encode_ms = encode_started_at.elapsed().as_millis();

    Ok(LoadedShellIcon {
        data_url: format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png)
        ),
        resolved_icon_key: Some(format!("shell-small:{}", file_info.iIcon)),
        metrics: IconLookupMetrics {
            lookup_ms,
            lookup_count: 1,
            encode_ms,
        },
    })
}

unsafe fn icon_to_png_bytes(icon: HICON) -> Result<Vec<u8>, ExplorerError> {
    let width = GetSystemMetrics(SM_CXSMICON).max(16);
    let height = GetSystemMetrics(SM_CYSMICON).max(16);

    let screen_dc = GetDC(None);
    if screen_dc.0.is_null() {
        return Err(ExplorerError::new(
            "icon_dc_failed",
            "Failed to acquire screen device context.",
        ));
    }

    let memory_dc = CreateCompatibleDC(Some(screen_dc));
    if memory_dc.0.is_null() {
        let _ = ReleaseDC(None, screen_dc);
        return Err(ExplorerError::new(
            "icon_dc_failed",
            "Failed to create memory device context.",
        ));
    }

    let mut bitmap_info = BITMAPINFO::default();
    bitmap_info.bmiHeader.biSize = size_of::<BITMAPINFOHEADER>() as u32;
    bitmap_info.bmiHeader.biWidth = width;
    bitmap_info.bmiHeader.biHeight = -height;
    bitmap_info.bmiHeader.biPlanes = 1;
    bitmap_info.bmiHeader.biBitCount = 32;
    bitmap_info.bmiHeader.biCompression = BI_RGB.0;

    let mut bits: *mut c_void = null_mut();
    let bitmap = CreateDIBSection(
        Some(screen_dc),
        &bitmap_info,
        DIB_RGB_COLORS,
        &mut bits,
        None,
        0,
    )
    .map_err(|error| {
        let _ = DeleteDC(memory_dc);
        let _ = ReleaseDC(None, screen_dc);
        ExplorerError::new("icon_bitmap_failed", error.to_string())
    })?;

    if bitmap.0.is_null() || bits.is_null() {
        let _ = DeleteDC(memory_dc);
        let _ = ReleaseDC(None, screen_dc);
        return Err(ExplorerError::new(
            "icon_bitmap_failed",
            "Failed to create icon bitmap surface.",
        ));
    }

    let previous = SelectObject(memory_dc, HGDIOBJ(bitmap.0));
    let draw_result = DrawIconEx(
        memory_dc,
        0,
        0,
        icon,
        width,
        height,
        0,
        Some(HBRUSH::default()),
        DI_NORMAL,
    );

    let png_result = if draw_result.is_ok() {
        let byte_len = (width * height * 4) as usize;
        let bgra = std::slice::from_raw_parts(bits as *const u8, byte_len);
        let mut rgba = vec![0u8; byte_len];

        for (index, chunk) in bgra.chunks_exact(4).enumerate() {
            let base = index * 4;
            rgba[base] = chunk[2];
            rgba[base + 1] = chunk[1];
            rgba[base + 2] = chunk[0];
            rgba[base + 3] = chunk[3];
        }

        let mut png = Vec::new();
        let encoder = PngEncoder::new(&mut png);
        encoder
            .write_image(&rgba, width as u32, height as u32, ColorType::Rgba8.into())
            .map_err(|error| ExplorerError::new("icon_encode_failed", error.to_string()))?;
        Ok(png)
    } else {
        Err(ExplorerError::new(
            "icon_draw_failed",
            "Failed to render Windows shell icon.",
        ))
    };

    let _ = SelectObject(memory_dc, previous);
    let _ = DeleteObject(bitmap.into());
    let _ = DeleteDC(memory_dc);
    let _ = ReleaseDC(None, screen_dc);

    png_result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_icons_use_real_paths() {
        let query = icon_query_for_item(r"C:\Temp\notes.txt", &DirectoryItemKind::File);

        assert_eq!(query.shell_query, r"C:\Temp\notes.txt");
        assert!(!query.use_file_attributes);
    }

    #[test]
    fn extensionless_files_still_use_real_paths() {
        let query = icon_query_for_item(r"C:\Temp\LICENSE", &DirectoryItemKind::File);

        assert_eq!(query.shell_query, r"C:\Temp\LICENSE");
        assert!(!query.use_file_attributes);
    }

    #[test]
    fn directories_use_real_paths() {
        let query = icon_query_for_item(r"C:\Temp\Work", &DirectoryItemKind::Directory);

        assert_eq!(query.shell_query, r"C:\Temp\Work");
        assert!(!query.use_file_attributes);
    }

    #[test]
    fn path_key_normalizes_case() {
        assert_eq!(
            normalized_item_path_key(r"C:\Temp\Work"),
            normalized_item_path_key(r"c:\temp\work")
        );
    }

    #[test]
    fn path_icon_key_cache_evicts_oldest_entry_without_clearing_all() {
        let mut cache = IconCacheState::default();

        for index in 0..=PATH_ICON_KEY_CACHE_LIMIT {
            remember_path_icon_key(&mut cache, format!("path:{index}"), format!("icon:{index}"));
        }

        assert_eq!(cache.path_to_icon_key.len(), PATH_ICON_KEY_CACHE_LIMIT);
        assert!(!cache.path_to_icon_key.contains_key("path:0"));
        assert!(cache
            .path_to_icon_key
            .contains_key(&format!("path:{PATH_ICON_KEY_CACHE_LIMIT}")));
    }

    #[test]
    fn icon_blob_cache_evicts_oldest_blob_without_clearing_all() {
        let mut cache = IconCacheState::default();

        for index in 0..=ICON_BLOB_CACHE_LIMIT {
            remember_icon_blob(&mut cache, format!("icon:{index}"), format!("data:{index}"));
        }

        assert_eq!(cache.icon_blob_cache.len(), ICON_BLOB_CACHE_LIMIT);
        assert!(!cache.icon_blob_cache.contains_key("icon:0"));
        assert!(cache
            .icon_blob_cache
            .contains_key(&format!("icon:{ICON_BLOB_CACHE_LIMIT}")));
    }
}
