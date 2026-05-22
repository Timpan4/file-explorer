import { get, type Writable } from "svelte/store";
import { createDirectory, deleteToRecycleBin, renameDirectoryItem } from "$lib/tauri/explorer";
import { notify } from "$lib/stores/notifications";
import {
  applyDerivedState,
  clearTransientRenameFallback,
  createMutationRestoreState,
  createRenameRestoreState,
  createTransientDirectoryItem,
  formatDeleteFailureSummary,
  formatDeleteSuccessMessage,
  getErrorMessage,
  getParentPath,
  isSameExplorerPath,
  type ExplorerRestoreState
} from "$lib/stores/explorerSessionHelpers";
import type {
  DeleteToRecycleBinResponse,
  DirectoryItemStub,
  ExplorerState,
  SortSpec
} from "$lib/types/explorer";

type NavigateOptions = {
  skipHistory?: boolean;
  refreshInPlace?: boolean;
  sort?: SortSpec;
  query?: string;
  forceRefresh?: boolean;
  restoreSelection?: boolean;
};

type MutationDeps = {
  store: Writable<ExplorerState>;
  navigate: (path: string, options?: NavigateOptions) => Promise<void>;
  setPendingRestore: (restore: ExplorerRestoreState | null) => void;
};

export function createExplorerMutationActions({ store, navigate, setPendingRestore }: MutationDeps) {
  async function createNewFolder() {
    dismissRenameForContextChange();

    const state = get(store);
    const parentPath = state.currentPath.trim();
    if (!parentPath) {
      notify.error("Open a folder before creating a new folder.");
      return false;
    }

    if (state.activeJobId) {
      return false;
    }

    try {
      const created = await createDirectory({ parentPath });
      setPendingRestore(createMutationRestoreState(state, [created.path], created.path, createTransientDirectoryItem(created)));

      await navigate(parentPath, {
        skipHistory: true,
        refreshInPlace: true,
        forceRefresh: true,
        restoreSelection: true
      });

      return true;
    } catch (error) {
      notify.error(getErrorMessage(error));
      return false;
    }
  }

  async function deleteItems(items: DirectoryItemStub[]) {
    dismissRenameForContextChange();

    if (items.length === 0) {
      return false;
    }

    const selectedPaths = items.map((item) => item.path);

    try {
      const result = await deleteToRecycleBin({ targetPaths: selectedPaths });
      applyDeleteResultState(result);
      await refreshAfterMutation(result.affectedParentPaths);
      notifyDeleteResult(result);
      return result.deleted.length > 0;
    } catch (error) {
      notify.error(getErrorMessage(error));
      return false;
    }
  }

  function cancelRenameIfEditing() {
    const renameState = get(store).rename;
    if (!renameState || renameState.status !== "editing") {
      return false;
    }

    store.update((state) => clearTransientRenameFallback(state));
    return true;
  }

  function dismissRenameForContextChange() {
    const renameState = get(store).rename;
    if (!renameState) {
      return false;
    }

    if (renameState.status === "editing") {
      return cancelRenameIfEditing();
    }

    store.update((state) => clearTransientRenameFallback(state));
    return true;
  }

  function beginRenameSelection() {
    const state = get(store);
    if (state.activeJobId || state.selectedIds.length !== 1) {
      return;
    }

    const item = state.filteredItems.find((candidate) => candidate.id === state.selectedIds[0]);
    if (!item) {
      return;
    }

    const parentPath = getParentPath(item.path);
    if (!parentPath) {
      notify.error(`"${item.name}" cannot be renamed from this location.`);
      return;
    }

    store.update((current) => ({
      ...current,
      rename: {
        itemId: item.id,
        sourcePath: item.path,
        sourceName: item.name,
        parentPath,
        draftName: item.name,
        status: "editing",
        error: null
      }
    }));
  }

  function updateRenameDraft(draftName: string) {
    store.update((state) => {
      if (!state.rename || state.rename.status !== "editing") {
        return state;
      }

      return {
        ...state,
        rename: {
          ...state.rename,
          draftName,
          error: null
        }
      };
    });
  }

  function cancelRename(options: { force?: boolean } = {}) {
    const state = get(store);
    if (!state.rename) {
      return false;
    }

    if (state.rename.status === "submitting" && !options.force) {
      return false;
    }

    store.update((current) => clearTransientRenameFallback(current));
    return true;
  }

  async function submitRename() {
    const renameState = get(store).rename;
    if (!renameState || renameState.status !== "editing") {
      return false;
    }

    const targetName = renameState.draftName.trim();
    if (!targetName) {
      store.update((state) => {
        if (!state.rename || state.rename.itemId !== renameState.itemId) {
          return state;
        }

        return {
          ...state,
          rename: {
            ...state.rename,
            error: "Enter a name before renaming this item."
          }
        };
      });
      notify.error("Enter a name before renaming this item.");
      return false;
    }

    if (targetName === renameState.sourceName) {
      cancelRename();
      return true;
    }

    store.update((state) => {
      if (!state.rename || state.rename.itemId !== renameState.itemId) {
        return state;
      }

      return {
        ...state,
        rename: {
          ...state.rename,
          draftName: targetName,
          status: "submitting",
          error: null
        }
      };
    });

    try {
      const result = await renameDirectoryItem({
        sourcePath: renameState.sourcePath,
        targetName
      });
      const state = get(store);
      const shouldRefreshCurrentFolder = state.currentPath === renameState.parentPath;
      const restoreState = shouldRefreshCurrentFolder
        ? createRenameRestoreState(state, renameState.sourcePath, result.path)
        : null;

      store.update((current) => ({
        ...current,
        rename: null
      }));

      if (shouldRefreshCurrentFolder && restoreState) {
        setPendingRestore(restoreState);
        await navigate(renameState.parentPath, {
          skipHistory: true,
          refreshInPlace: true,
          forceRefresh: true,
          restoreSelection: true
        });
      }

      notify.success(`Renamed "${renameState.sourceName}" to "${result.name}"`);
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      store.update((state) => {
        if (!state.rename || state.rename.itemId !== renameState.itemId) {
          return state;
        }

        return {
          ...state,
          rename: {
            ...state.rename,
            status: "editing",
            error: message
          }
        };
      });
      notify.error(message);
      return false;
    }
  }

  async function refreshAfterMutation(affectedParentPaths: string[]) {
    const { currentPath } = get(store);
    if (!currentPath || !affectedParentPaths.some((path) => isSameExplorerPath(path, currentPath))) {
      store.update((state) => applyDerivedState({
        ...state,
        selectedIds: [],
        focusedItemId: null,
        anchorItemId: null
      }));
      return;
    }

    await navigate(currentPath, {
      skipHistory: true,
      refreshInPlace: true,
      forceRefresh: true,
      restoreSelection: true
    });
  }

  function applyDeleteResultState(result: DeleteToRecycleBinResponse) {
    const deletedIdSet = new Set(result.deleted.map((item) => item.path));
    if (deletedIdSet.size === 0) {
      return;
    }

    store.update((state) => applyDerivedState({
      ...state,
      selectedIds: state.selectedIds.filter((itemId) => !deletedIdSet.has(itemId)),
      focusedItemId: deletedIdSet.has(state.focusedItemId ?? "") ? null : state.focusedItemId,
      anchorItemId: deletedIdSet.has(state.anchorItemId ?? "") ? null : state.anchorItemId
    }));
  }

  function notifyDeleteResult(result: DeleteToRecycleBinResponse) {
    if (result.deleted.length > 0 && result.failed.length === 0) {
      notify.success(formatDeleteSuccessMessage(result.deleted.length));
      return;
    }

    if (result.deleted.length > 0) {
      notify.warning(
        `${formatDeleteSuccessMessage(result.deleted.length)} ${formatDeleteFailureSummary(result.failed)}`
      );
      return;
    }

    notify.error(formatDeleteFailureSummary(result.failed));
  }

  return {
    createNewFolder,
    deleteItems,
    dismissRenameForContextChange,
    beginRenameSelection,
    updateRenameDraft,
    submitRename,
    cancelRename
  };
}
