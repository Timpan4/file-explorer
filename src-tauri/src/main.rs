// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{read_dir, DirEntry};
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sysinfo::{Disk, Disks, System};
use mime;
use std::str::FromStr;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    if name.is_empty() {
        return "Hello, World! Please provide a name for greeting.".to_string();
    }
    format!("Hello, {}! You've been greeted from Rust again!", name)
}

#[derive(Serialize)]
struct Volume {
    name: String,
    mount_point: PathBuf,
    available_space: u64,
    total_space: u64,
    used_space: u64,
}

impl Volume {
    fn new(disk: &Disk) -> Self {
        let name = disk.name().to_os_string().into_string().unwrap();
        let mount_point = disk.mount_point().to_path_buf();
        let available_space = disk.available_space();
        let total_space = disk.total_space();
        let used_space = total_space - available_space;
        Self {
            name,
            mount_point,
            available_space,
            total_space,
            used_space,
        }
    }
}

#[tauri::command]
fn get_volumes() -> Result<Vec<Volume>, String> {
    let mut volumes = Vec::new();
    let mut system = System::new_all();
    system.refresh_all();

    let disks = Disks::new_with_refreshed_list();

    for disk in disks.list() {
        println!("{:?}", disk);
        volumes.push(Volume::new(disk));
    }
    Ok(volumes)
}
#[derive(Serialize)]
struct DirItem {
    name: String,
    path: String,
    is_dir: bool,
    last_modified: String,
    size: u64,
    file_type: String,
}

impl DirItem {
    fn new(entry: &DirEntry) -> Self {
        let name = entry.file_name().to_str().unwrap().to_string();
        let path = entry.path().to_str().unwrap().to_string();
        let is_dir = entry.file_type().unwrap().is_dir();
        let last_modified_raw: DateTime<Utc> = entry.metadata().unwrap().modified().unwrap().into();
        let size = entry.metadata().unwrap().len();

        let last_modified = last_modified_raw.format("%Y-%m-%d %H:%M:%S").to_string();

        let file_type = if is_dir {
            "Folder".to_string()
        } else {
            let mime_type = mime_guess::from_path(&entry.path());
            if let Some(m) = mime_type.first() {
                if m.type_() == mime::Mime::from_str("application/octet-stream").unwrap().type_() && m.subtype() == mime::Mime::from_str("application/octet-stream").unwrap().subtype() {
                    // Fallback to extension if it's octet-stream
                    if let Some(ext) = entry.path().extension() {
                        match ext.to_str().unwrap_or("File").to_uppercase().as_str() {
                            "LNK" => "Shortcut".to_string(), // Windows shortcut
                            "EXE" | "MSI" | "APP" => "Application".to_string(),
                            _ => ext.to_str().unwrap_or("File").to_uppercase(),
                        }
                    } else {
                        "File".to_string()
                    }
                } else {
                    match m.type_().as_str() {
                        "image" => "Image".to_string(),
                        "video" => "Video".to_string(),
                        "audio" => "Audio".to_string(),
                        "text" => "Text Document".to_string(),
                        "application" => match m.subtype().as_str() {
                            "pdf" => "PDF Document".to_string(),
                            "zip" | "x-tar" | "x-7z-compressed" | "x-rar-compressed" => "Archive".to_string(),
                            "vnd.microsoft.portable-executable" => "Application".to_string(), // .exe
                            _ => m.subtype().as_str().to_uppercase(),
                        },
                        _ => m.subtype().as_str().to_uppercase(),
                    }
                }
            } else {
                // Fallback to extension if no mime type is found
                if let Some(ext) = entry.path().extension() {
                    match ext.to_str().unwrap_or("File").to_uppercase().as_str() {
                        "LNK" => "Shortcut".to_string(), // Windows shortcut
                        "EXE" | "MSI" | "APP" => "Application".to_string(),
                        _ => ext.to_str().unwrap_or("File").to_uppercase(),
                    }
                } else {
                    "File".to_string()
                }
            }
        };

        println!("{:?}", size);

        Self {
            name,
            path,
            is_dir,
            last_modified,
            size,
            file_type,
        }
    }
}

#[tauri::command]
fn get_directory(path: String) -> Result<Vec<DirItem>, ()> {
    let Ok(directory) = read_dir(path) else {
        return Ok(Vec::new());
    };

    Ok(directory
        .map(|entry| {
            let entry = entry.unwrap();

            DirItem::new(&entry)
        })
        .collect())
}

fn main() {
    let _ = get_volumes();
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_volumes,
            get_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}