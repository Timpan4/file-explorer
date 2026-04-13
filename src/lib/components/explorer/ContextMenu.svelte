<script lang="ts">
  import ActionGlyph from "$lib/components/explorer/ActionGlyph.svelte";
  import { onDestroy } from "svelte";
  import { getActionsForSurface, runExplorerAction } from "$lib/stores/explorerActions";
  import { explorerSession } from "$lib/stores/explorerSession";
  import { explorerUi } from "$lib/stores/explorerUi";

  let { contextMenu } = $derived($explorerUi);
  let { currentPath, selectedIds, items } = $derived($explorerSession);
  const actionContext = $derived.by(() => {
    const selectedIdSet = new Set(selectedIds);
    const selectedItems = items.filter((item) => selectedIdSet.has(item.id));

    return {
      currentPath,
      selectedItems,
      selectedCount: selectedItems.length,
      hasSelection: selectedItems.length > 0,
      clipboardAvailable: false
    };
  });
  const actions = $derived(contextMenu.open ? getActionsForSurface(contextMenu.surface, actionContext) : []);
  const clampedX = $derived(Math.max(12, Math.min(contextMenu.x, window.innerWidth - 224)));
  const clampedY = $derived(Math.max(12, Math.min(contextMenu.y, window.innerHeight - 260)));

  function close() { explorerUi.closeContextMenu(); }
  function handleWindowPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null;
    if (!target?.closest(".context-menu")) close();
  }
  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") close();
  }
  onDestroy(() => explorerUi.closeContextMenu());
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

{#if contextMenu.open}
  <div class="context-menu" style={`left:${clampedX}px; top:${clampedY}px;`}>
    {#each actions as action}
      <button class="item" disabled={!action.enabled} onclick={() => { runExplorerAction(action.id, actionContext); close(); }} type="button">
        <ActionGlyph icon={action.icon} size={14} />
        <span>{action.label}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1100;
    display: grid;
    min-width: 200px;
    padding: 6px;
    border: 1px solid color-mix(in srgb, var(--panel-border) 92%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--surface-raised) 99%, transparent);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(10px);
  }

  .item {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    font-size: 0.82rem;
  }

  .item :global(.glyph) {
    color: var(--text-muted);
  }

  .item:hover:enabled {
    border-color: color-mix(in srgb, var(--button-hover-border) 68%, transparent);
    background: color-mix(in srgb, var(--button-hover-bg) 54%, transparent);
  }

  .item:hover:enabled :global(.glyph) {
    color: var(--pill-text);
  }

  .item:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }
</style>
