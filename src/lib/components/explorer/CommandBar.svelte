<script lang="ts">
  import ActionGlyph from "$lib/components/explorer/ActionGlyph.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { getActionsForSurface, runExplorerAction } from "$lib/stores/explorerActions";
  import { explorerSession } from "$lib/stores/explorerSession";

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
  const actions = $derived(getActionsForSurface("command-bar", actionContext));
  const separatorsAfter = new Set(["new-folder", "paste"]);
</script>

<div class="command-bar" role="toolbar" aria-label="Explorer actions">
  {#each actions as action}
    <Button
      className="command"
      variant={action.id === "new-folder" ? "solid" : "ghost"}
      disabled={!action.enabled}
      onclick={() => runExplorerAction(action.id, actionContext)}
    >
      {#snippet icon()}
        <ActionGlyph icon={action.icon} size={15} />
      {/snippet}
      {action.label}
    </Button>
    {#if separatorsAfter.has(action.id)}
      <span class="separator" aria-hidden="true"></span>
    {/if}
  {/each}
</div>

<style>
  .command-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-bottom: none;
    background: var(--surface-subtle);
    position: relative;
    z-index: 2;
  }

  :global(.command) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 26px;
    padding: 0 8px;
    color: color-mix(in srgb, var(--text-primary) 92%, transparent);
    font-size: 0.79rem;
  }

  :global(.command .glyph) {
    color: color-mix(in srgb, var(--pill-text) 90%, transparent);
  }

  :global(.command:disabled) {
    opacity: 0.52;
    color: color-mix(in srgb, var(--text-muted) 70%, transparent);
  }

  :global(.command:disabled .glyph) {
    color: color-mix(in srgb, var(--text-muted) 70%, transparent);
  }

  .separator {
    width: 1px;
    height: 14px;
    margin: 0 4px;
    background: color-mix(in srgb, var(--panel-border) 62%, transparent);
  }
</style>
