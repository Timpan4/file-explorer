<script lang="ts">
  import { explorerUi } from "$lib/stores/explorerUi";
  import { explorerSession } from "$lib/stores/explorerSession";
  import type { DirectoryItemStub, JobId } from "$lib/types/explorer";
  import DirectoryRow from "$lib/components/explorer/DirectoryRow.svelte";
  import * as explorerTimingTrace from "$lib/utils/explorerTimingTrace";

  type RenameState = {
    itemId: string;
    draftName: string;
    status: "editing" | "submitting";
    error: string | null;
  } | null;

  const ROW_HEIGHT = 42;
  const OVERSCAN = 10;
  const ENABLE_ROW_VISIBILITY_TRACE = explorerTimingTrace.isExplorerTimingTraceEnabled();

  let {
    items,
    scrollTop = 0,
    viewportHeight = 0,
    viewportElement = null,
    renderedJobId = null
  }: {
    items: DirectoryItemStub[];
    scrollTop?: number;
    viewportHeight?: number;
    viewportElement?: HTMLDivElement | null;
    renderedJobId?: JobId | null;
  } = $props();

  let listElement = $state<HTMLDivElement | null>(null);

  let { selectedIds, focusedItemId } = $derived($explorerSession);
  const rename = $derived(($explorerSession as { rename?: RenameState }).rename ?? null);
  const totalHeight = $derived(items.length * ROW_HEIGHT);
  const visibleCount = $derived(Math.max(1, Math.ceil(viewportHeight / ROW_HEIGHT)));
  const startIndex = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
  const endIndex = $derived(Math.min(items.length, startIndex + visibleCount + OVERSCAN * 2));
  const visibleItems = $derived(items.slice(startIndex, endIndex));
  const topSpacerHeight = $derived(startIndex * ROW_HEIGHT);
  const bottomSpacerHeight = $derived(Math.max(0, totalHeight - endIndex * ROW_HEIGHT));

  $effect(() => {
    if (!viewportElement || !focusedItemId) {
      return;
    }

    const focusedIndex = items.findIndex((item) => item.id === focusedItemId);
    if (focusedIndex === -1) {
      return;
    }

    const rowTop = focusedIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewTop = viewportElement.scrollTop;
    const viewBottom = viewTop + viewportHeight;

    if (rowTop < viewTop) {
      viewportElement.scrollTop = rowTop;
      return;
    }

    if (rowBottom > viewBottom) {
      viewportElement.scrollTop = rowBottom - viewportHeight;
    }
  });

  $effect(() => {
    if (visibleItems.length === 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      explorerSession.hydrateVisibleIcons(visibleItems);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  });

  $effect(() => {
    if (!ENABLE_ROW_VISIBILITY_TRACE) {
      return;
    }

    if (!renderedJobId) {
      return;
    }

    if (visibleItems.length === 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      explorerTimingTrace.markExplorerTraceRowsVisible(renderedJobId, {
        renderedRowCount: visibleItems.length,
        totalItemCount: items.length,
        startIndex,
        endIndex
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  });

  async function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      explorerSession.moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      explorerSession.moveFocus(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      explorerSession.focusFirst();
    } else if (event.key === "End") {
      event.preventDefault();
      explorerSession.focusLast();
    } else if (event.key === "Enter") {
      event.preventDefault();
      await explorerSession.openFocused();
    } else if (event.key === "F2") {
      event.preventDefault();
      explorerSession.beginRenameSelection();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      await explorerSession.goUp();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      explorerSession.selectAllVisible();
    } else if (event.key === "Escape") {
      event.preventDefault();
      explorerSession.clearSelection();
    }
  }

  function handleSelect(item: DirectoryItemStub, event: MouseEvent) {
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey && selectedIds.length === 1 && selectedIds[0] === item.id) {
      listElement?.focus();
      return;
    }

    explorerSession.selectWithModifiers(item.id, {
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    });

    listElement?.focus();
  }

  function handleBackgroundClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".row")) {
      return;
    }

    explorerSession.clearSelection();
    explorerUi.closeContextMenu();
    listElement?.focus();
  }

  function handleRowContextMenu(item: DirectoryItemStub, event: MouseEvent) {
    event.preventDefault();
    if (!selectedIds.includes(item.id)) {
      explorerSession.selectSingle(item.id);
    }
    explorerUi.openContextMenu("row-menu", event.clientX, event.clientY);
    listElement?.focus();
  }

  function handleBackgroundContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".row")) {
      return;
    }

    event.preventDefault();
    explorerSession.clearSelection();
    explorerUi.openContextMenu("background-menu", event.clientX, event.clientY);
    listElement?.focus();
  }
</script>

<div
  bind:this={listElement}
  class="list"
  onclick={handleBackgroundClick}
  oncontextmenu={handleBackgroundContextMenu}
  onkeydown={handleKeydown}
  tabindex="0"
  role="listbox"
  aria-label="Directory listing"
>
  <div class="table-surface">
    <div class="spacer" style={`height:${topSpacerHeight}px;`}></div>
    {#each visibleItems as item, offset (item.id)}
      <DirectoryRow
        {item}
        rowId={`dir-row-${startIndex + offset}`}
        selected={selectedIds.includes(item.id)}
        focused={focusedItemId === item.id}
        rename={rename}
        onSelect={handleSelect}
        onContextMenu={handleRowContextMenu}
        onOpen={(selectedItem) => explorerSession.openItem(selectedItem)}
        onRenameDraftChange={(draftName) => explorerSession.updateRenameDraft(draftName)}
        onRenameSubmit={() => explorerSession.submitRename()}
        onRenameCancel={() => explorerSession.cancelRename()}
      />
    {/each}
    <div class="spacer" style={`height:${bottomSpacerHeight}px;`}></div>
  </div>
</div>

<style>
  .list {
    display: grid;
    outline: none;
    background: transparent;
    padding: 0 8px 8px;
    box-sizing: border-box;
    user-select: none;
    -webkit-user-select: none;
  }

  .spacer {
    width: 100%;
  }

  .table-surface {
    display: grid;
  }

  .list:focus-visible {
    box-shadow: inset 0 0 0 2px var(--focus-ring);
  }

  .list:not(:focus-within) :global(.row.selected) {
    background: color-mix(in srgb, var(--selection-bg) 48%, transparent);
    border-color: color-mix(in srgb, var(--selection-border) 28%, transparent);
    color: var(--text-primary);
  }

  .list:not(:focus-within) :global(.row.selected .meta) {
    color: color-mix(in srgb, var(--text-muted) 92%, transparent);
  }

  .list:not(:focus-within) :global(.row.focused) {
    outline: none;
  }
</style>
