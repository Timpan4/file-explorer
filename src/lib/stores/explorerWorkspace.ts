import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { get, writable } from "svelte/store";
import { createExplorerSession, type ExplorerSession } from "$lib/stores/explorerSessionCore";
import { createExplorerUiStore, type ExplorerUiStore } from "$lib/stores/explorerUiCore";
import { createWorkspaceSessionPersistence, readSession, type SessionSnapshot } from "$lib/stores/explorerWorkspaceSession";
import { settings } from "$lib/stores/settings";
import type {
  ExplorerTabDetachResult,
  ExplorerTabId,
  ExplorerTabSnapshot,
  ExplorerTabView,
  ExplorerWindowBootstrap,
  ExplorerWorkspaceState,
  SidebarRoot
} from "$lib/types/explorer";
import { createExplorerTabId, createExplorerWindowId, findMatchingSidebarRoot } from "$lib/types/explorer";

const BOOTSTRAP_STORAGE_KEY = "file-explorer.detached-tab";
const DETACH_RESULT_EVENT = "workspace/tab-detach-result";
const TAB_IMPORT_EVENT = "workspace/tab-import";
const WINDOW_REGISTRY_KEY = "file-explorer.window-registry";
const DEFAULT_WINDOW_OPTIONS = {
  title: "File Explorer",
  decorations: false,
  width: 1440,
  height: 920,
  minWidth: 1100,
  minHeight: 720
} as const;

type WorkspaceTabRecord = {
  id: ExplorerTabId;
  session: ExplorerSession;
  ui: ExplorerUiStore;
  derivedTitle: string;
  customTitle: string | null;
  title: string;
  currentPath: string;
  roots: SidebarRoot[];
  iconDataUrl?: string;
  unsubscribe: () => void;
};

type WorkspaceInitOptions = {
  bootstrap?: ExplorerWindowBootstrap | null;
};

type WindowRegistryEntry = {
  windowId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  updatedAt: number;
};

type ImportTabPayload = {
  sourceWindowId: string;
  transferId: string;
  tab: ExplorerTabSnapshot;
};

function createInitialWorkspaceState(windowId: string): ExplorerWorkspaceState {
  return {
    windowId,
    activeTabId: null,
    tabs: [],
    initialized: false
  };
}

