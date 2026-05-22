import { get, writable } from "svelte/store";
import {
  cancelDirectoryNavigation,
  listSidebarRoots,
  openDirectoryItem,
  startDirectoryNavigation
} from "$lib/tauri/explorer";
import { notify } from "$lib/stores/notifications";
import {
  applyDerivedState,
  classifyOperation,
  createRenameStateForItem,
  defaultDirectionForField,
  delay,
  ensureRenameItemVisible,
  getErrorMessage,
  resolveCompletedOperationType,
  shouldPreserveVisibleRows,
  type ExplorerRestoreState
} from "$lib/stores/explorerSessionHelpers";
import { createExplorerIconHydration } from "$lib/stores/explorerSessionIcons";
import { createExplorerMutationActions } from "$lib/stores/explorerSessionMutations";
import { createExplorerSelectionActions } from "$lib/stores/explorerSessionSelection";
import {
  completeExplorerTrace,
  markExplorerTraceStage,
  startExplorerTrace,
  updateExplorerTraceOperation
} from "$lib/utils/explorerTimingTrace";
import { settings } from "$lib/stores/settings";
import type {
  DirectoryItemStub,
  ExplorerOperationType,
  ExplorerState,
  ExplorerStreamEvent,
  ExplorerTabId,
  ExplorerTabSnapshot,
  NavigationRequest,
  SortField,
  SortSpec,
  SidebarRoot
} from "$lib/types/explorer";
import { createJobId } from "$lib/types/explorer";

const DEFAULT_SORT: SortSpec = { field: "type", direction: "asc" };

export { applyDerivedState } from "$lib/stores/explorerSessionHelpers";

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

export type ExplorerSession = ReturnType<typeof createExplorerSession>;

export function createExplorerSession(tabId: ExplorerTabId) {
  const store = writable<ExplorerState>(initialExplorerState);
  let currentChannel: { onmessage: ((message: ExplorerStreamEvent) => void) | null } | null = null;
  let pendingRestore: ExplorerRestoreState | null = null;
  const operationTypes = new Map<string, ExplorerOperationType>();
  const setPendingRestore = (restore: ExplorerRestoreState | null) => {
    pendingRestore = restore;
  };
  const iconHydration = createExplorerIconHydration({ store });
  const mutationActions = createExplorerMutationActions({
    store,
    navigate,
    setPendingRestore
  });
  const selectionActions = createExplorerSelectionActions({
    store,
    dismissRenameForContextChange: mutationActions.dismissRenameForContextChange,
    openItem,
    cancelCurrentJob
  });

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

    mutationActions.dismissRenameForContextChange();

    iconHydration.invalidateIconHydration();

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
    mutationActions.dismissRenameForContextChange();

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

  async function setSearchQuery(searchQuery: string) {
    mutationActions.dismissRenameForContextChange();

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
    mutationActions.dismissRenameForContextChange();

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

  function dispose() {
    const activeJobId = get(store).activeJobId;
    if (activeJobId) {
      void cancelCurrentJob(activeJobId);
    }
    iconHydration.invalidateIconHydration();
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
        iconHydration.invalidateIconHydration();
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
        iconHydration.markSnapshotCommitted();
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
    createNewFolder: mutationActions.createNewFolder,
    deleteItems: mutationActions.deleteItems,
    hydrateVisibleIcons: iconHydration.hydrateVisibleIcons,
    setSearchQuery,
    setSort,
    beginRenameSelection: mutationActions.beginRenameSelection,
    updateRenameDraft: mutationActions.updateRenameDraft,
    submitRename: mutationActions.submitRename,
    cancelRename: mutationActions.cancelRename,
    selectSingle: selectionActions.selectSingle,
    toggleSelection: selectionActions.toggleSelection,
    rangeSelectTo: selectionActions.rangeSelectTo,
    selectWithModifiers: selectionActions.selectWithModifiers,
    selectAllVisible: selectionActions.selectAllVisible,
    clearSelection: selectionActions.clearSelection,
    moveFocus: selectionActions.moveFocus,
    focusFirst: selectionActions.focusFirst,
    focusLast: selectionActions.focusLast,
    openFocused: selectionActions.openFocused,
    cancelActiveNavigation: selectionActions.cancelActiveNavigation,
    createSnapshot,
    dispose
  };
}
