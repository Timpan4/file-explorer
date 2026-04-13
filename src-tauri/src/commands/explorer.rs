use crate::explorer::service::ExplorerService;
use crate::ipc::directory::{
    CancelRequest, CreateFolderRequest, CreateFolderResponse, DeleteToRecycleBinRequest,
    DeleteToRecycleBinResponse, ExplorerError, NativeIconBatchRequest, NativeIconBatchResponse,
    NavigationRequest, OpenPathRequest, RenameRequest, RenameResponse, SidebarRoot,
};
use std::sync::Arc;
use tauri::{ipc::Channel, State};

#[tauri::command]
pub fn start_directory_navigation(
    explorer: State<'_, Arc<ExplorerService>>,
    request: NavigationRequest,
    on_event: Channel<crate::ipc::directory::ExplorerStreamEvent>,
) -> Result<(), ExplorerError> {
    explorer.start_navigation(request, on_event)
}

#[tauri::command]
pub fn cancel_directory_navigation(
    explorer: State<'_, Arc<ExplorerService>>,
    request: CancelRequest,
) -> Result<(), ExplorerError> {
    explorer.cancel_job(&request.job_id)
}

#[tauri::command]
pub fn list_sidebar_roots(
    explorer: State<'_, Arc<ExplorerService>>,
) -> Result<Vec<SidebarRoot>, ExplorerError> {
    explorer.list_sidebar_roots()
}

#[tauri::command]
pub fn hydrate_directory_icons(
    explorer: State<'_, Arc<ExplorerService>>,
    request: NativeIconBatchRequest,
) -> Result<NativeIconBatchResponse, ExplorerError> {
    explorer.hydrate_directory_icons(request)
}

#[tauri::command]
pub fn rename_directory_item(
    explorer: State<'_, Arc<ExplorerService>>,
    request: RenameRequest,
) -> Result<RenameResponse, ExplorerError> {
    explorer.rename_directory_item(request)
}

#[tauri::command]
pub fn open_directory_item(
    explorer: State<'_, Arc<ExplorerService>>,
    request: OpenPathRequest,
) -> Result<(), ExplorerError> {
    explorer.open_directory_item(request)
}

#[tauri::command]
pub fn create_directory(
    explorer: State<'_, Arc<ExplorerService>>,
    request: CreateFolderRequest,
) -> Result<CreateFolderResponse, ExplorerError> {
    explorer.create_directory(request)
}

#[tauri::command]
pub fn delete_to_recycle_bin(
    explorer: State<'_, Arc<ExplorerService>>,
    request: DeleteToRecycleBinRequest,
) -> Result<DeleteToRecycleBinResponse, ExplorerError> {
    explorer.delete_to_recycle_bin(request)
}
