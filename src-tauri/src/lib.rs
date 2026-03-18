use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapSummary {
    product_name: &'static str,
    target_platform: &'static str,
    renderer: &'static str,
    backend: &'static str,
    strategy: &'static str,
}

#[tauri::command]
fn get_bootstrap_summary() -> BootstrapSummary {
    BootstrapSummary {
        product_name: "File Explorer",
        target_platform: "Windows-first",
        renderer: "SvelteKit via Tauri",
        backend: "Rust",
        strategy: "Renderer-only frontend, Rust-owned logic, streaming directory data, virtualization everywhere",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_bootstrap_summary])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
