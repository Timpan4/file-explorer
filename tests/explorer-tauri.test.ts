import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ExplorerStreamEvent, NavigationRequest, SidebarRoot } from "../src/lib/types/explorer";

type InvokeArgs = Record<string, unknown> | number[] | ArrayBuffer | Uint8Array;
type InvokeCall = {
  command: string;
  args?: InvokeArgs;
  options?: unknown;
};

class TestChannel<T> {
  private handler: (message: T) => void = () => {};

  set onmessage(handler: (message: T) => void) {
    this.handler = handler;
  }

  get onmessage() {
    return this.handler;
  }

  emit(message: T) {
    this.handler(message);
  }
}

const calls: InvokeCall[] = [];
let responses: Record<string, unknown> = {};

const invokeMock = mock(async (
  command: string,
  args?: InvokeArgs,
  options?: unknown
): Promise<unknown> => {
  calls.push({ command, args, options });
  if (command in responses) {
    return responses[command];
  }

  throw new Error(`No mock response for command: ${command}`);
});

mock.module("@tauri-apps/api/core", () => ({
  Channel: TestChannel,
  invoke: invokeMock
}));

const explorer = await import("../src/lib/tauri/explorer");

function requireRecord(value: unknown) {
  expect(value).toBeDefined();
  expect(typeof value).toBe("object");
  expect(Array.isArray(value)).toBe(false);
  return value as Record<string, unknown>;
}

beforeEach(() => {
  calls.length = 0;
  responses = {};
});

describe("typed Explorer Tauri wrappers", () => {
  test("returns sidebar roots from the list roots command", async () => {
    const roots: SidebarRoot[] = [
      { id: "home", label: "Home", path: "C:\\Users\\timpa", kind: "favorite" }
    ];
    responses = { list_sidebar_roots: roots };

    await expect(explorer.listSidebarRoots()).resolves.toEqual(roots);

    expect(calls).toEqual([
      { command: "list_sidebar_roots", args: undefined, options: undefined }
    ]);
  });

  test("passes command payloads through typed invoke calls", async () => {
    responses = {
      cancel_directory_navigation: undefined,
      hydrate_directory_icons: { items: [], iconLookupTotalMs: 0, iconLookupCount: 0, iconEncodeTotalMs: 0, totalMs: 0 },
      rename_directory_item: { path: "C:\\Work\\Report.txt", name: "Report.txt" },
      open_directory_item: undefined,
      create_directory: { path: "C:\\Work\\New Folder", name: "New Folder", parentPath: "C:\\Work" },
      delete_to_recycle_bin: { deleted: [], failed: [], affectedParentPaths: [] }
    };

    await explorer.cancelDirectoryNavigation({ jobId: "job-1" });
    await explorer.hydrateDirectoryIcons({ items: [{ path: "C:\\Work\\a.txt", kind: "file" }] });
    await explorer.renameDirectoryItem({ sourcePath: "C:\\Work\\a.txt", targetName: "Report.txt" });
    await explorer.openDirectoryItem({ targetPath: "C:\\Work\\Report.txt" });
    await explorer.createDirectory({ parentPath: "C:\\Work" });
    await explorer.deleteToRecycleBin({ targetPaths: ["C:\\Work\\old.txt"] });

    expect(calls.map((call) => call.command)).toEqual([
      "cancel_directory_navigation",
      "hydrate_directory_icons",
      "rename_directory_item",
      "open_directory_item",
      "create_directory",
      "delete_to_recycle_bin"
    ]);
    expect(calls.map((call) => requireRecord(call.args).request)).toEqual([
      { jobId: "job-1" },
      { items: [{ path: "C:\\Work\\a.txt", kind: "file" }] },
      { sourcePath: "C:\\Work\\a.txt", targetName: "Report.txt" },
      { targetPath: "C:\\Work\\Report.txt" },
      { parentPath: "C:\\Work" },
      { targetPaths: ["C:\\Work\\old.txt"] }
    ]);
  });

  test("creates a directory navigation channel and wires stream messages", async () => {
    const request: NavigationRequest = {
      jobId: "job-1",
      tabId: "tab-1",
      path: "C:\\Work",
      query: "report",
      sort: { field: "name", direction: "asc" },
      includeHidden: false,
      forceRefresh: true,
      viewportHint: { start: 0, count: 120 }
    };
    responses = { start_directory_navigation: undefined };
    const received: ExplorerStreamEvent[] = [];

    const channel = await explorer.startDirectoryNavigation(request, (event) => received.push(event));
    const event: ExplorerStreamEvent = {
      event: "snapshotStarted",
      data: { jobId: "job-1", path: "C:\\Work", query: "report", snapshotToken: "token-1" }
    };
    (channel as unknown as TestChannel<ExplorerStreamEvent>).emit(event);

    expect(received).toEqual([event]);
    expect(calls[0]?.command).toBe("start_directory_navigation");
    expect(requireRecord(calls[0]?.args).request).toEqual(request);
    expect(requireRecord(calls[0]?.args).onEvent).toBe(channel);
  });
});
