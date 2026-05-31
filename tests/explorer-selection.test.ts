import { describe, expect, test } from "bun:test";
import { get, writable } from "svelte/store";
import { createExplorerSelectionActions } from "../src/lib/stores/explorerSessionSelection";
import type { DirectoryItemStub, ExplorerState } from "../src/lib/types/explorer";

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

function stateWithItems(items: DirectoryItemStub[]): ExplorerState {
  return {
    roots: [],
    currentPath: "C:\\Work",
    activeJobId: null,
    visibleSnapshotJobId: null,
    snapshotToken: null,
    items,
    filteredItems: items,
    pendingItems: [],
    status: "ready",
    isRefreshing: false,
    error: null,
    totalKnown: items.length,
    pendingTotalKnown: 0,
    lastDurationMs: null,
    sort: { field: "type", direction: "asc" },
    stagedSearchQuery: "",
    appliedSearchQuery: "",
    pendingAppliedSearchQuery: "",
    rename: null,
    selectedIds: [],
    focusedItemId: null,
    anchorItemId: null,
    backHistory: [],
    forwardHistory: []
  };
}

function createActions(initialState: ExplorerState) {
  const store = writable(initialState);
  const opened: DirectoryItemStub[] = [];
  const cancelled: string[] = [];
  let dismissCount = 0;

  const actions = createExplorerSelectionActions({
    store,
    dismissRenameForContextChange: () => {
      dismissCount += 1;
      return false;
    },
    openItem: async (target) => {
      opened.push(target);
    },
    cancelCurrentJob: async (jobId) => {
      cancelled.push(jobId);
    }
  });

  return {
    actions,
    store,
    opened,
    cancelled,
    dismissCount: () => dismissCount
  };
}

describe("explorer selection actions", () => {
  test("selects one item and tracks focus and anchor", () => {
    const { actions, store, dismissCount } = createActions(stateWithItems([item("a"), item("b")]));

    actions.selectSingle("b");

    expect(get(store)).toMatchObject({
      selectedIds: ["b"],
      focusedItemId: "b",
      anchorItemId: "b"
    });
    expect(dismissCount()).toBe(1);
  });

  test("toggles selection without dropping existing selected items", () => {
    const { actions, store } = createActions(stateWithItems([item("a"), item("b"), item("c")]));

    actions.selectSingle("a");
    actions.toggleSelection("c");

    expect(get(store)).toMatchObject({
      selectedIds: ["a", "c"],
      focusedItemId: "c",
      anchorItemId: "c"
    });
  });

  test("range selection uses the current anchor across visible rows", () => {
    const { actions, store } = createActions(stateWithItems([item("a"), item("b"), item("c")]));

    actions.selectSingle("a");
    actions.rangeSelectTo("c");

    expect(get(store)).toMatchObject({
      selectedIds: ["a", "b", "c"],
      focusedItemId: "c",
      anchorItemId: "a"
    });
  });

  test("selects all visible rows and seeds focus when none is focused", () => {
    const { actions, store } = createActions(stateWithItems([item("a"), item("b")]));

    actions.selectAllVisible();

    expect(get(store)).toMatchObject({
      selectedIds: ["a", "b"],
      focusedItemId: "a",
      anchorItemId: "a"
    });
  });

  test("does not create focus or selection when moving through an empty list", () => {
    const { actions, store } = createActions(stateWithItems([]));

    actions.moveFocus(1);

    expect(get(store)).toMatchObject({
      selectedIds: [],
      focusedItemId: null,
      anchorItemId: null
    });
  });

  test("opens the focused item and cancels the active navigation job", async () => {
    const initialState = {
      ...stateWithItems([item("a"), item("b")]),
      activeJobId: "job-1",
      selectedIds: ["a"],
      focusedItemId: "b"
    };
    const { actions, opened, cancelled } = createActions(initialState);

    await actions.openFocused();
    await actions.cancelActiveNavigation();

    expect(opened.map((target) => target.id)).toEqual(["b"]);
    expect(cancelled).toEqual(["job-1"]);
  });
});
