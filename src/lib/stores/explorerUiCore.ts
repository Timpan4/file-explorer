import { writable } from "svelte/store";

export type ExplorerUiState = {
  columnWidths: {
    name: number;
    type: number;
    modifiedAt: number;
    size: number;
  };
  contextMenu: {
    open: boolean;
    x: number;
    y: number;
    surface: "row-menu" | "background-menu";
  };
};

export const initialExplorerUiState: ExplorerUiState = {
  columnWidths: { name: 420, type: 140, modifiedAt: 180, size: 120 },
  contextMenu: { open: false, x: 0, y: 0, surface: "background-menu" }
};

export type ExplorerUiStore = ReturnType<typeof createExplorerUiStore>;

export function createExplorerUiStore() {
  const store = writable(initialExplorerUiState);
  return {
    subscribe: store.subscribe,
    setColumnWidth(column: keyof ExplorerUiState["columnWidths"], width: number) {
      store.update((state) => ({
        ...state,
        columnWidths: { ...state.columnWidths, [column]: Math.max(80, Math.round(width)) }
      }));
    },
    openContextMenu(surface: ExplorerUiState["contextMenu"]["surface"], x: number, y: number) {
      store.update((state) => ({ ...state, contextMenu: { open: true, x, y, surface } }));
    },
    closeContextMenu() {
      store.update((state) => ({ ...state, contextMenu: { ...state.contextMenu, open: false } }));
    }
  };
}

export function getGridTemplate(widths: ExplorerUiState["columnWidths"]) {
  return `${widths.name}px ${widths.type}px ${widths.modifiedAt}px ${widths.size}px`;
}

export function getTableWidth(widths: ExplorerUiState["columnWidths"], gap: number = 12) {
  return widths.name + widths.type + widths.modifiedAt + widths.size + gap * 3;
}
