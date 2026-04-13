export type JobId = string;
export type SnapshotToken = string;
export type ExplorerTabId = string;
export type ExplorerWindowId = string;
export type ExplorerOperationType = "cold_navigation" | "warm_navigation" | "search" | "sort" | "refresh";

export type SortField = "name" | "type" | "modifiedAt" | "size";
export type SortDirection = "asc" | "desc";
export type SortSpec = {
  field: SortField;
  direction: SortDirection;
};

export type NavigationRequest = {
  jobId: JobId;
  tabId: ExplorerTabId;
  path: string;
  query?: string;
  sort?: SortSpec;
  includeHidden?: boolean;
  forceRefresh?: boolean;
  viewportHint?: {
    start: number;
    count: number;
  };
};

export type CancelRequest = {
  jobId: JobId;
};

export type RenameRequest = {
  sourcePath: string;
  targetName: string;
};

export type RenameResponse = {
  path: string;
  name: string;
};

export type OpenPathRequest = {
  targetPath: string;
};

export type CreateFolderRequest = {
  parentPath: string;
};

export type CreateFolderResponse = {
  path: string;
  name: string;
  parentPath: string;
};

export type DeleteToRecycleBinRequest = {
  targetPaths: string[];
};

export type DeleteToRecycleBinSuccess = {
  path: string;
  name: string;
  parentPath: string;
  kind: DirectoryItemKind;
};

export type DeleteToRecycleBinFailure = {
  path: string;
  name: string;
  parentPath: string | null;
  code: string;
  message: string;
};

export type DeleteToRecycleBinResponse = {
  deleted: DeleteToRecycleBinSuccess[];
  failed: DeleteToRecycleBinFailure[];
  affectedParentPaths: string[];
};

export type SidebarRoot = {
  id: string;
  label: string;
  path: string;
  kind: "favorite" | "drive";
  iconDataUrl?: string;
};

export type DirectoryItemKind = "file" | "directory" | "symlink" | "other";
export type NativeIconState = "pending" | "loading" | "ready" | "failed";

export type DirectoryItemStub = {
  id: string;
  name: string;
  path: string;
  kind: DirectoryItemKind;
  size?: number;
  modifiedAt?: string;
  hidden: boolean;
  readonly: boolean;
  iconDataUrl?: string;
  nativeIconState: NativeIconState;
};

export type NativeIconBatchRequest = {
  items: Array<{
    path: string;
    kind: DirectoryItemKind;
  }>;
};

export type NativeIconBatchResponse = {
  items: Array<{
    path: string;
    iconDataUrl?: string;
    nativeIconState: NativeIconState;
  }>;
  iconLookupTotalMs: number;
  iconLookupCount: number;
  iconEncodeTotalMs: number;
  totalMs: number;
};

export type ExplorerStreamEvent =
  | {
      event: "snapshotStarted";
      data: { jobId: JobId; path: string; query: string; snapshotToken: SnapshotToken };
    }
  | {
      event: "snapshotChunk";
      data: {
        jobId: JobId;
        snapshotToken: SnapshotToken;
        items: DirectoryItemStub[];
        totalKnown?: number;
      };
    }
  | {
      event: "snapshotCompleted";
      data: {
        jobId: JobId;
        query: string;
        snapshotToken: SnapshotToken;
        totalItems: number;
        durationMs: number;
        cacheHit: boolean;
        resolveSnapshotMs: number;
        enumerateFsMs: number | null;
        enumerateEntriesMs: number | null;
        iconLookupTotalMs: number | null;
        iconLookupCount: number | null;
        iconEncodeTotalMs: number | null;
        snapshotBuildMs: number | null;
        projectMs: number;
        firstChunkSendMs: number | null;
        allChunksSentMs: number;
        totalBackendMs: number;
      };
    }
  | {
      event: "cancelled";
      data: { jobId: JobId; reason: "explicit" | "superseded" };
    }
  | {
      event: "failed";
      data: { jobId: JobId; code: string; message: string };
    };

export type ExplorerStatus = "idle" | "loading" | "ready" | "cancelled" | "error";

export type ExplorerRenameState = {
  itemId: string;
  sourcePath: string;
  sourceName: string;
  parentPath: string;
  draftName: string;
  status: "editing" | "submitting";
  error: string | null;
} | null;

export type ExplorerState = {
  roots: SidebarRoot[];
  currentPath: string;
  activeJobId: JobId | null;
  visibleSnapshotJobId: JobId | null;
  snapshotToken: SnapshotToken | null;
  items: DirectoryItemStub[];
  filteredItems: DirectoryItemStub[];
  pendingItems: DirectoryItemStub[];
  status: ExplorerStatus;
  isRefreshing: boolean;
  error: string | null;
  totalKnown: number;
  pendingTotalKnown: number;
  lastDurationMs: number | null;
  sort: SortSpec;
  stagedSearchQuery: string;
  appliedSearchQuery: string;
  pendingAppliedSearchQuery: string;
  rename: ExplorerRenameState;
  selectedIds: string[];
  focusedItemId: string | null;
  anchorItemId: string | null;
  backHistory: string[];
  forwardHistory: string[];
};

export type ExplorerTabSnapshot = {
  tabId: ExplorerTabId;
  currentPath: string;
  customTitle: string | null;
  sort: SortSpec;
  stagedSearchQuery: string;
  appliedSearchQuery: string;
  selectedIds: string[];
  focusedItemId: string | null;
  anchorItemId: string | null;
  backHistory: string[];
  forwardHistory: string[];
};

export type ExplorerTabView = {
  id: ExplorerTabId;
  title: string;
  customTitle: string | null;
  currentPath: string;
  iconDataUrl?: string;
  active: boolean;
};

export type ExplorerWorkspaceState = {
  windowId: ExplorerWindowId;
  activeTabId: ExplorerTabId | null;
  tabs: ExplorerTabView[];
  initialized: boolean;
};

export type ExplorerWindowBootstrap = {
  sourceWindowId?: ExplorerWindowId;
  transferId?: string;
  tab: ExplorerTabSnapshot;
};

export type ExplorerTabDetachResult = {
  transferId: string;
  ok: boolean;
  windowId?: ExplorerWindowId;
};

export function createJobId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createExplorerTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createExplorerWindowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `window-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function findMatchingSidebarRoot(path: string, roots: SidebarRoot[]) {
  const normalizedPath = normalizeExplorerPath(path);
  if (!normalizedPath) {
    return roots.find((root) => root.kind === "favorite") ?? null;
  }

  let bestMatch: SidebarRoot | null = null;
  for (const root of roots) {
    const normalizedRootPath = normalizeExplorerPath(root.path);
    if (!normalizedRootPath) {
      continue;
    }

    if (!pathStartsWithinRoot(normalizedPath, normalizedRootPath)) {
      continue;
    }

    if (!bestMatch || normalizedRootPath.length > normalizeExplorerPath(bestMatch.path).length) {
      bestMatch = root;
    }
  }

  return bestMatch;
}

function normalizeExplorerPath(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}

function pathStartsWithinRoot(path: string, rootPath: string) {
  if (path === rootPath) {
    return true;
  }

  const rootPathWithSeparator = `${rootPath}\\`;
  return path.startsWith(rootPathWithSeparator);
}
