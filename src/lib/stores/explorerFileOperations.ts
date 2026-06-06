import { get, writable } from "svelte/store";
import {
  cancelFileOperation,
  resolveFileOperationConflict,
  startFileOperation
} from "$lib/tauri/explorer";
import { explorerSession, getActiveExplorerState } from "$lib/stores/explorerSession";
import { notify } from "$lib/stores/notifications";
import {
  formatFileOperationItemCount,
  getFileOperationErrorMessage,
  normalizeExplorerPathForCompare,
  summarizeFileOperation
} from "$lib/utils/fileOperationText";
import {
  createFileOperationId,
  type DirectoryItemStub,
  type FileConflictId,
  type FileConflictResolution,
  type FileOperationEvent,
  type FileOperationId,
  type FileOperationKind
} from "$lib/types/explorer";

type ExplorerClipboard = {
  kind: FileOperationKind;
  items: DirectoryItemStub[];
} | null;

export type FileOperationView = {
  id: FileOperationId;
  kind: FileOperationKind;
  status: "queued" | "running" | "waiting" | "completed" | "cancelled" | "failed";
  queuePosition: number | null;
  totalItems: number;
  processedItems: number;
  currentPath: string | null;
  completedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string | null;
};

export type FileOperationConflictView = {
  operationId: FileOperationId;
  conflictId: FileConflictId;
  sourcePath: string;
  destinationPath: string;
  name: string;
};

export type ExplorerFileOperationState = {
  clipboard: ExplorerClipboard;
  operations: FileOperationView[];
  pendingConflict: FileOperationConflictView | null;
};

const initialState: ExplorerFileOperationState = {
  clipboard: null,
  operations: [],
  pendingConflict: null
};

const channels = new Map<FileOperationId, { onmessage: ((message: FileOperationEvent) => void) | null }>();

