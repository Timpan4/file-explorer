import { get, readable, type Readable } from "svelte/store";
import { explorerWorkspace } from "$lib/stores/explorerWorkspace";
import { initialExplorerState, type ExplorerSession as ExplorerSessionInstance } from "$lib/stores/explorerSessionCore";
import type { ExplorerState } from "$lib/types/explorer";

export type ExplorerSession = ExplorerSessionInstance;

const activeExplorerState = readable<ExplorerState>(initialExplorerState, (set) => {
  let unsubscribeSession: (() => void) | null = null;

  const unsubscribeWorkspace = explorerWorkspace.subscribe(() => {
    unsubscribeSession?.();

    const activeSession = explorerWorkspace.getActiveSession();
    if (!activeSession) {
      set(initialExplorerState);
      return;
    }

    unsubscribeSession = activeSession.subscribe((state) => {
      set(state);
    });
  });

  return () => {
    unsubscribeSession?.();
    unsubscribeWorkspace();
  };
}) as Readable<ExplorerState>;

function withActiveSession<T>(callback: (session: ExplorerSessionInstance) => T, fallback: T) {
  const session = explorerWorkspace.getActiveSession();
  if (!session) {
    return fallback;
  }

  return callback(session);
}

export const explorerSession = {
  subscribe: activeExplorerState.subscribe,
  initialize: (...args: Parameters<ExplorerSessionInstance["initialize"]>) =>
    withActiveSession((session) => session.initialize(...args), Promise.resolve()),
  navigate: (...args: Parameters<ExplorerSessionInstance["navigate"]>) =>
    withActiveSession((session) => session.navigate(...args), Promise.resolve()),
  refresh: (...args: Parameters<ExplorerSessionInstance["refresh"]>) =>
    withActiveSession((session) => session.refresh(...args), Promise.resolve()),
  refreshRoots: (...args: Parameters<ExplorerSessionInstance["refreshRoots"]>) =>
    withActiveSession((session) => session.refreshRoots(...args), Promise.resolve([])),
  goBack: (...args: Parameters<ExplorerSessionInstance["goBack"]>) =>
    withActiveSession((session) => session.goBack(...args), Promise.resolve()),
  goForward: (...args: Parameters<ExplorerSessionInstance["goForward"]>) =>
    withActiveSession((session) => session.goForward(...args), Promise.resolve()),
  goUp: (...args: Parameters<ExplorerSessionInstance["goUp"]>) =>
    withActiveSession((session) => session.goUp(...args), Promise.resolve()),
  openRoot: (...args: Parameters<ExplorerSessionInstance["openRoot"]>) =>
    withActiveSession((session) => session.openRoot(...args), Promise.resolve()),
  openItem: (...args: Parameters<ExplorerSessionInstance["openItem"]>) =>
    withActiveSession((session) => session.openItem(...args), Promise.resolve()),
  createNewFolder: (...args: Parameters<ExplorerSessionInstance["createNewFolder"]>) =>
    withActiveSession((session) => session.createNewFolder(...args), Promise.resolve(false)),
  deleteItems: (...args: Parameters<ExplorerSessionInstance["deleteItems"]>) =>
    withActiveSession((session) => session.deleteItems(...args), Promise.resolve(false)),
  hydrateVisibleIcons: (...args: Parameters<ExplorerSessionInstance["hydrateVisibleIcons"]>) =>
    withActiveSession((session) => session.hydrateVisibleIcons(...args), undefined),
  setSearchQuery: (...args: Parameters<ExplorerSessionInstance["setSearchQuery"]>) =>
    withActiveSession((session) => session.setSearchQuery(...args), Promise.resolve()),
  setSort: (...args: Parameters<ExplorerSessionInstance["setSort"]>) =>
    withActiveSession((session) => session.setSort(...args), Promise.resolve()),
  beginRenameSelection: (...args: Parameters<ExplorerSessionInstance["beginRenameSelection"]>) =>
    withActiveSession((session) => session.beginRenameSelection(...args), undefined),
  updateRenameDraft: (...args: Parameters<ExplorerSessionInstance["updateRenameDraft"]>) =>
    withActiveSession((session) => session.updateRenameDraft(...args), undefined),
  submitRename: (...args: Parameters<ExplorerSessionInstance["submitRename"]>) =>
    withActiveSession((session) => session.submitRename(...args), Promise.resolve(false)),
  cancelRename: (...args: Parameters<ExplorerSessionInstance["cancelRename"]>) =>
    withActiveSession((session) => session.cancelRename(...args), false),
  selectSingle: (...args: Parameters<ExplorerSessionInstance["selectSingle"]>) =>
    withActiveSession((session) => session.selectSingle(...args), undefined),
  toggleSelection: (...args: Parameters<ExplorerSessionInstance["toggleSelection"]>) =>
    withActiveSession((session) => session.toggleSelection(...args), undefined),
  rangeSelectTo: (...args: Parameters<ExplorerSessionInstance["rangeSelectTo"]>) =>
    withActiveSession((session) => session.rangeSelectTo(...args), undefined),
  selectWithModifiers: (...args: Parameters<ExplorerSessionInstance["selectWithModifiers"]>) =>
    withActiveSession((session) => session.selectWithModifiers(...args), undefined),
  selectAllVisible: (...args: Parameters<ExplorerSessionInstance["selectAllVisible"]>) =>
    withActiveSession((session) => session.selectAllVisible(...args), undefined),
  clearSelection: (...args: Parameters<ExplorerSessionInstance["clearSelection"]>) =>
    withActiveSession((session) => session.clearSelection(...args), undefined),
  moveFocus: (...args: Parameters<ExplorerSessionInstance["moveFocus"]>) =>
    withActiveSession((session) => session.moveFocus(...args), undefined),
  focusFirst: (...args: Parameters<ExplorerSessionInstance["focusFirst"]>) =>
    withActiveSession((session) => session.focusFirst(...args), undefined),
  focusLast: (...args: Parameters<ExplorerSessionInstance["focusLast"]>) =>
    withActiveSession((session) => session.focusLast(...args), undefined),
  openFocused: (...args: Parameters<ExplorerSessionInstance["openFocused"]>) =>
    withActiveSession((session) => session.openFocused(...args), Promise.resolve()),
  cancelActiveNavigation: (...args: Parameters<ExplorerSessionInstance["cancelActiveNavigation"]>) =>
    withActiveSession((session) => session.cancelActiveNavigation(...args), Promise.resolve()),
  createSnapshot: (...args: Parameters<ExplorerSessionInstance["createSnapshot"]>) =>
    withActiveSession((session) => session.createSnapshot(...args), {
      tabId: "",
      currentPath: "",
      customTitle: null,
      sort: initialExplorerState.sort,
      stagedSearchQuery: "",
      appliedSearchQuery: "",
      selectedIds: [],
      focusedItemId: null,
      anchorItemId: null,
      backHistory: [],
      forwardHistory: []
    }),
  dispose: (...args: Parameters<ExplorerSessionInstance["dispose"]>) =>
    withActiveSession((session) => session.dispose(...args), undefined)
} satisfies ExplorerSessionInstance & Readable<ExplorerState>;

export function getActiveExplorerState() {
  return get(activeExplorerState);
}
