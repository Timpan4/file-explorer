import { get, writable } from "svelte/store";
import {
  cancelDirectoryNavigation,
  createDirectory,
  deleteToRecycleBin,
  hydrateDirectoryIcons,
  listSidebarRoots,
  openDirectoryItem,
  renameDirectoryItem,
  startDirectoryNavigation
} from "$lib/tauri/explorer";
import { notify } from "$lib/stores/notifications";
import {
  completeExplorerTrace,
  markExplorerTraceStage,
  startExplorerTrace,
  updateExplorerTraceOperation
} from "$lib/utils/explorerTimingTrace";
import { settings } from "$lib/stores/settings";
import type {
  DirectoryItemStub,
  DeleteToRecycleBinResponse,
  ExplorerOperationType,
  ExplorerRenameState,
  ExplorerState,
  ExplorerStreamEvent,
  ExplorerTabId,
  ExplorerTabSnapshot,
  NativeIconBatchResponse,
  NavigationRequest,
  SortField,
  SortSpec,
  SidebarRoot
} from "$lib/types/explorer";
import { createJobId } from "$lib/types/explorer";

const DEFAULT_SORT: SortSpec = { field: "type", direction: "asc" };

export const initialExplorerState: ExplorerState = {
  roots: [],
  currentPath: "",
  activeJobId: null,
  visibleSnapshotJobId: null,
  snapshotToken: null,
  items: [],
  filteredItems: [],
  pendingItems: [],
  status: "idle",
  isRefreshing: false,
  error: null,
  totalKnown: 0,
  pendingTotalKnown: 0,
  lastDurationMs: null,
  sort: DEFAULT_SORT,
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

type ExplorerSessionInitOptions = {
  path?: string;
  snapshot?: Partial<ExplorerTabSnapshot>;
};

type ExplorerRestoreState = Pick<
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

export type ExplorerSession = ReturnType<typeof createExplorerSession>;

export function createExplorerSession(tabId: ExplorerTabId) {
  const store = writable<ExplorerState>(initialExplorerState);
  let currentChannel: { onmessage: ((message: ExplorerStreamEvent) => void) | null } | null = null;
  let pendingRestore: ExplorerRestoreState | null = null;
  const operationTypes = new Map<string, ExplorerOperationType>();
  const queuedIconHydrationKinds = new Map<string, DirectoryItemStub["kind"]>();
  const inflightIconHydrationGenerations = new Map<string, number>();
  let iconHydrationTimer: ReturnType<typeof setTimeout> | null = null;
  let iconHydrationGeneration = 0;

  async function initialize(options: ExplorerSessionInitOptions = {}) {
    try {
      const roots = await listSidebarRoots();
      const snapshot = options.snapshot;
      store.update((state) => applyDerivedState({
        ...state,
        roots,
        sort: snapshot?.sort ?? state.sort,
        stagedSearchQuery: snapshot?.stagedSearchQuery ?? state.stagedSearchQuery,
        appliedSearchQuery: snapshot?.appliedSearchQuery ?? state.appliedSearchQuery,
        pendingAppliedSearchQuery: snapshot?.appliedSearchQuery ?? state.pendingAppliedSearchQuery,
        backHistory: [...(snapshot?.backHistory ?? state.backHistory)],
        forwardHistory: [...(snapshot?.forwardHistory ?? state.forwardHistory)]
      }));

      pendingRestore = snapshot
        ? {
            selectedIds: [...(snapshot.selectedIds ?? [])],
            focusedItemId: snapshot.focusedItemId ?? null,
            anchorItemId: snapshot.anchorItemId ?? null,
            backHistory: [...(snapshot.backHistory ?? [])],
            forwardHistory: [...(snapshot.forwardHistory ?? [])],
            stagedSearchQuery: snapshot.stagedSearchQuery ?? "",
            appliedSearchQuery: snapshot.appliedSearchQuery ?? ""
          }
        : null;

      const initialPath = options.path ?? snapshot?.currentPath ?? roots[0]?.path;
      if (initialPath) {
        await navigate(initialPath, {
          skipHistory: true,
          sort: snapshot?.sort,
          query: snapshot?.appliedSearchQuery,
          restoreSelection: Boolean(snapshot)
        });
      }
    } catch (error) {
      pendingRestore = null;
      store.update((state) =>
        applyDerivedState({
          ...state,
          status: "error",
          error: getErrorMessage(error),
          roots: []
        })
      );
    }
  }

  async function refreshRoots() {
    const roots = await listSidebarRoots();
    store.update((state) => applyDerivedState({ ...state, roots }));
    return roots;
  }

  async function navigate(
    path: string,
    options: {
      skipHistory?: boolean;
      refreshInPlace?: boolean;
      sort?: SortSpec;
      query?: string;
      forceRefresh?: boolean;
      restoreSelection?: boolean;
    } = {}
  ) {
    const targetPath = path.trim();
    if (!targetPath) {
      return;
    }

    dismissRenameForContextChange();

    invalidateIconHydration();

    const beforeNavigate = get(store);
    const preserveVisibleRows = shouldPreserveVisibleRows(beforeNavigate, targetPath);
    if (!options.skipHistory && beforeNavigate.currentPath && beforeNavigate.currentPath !== targetPath) {
      store.update((state) => ({
        ...state,
        backHistory: [...state.backHistory, state.currentPath],
        forwardHistory: []
      }));
    }

    const previousJobId = get(store).activeJobId;
    if (previousJobId) {
      await cancelCurrentJob(previousJobId);
      completeExplorerTrace(previousJobId, {
        outcome: "cancelled",
        error: { reason: "superseded" }
      });
      operationTypes.delete(previousJobId);
    }

    const jobId = createJobId();
    const request: NavigationRequest = {
      jobId,
      tabId,
      path: targetPath,
      query: options.query ?? beforeNavigate.stagedSearchQuery,
      sort: options.sort ?? beforeNavigate.sort,
      includeHidden: false,
      forceRefresh: Boolean(options.forceRefresh),
      viewportHint: {
        start: 0,
        count: 120
      }
    };

    const requestedOperationType = classifyOperation(beforeNavigate, targetPath, request, options);

    startExplorerTrace({
      jobId,
      tabId,
      path: targetPath,
      query: request.query ?? "",
      sort: request.sort ?? beforeNavigate.sort,
      operationType: requestedOperationType
    });
    operationTypes.set(jobId, requestedOperationType);

    if (!options.restoreSelection) {
      pendingRestore = null;
    }

    store.update((state) =>
      applyDerivedState({
          ...state,
          currentPath: targetPath,
          activeJobId: jobId,
          snapshotToken: null,
        items: preserveVisibleRows ? state.items : [],
        pendingItems: [],
        status: "loading",
        isRefreshing: preserveVisibleRows,
        error: null,
        totalKnown: preserveVisibleRows ? state.totalKnown : 0,
        pendingTotalKnown: preserveVisibleRows ? state.totalKnown : 0,
        lastDurationMs: null,
        sort: options.sort ?? state.sort,
        pendingAppliedSearchQuery: request.query ?? "",
        selectedIds: preserveVisibleRows ? state.selectedIds : [],
        focusedItemId: preserveVisibleRows ? state.focusedItemId : null,
        anchorItemId: preserveVisibleRows ? state.anchorItemId : null
      })
    );
    markExplorerTraceStage(jobId, "state_loading_committed", {
      preserveVisibleRows,
      itemCountBefore: beforeNavigate.items.length
    });

    const artificialDelayMs = get(settings).artificialNavDelayMs;
    if (artificialDelayMs > 0) {
      await delay(artificialDelayMs);
    }

    try {
      markExplorerTraceStage(jobId, "invoke_start", {
        artificialDelayMs,
        forceRefresh: request.forceRefresh ?? false
      });
      currentChannel = await startDirectoryNavigation(request, handleStreamEvent);
      markExplorerTraceStage(jobId, "invoke_resolved");
    } catch (error) {
      pendingRestore = null;
      currentChannel = null;
      const message = getErrorMessage(error);
      operationTypes.delete(jobId);
      completeExplorerTrace(jobId, {
        outcome: "failed",
        error: {
          code: "invoke_failed",
          message
        }
      });

      store.update((state) =>
        applyDerivedState({
          ...state,
          activeJobId: null,
          snapshotToken: null,
          pendingItems: [],
          pendingTotalKnown: 0,
          status: "error",
          isRefreshing: false,
          error: message,
          pendingAppliedSearchQuery: state.appliedSearchQuery
        })
      );
    }
  }

  async function refresh() {
    const { currentPath } = get(store);
    if (currentPath) {
      await navigate(currentPath, { skipHistory: true, refreshInPlace: true, forceRefresh: true });
    }
  }

  async function goBack() {
    const state = get(store);
    const previousPath = state.backHistory.at(-1);
    if (!previousPath) {
      return;
    }

    store.update((current) => ({
      ...current,
      backHistory: current.backHistory.slice(0, -1),
      forwardHistory: current.currentPath ? [...current.forwardHistory, current.currentPath] : current.forwardHistory
    }));

    await navigate(previousPath, { skipHistory: true });
  }

  async function goForward() {
    const state = get(store);
    const nextPath = state.forwardHistory.at(-1);
    if (!nextPath) {
      return;
    }

    store.update((current) => ({
      ...current,
      forwardHistory: current.forwardHistory.slice(0, -1),
      backHistory: current.currentPath ? [...current.backHistory, current.currentPath] : current.backHistory
    }));

    await navigate(nextPath, { skipHistory: true });
  }

  async function goUp() {
    const { currentPath } = get(store);
    const normalized = currentPath.replace(/[\\/]+$/, "");
    const driveRootMatch = normalized.match(/^[A-Za-z]:$/);
    if (driveRootMatch) {
      return;
    }

    const nextPath = normalized.replace(/[\\/][^\\/]+$/, "");
    if (nextPath && nextPath !== normalized) {
      await navigate(nextPath.endsWith(":") ? `${nextPath}\\` : nextPath);
    }
  }

  async function openRoot(root: SidebarRoot) {
    await navigate(root.path);
  }

  async function openItem(item: DirectoryItemStub) {
    dismissRenameForContextChange();

    if (item.kind === "directory") {
      await navigate(item.path);
      return;
    }

    try {
      await openDirectoryItem({ targetPath: item.path });
    } catch (error) {
      notify.error(getErrorMessage(error));
    }
  }

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
      pendingRestore = createMutationRestoreState(state, [created.path], created.path, createTransientDirectoryItem(created));

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

  function hydrateVisibleIcons(items: DirectoryItemStub[]) {
    for (const item of items) {
      if (item.nativeIconState !== "pending") {
        continue;
      }

      if (queuedIconHydrationKinds.has(item.path) || inflightIconHydrationGenerations.has(item.path)) {
        continue;
      }

      queuedIconHydrationKinds.set(item.path, item.kind);
    }

    scheduleIconHydrationFlush();
  }

  async function setSearchQuery(searchQuery: string) {
    dismissRenameForContextChange();

    const stagedSearchQuery = searchQuery;
    const state = get(store);

    store.update((current) => applyDerivedState({ ...current, stagedSearchQuery }));

    if (!state.currentPath) {
      return;
    }

    await navigate(state.currentPath, {
      skipHistory: true,
      refreshInPlace: state.items.length > 0,
      query: stagedSearchQuery
    });
  }

  async function setSort(field: SortField) {
    dismissRenameForContextChange();

    const state = get(store);
    const direction = state.sort.field === field
      ? (state.sort.direction === "asc" ? "desc" : "asc")
      : defaultDirectionForField(field);

    const sort = { field, direction } satisfies SortSpec;

    if (state.currentPath) {
      await navigate(state.currentPath, {
        skipHistory: true,
        refreshInPlace: true,
        sort
      });
      return;
    }

    store.update((current) => applyDerivedState({ ...current, sort }));
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
        pendingRestore = restoreState;
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

  function dispose() {
    const activeJobId = get(store).activeJobId;
    if (activeJobId) {
      void cancelCurrentJob(activeJobId);
    }
    invalidateIconHydration();
    currentChannel = null;
    pendingRestore = null;
  }

  function createSnapshot(): ExplorerTabSnapshot {
    const state = get(store);
    return {
      tabId,
      currentPath: state.currentPath,
      customTitle: null,
      sort: state.sort,
      stagedSearchQuery: state.stagedSearchQuery,
      appliedSearchQuery: state.appliedSearchQuery,
      selectedIds: [...state.selectedIds],
      focusedItemId: state.focusedItemId,
      anchorItemId: state.anchorItemId,
      backHistory: [...state.backHistory],
      forwardHistory: [...state.forwardHistory]
    };
  }

  function handleStreamEvent(event: ExplorerStreamEvent) {
    const activeJobId = get(store).activeJobId;
    if (!activeJobId || event.data.jobId !== activeJobId) {
      return;
    }

    switch (event.event) {
      case "snapshotStarted":
        invalidateIconHydration();
        store.update((state) =>
          applyDerivedState({
            ...state,
            snapshotToken: event.data.snapshotToken,
            status: "loading",
            pendingAppliedSearchQuery: event.data.query,
            pendingItems: state.isRefreshing ? [] : state.pendingItems,
            error: null
          })
        );
        break;
      case "snapshotChunk":
        markExplorerTraceStage(event.data.jobId, "first_chunk_received", {
          chunkSize: event.data.items.length,
          totalKnown: event.data.totalKnown ?? null
        });
        store.update((state) => {
          if (state.isRefreshing) {
            return applyDerivedState({
              ...state,
              pendingItems: [...state.pendingItems, ...event.data.items],
              pendingTotalKnown: event.data.totalKnown ?? state.pendingTotalKnown
            });
          }

          return applyDerivedState({
            ...state,
            items: [...state.items, ...event.data.items],
            totalKnown: event.data.totalKnown ?? state.totalKnown
          });
        });
        break;
      case "snapshotCompleted":
        updateExplorerTraceOperation(event.data.jobId, resolveCompletedOperationType(operationTypes.get(event.data.jobId), event.data.cacheHit));
        iconHydrationGeneration += 1;
        store.update((state) => {
          const completed = state.isRefreshing
            ? applyDerivedState({
                ...state,
                items: state.pendingItems,
                pendingItems: [],
                activeJobId: null,
                visibleSnapshotJobId: event.data.jobId,
                status: "ready",
                isRefreshing: false,
                appliedSearchQuery: event.data.query,
                pendingAppliedSearchQuery: event.data.query,
                lastDurationMs: event.data.durationMs,
                totalKnown: event.data.totalItems,
                pendingTotalKnown: 0
              })
            : applyDerivedState({
                ...state,
                activeJobId: null,
                visibleSnapshotJobId: event.data.jobId,
                status: "ready",
                appliedSearchQuery: event.data.query,
                pendingAppliedSearchQuery: event.data.query,
                lastDurationMs: event.data.durationMs,
                totalKnown: event.data.totalItems
              });

          if (!pendingRestore) {
            return completed;
          }

          const restored = applyDerivedState({
            ...completed,
            selectedIds: pendingRestore.selectedIds,
            focusedItemId: pendingRestore.focusedItemId,
            anchorItemId: pendingRestore.anchorItemId,
            backHistory: pendingRestore.backHistory,
            forwardHistory: pendingRestore.forwardHistory,
            stagedSearchQuery: pendingRestore.stagedSearchQuery,
            appliedSearchQuery: pendingRestore.appliedSearchQuery,
            pendingAppliedSearchQuery: pendingRestore.appliedSearchQuery
          });

          if (pendingRestore.renameItemId) {
            const restoredWithRenameItem = ensureRenameItemVisible(restored, pendingRestore.renameItemId, pendingRestore.renameFallbackItem);
            const renameState = createRenameStateForItem(restoredWithRenameItem, pendingRestore.renameItemId);
            pendingRestore = null;
            return renameState
              ? applyDerivedState({
                  ...restoredWithRenameItem,
                  rename: renameState
                })
              : restoredWithRenameItem;
          }

          pendingRestore = null;
          return restored;
        });
        markExplorerTraceStage(event.data.jobId, "swap_complete", {
          totalItems: event.data.totalItems,
          durationMs: event.data.durationMs
        });
        completeExplorerTrace(event.data.jobId, {
          outcome: "completed",
          backendTimings: {
            cacheHit: event.data.cacheHit,
            resolveSnapshotMs: event.data.resolveSnapshotMs,
            enumerateFsMs: event.data.enumerateFsMs,
            enumerateEntriesMs: event.data.enumerateEntriesMs,
            iconLookupTotalMs: event.data.iconLookupTotalMs,
            iconLookupCount: event.data.iconLookupCount,
            iconEncodeTotalMs: event.data.iconEncodeTotalMs,
            snapshotBuildMs: event.data.snapshotBuildMs,
            projectMs: event.data.projectMs,
            firstChunkSendMs: event.data.firstChunkSendMs,
            allChunksSentMs: event.data.allChunksSentMs,
            totalBackendMs: event.data.totalBackendMs
          }
        });
        operationTypes.delete(event.data.jobId);
        break;
      case "cancelled":
        pendingRestore = null;
        store.update((state) =>
          applyDerivedState({
            ...state,
            activeJobId: null,
            status: "cancelled",
            pendingItems: [],
            pendingTotalKnown: 0,
            isRefreshing: false,
            pendingAppliedSearchQuery: state.appliedSearchQuery,
            error: event.data.reason === "explicit" ? "Navigation cancelled." : null
          })
        );
        completeExplorerTrace(event.data.jobId, {
          outcome: "cancelled",
          error: { reason: event.data.reason }
        });
        operationTypes.delete(event.data.jobId);
        break;
      case "failed":
        pendingRestore = null;
        store.update((state) =>
          applyDerivedState({
            ...state,
            activeJobId: null,
            status: "error",
            pendingItems: [],
            pendingTotalKnown: 0,
            isRefreshing: false,
            pendingAppliedSearchQuery: state.appliedSearchQuery,
            error: event.data.message
          })
        );
        completeExplorerTrace(event.data.jobId, {
          outcome: "failed",
          error: {
            code: event.data.code,
            message: event.data.message
          }
        });
        operationTypes.delete(event.data.jobId);
        break;
    }
  }

  async function cancelCurrentJob(jobId: string) {
    try {
      await cancelDirectoryNavigation({ jobId });
    } catch {
      // Ignore cancellation errors during rapid navigation teardown.
    }
  }

  function scheduleIconHydrationFlush() {
    if (iconHydrationTimer || queuedIconHydrationKinds.size === 0) {
      return;
    }

    iconHydrationTimer = setTimeout(() => {
      iconHydrationTimer = null;
      void flushIconHydrationQueue();
    }, 0);
  }

  async function flushIconHydrationQueue() {
    if (queuedIconHydrationKinds.size === 0) {
      return;
    }

    const requestGeneration = iconHydrationGeneration;
    const requestItems = [...queuedIconHydrationKinds.entries()].map(([path, kind]) => ({ path, kind }));
    queuedIconHydrationKinds.clear();

    for (const item of requestItems) {
      inflightIconHydrationGenerations.set(item.path, requestGeneration);
    }

    markItemsLoading(requestItems.map((item) => item.path), requestGeneration);

    try {
      const response = await hydrateDirectoryIcons({ items: requestItems });
      if (requestGeneration !== iconHydrationGeneration) {
        return;
      }

      store.update((state) =>
        applyDerivedState({
          ...state,
          items: mergeHydratedIcons(state.items, response.items),
          pendingItems: mergeHydratedIcons(state.pendingItems, response.items)
        })
      );
    } catch {
      markItemsFailed(requestItems.map((item) => item.path), requestGeneration);
    } finally {
      for (const item of requestItems) {
        if (inflightIconHydrationGenerations.get(item.path) === requestGeneration) {
          inflightIconHydrationGenerations.delete(item.path);
        }
      }
    }
  }

  function invalidateIconHydration() {
    iconHydrationGeneration += 1;
    clearQueuedIconHydration();
    inflightIconHydrationGenerations.clear();
    store.update((state) =>
      applyDerivedState({
        ...state,
        items: resetObsoleteLoadingIconState(state.items),
        pendingItems: resetObsoleteLoadingIconState(state.pendingItems)
      })
    );
  }

  function clearQueuedIconHydration() {
    if (iconHydrationTimer) {
      clearTimeout(iconHydrationTimer);
      iconHydrationTimer = null;
    }

    queuedIconHydrationKinds.clear();
  }

  function markItemsLoading(paths: string[], requestGeneration: number) {
    if (requestGeneration !== iconHydrationGeneration) {
      return;
    }

    if (paths.length === 0) {
      return;
    }

    const pathSet = new Set(paths);
    store.update((state) =>
      applyDerivedState({
        ...state,
        items: updateNativeIconState(state.items, pathSet, "loading"),
        pendingItems: updateNativeIconState(state.pendingItems, pathSet, "loading")
      })
    );
  }

  function markItemsFailed(paths: string[], requestGeneration: number) {
    if (requestGeneration !== iconHydrationGeneration) {
      return;
    }

    if (paths.length === 0) {
      return;
    }

    const pathSet = new Set(paths);
    store.update((state) =>
      applyDerivedState({
        ...state,
        items: updateNativeIconState(state.items, pathSet, "failed"),
        pendingItems: updateNativeIconState(state.pendingItems, pathSet, "failed")
      })
    );
  }

  return {
    subscribe: store.subscribe,
    initialize,
    navigate,
    refresh,
    refreshRoots,
    goBack,
    goForward,
    goUp,
    openRoot,
    openItem,
    createNewFolder,
    deleteItems,
    hydrateVisibleIcons,
    setSearchQuery,
    setSort,
    beginRenameSelection,
    updateRenameDraft,
    submitRename,
    cancelRename,
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
    cancelActiveNavigation,
    createSnapshot,
    dispose
  };
}

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

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "An unexpected explorer error occurred.";
}

function defaultDirectionForField(field: SortField): SortSpec["direction"] {
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

function classifyOperation(
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

  if (targetPath !== state.currentPath) {
    return state.items.length > 0 ? "warm_navigation" : "cold_navigation";
  }

  return options.refreshInPlace ? "warm_navigation" : "cold_navigation";
}

function shouldPreserveVisibleRows(state: ExplorerState, targetPath: string) {
  return state.currentPath === targetPath && state.items.length > 0;
}

function resolveCompletedOperationType(
  requestedOperationType: ExplorerOperationType | undefined,
  cacheHit: boolean
): ExplorerOperationType {
  if (requestedOperationType === "search" || requestedOperationType === "sort" || requestedOperationType === "refresh") {
    return requestedOperationType;
  }

  return cacheHit ? "warm_navigation" : "cold_navigation";
}

function createRenameRestoreState(
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

function createMutationRestoreState(
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

function createRenameStateForItem(state: ExplorerState, itemId: string): NonNullable<ExplorerRenameState> | null {
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

function ensureRenameItemVisible(
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

function insertVisibleRenameFallback(items: DirectoryItemStub[], fallbackItem: DirectoryItemStub, sort: SortSpec) {
  if (items.some((item) => item.id === fallbackItem.id)) {
    return items;
  }

  const nextItems = [...items, fallbackItem];
  return sortDirectoryItems(nextItems, sort);
}

function createTransientDirectoryItem(created: { path: string; name: string; parentPath: string }): DirectoryItemStub {
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

function clearTransientRenameFallback(state: ExplorerState) {
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

function formatDeleteSuccessMessage(count: number) {
  return count === 1 ? "Moved 1 item to the Recycle Bin." : `Moved ${count} items to the Recycle Bin.`;
}

function formatDeleteFailureSummary(failures: DeleteToRecycleBinResponse["failed"]) {
  if (failures.length === 0) {
    return "Delete failed.";
  }

  if (failures.length === 1) {
    return failures[0].message;
  }

  return `${failures.length} items could not be moved to the Recycle Bin. ${failures[0].message}`;
}

function getParentPath(path: string) {
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

function isSameExplorerPath(left: string, right: string) {
  return normalizeExplorerPath(left) === normalizeExplorerPath(right);
}

function normalizeExplorerPath(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}

function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function mergeHydratedIcons(items: DirectoryItemStub[], response: NativeIconBatchResponse["items"]) {
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

function updateNativeIconState(
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

function resetObsoleteLoadingIconState(items: DirectoryItemStub[]) {
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
