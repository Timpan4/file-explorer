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

    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (parsed.version !== 1) {
      return null;
    }

    if (!Number.isFinite(parsed.savedAt)) {
      return null;
    }

    if (Date.now() - parsed.savedAt > SESSION_STALENESS_THRESHOLD_MS) {
      return null;
    }

    if (!parsed.tabOrder || !Array.isArray(parsed.tabOrder)) {
      return null;
    }

    if (!parsed.tabs || !Array.isArray(parsed.tabs)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
