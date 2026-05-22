import { type Writable } from "svelte/store";
import { hydrateDirectoryIcons } from "$lib/tauri/explorer";
import {
  applyDerivedState,
  mergeHydratedIcons,
  resetObsoleteLoadingIconState,
  updateNativeIconState
} from "$lib/stores/explorerSessionHelpers";
import type { DirectoryItemStub, ExplorerState } from "$lib/types/explorer";

type IconHydrationDeps = {
  store: Writable<ExplorerState>;
};

export function createExplorerIconHydration({ store }: IconHydrationDeps) {
  const queuedIconHydrationKinds = new Map<string, DirectoryItemStub["kind"]>();
  const inflightIconHydrationGenerations = new Map<string, number>();
  let iconHydrationTimer: ReturnType<typeof setTimeout> | null = null;
  let iconHydrationGeneration = 0;

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

  function markSnapshotCommitted() {
    iconHydrationGeneration += 1;
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
    hydrateVisibleIcons,
    invalidateIconHydration,
    markSnapshotCommitted,
    clearQueuedIconHydration
  };
}