function createExplorerWorkspace() {
  const currentWindow = getCurrentWebviewWindow();
  const windowId = currentWindow.label || createExplorerWindowId();
  const store = writable<ExplorerWorkspaceState>(createInitialWorkspaceState(windowId));
  const tabs = new Map<ExplorerTabId, WorkspaceTabRecord>();
  let detachResultUnlisten: (() => void) | null = null;
  let importTabUnlisten: (() => void) | null = null;
  let registryIntervalId: number | null = null;
  let settingsUnsubscribe: (() => void) | null = null;
  const sessionPersistence = createWorkspaceSessionPersistence({
    readActiveTabId: () => get(store).activeTabId,
    readTabOrder: () => [...tabs.keys()],
    readTabs: () => [...tabs.values()].map((tabRecord) => ({
      ...tabRecord.session.createSnapshot(),
      customTitle: tabRecord.customTitle
    }))
  });

  function subscribe(run: Parameters<typeof store.subscribe>[0]) {
    return store.subscribe(run);
  }

  async function initialize(options: WorkspaceInitOptions = {}) {
    disposeTabs();
    store.set(createInitialWorkspaceState(windowId));
    await ensureEventListeners();
    startWindowRegistry();
    const canPersistSession = !options.bootstrap?.tab;
    settingsUnsubscribe?.();
    sessionPersistence.pause();

    if (options.bootstrap?.tab) {
      await createTab({ snapshot: options.bootstrap.tab, makeActive: true });
    } else {
      if (get(settings).sessionRestoreEnabled) {
        const sessionSnapshot = readSession();
        if (sessionSnapshot && sessionSnapshot.tabOrder.length > 0) {
          await restoreSession(sessionSnapshot);
          if (tabs.size === 0) {
            await createTab({ makeActive: true });
          }
        } else {
          await createTab({ makeActive: true });
        }
      } else {
        await createTab({ makeActive: true });
      }
    }

    store.update((state) => ({ ...state, initialized: true }));

    settingsUnsubscribe = settings.subscribe((currentSettings) => {
      if (!currentSettings.sessionRestoreEnabled) {
        sessionPersistence.disable();
      } else if (canPersistSession) {
        sessionPersistence.enable();
      }
    });
  }

  async function createTab(options: { snapshot?: ExplorerTabSnapshot; makeActive?: boolean; preserveTabId?: boolean } = {}) {
    const snapshot = options.snapshot;
    const tabId = options.preserveTabId && snapshot?.tabId ? snapshot.tabId : createExplorerTabId();
    const session = createExplorerSession(tabId);
    const ui = createExplorerUiStore();
    const record: WorkspaceTabRecord = {
      id: tabId,
      session,
      ui,
      derivedTitle: formatTabTitle(snapshot?.currentPath ?? ""),
      customTitle: normalizeCustomTabTitle(snapshot?.customTitle ?? null),
      title: normalizeCustomTabTitle(snapshot?.customTitle ?? null) ?? formatTabTitle(snapshot?.currentPath ?? ""),
      currentPath: snapshot?.currentPath ?? "",
      roots: [],
      iconDataUrl: undefined,
      unsubscribe: () => {}
    };

    record.unsubscribe = session.subscribe((state) => {
      record.currentPath = state.currentPath;
      record.roots = state.roots;
      record.derivedTitle = formatTabTitle(state.currentPath);
      record.title = record.customTitle ?? record.derivedTitle;
      record.iconDataUrl = findMatchingSidebarRoot(state.currentPath, state.roots)?.iconDataUrl;
      syncState();
      sessionPersistence.markDirty();
    });

    tabs.set(tabId, record);
    syncState(options.makeActive ? tabId : get(store).activeTabId ?? tabId);
    await session.initialize(snapshot ? { path: snapshot.currentPath, snapshot } : {});
    syncState(get(store).activeTabId ?? tabId);
    return tabId;
  }

  async function restoreSession(sessionSnapshot: SessionSnapshot) {
    const snapshotsById = new Map(sessionSnapshot.tabs.map((snapshot) => [snapshot.tabId, snapshot]));
    const orderedSnapshots = sessionSnapshot.tabOrder
      .map((tabId) => snapshotsById.get(tabId))
      .filter((snapshot): snapshot is ExplorerTabSnapshot => snapshot !== undefined);

    for (const tabSnapshot of orderedSnapshots) {
      await createTab({ snapshot: tabSnapshot, preserveTabId: true });
    }

    const restoredActiveTabId = sessionSnapshot.activeTabId;
    if (restoredActiveTabId && tabs.has(restoredActiveTabId)) {
      syncState(restoredActiveTabId);
    }
  }

  async function newTab() {
    return createTab({ makeActive: true });
  }

  function renameTab(tabId: ExplorerTabId, title: string) {
    const record = tabs.get(tabId);
    if (!record) {
      return;
    }

    record.customTitle = normalizeCustomTabTitle(title);
    record.title = record.customTitle ?? record.derivedTitle;
    syncState();
    sessionPersistence.markDirty();
  }

  function clearTabTitle(tabId: ExplorerTabId) {
    const record = tabs.get(tabId);
    if (!record) {
      return;
    }

    record.customTitle = null;
    record.title = record.derivedTitle;
    syncState();
    sessionPersistence.markDirty();
  }

  function moveTabBefore(tabId: ExplorerTabId, targetTabId: ExplorerTabId | null) {
    const orderedTabs = [...tabs.values()];
    const movingIndex = orderedTabs.findIndex((tab) => tab.id === tabId);
    if (movingIndex === -1) {
      return;
    }

    const [movingTab] = orderedTabs.splice(movingIndex, 1);
    const targetIndex = targetTabId ? orderedTabs.findIndex((tab) => tab.id === targetTabId) : -1;
    if (targetIndex === -1) {
      orderedTabs.push(movingTab);
    } else {
      orderedTabs.splice(targetIndex, 0, movingTab);
    }

    replaceTabOrder(orderedTabs);
  }

  function activateAdjacentTab(direction: 1 | -1) {
    const orderedTabs = [...tabs.values()];
    if (orderedTabs.length <= 1) {
      return;
    }

    const activeTabId = get(store).activeTabId;
    const currentIndex = orderedTabs.findIndex((tab) => tab.id === activeTabId);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + orderedTabs.length) % orderedTabs.length;
    activateTab(orderedTabs[nextIndex]?.id ?? orderedTabs[0].id);
  }

  function getActiveTabId() {
    return get(store).activeTabId;
  }

  function activateTab(tabId: ExplorerTabId) {
    if (!tabs.has(tabId)) {
      return;
    }

    syncState(tabId);
    sessionPersistence.markDirty();
  }

  async function closeTab(tabId: ExplorerTabId) {
    if (!tabs.has(tabId)) {
      return;
    }

    const activeTabId = get(store).activeTabId;

    if (tabs.size === 1) {
      disposeTab(tabId);
      await createTab({ makeActive: true });
      sessionPersistence.markDirty();
      return;
    }

    if (activeTabId && activeTabId !== tabId) {
      disposeTab(tabId);
      syncState(activeTabId);
      sessionPersistence.markDirty();
      return;
    }

    const tabIds = [...tabs.keys()];
    const currentIndex = tabIds.indexOf(tabId);
    disposeTab(tabId);
    const nextTabId = tabIds[currentIndex + 1] ?? tabIds[currentIndex - 1] ?? [...tabs.keys()][0] ?? null;
    syncState(nextTabId);
    sessionPersistence.markDirty();
  }

  async function detachTab(tabId: ExplorerTabId, screenPosition?: { x: number; y: number }) {
    const record = tabs.get(tabId);
    if (!record) {
      return false;
    }

    const transferId = createExplorerTabId();
    const bootstrapKey = `${BOOTSTRAP_STORAGE_KEY}.${transferId}`;
    const payload: ExplorerWindowBootstrap = {
      sourceWindowId: windowId,
      transferId,
      tab: {
        ...record.session.createSnapshot(),
        customTitle: record.customTitle
      }
    };

    window.localStorage.setItem(bootstrapKey, JSON.stringify(payload));

    const detachedWindowLabel = `window-${transferId}`;
    const url = `/?bootstrap=${encodeURIComponent(bootstrapKey)}&transfer=${encodeURIComponent(transferId)}&source=${encodeURIComponent(windowId)}`;
    const detachedWindow = new WebviewWindow(detachedWindowLabel, {
      ...DEFAULT_WINDOW_OPTIONS,
      x: Math.max(0, Math.round((screenPosition?.x ?? window.screenX) - 120)),
      y: Math.max(0, Math.round((screenPosition?.y ?? window.screenY) - 24)),
      url
    });

    const created = await waitForWindowCreation(detachedWindow);
    if (!created) {
      window.localStorage.removeItem(bootstrapKey);
      return false;
    }

    const result = await waitForDetachResult(transferId);
    if (!result.ok) {
      window.localStorage.removeItem(bootstrapKey);
      return false;
    }

    await closeTab(tabId);
    return true;
  }

  async function importTabIntoWindow(tabId: ExplorerTabId, targetWindowId: string) {
    const record = tabs.get(tabId);
    if (!record || targetWindowId === windowId) {
      return false;
    }

    const transferId = createExplorerTabId();
    const payload: ImportTabPayload = {
      sourceWindowId: windowId,
      transferId,
      tab: {
        ...record.session.createSnapshot(),
        customTitle: record.customTitle
      }
    };

    try {
      await emitTo(targetWindowId, TAB_IMPORT_EVENT, payload);
      const result = await waitForDetachResult(transferId);
      if (!result.ok) {
        return false;
      }

      await closeTab(tabId);
      return true;
    } catch {
      return false;
    }
  }

  function findWindowAtPosition(screenX: number, screenY: number) {
    const entries = readWindowRegistry()
      .filter((entry) => entry.windowId !== windowId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return entries.find((entry) =>
      screenX >= entry.x &&
      screenX <= entry.x + entry.width &&
      screenY >= entry.y &&
      screenY <= entry.y + entry.height
    )?.windowId ?? null;
  }

  async function acknowledgeDetachedTab(result: ExplorerTabDetachResult, sourceWindowId?: string) {
    if (!sourceWindowId) {
      return;
    }

    await emitTo(sourceWindowId, DETACH_RESULT_EVENT, result);
  }

  function consumeBootstrapFromUrl(): ExplorerWindowBootstrap | null {
    const params = new URLSearchParams(window.location.search);
    const bootstrapKey = params.get("bootstrap");
    if (!bootstrapKey) {
      return null;
    }

    const raw = window.localStorage.getItem(bootstrapKey);
    if (!raw) {
      return null;
    }

    window.localStorage.removeItem(bootstrapKey);

    try {
      return JSON.parse(raw) as ExplorerWindowBootstrap;
    } catch {
      return null;
    }
  }

  function getActiveSession() {
    const activeTabId = get(store).activeTabId;
    return activeTabId ? tabs.get(activeTabId)?.session ?? null : null;
  }

  function getActiveUi() {
    const activeTabId = get(store).activeTabId;
    return activeTabId ? tabs.get(activeTabId)?.ui ?? null : null;
  }

  function getTabRecords() {
    return [...tabs.values()];
  }

  function dispose() {
    sessionPersistence.saveNow();
    disposeTabs();
    sessionPersistence.pause();
    detachResultUnlisten?.();
    importTabUnlisten?.();
    detachResultUnlisten = null;
    importTabUnlisten = null;
    settingsUnsubscribe?.();
    settingsUnsubscribe = null;
    stopWindowRegistry();
    store.set(createInitialWorkspaceState(windowId));
  }

  async function ensureEventListeners() {
    if (detachResultUnlisten && importTabUnlisten) {
      return;
    }

    if (!detachResultUnlisten) {
      detachResultUnlisten = await currentWindow.listen<ExplorerTabDetachResult>(DETACH_RESULT_EVENT, (event) => {
        window.dispatchEvent(new CustomEvent(`${DETACH_RESULT_EVENT}:${event.payload.transferId}`, { detail: event.payload }));
      });
    }

    if (!importTabUnlisten) {
      importTabUnlisten = await currentWindow.listen<ImportTabPayload>(TAB_IMPORT_EVENT, async (event) => {
        try {
          await currentWindow.unminimize();
          await currentWindow.show();
          await currentWindow.setFocus();
        } catch {
          // Best effort only.
        }

        try {
          await createTab({ snapshot: event.payload.tab, makeActive: true });
          await emitTo(event.payload.sourceWindowId, DETACH_RESULT_EVENT, {
            transferId: event.payload.transferId,
            ok: true,
            windowId
          } satisfies ExplorerTabDetachResult);
        } catch {
          await emitTo(event.payload.sourceWindowId, DETACH_RESULT_EVENT, {
            transferId: event.payload.transferId,
            ok: false
          } satisfies ExplorerTabDetachResult);
        }
      });
    }
  }

  function syncState(activeTabId = get(store).activeTabId) {
    store.set({
      windowId,
      activeTabId,
      initialized: get(store).initialized,
      tabs: [...tabs.values()].map((tab): ExplorerTabView => ({
        id: tab.id,
        title: tab.title,
        customTitle: tab.customTitle,
        currentPath: tab.currentPath,
        iconDataUrl: tab.iconDataUrl,
        active: tab.id === activeTabId
      }))
    });
  }

  function disposeTab(tabId: ExplorerTabId) {
    const record = tabs.get(tabId);
    if (!record) {
      return;
    }

    record.unsubscribe();
    record.session.dispose();
    tabs.delete(tabId);
  }

  function disposeTabs() {
    for (const tabId of [...tabs.keys()]) {
      disposeTab(tabId);
    }
  }

  function replaceTabOrder(orderedTabs: WorkspaceTabRecord[]) {
    tabs.clear();
    for (const tab of orderedTabs) {
      tabs.set(tab.id, tab);
    }

    syncState(get(store).activeTabId);
    sessionPersistence.markDirty();
  }

  function startWindowRegistry() {
    updateWindowRegistry();
    if (registryIntervalId !== null) {
      return;
    }

    registryIntervalId = window.setInterval(() => {
      updateWindowRegistry();
    }, 350);
  }

  function stopWindowRegistry() {
    if (registryIntervalId !== null) {
      window.clearInterval(registryIntervalId);
      registryIntervalId = null;
    }

    const entries = readWindowRegistry().filter((entry) => entry.windowId !== windowId);
    writeWindowRegistry(entries);
  }

  function updateWindowRegistry() {
    const nextEntry: WindowRegistryEntry = {
      windowId,
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
      updatedAt: Date.now()
    };

    const entries = readWindowRegistry().filter((entry) => entry.windowId !== windowId);
    entries.push(nextEntry);
    writeWindowRegistry(entries);
  }

  return {
    subscribe,
    initialize,
    newTab,
    renameTab,
    clearTabTitle,
    moveTabBefore,
    activateAdjacentTab,
    getActiveTabId,
    activateTab,
    closeTab,
    detachTab,
    importTabIntoWindow,
    findWindowAtPosition,
    acknowledgeDetachedTab,
    consumeBootstrapFromUrl,
    getActiveSession,
    getActiveUi,
    getTabRecords,
    dispose
  };
}

