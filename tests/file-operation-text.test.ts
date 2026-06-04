import { describe, expect, test } from "bun:test";
import {
  fileOperationVerb,
  formatFileOperationItemCount,
  getFileOperationErrorMessage,
  normalizeExplorerPathForCompare,
  summarizeFileOperation
} from "../src/lib/utils/fileOperationText";

describe("file operation text helpers", () => {
  test("formats item counts with singular and plural labels", () => {
    expect(formatFileOperationItemCount(1)).toBe("1 item");
    expect(formatFileOperationItemCount(2)).toBe("2 items");
  });

  test("uses operation-specific verbs", () => {
    expect(fileOperationVerb("copy")).toBe("Copied");
    expect(fileOperationVerb("move")).toBe("Moved");
  });

  test("summarizes clean and mixed terminal operation results", () => {
    expect(summarizeFileOperation("copy", 3, 0, 0)).toBe("Copied 3 items.");
    expect(summarizeFileOperation("move", 2, 1, 1)).toBe(
      "Moved operation finished: 2 completed, 1 skipped, 1 failed."
    );
  });

  test("normalizes paths for case-insensitive comparison", () => {
    expect(normalizeExplorerPathForCompare(" C:/Users/timpa/Projects/// ")).toBe(
      "c:/users/timpa/projects"
    );
    expect(normalizeExplorerPathForCompare("D:\\Archive\\\\")).toBe("d:\\archive");
  });

  test("returns user-visible file operation errors with a stable fallback", () => {
    expect(getFileOperationErrorMessage(new Error("Access denied."))).toBe("Access denied.");
    expect(getFileOperationErrorMessage("Access denied.")).toBe("File operation failed.");
  });
});
