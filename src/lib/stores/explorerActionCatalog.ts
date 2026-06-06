import type {
  ExplorerActionContext,
  ExplorerActionDescriptor,
  ExplorerActionId,
  ExplorerActionSurface
} from "$lib/types/actions";

const ACTIONS: Record<ExplorerActionId, ExplorerActionDescriptor> = {
  "new-folder": { id: "new-folder", label: "New", icon: "new", isEnabled: () => true },
  rename: { id: "rename", label: "Rename", icon: "rename", requiresSelection: true, isEnabled: (c) => c.selectedCount === 1 },
  delete: { id: "delete", label: "Delete", icon: "delete", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  cut: { id: "cut", label: "Cut", icon: "cut", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  copy: { id: "copy", label: "Copy", icon: "copy", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  paste: { id: "paste", label: "Paste", icon: "paste", isEnabled: (c) => c.clipboardAvailable },
  open: { id: "open", label: "Open", icon: "open", requiresSelection: true, isEnabled: (c) => c.hasSelection },
  refresh: { id: "refresh", label: "Refresh", icon: "refresh", isEnabled: () => true }
};

const SURFACES: Record<ExplorerActionSurface, ExplorerActionId[]> = {
  "command-bar": ["new-folder", "rename", "delete", "cut", "copy", "paste"],
  "row-menu": ["open", "rename", "delete", "cut", "copy", "paste"],
  "background-menu": ["refresh", "new-folder", "paste"]
};

export function getActionsForSurface(surface: ExplorerActionSurface, context: ExplorerActionContext) {
  return SURFACES[surface].map((id) => ({ ...ACTIONS[id], enabled: ACTIONS[id].isEnabled(context) }));
}
