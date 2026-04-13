import { get } from "svelte/store";
import { confirm } from "$lib/stores/dialogs";
import { notify, notifications } from "$lib/stores/notifications";
import { explorerSession } from "$lib/stores/explorerSession";
import type {
  ExplorerActionContext,
  ExplorerActionDescriptor,
  ExplorerActionId,
  ExplorerActionSurface
} from "$lib/types/actions";
import type { DirectoryItemStub } from "$lib/types/explorer";

let clipboardItems: DirectoryItemStub[] = [];

const ACTIONS: Record<ExplorerActionId, ExplorerActionDescriptor> = {
  "new-folder": { id: "new-folder", label: "New", icon: "new", isEnabled: () => true },
  rename: { id: "rename", label: "Rename", icon: "rename", requiresSelection: true, isEnabled: (c) => c.selectedCount === 1 },
  delete: { id: "delete", label: "Delete", icon: "delete", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  cut: { id: "cut", label: "Cut", icon: "cut", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  copy: { id: "copy", label: "Copy", icon: "copy", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  paste: { id: "paste", label: "Paste", icon: "paste", isEnabled: (c) => c.clipboardAvailable },
  properties: { id: "properties", label: "Properties", icon: "properties", isEnabled: (c) => c.hasSelection },
  open: { id: "open", label: "Open", icon: "open", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  refresh: { id: "refresh", label: "Refresh", icon: "refresh", isEnabled: () => true }
};

const SURFACES: Record<ExplorerActionSurface, ExplorerActionId[]> = {
  "command-bar": ["new-folder", "rename", "delete", "cut", "copy", "paste", "properties"],
  "row-menu": ["open", "rename", "delete", "cut", "copy", "paste", "properties"],
  "background-menu": ["refresh", "new-folder", "paste", "properties"]
};

export function getExplorerActionContext(): ExplorerActionContext {
  const state = get(explorerSession);
  const selectedIdSet = new Set(state.selectedIds);
  const selectedItems = state.items.filter((item) => selectedIdSet.has(item.id));

  return {
    currentPath: state.currentPath,
    selectedItems,
    selectedCount: selectedItems.length,
    hasSelection: selectedItems.length > 0,
    clipboardAvailable: clipboardItems.length > 0
  };
}

export function getActionsForSurface(surface: ExplorerActionSurface, context: ExplorerActionContext) {
  return SURFACES[surface].map((id) => ({ ...ACTIONS[id], enabled: ACTIONS[id].isEnabled(context) }));
}

export async function runExplorerAction(actionId: ExplorerActionId, context = getExplorerActionContext()) {
  const action = ACTIONS[actionId];
  if (!action || !action.isEnabled(context)) return;

  switch (actionId) {
    case "new-folder":
      await explorerSession.createNewFolder();
      break;
    case "rename":
      explorerSession.beginRenameSelection();
      break;
    case "delete":
      await deleteSelection(context);
      break;
    case "cut":
      mockCut(context);
      break;
    case "copy":
      mockCopy(context);
      break;
    case "paste":
      mockPaste(context);
      break;
    case "open":
      await openSelection(context);
      break;
    case "properties":
      mockProperties(context);
      break;
    case "refresh":
      explorerSession.refresh();
      break;
  }
}

async function deleteSelection(context: ExplorerActionContext) {
  const label = context.selectedCount === 1
    ? `"${context.selectedItems[0]?.name}"`
    : `${context.selectedCount} items`;

  const confirmed = await confirm({
    title: context.selectedCount === 1
      ? `Delete ${label}?`
      : `Delete ${context.selectedCount} items?`,
    message: context.selectedCount === 1
      ? "This item will be moved to the Recycle Bin."
      : "These items will be moved to the Recycle Bin.",
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
    tone: "danger"
  });

  if (!confirmed) {
    return;
  }

  const progressId = notify.warning(`Moving ${label} to Recycle Bin...`, { durationMs: 0 });

  try {
    await explorerSession.deleteItems(context.selectedItems);
  } finally {
    notifications.dismiss(progressId);
  }
}

function mockCopy(context: ExplorerActionContext) {
  clipboardItems = [...context.selectedItems];

  const label = context.selectedCount === 1
    ? `"${context.selectedItems[0]?.name}"`
    : `${context.selectedCount} items`;

  notify.info(`Copied ${label} to clipboard`);
}

function mockCut(context: ExplorerActionContext) {
  clipboardItems = [...context.selectedItems];

  const label = context.selectedCount === 1
    ? `"${context.selectedItems[0]?.name}"`
    : `${context.selectedCount} items`;

  notify.info(`Cut ${label} to clipboard`);
}

function mockPaste(context: ExplorerActionContext) {
  const count = clipboardItems.length;
  if (count === 0) return;

  const label = count === 1
    ? `"${clipboardItems[0]?.name}"`
    : `${count} items`;

  const progressId = notify.info(`Pasting ${label}...`, { durationMs: 0 });

  setTimeout(() => {
    notifications.dismiss(progressId);
    notify.success(`Pasted ${label} into ${shortenPath(context.currentPath)}`);
  }, 800);
}

async function openSelection(context: ExplorerActionContext) {
  const item = context.selectedItems[0];
  if (!item) return;
  await explorerSession.openItem(item);
}

function mockProperties(context: ExplorerActionContext) {
  if (context.selectedCount === 1) {
    notify.info(`Properties for "${context.selectedItems[0]?.name}"`);
  } else if (context.hasSelection) {
    notify.info(`Properties for ${context.selectedCount} items`);
  } else {
    notify.info(`Properties for ${shortenPath(context.currentPath)}`);
  }
}

function shortenPath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return `.../${parts[parts.length - 1]}`;
}
