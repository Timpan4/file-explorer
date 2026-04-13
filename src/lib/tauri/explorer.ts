import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  CancelRequest,
  CreateFolderRequest,
  CreateFolderResponse,
  DeleteToRecycleBinRequest,
  DeleteToRecycleBinResponse,
  ExplorerStreamEvent,
  NativeIconBatchRequest,
  NativeIconBatchResponse,
  NavigationRequest,
  OpenPathRequest,
  RenameRequest,
  RenameResponse,
  SidebarRoot
} from "$lib/types/explorer";

export async function listSidebarRoots() {
  return invoke<SidebarRoot[]>("list_sidebar_roots");
}

export async function startDirectoryNavigation(
  request: NavigationRequest,
  onMessage: (event: ExplorerStreamEvent) => void
) {
  const onEvent = new Channel<ExplorerStreamEvent>();
  onEvent.onmessage = onMessage;

  await invoke("start_directory_navigation", {
    request,
    onEvent
  });

  return onEvent;
}

export async function cancelDirectoryNavigation(request: CancelRequest) {
  return invoke("cancel_directory_navigation", { request });
}

export async function hydrateDirectoryIcons(request: NativeIconBatchRequest) {
  return invoke<NativeIconBatchResponse>("hydrate_directory_icons", { request });
}

export async function renameDirectoryItem(request: RenameRequest) {
  return invoke<RenameResponse>("rename_directory_item", { request });
}

export async function openDirectoryItem(request: OpenPathRequest) {
  return invoke("open_directory_item", { request });
}

export async function createDirectory(request: CreateFolderRequest) {
  return invoke<CreateFolderResponse>("create_directory", { request });
}

export async function deleteToRecycleBin(request: DeleteToRecycleBinRequest) {
  return invoke<DeleteToRecycleBinResponse>("delete_to_recycle_bin", { request });
}