export type ExplorerWorkspaceStore = ReturnType<typeof createExplorerWorkspace>;

function readWindowRegistry() {
  try {
    const raw = window.localStorage.getItem(WINDOW_REGISTRY_KEY);
    if (!raw) {
      return [] as WindowRegistryEntry[];
    }

    const parsed = JSON.parse(raw) as WindowRegistryEntry[];
    return parsed.filter((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y));
  } catch {
    return [] as WindowRegistryEntry[];
  }
}

function writeWindowRegistry(entries: WindowRegistryEntry[]) {
  window.localStorage.setItem(WINDOW_REGISTRY_KEY, JSON.stringify(entries.slice(-12)));
}

async function waitForWindowCreation(windowHandle: WebviewWindow) {
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    void windowHandle.once("tauri://created", () => finish(true));
    void windowHandle.once("tauri://error", () => finish(false));
    window.setTimeout(() => finish(false), 4000);
  });
}

async function waitForDetachResult(transferId: string) {
  return await new Promise<ExplorerTabDetachResult>((resolve) => {
    const eventName = `${DETACH_RESULT_EVENT}:${transferId}`;
    const onResult = (event: Event) => {
      const customEvent = event as CustomEvent<ExplorerTabDetachResult>;
      window.removeEventListener(eventName, onResult);
      window.clearTimeout(timeoutId);
      resolve(customEvent.detail);
    };

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener(eventName, onResult);
      resolve({ transferId, ok: false });
    }, 12000);

    window.addEventListener(eventName, onResult as EventListener);
  });
}

function formatTabTitle(path: string) {
  if (!path) {
    return "Home";
  }

  const normalized = path.replace(/[\\/]+$/, "");
  if (/^[A-Za-z]:$/.test(normalized)) {
    return `${normalized}\\`;
  }

  const segments = normalized.split(/[\\/]+/).filter(Boolean);
  return segments.at(-1) ?? path;
}

function normalizeCustomTabTitle(title: string | null | undefined) {
  const trimmed = title?.trim();
  return trimmed ? trimmed : null;
}

export const explorerWorkspace: ExplorerWorkspaceStore = createExplorerWorkspace();
