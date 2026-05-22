import { notify } from "$lib/stores/notifications";
import type {
  DeleteToRecycleBinResponse,
  DirectoryItemStub,
  ExplorerOperationType,
  ExplorerRenameState,
  ExplorerState,
  NavigationRequest,
  NativeIconBatchResponse,
  SortField,
  SortSpec
} from "$lib/types/explorer";

export type ExplorerRestoreState = Pick<
  ExplorerState,
  | "selectedIds"
  | "focusedItemId"
  | "anchorItemId"
  | "backHistory"
  | "forwardHistory"
  | "stagedSearchQuery"
  | "appliedSearchQuery"
> & {
  renameItemId?: string | null;
  renameFallbackItem?: DirectoryItemStub | null;
};

export function applyDerivedState(state: ExplorerState): ExplorerState {
  const filteredItems = state.items;
  const selectedIds = state.selectedIds.filter((id) => filteredItems.some((item) => item.id === id));
  const focusedItemId = filteredItems.some((item) => item.id === state.focusedItemId)
    ? state.focusedItemId
    : null;
  const anchorItemId = filteredItems.some((item) => item.id === state.anchorItemId)
    ? state.anchorItemId
    : focusedItemId;

  return {
    ...state,
    filteredItems,
    pendingItems: state.pendingItems,
    selectedIds,
    focusedItemId,
    anchorItemId
  };
}

export function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "An unexpected explorer error occurred.";
}

export function defaultDirectionForField(field: SortField): SortSpec["direction"] {
  switch (field) {
    case "modifiedAt":
    case "size":
      return "desc";
    case "name":
    case "type":
    default:
      return "asc";
  }
}

export function classifyOperation(
  state: ExplorerState,
  targetPath: string,
  request: NavigationRequest,
  options: {
    refreshInPlace?: boolean;
    forceRefresh?: boolean;
  }
): ExplorerOperationType {
  if (options.forceRefresh) {
    return "refresh";
  }

  const nextQuery = request.query ?? "";
  if (nextQuery !== state.appliedSearchQuery) {
    return "search";
  }

  const nextSort = request.sort ?? state.sort;
  if (nextSort.field !== state.sort.field || nextSort.direction !== state.sort.direction) {
    return "sort";
  }

  if (!isSameExplorerPath(targetPath, state.currentPath)) {
    return state.items.length > 0 ? "warm_navigation" : "cold_navigation";
  }

  return options.refreshInPlace ? "warm_navigation" : "cold_navigation";
}

export function shouldPreserveVisibleRows(state: ExplorerState, targetPath: string) {
  return isSameExplorerPath(state.currentPath, targetPath) && state.items.length > 0;
}

export function resolveCompletedOperationType(
  requestedOperationType: ExplorerOperationType | undefined,
  cacheHit: boolean
): ExplorerOperationType {
  if (requestedOperationType === "search" || requestedOperationType === "sort" || requestedOperationType === "refresh") {
    return requestedOperationType;
  }

  return cacheHit ? "warm_navigation" : "cold_navigation";
}

export function createRenameRestoreState(
  state: ExplorerState,
  sourcePath: string,
  renamedPath: string
): ExplorerRestoreState {
  return {
    selectedIds: state.selectedIds.map((itemId) => itemId === sourcePath ? renamedPath : itemId),
    focusedItemId: state.focusedItemId === sourcePath ? renamedPath : state.focusedItemId,
    anchorItemId: state.anchorItemId === sourcePath ? renamedPath : state.anchorItemId,
    backHistory: [...state.backHistory],
    forwardHistory: [...state.forwardHistory],
    stagedSearchQuery: state.stagedSearchQuery,
    appliedSearchQuery: state.appliedSearchQuery,
    renameItemId: null
  };
}

export function createMutationRestoreState(
  state: ExplorerState,
  selectedIds: string[],
  renameItemId: string | null = null,
  renameFallbackItem: DirectoryItemStub | null = null
): ExplorerRestoreState {
  return {
    selectedIds: [...selectedIds],
    focusedItemId: selectedIds[0] ?? null,
    anchorItemId: selectedIds[0] ?? null,
    backHistory: [...state.backHistory],
    forwardHistory: [...state.forwardHistory],
    stagedSearchQuery: state.stagedSearchQuery,
    appliedSearchQuery: state.appliedSearchQuery,
    renameItemId,
    renameFallbackItem
  };
}

