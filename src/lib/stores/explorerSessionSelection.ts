import { get, type Writable } from "svelte/store";
import type { DirectoryItemStub, ExplorerState } from "$lib/types/explorer";

type SelectionDeps = {
  store: Writable<ExplorerState>;
  dismissRenameForContextChange: () => boolean;
  openItem: (item: DirectoryItemStub) => Promise<void>;
  cancelCurrentJob: (jobId: string) => Promise<void>;
};

export function createExplorerSelectionActions({
  store,
  dismissRenameForContextChange,
  openItem,
  cancelCurrentJob
}: SelectionDeps) {
  function selectSingle(itemId: string) {
    dismissRenameForContextChange();

    store.update((state) => ({
      ...state,
      selectedIds: [itemId],
      focusedItemId: itemId,
      anchorItemId: itemId
    }));
  }

  function toggleSelection(itemId: string) {
    dismissRenameForContextChange();

    store.update((state) => {
      const nextSelectedIds = state.selectedIds.includes(itemId)
        ? state.selectedIds.filter((id) => id !== itemId)
        : [...state.selectedIds, itemId];

      return {
        ...state,
        selectedIds: nextSelectedIds,
        focusedItemId: itemId,
        anchorItemId: itemId
      };
    });
  }

  function rangeSelectTo(itemId: string) {
    dismissRenameForContextChange();

    store.update((state) => {
      const anchorItemId = state.anchorItemId ?? state.focusedItemId;
      if (!anchorItemId) {
        return {
          ...state,
          selectedIds: [itemId],
          focusedItemId: itemId,
          anchorItemId: itemId
        };
      }

      const anchorIndex = state.filteredItems.findIndex((item) => item.id === anchorItemId);
      const targetIndex = state.filteredItems.findIndex((item) => item.id === itemId);

      if (anchorIndex === -1 || targetIndex === -1) {
        return {
          ...state,
          selectedIds: [itemId],
          focusedItemId: itemId,
          anchorItemId: itemId
        };
      }

      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);

      return {
        ...state,
        selectedIds: state.filteredItems.slice(start, end + 1).map((item) => item.id),
        focusedItemId: itemId,
        anchorItemId
      };
    });
  }

  function selectWithModifiers(
    itemId: string,
    options: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
  ) {
    if (options.shiftKey) {
      rangeSelectTo(itemId);
      return;
    }

    if (options.ctrlKey || options.metaKey) {
      toggleSelection(itemId);
      return;
    }

    selectSingle(itemId);
  }

  function selectAllVisible() {
    dismissRenameForContextChange();

    store.update((state) => ({
      ...state,
      selectedIds: state.filteredItems.map((item) => item.id),
      focusedItemId: state.focusedItemId ?? state.filteredItems[0]?.id ?? null,
      anchorItemId: state.anchorItemId ?? state.filteredItems[0]?.id ?? null
    }));
  }

  function clearSelection() {
    dismissRenameForContextChange();

    store.update((state) => ({
      ...state,
      selectedIds: [],
      focusedItemId: null,
      anchorItemId: null
    }));
  }

  function moveFocus(delta: number) {
    dismissRenameForContextChange();

    const state = get(store);
    if (state.filteredItems.length === 0) {
      return;
    }

    const currentIndex = state.filteredItems.findIndex((item) => item.id === state.focusedItemId);
    const nextIndex = currentIndex === -1
      ? delta < 0
        ? state.filteredItems.length - 1
        : 0
      : Math.max(0, Math.min(state.filteredItems.length - 1, currentIndex + delta));
    const target = state.filteredItems[nextIndex];

    if (target) {
      selectSingle(target.id);
    }
  }

  function focusFirst() {
    dismissRenameForContextChange();

    const first = get(store).filteredItems[0];
    if (first) {
      selectSingle(first.id);
    }
  }

  function focusLast() {
    dismissRenameForContextChange();

    const last = get(store).filteredItems.at(-1);
    if (last) {
      selectSingle(last.id);
    }
  }

  async function openFocused() {
    const state = get(store);
    const target = state.filteredItems.find((item) => item.id === state.focusedItemId)
      ?? state.filteredItems.find((item) => item.id === state.selectedIds[0]);

    if (target) {
      await openItem(target);
    }
  }

  async function cancelActiveNavigation() {
    const activeJobId = get(store).activeJobId;
    if (activeJobId) {
      await cancelCurrentJob(activeJobId);
    }
  }

  return {
    selectSingle,
    toggleSelection,
    rangeSelectTo,
    selectWithModifiers,
    selectAllVisible,
    clearSelection,
    moveFocus,
    focusFirst,
    focusLast,
    openFocused,
    cancelActiveNavigation
  };
}
