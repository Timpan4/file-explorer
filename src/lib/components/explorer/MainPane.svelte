<script lang="ts">
  import { onDestroy } from "svelte";
  import CommandBar from "$lib/components/explorer/CommandBar.svelte";
  import ContextMenu from "$lib/components/explorer/ContextMenu.svelte";
  import { explorerSession } from "$lib/stores/explorerSession";
  import DirectoryHeader from "$lib/components/explorer/DirectoryHeader.svelte";
  import DirectoryList from "$lib/components/explorer/DirectoryList.svelte";
  import EmptyState from "$lib/components/explorer/EmptyState.svelte";
  import ErrorState from "$lib/components/explorer/ErrorState.svelte";
  import LoadingState from "$lib/components/explorer/LoadingState.svelte";
  import { markExplorerLoadingVisual } from "$lib/utils/explorerTimingTrace";

  const LOADING_VISUAL_DELAY_MS = 200;

  const explorerState = $derived($explorerSession);
  const status = $derived(explorerState.status);
  const filteredItems = $derived(explorerState.filteredItems);
  const currentPath = $derived(explorerState.currentPath);
  const error = $derived(explorerState.error);
  const appliedSearchQuery = $derived(($explorerSession as any).appliedSearchQuery as string);
  const activeJobId = $derived(explorerState.activeJobId);
  const isRefreshing = $derived(explorerState.isRefreshing);
  const items = $derived(explorerState.items);
  const visibleSnapshotJobId = $derived(explorerState.visibleSnapshotJobId);
  const isLoading = $derived(status === "loading");
  let viewportElement = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);
  let showLoadingState = $state(false);
  let loadingTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    const shouldDelayLoader = status === "loading" && !isRefreshing && items.length === 0 && filteredItems.length === 0;

    const loadingVisualJobId = activeJobId;

    if (shouldDelayLoader) {
      if (!loadingTimer) {
        loadingTimer = setTimeout(() => {
          showLoadingState = true;
          markExplorerLoadingVisual(loadingVisualJobId, "pane", {
            thresholdMs: LOADING_VISUAL_DELAY_MS,
            visibleRowsBeforeSwap: items.length
          });
          loadingTimer = null;
        }, LOADING_VISUAL_DELAY_MS);
      }

      return () => {
        if (loadingTimer) {
          clearTimeout(loadingTimer);
          loadingTimer = null;
        }
      };
    }

    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }

    showLoadingState = false;
  });

  onDestroy(() => {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }
  });
</script>

<section class="pane">
  {#if appliedSearchQuery}
    <div class="pane-head">
      <p class="meta">Showing {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"} in {currentPath}</p>
    </div>
  {/if}

  <CommandBar />
  <div
    class="viewport"
    bind:this={viewportElement}
    bind:clientHeight={viewportHeight}
    onscroll={(event) => {
      scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
    }}
  >
    <DirectoryHeader />
    {#if status === "error"}
      <ErrorState message={error ?? "Explorer navigation failed."} />
    {:else if showLoadingState}
      <LoadingState />
    {:else if isRefreshing}
      <DirectoryList {viewportElement} {scrollTop} {viewportHeight} items={filteredItems} renderedJobId={visibleSnapshotJobId} />
    {:else if !isLoading && filteredItems.length === 0}
      <EmptyState />
    {:else}
      <DirectoryList {viewportElement} {scrollTop} {viewportHeight} items={filteredItems} renderedJobId={visibleSnapshotJobId} />
    {/if}
  </div>

  <ContextMenu />
</section>

<style>
  .pane {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr);
    background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
    overflow: hidden;
    border-radius: 0;
  }

  .pane-head {
    padding: 8px 16px 6px;
    border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
    background: color-mix(in srgb, var(--surface-subtle) 88%, transparent);
  }

  .meta {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.76rem;
  }

  .viewport {
    min-height: 0;
    overflow: auto;
    background: var(--surface-input);
    padding-top: 0;
  }
</style>