export function createRenameStateForItem(state: ExplorerState, itemId: string): NonNullable<ExplorerRenameState> | null {
  const item = state.filteredItems.find((candidate) => candidate.id === itemId);
  if (!item) {
    notify.error("The created folder could not be found after refresh.");
    return null;
  }

  const parentPath = getParentPath(item.path);
  if (!parentPath) {
    notify.error(`"${item.name}" cannot be renamed from this location.`);
    return null;
  }

  return {
    itemId: item.id,
    sourcePath: item.path,
    sourceName: item.name,
    parentPath,
    draftName: item.name,
    status: "editing",
    error: null
  };
}

export function ensureRenameItemVisible(
  state: ExplorerState,
  itemId: string,
  fallbackItem: DirectoryItemStub | null | undefined
) {
  if (state.filteredItems.some((candidate) => candidate.id === itemId) || !fallbackItem) {
    return state;
  }

  return applyDerivedState({
    ...state,
    items: insertVisibleRenameFallback(state.items, fallbackItem, state.sort)
  });
}

export function createTransientDirectoryItem(created: { path: string; name: string; parentPath: string }): DirectoryItemStub {
  return {
    id: created.path,
    path: created.path,
    name: created.name,
    kind: "directory",
    hidden: false,
    readonly: false,
    nativeIconState: "pending"
  };
}

export function clearTransientRenameFallback(state: ExplorerState) {
  const renameState = state.rename;
  if (!renameState) {
    return state;
  }

  const renamedItem = state.items.find((item) => item.id === renameState.itemId);

  const nextState = {
    ...state,
    rename: null
  } satisfies ExplorerState;
  if (!renamedItem || matchesExplorerQuery(renamedItem, state.appliedSearchQuery)) {
    return nextState;
  }

  return applyDerivedState({
    ...nextState,
    items: nextState.items.filter((item) => item.id !== renameState.itemId)
  });
}

export function formatDeleteSuccessMessage(count: number) {
  return count === 1 ? "Moved 1 item to the Recycle Bin." : `Moved ${count} items to the Recycle Bin.`;
}

export function formatDeleteFailureSummary(failures: DeleteToRecycleBinResponse["failed"]) {
  if (failures.length === 0) {
    return "Delete failed.";
  }

  if (failures.length === 1) {
    return failures[0].message;
  }

  return `${failures.length} items could not be moved to the Recycle Bin. ${failures[0].message}`;
}

export function getParentPath(path: string) {
  const normalizedPath = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(normalizedPath.lastIndexOf("\\"), normalizedPath.lastIndexOf("/"));
  if (separatorIndex === -1) {
    return null;
  }

  if (separatorIndex === 2 && normalizedPath[1] === ":") {
    return normalizedPath.slice(0, separatorIndex + 1);
  }

  if (separatorIndex === 0) {
    return normalizedPath.slice(0, 1);
  }

  return normalizedPath.slice(0, separatorIndex);
}

export function isSameExplorerPath(left: string, right: string) {
  return normalizeExplorerPath(left) === normalizeExplorerPath(right);
}

export function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export function mergeHydratedIcons(items: DirectoryItemStub[], response: NativeIconBatchResponse["items"]) {
  if (response.length === 0) {
    return items;
  }

  const hydratedByPath = new Map(response.map((item) => [item.path, item]));
  let changed = false;

  const nextItems = items.map((item) => {
    const hydrated = hydratedByPath.get(item.path);
    if (!hydrated) {
      return item;
    }

    changed = true;
    return {
      ...item,
      iconDataUrl: hydrated.iconDataUrl,
      nativeIconState: hydrated.nativeIconState
    };
  });

  return changed ? nextItems : items;
}

