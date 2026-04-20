mod commands;
mod explorer;

use explorer::service::ExplorerService;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let explorer = Arc::new(ExplorerService::new());

    tauri::Builder::default()
        .manage(explorer)
        .invoke_handler(tauri::generate_handler![
            commands::explorer::start_directory_navigation,
            commands::explorer::cancel_directory_navigation,
            commands::explorer::list_sidebar_roots,
            commands::explorer::hydrate_directory_icons,
            commands::explorer::rename_directory_item,
            commands::explorer::open_directory_item,
            commands::explorer::create_directory,
            commands::explorer::delete_to_recycle_bin
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