function createExplorerFileOperationsStore() {
  const store = writable<ExplorerFileOperationState>(initialState);

  function setClipboard(kind: FileOperationKind, items: DirectoryItemStub[]) {
    if (items.length === 0) {
      return;
    }

    store.update((state) => ({
      ...state,
      clipboard: {
        kind,
        items: [...items]
      }
    }));

    notify.info(`${kind === "copy" ? "Copied" : "Cut"} ${formatFileOperationItemCount(items.length)} to clipboard`);
  }

  async function pasteInto(destinationDirectory: string) {
    const clipboard = get(store).clipboard;
    if (!clipboard || clipboard.items.length === 0) {
      notify.info("Nothing to paste.");
      return false;
    }

    if (!destinationDirectory.trim()) {
      notify.error("Open a folder before pasting items.");
      return false;
    }

    const operationId = createFileOperationId();
    const operation: FileOperationView = {
      id: operationId,
      kind: clipboard.kind,
      status: "queued",
      queuePosition: null,
      totalItems: clipboard.items.length,
      processedItems: 0,
      currentPath: null,
      completedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      message: null
    };

    store.update((state) => ({
      ...state,
      operations: [...state.operations, operation]
    }));

    try {
      const channel = await startFileOperation(
        {
          operationId,
          kind: clipboard.kind,
          sourcePaths: clipboard.items.map((item) => item.path),
          destinationDirectory,
          defaultConflictResolution: "ask"
        },
        handleFileOperationEvent
      );
      channels.set(operationId, channel);
      return true;
    } catch (error) {
      removeChannel(operationId);
      const message = getFileOperationErrorMessage(error);
      updateOperation(operationId, {
        status: "failed",
        message
      });
      notify.error(message);
      return false;
    }
  }

  async function cancel(operationId: FileOperationId) {
    try {
      await cancelFileOperation({ operationId });
    } catch (error) {
      notify.error(getFileOperationErrorMessage(error));
    }
  }

  async function resolveConflict(
    operationId: FileOperationId,
    conflictId: FileConflictId,
    resolution: Exclude<FileConflictResolution, "ask">
  ) {
    try {
      await resolveFileOperationConflict({ operationId, conflictId, resolution });
      store.update((state) => ({ ...state, pendingConflict: null }));
    } catch (error) {
      notify.error(getFileOperationErrorMessage(error));
    }
  }

  function handleFileOperationEvent(event: FileOperationEvent) {
    switch (event.event) {
      case "queued":
        updateOperation(event.data.operationId, {
          status: "queued",
          queuePosition: event.data.queuePosition
        });
        break;
      case "started":
        updateOperation(event.data.operationId, {
          status: "running",
          totalItems: event.data.totalItems,
          queuePosition: null
        });
        break;
      case "progress":
        updateOperation(event.data.operationId, {
          status: "running",
          processedItems: event.data.processedItems,
          totalItems: event.data.totalItems,
          currentPath: event.data.currentPath
        });
        break;
      case "conflict":
        updateOperation(event.data.operationId, {
          status: "waiting",
          message: `Waiting on conflict for ${event.data.name}`
        });
        store.update((state) => ({
          ...state,
          pendingConflict: {
            operationId: event.data.operationId,
            conflictId: event.data.conflictId,
            sourcePath: event.data.sourcePath,
            destinationPath: event.data.destinationPath,
            name: event.data.name
          }
        }));
        notify.warning(`Conflict while pasting "${event.data.name}". Choose an action in the file operation dialog.`, {
          durationMs: 6000
        });
        break;
      case "completed":
        updateOperation(event.data.operationId, {
          status: event.data.failed.length > 0 ? "failed" : "completed",
          processedItems: event.data.completed.length + event.data.skipped.length + event.data.failed.length,
          completedCount: event.data.completed.length,
          skippedCount: event.data.skipped.length,
          failedCount: event.data.failed.length,
          message: summarizeFileOperation(event.data.kind, event.data.completed.length, event.data.skipped.length, event.data.failed.length)
        });
        handleTerminalOperation(
          event.data.operationId,
          event.data.kind,
          "completed",
          event.data.failed.length,
          event.data.affectedParentPaths
        );
        break;
      case "cancelled":
        updateOperation(event.data.operationId, {
          status: "cancelled",
          completedCount: event.data.completed.length,
          skippedCount: event.data.skipped.length,
          failedCount: event.data.failed.length,
          message: "Operation cancelled"
        });
        handleTerminalOperation(
          event.data.operationId,
          event.data.kind,
          "cancelled",
          event.data.failed.length,
          event.data.affectedParentPaths
        );
        break;
      case "failed":
        updateOperation(event.data.operationId, {
          status: "failed",
          message: event.data.message
        });
        clearPendingConflict(event.data.operationId);
        removeChannel(event.data.operationId);
        notify.error(event.data.message);
        break;
    }
  }

  function updateOperation(operationId: FileOperationId, patch: Partial<FileOperationView>) {
    store.update((state) => ({
      ...state,
      operations: state.operations.map((operation) =>
        operation.id === operationId ? { ...operation, ...patch } : operation
      )
    }));
  }

  function handleTerminalOperation(
    operationId: FileOperationId,
    kind: FileOperationKind,
    status: "completed" | "cancelled",
    failedCount: number,
    affectedParentPaths: string[]
  ) {
    removeChannel(operationId);
    clearPendingConflict(operationId);

    if (status === "completed" && kind === "move" && failedCount === 0) {
      store.update((state) => ({ ...state, clipboard: null }));
    }

    const operation = get(store).operations.find((item) => item.id === operationId);
    if (operation?.status === "completed") {
      notify.success(operation.message ?? "File operation completed.");
    } else if (operation?.status === "cancelled") {
      notify.warning("File operation cancelled.");
    } else if (operation?.message) {
      notify.warning(operation.message);
    }

    if (shouldRefreshCurrentPath(affectedParentPaths)) {
      void explorerSession.refresh();
    }
  }

  return {
    subscribe: store.subscribe,
    setClipboard,
    pasteInto,
    cancel,
    resolveConflict
  };

  function clearPendingConflict(operationId: FileOperationId) {
    store.update((state) => {
      if (state.pendingConflict?.operationId !== operationId) {
        return state;
      }

      return { ...state, pendingConflict: null };
    });
  }
}

function removeChannel(operationId: FileOperationId) {
  const channel = channels.get(operationId);
  if (channel) {
    channel.onmessage = null;
    channels.delete(operationId);
  }
}

function shouldRefreshCurrentPath(affectedParentPaths: string[]) {
  const currentPath = normalizeExplorerPathForCompare(getActiveExplorerState().currentPath);
  return Boolean(currentPath) && affectedParentPaths.some((path) => normalizeExplorerPathForCompare(path) === currentPath);
}

export const explorerFileOperations = createExplorerFileOperationsStore();
