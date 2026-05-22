import type { ExplorerTabId, ExplorerTabSnapshot } from "$lib/types/explorer";

const SESSION_STORAGE_KEY = "file-explorer.session.v1";
const SESSION_STALENESS_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionSnapshot = {
  version: 1;
  savedAt: number;
  activeTabId: ExplorerTabId | null;
  tabOrder: ExplorerTabId[];
  tabs: ExplorerTabSnapshot[];
};

type WorkspaceSessionPersistenceDeps = {
  readActiveTabId: () => ExplorerTabId | null;
  readTabOrder: () => ExplorerTabId[];
  readTabs: () => ExplorerTabSnapshot[];
};

export function createWorkspaceSessionPersistence({
  readActiveTabId,
  readTabOrder,
  readTabs
}: WorkspaceSessionPersistenceDeps) {
  let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let beforeUnloadUnlisten: (() => void) | null = null;
  let pageHideUnlisten: (() => void) | null = null;
  let isSessionDirty = false;
  let shouldPersistSession = false;

  function enable() {
    shouldPersistSession = true;
    startAutoSave();
  }

  function pause() {
    stopAutoSave();
    shouldPersistSession = false;
  }

  function disable() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    pause();
  }

  function markDirty() {
    if (!shouldPersistSession) {
      return;
    }

    isSessionDirty = true;
    scheduleAutoSave();
  }

  function saveNow() {
    if (!shouldPersistSession) {
      return;
    }

    const payload: SessionSnapshot = {
      version: 1,
      savedAt: Date.now(),
      activeTabId: readActiveTabId(),
      tabOrder: readTabOrder(),
      tabs: readTabs()
    };

    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage can be unavailable or full; session restore should never break explorer runtime.
    }
  }

  function dispose() {
    saveNow();
    pause();
  }

  function scheduleAutoSave() {
    if (!shouldPersistSession) {
      return;
    }

    if (saveDebounceTimer !== null) {
      return;
    }

    saveDebounceTimer = window.setTimeout(() => {
      saveDebounceTimer = null;
      if (isSessionDirty) {
        saveNow();
        isSessionDirty = false;
      }
    }, 200);
  }

  function startAutoSave() {
    if (beforeUnloadUnlisten !== null) {
      return;
    }

    beforeUnloadUnlisten = () => {
      if (saveDebounceTimer !== null) {
        window.clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
      }
      saveNow();
    };

    pageHideUnlisten = () => {
      saveNow();
    };

    window.addEventListener("beforeunload", beforeUnloadUnlisten);
    window.addEventListener("pagehide", pageHideUnlisten);
  }

  function stopAutoSave() {
    if (saveDebounceTimer !== null) {
      window.clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }

    if (beforeUnloadUnlisten !== null) {
      window.removeEventListener("beforeunload", beforeUnloadUnlisten);
      beforeUnloadUnlisten = null;
    }

    if (pageHideUnlisten !== null) {
      window.removeEventListener("pagehide", pageHideUnlisten);
      pageHideUnlisten = null;
    }
  }

  return {
    enable,
    pause,
    disable,
    markDirty,
    saveNow,
    dispose
  };
}

export function readSession(): SessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isSessionSnapshotCandidate(parsed)) {
      return null;
    }

    if (parsed.version !== 1) {
      return null;
    }

    if (!Number.isFinite(parsed.savedAt)) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SESSION_STALENESS_THRESHOLD_MS) {
      return null;
    }

    const tabIds = new Set(parsed.tabOrder);
    if (tabIds.size !== parsed.tabOrder.length) {
      return null;
    }

    if (parsed.activeTabId !== null && !tabIds.has(parsed.activeTabId)) {
      return null;
    }

    const snapshotIds = new Set(parsed.tabs.map((tab) => tab.tabId));
    if (snapshotIds.size !== parsed.tabs.length || snapshotIds.size !== tabIds.size) {
      return null;
    }

    if (parsed.tabs.some((tab) => !tabIds.has(tab.tabId))) {
      return null;
    }

    return parsed satisfies SessionSnapshot;
  } catch {
    return null;
  }
}

function isSessionSnapshotCandidate(value: unknown): value is SessionSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && Number.isFinite(candidate.savedAt)
    && isTabIdOrNull(candidate.activeTabId)
    && Array.isArray(candidate.tabOrder)
    && candidate.tabOrder.every(isTabId)
    && Array.isArray(candidate.tabs)
    && candidate.tabs.every(isExplorerTabSnapshot);
}

function isExplorerTabSnapshot(value: unknown): value is ExplorerTabSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isTabId(candidate.tabId)
    && typeof candidate.currentPath === "string"
    && (candidate.customTitle === null || typeof candidate.customTitle === "string")
    && isSortSpec(candidate.sort)
    && typeof candidate.stagedSearchQuery === "string"
    && typeof candidate.appliedSearchQuery === "string"
    && isStringArray(candidate.selectedIds)
    && isStringOrNull(candidate.focusedItemId)
    && isStringOrNull(candidate.anchorItemId)
    && isStringArray(candidate.backHistory)
    && isStringArray(candidate.forwardHistory);
}

function isSortSpec(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["name", "type", "modifiedAt", "size"].includes(String(candidate.field))
    && ["asc", "desc"].includes(String(candidate.direction));
}

function isTabId(value: unknown): value is ExplorerTabId {
  return typeof value === "string" && value.length > 0;
}

function isTabIdOrNull(value: unknown): value is ExplorerTabId | null {
  return value === null || isTabId(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
