import type { DirectoryItemStub } from "$lib/types/explorer";

export type ExplorerActionId =
  | "new-folder"
  | "rename"
  | "delete"
  | "cut"
  | "copy"
  | "paste"
  | "properties"
  | "open"
  | "refresh";

export type ExplorerActionIcon =
  | "new"
  | "rename"
  | "delete"
  | "cut"
  | "copy"
  | "paste"
  | "properties"
  | "open"
  | "refresh";

export type ExplorerActionContext = {
  currentPath: string;
  selectedItems: DirectoryItemStub[];
  selectedCount: number;
  hasSelection: boolean;
  clipboardAvailable: boolean;
};

export type ExplorerActionDescriptor = {
  id: ExplorerActionId;
  label: string;
  icon: ExplorerActionIcon;
  requiresSelection?: boolean;
  isEnabled: (context: ExplorerActionContext) => boolean;
};

export type ExplorerActionSurface = "command-bar" | "row-menu" | "background-menu";
