import { describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  createExplorerUiStore,
  getGridTemplate,
  getTableWidth,
  initialExplorerUiState
} from "../src/lib/stores/explorerUiCore";

describe("explorer UI helpers", () => {
  test("builds stable grid template and table width values", () => {
    expect(getGridTemplate(initialExplorerUiState.columnWidths)).toBe("420px 140px 180px 120px");
    expect(getTableWidth(initialExplorerUiState.columnWidths)).toBe(896);
    expect(getTableWidth(initialExplorerUiState.columnWidths, 8)).toBe(884);
  });

  test("rounds column widths and clamps them to the minimum", () => {
    const ui = createExplorerUiStore();

    ui.setColumnWidth("name", 42.2);
    ui.setColumnWidth("size", 130.8);

    expect(get(ui).columnWidths).toMatchObject({
      name: 80,
      size: 131
    });
  });

  test("opens and closes context menus without changing placement state", () => {
    const ui = createExplorerUiStore();

    ui.openContextMenu("row-menu", 20, 30);
    expect(get(ui).contextMenu).toEqual({ open: true, x: 20, y: 30, surface: "row-menu" });

    ui.closeContextMenu();
    expect(get(ui).contextMenu).toEqual({ open: false, x: 20, y: 30, surface: "row-menu" });
  });
});