export function updateNativeIconState(
  items: DirectoryItemStub[],
  paths: Set<string>,
  nextState: DirectoryItemStub["nativeIconState"]
) {
  let changed = false;

  const nextItems = items.map((item) => {
    if (!paths.has(item.path) || item.nativeIconState === nextState || item.nativeIconState === "ready") {
      return item;
    }

    changed = true;
    return {
      ...item,
      nativeIconState: nextState
    };
  });

  return changed ? nextItems : items;
}

export function resetObsoleteLoadingIconState(items: DirectoryItemStub[]) {
  let changed = false;

  const nextItems = items.map((item) => {
    if (item.nativeIconState !== "loading") {
      return item;
    }

    changed = true;
    return {
      ...item,
      nativeIconState: "pending" as const
    };
  });

  return changed ? nextItems : items;
}

function insertVisibleRenameFallback(items: DirectoryItemStub[], fallbackItem: DirectoryItemStub, sort: SortSpec) {
  if (items.some((item) => item.id === fallbackItem.id)) {
    return items;
  }

  const nextItems = [...items, fallbackItem];
  return sortDirectoryItems(nextItems, sort);
}

function sortDirectoryItems(items: DirectoryItemStub[], sort: SortSpec) {
  return [...items].sort((left, right) => compareDirectoryItems(left, right, sort));
}

function compareDirectoryItems(left: DirectoryItemStub, right: DirectoryItemStub, sort: SortSpec) {
  const directoryBias = compareDirectoryBias(left.kind, right.kind);
  if (directoryBias !== 0) {
    return directoryBias;
  }

  const ordering = compareSortValue(left, right, sort.field);
  if (ordering !== 0) {
    return sort.direction === "asc" ? ordering : -ordering;
  }

  return compareText(left.name, right.name);
}

function compareDirectoryBias(leftKind: DirectoryItemStub["kind"], rightKind: DirectoryItemStub["kind"]) {
  const leftIsFolderGroup = leftKind === "directory" || leftKind === "symlink";
  const rightIsFolderGroup = rightKind === "directory" || rightKind === "symlink";

  if (leftIsFolderGroup && !rightIsFolderGroup) {
    return -1;
  }

  if (!leftIsFolderGroup && rightIsFolderGroup) {
    return 1;
  }

  return 0;
}

function compareSortValue(left: DirectoryItemStub, right: DirectoryItemStub, field: SortField) {
  switch (field) {
    case "name":
      return compareText(left.name, right.name);
    case "type":
      return compareText(typeLabel(left.kind), typeLabel(right.kind));
    case "modifiedAt":
      return compareNullableText(left.modifiedAt, right.modifiedAt);
    case "size":
      return compareNullableNumber(left.size, right.size);
    default:
      return 0;
  }
}

function compareText(left: string, right: string) {
  if (left.toLowerCase() < right.toLowerCase()) {
    return -1;
  }

  if (left.toLowerCase() > right.toLowerCase()) {
    return 1;
  }

  return 0;
}

function compareNullableText(left?: string, right?: string) {
  const safeLeft = left ?? "";
  const safeRight = right ?? "";
  return compareText(safeLeft, safeRight);
}

function compareNullableNumber(left?: number, right?: number) {
  const safeLeft = left ?? -1;
  const safeRight = right ?? -1;
  if (safeLeft < safeRight) {
    return -1;
  }

  if (safeLeft > safeRight) {
    return 1;
  }

  return 0;
}

function typeLabel(kind: DirectoryItemStub["kind"]) {
  switch (kind) {
    case "directory":
      return "Folder";
    case "file":
      return "File";
    case "symlink":
      return "Shortcut";
    default:
      return "Other";
  }
}

function matchesExplorerQuery(item: DirectoryItemStub, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return `${item.name} ${searchableKindLabel(item.kind)} ${item.path}`.toLowerCase().includes(normalizedQuery);
}

function searchableKindLabel(kind: DirectoryItemStub["kind"]) {
  switch (kind) {
    case "directory":
      return "directory";
    case "file":
      return "file";
    case "symlink":
      return "symlink";
    default:
      return "other";
  }
}

function normalizeExplorerPath(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}
