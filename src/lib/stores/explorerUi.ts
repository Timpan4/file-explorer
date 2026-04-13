import { readable, type Readable } from "svelte/store";
import { explorerWorkspace } from "$lib/stores/explorerWorkspace";
import {
  createExplorerUiStore,
  getGridTemplate,
  getTableWidth,
  initialExplorerUiState,
  type ExplorerUiState,
  type ExplorerUiStore
} from "$lib/stores/explorerUiCore";

const activeExplorerUiState = readable<ExplorerUiState>(initialExplorerUiState, (set) => {
  let unsubscribeUi: (() => void) | null = null;

  const unsubscribeWorkspace = explorerWorkspace.subscribe(() => {
    unsubscribeUi?.();

    const activeUi = explorerWorkspace.getActiveUi();
    if (!activeUi) {
      set(initialExplorerUiState);
      return;
    }

    unsubscribeUi = activeUi.subscribe((state: ExplorerUiState) => {
      set(state);
    });
  });

  return () => {
    unsubscribeUi?.();
    unsubscribeWorkspace();
  };
}) as Readable<ExplorerUiState>;

function withActiveUi<T>(callback: (ui: ExplorerUiStore) => T, fallback: T) {
  const ui = explorerWorkspace.getActiveUi();
  if (!ui) {
    return fallback;
  }

  return callback(ui);
}

export const explorerUi = {
  subscribe: activeExplorerUiState.subscribe,
  setColumnWidth: (...args: Parameters<ExplorerUiStore["setColumnWidth"]>) =>
    withActiveUi((ui) => ui.setColumnWidth(...args), undefined),
  openContextMenu: (...args: Parameters<ExplorerUiStore["openContextMenu"]>) =>
    withActiveUi((ui) => ui.openContextMenu(...args), undefined),
  closeContextMenu: (...args: Parameters<ExplorerUiStore["closeContextMenu"]>) =>
    withActiveUi((ui) => ui.closeContextMenu(...args), undefined)
} satisfies ExplorerUiStore & Readable<ExplorerUiState>;

export { createExplorerUiStore, getGridTemplate, getTableWidth };
