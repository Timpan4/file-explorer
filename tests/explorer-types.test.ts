import { describe, expect, test } from "bun:test";
import { findMatchingSidebarRoot, type SidebarRoot } from "../src/lib/types/explorer";

const roots: SidebarRoot[] = [
  { id: "home", label: "Home", path: "C:\\Users\\timpa", kind: "favorite" },
  { id: "drive-c", label: "C:\\", path: "C:\\", kind: "drive" },
  { id: "projects", label: "Projects", path: "C:\\Users\\timpa\\Projects", kind: "favorite" }
];

describe("findMatchingSidebarRoot", () => {
  test("returns the deepest matching root for a descendant path", () => {
    expect(findMatchingSidebarRoot("C:\\Users\\timpa\\Projects\\file-explorer", roots)).toEqual(roots[2]);
  });

  test("matches roots case-insensitively and ignores trailing separators", () => {
    expect(findMatchingSidebarRoot("c:\\users\\timpa\\", roots)).toEqual(roots[0]);
  });

  test("does not match roots by string prefix alone", () => {
    expect(findMatchingSidebarRoot("C:\\Users\\timpa-other", roots)).toEqual(roots[1]);
  });

  test("falls back to the first favorite root for empty paths", () => {
    expect(findMatchingSidebarRoot("   ", roots)).toEqual(roots[0]);
  });
});
