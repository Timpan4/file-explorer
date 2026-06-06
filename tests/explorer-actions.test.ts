import { describe, expect, test } from "bun:test";
import { getActionsForSurface } from "../src/lib/stores/explorerActionCatalog";
import type { ExplorerActionContext } from "../src/lib/types/actions";
import type { DirectoryItemStub } from "../src/lib/types/explorer";

function item(id: string): DirectoryItemStub {
  return {
    id,
    name: `${id}.txt`,
    path: `C:\\Work\\${id}.txt`,
    kind: "file",
    hidden: false,
    readonly: false,
    nativeIconState: "pending"
  };
}

function context(patch: Partial<ExplorerActionContext> = {}): ExplorerActionContext {
  const selectedItems = patch.selectedItems ?? [];
  return {
    currentPath: "C:\\Work",
    selectedItems,
    selectedCount: selectedItems.length,
    hasSelection: selectedItems.length > 0,
    clipboardAvailable: false,
    ...patch
  };
}

describe("explorer action surfaces", () => {
  test("only exposes actions backed by real behavior", () => {
    const selectedContext = context({ selectedItems: [item("report")], clipboardAvailable: true });

    expect(getActionsForSurface("command-bar", selectedContext).map((action) => action.id)).toEqual([
      "new-folder",
      "rename",
      "delete",
      "cut",
      "copy",
      "paste"
    ]);
    expect(getActionsForSurface("row-menu", selectedContext).map((action) => action.id)).toEqual([
      "open",
      "rename",
      "delete",
      "cut",
      "copy",
      "paste"
    ]);
    expect(getActionsForSurface("background-menu", selectedContext).map((action) => action.id)).toEqual([
      "refresh",
      "new-folder",
      "paste"
    ]);
  });

  test("disables selection and clipboard actions when their inputs are missing", () => {
    const actions = getActionsForSurface("command-bar", context());
    const enabledById = new Map(actions.map((action) => [action.id, action.enabled]));

    expect(enabledById.get("new-folder")).toBe(true);
    expect(enabledById.get("rename")).toBe(false);
    expect(enabledById.get("delete")).toBe(false);
    expect(enabledById.get("cut")).toBe(false);
    expect(enabledById.get("copy")).toBe(false);
    expect(enabledById.get("paste")).toBe(false);
  });
});
