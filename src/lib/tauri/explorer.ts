import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  CancelFileOperationRequest,
  CancelRequest,
  CreateFolderRequest,
  CreateFolderResponse,
  DeleteToRecycleBinRequest,
  DeleteToRecycleBinResponse,
  ExplorerStreamEvent,
  FileOperationEvent,
  NativeIconBatchRequest,
  NativeIconBatchResponse,
  NavigationRequest,
  OpenPathRequest,
  RenameRequest,
  RenameResponse,
  ResolveFileOperationConflictRequest,
  SidebarRoot,
  StartFileOperationRequest
} from "$lib/types/explorer";

export type ExplorerInvokeArgs = Record<string, unknown> | number[] | ArrayBuffer | Uint8Array;

export type ExplorerEventChannel<T> = {
  onmessage: ((message: T) => void) | null;
};

export type ExplorerTauriClient = {
  invoke<T>(command: string, args?: ExplorerInvokeArgs): Promise<T>;
  createChannel<T>(): ExplorerEventChannel<T>;
};

export type ExplorerTauriCall = {
  command: string;
  args?: ExplorerInvokeArgs;
};

export class ExplorerMockChannel<T> implements ExplorerEventChannel<T> {
  onmessage: ((message: T) => void) | null = null;

  emit(message: T) {
    this.onmessage?.(message);
  }
}

export type MockExplorerTauriClient = ExplorerTauriClient & {
  calls: ExplorerTauriCall[];
  channels: ExplorerMockChannel<unknown>[];
  respondWith(command: string, response: unknown): void;
  failWith(command: string, error: unknown): void;
  reset(): void;
};

const runtimeClient: ExplorerTauriClient = {
  invoke: (command, args) => invoke(command, args),
  createChannel: <T>() => new Channel<T>()
};

export function createMockExplorerTauriClient(
  initialResponses: Record<string, unknown> = {}
): MockExplorerTauriClient {
  const calls: ExplorerTauriCall[] = [];
  const channels: ExplorerMockChannel<unknown>[] = [];
  const responses = new Map(Object.entries(initialResponses));
  const failures = new Map<string, unknown>();

  return {
    calls,
    channels,
    async invoke<T>(command: string, args?: ExplorerInvokeArgs) {
      calls.push({ command, args });

      if (failures.has(command)) {
        throw failures.get(command);
      }

      if (responses.has(command)) {
        return responses.get(command) as T;
      }

      throw new Error(`No mock response for command: ${command}`);
    },
    createChannel<T>() {
      const channel = new ExplorerMockChannel<T>();
      channels.push(channel as ExplorerMockChannel<unknown>);
      return channel;
    },
    respondWith(command, response) {
      responses.set(command, response);
      failures.delete(command);
    },
    failWith(command, error) {
      failures.set(command, error);
      responses.delete(command);
    },
    reset() {
      calls.length = 0;
      channels.length = 0;
      responses.clear();
      failures.clear();
      for (const [command, response] of Object.entries(initialResponses)) {
        responses.set(command, response);
      }
    }
  };
}

export function createExplorerTauriApi(client: ExplorerTauriClient = runtimeClient) {
  return {
    listSidebarRoots() {
      return client.invoke<SidebarRoot[]>("list_sidebar_roots");
    },

    async startDirectoryNavigation(
      request: NavigationRequest,
      onMessage: (event: ExplorerStreamEvent) => void
    ) {
      const onEvent = client.createChannel<ExplorerStreamEvent>();
      onEvent.onmessage = onMessage;

      await client.invoke("start_directory_navigation", {
        request,
        onEvent
      });

      return onEvent;
    },

    cancelDirectoryNavigation(request: CancelRequest) {
      return client.invoke("cancel_directory_navigation", { request });
    },

    hydrateDirectoryIcons(request: NativeIconBatchRequest) {
      return client.invoke<NativeIconBatchResponse>("hydrate_directory_icons", { request });
    },

    renameDirectoryItem(request: RenameRequest) {
      return client.invoke<RenameResponse>("rename_directory_item", { request });
    },

    openDirectoryItem(request: OpenPathRequest) {
      return client.invoke("open_directory_item", { request });
    },

    createDirectory(request: CreateFolderRequest) {
      return client.invoke<CreateFolderResponse>("create_directory", { request });
    },

    deleteToRecycleBin(request: DeleteToRecycleBinRequest) {
      return client.invoke<DeleteToRecycleBinResponse>("delete_to_recycle_bin", { request });
    },

    async startFileOperation(
      request: StartFileOperationRequest,
      onMessage: (event: FileOperationEvent) => void
    ) {
      const onEvent = client.createChannel<FileOperationEvent>();
      onEvent.onmessage = onMessage;

      await client.invoke("start_file_operation", {
        request,
        onEvent
      });

      return onEvent;
    },

    cancelFileOperation(request: CancelFileOperationRequest) {
      return client.invoke("cancel_file_operation", { request });
    },

    resolveFileOperationConflict(request: ResolveFileOperationConflictRequest) {
      return client.invoke("resolve_file_operation_conflict", { request });
    }
  };
}

export const {
  listSidebarRoots,
  startDirectoryNavigation,
  cancelDirectoryNavigation,
  hydrateDirectoryIcons,
  renameDirectoryItem,
  openDirectoryItem,
  createDirectory,
  deleteToRecycleBin,
  startFileOperation,
  cancelFileOperation,
  resolveFileOperationConflict
} = createExplorerTauriApi();
