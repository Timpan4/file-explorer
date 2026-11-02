import type { FileOperationKind } from "$lib/types/explorer";

export function formatFileOperationItemCount(count: number) {
  return `${count} item${count === 1 ? "" : "s"}`;
}

export function fileOperationVerb(kind: FileOperationKind) {
  return kind === "copy" ? "Copied" : "Moved";
}

export function summarizeFileOperation(kind: FileOperationKind, completed: number, skipped: number, failed: number) {
  const verb = fileOperationVerb(kind);
  if (failed === 0 && skipped === 0) {
    return `${verb} ${formatFileOperationItemCount(completed)}.`;
  }

  const parts = [];
  if (completed > 0) parts.push(`${completed} completed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (failed > 0) parts.push(`${failed} failed`);
  return `${verb} operation finished: ${parts.join(", ")}.`;
}

export function normalizeExplorerPathForCompare(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}

export function getFileOperationErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "File operation failed.";
}
