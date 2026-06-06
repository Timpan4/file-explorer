import { get } from "svelte/store";
import { confirm } from "$lib/stores/dialogs";
import { explorerFileOperations } from "$lib/stores/explorerFileOperations";
import { notify, notifications } from "$lib/stores/notifications";
import { explorerSession } from "$lib/stores/explorerSession";
import { getActionsForSurface } from "$lib/stores/explorerActionCatalog";
import type {
  ExplorerActionContext,
  ExplorerActionId
} from "$lib/types/actions";

export { getActionsForSurface } from "$lib/stores/explorerActionCatalog";

export function getExplorerActionContext(): ExplorerActionContext {
  const state = get(explorerSession);
  const operationState = get(explorerFileOperations);
  const selectedIdSet = new Set(state.selectedIds);
  const selectedItems = state.items.filter((item) => selectedIdSet.has(item.id));

  return {
    currentPath: state.currentPath,
    selectedItems,
    selectedCount: selectedItems.length,
    hasSelection: selectedItems.length > 0,
    clipboardAvailable: Boolean(operationState.clipboard && operationState.clipboard.items.length > 0)
  };
}

export async function runExplorerAction(actionId: ExplorerActionId, context = getExplorerActionContext()) {
  const action = getActionsForSurface(actionSurfaceForId(actionId), context).find((candidate) => candidate.id === actionId);
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
      explorerFileOperations.setClipboard("move", context.selectedItems);
      break;
    case "copy":
      explorerFileOperations.setClipboard("copy", context.selectedItems);
      break;
    case "paste":
      await explorerFileOperations.pasteInto(context.currentPath);
      break;
    case "open":
      await openSelection(context);
      break;
    case "refresh":
      explorerSession.refresh();
      break;
  }
}

function actionSurfaceForId(actionId: ExplorerActionId) {
  return actionId === "open"
    ? "row-menu"
    : actionId === "refresh"
      ? "background-menu"
      : "command-bar";
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

async function openSelection(context: ExplorerActionContext) {
  const item = context.selectedItems[0];
  if (!item) return;
  await explorerSession.openItem(item);
}

