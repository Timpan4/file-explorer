<script lang="ts">
  import { onDestroy } from "svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import type { JobId } from "$lib/types/explorer";
  import * as explorerTimingTrace from "$lib/utils/explorerTimingTrace";

  const LOADING_VISUAL_DELAY_MS = 200;
  const REFRESH_CONFIRMATION_SPIN_MS = 200;
  const timingTraceModule = explorerTimingTrace as Record<string, unknown>;
  const markLoadingVisual = timingTraceModule["markExplorerLoadingVisual"] as (
    jobId: JobId | null | undefined,
    visual: "toolbar_cancel" | "toolbar_refresh",
    details?: Record<string, unknown>
  ) => void;

  let {
    onRefresh,
    onUp,
    onBack,
    onForward,
    onCancel,
    loading = false,
    loadingJobId = null,
    canGoBack = false,
    canGoForward = false
  }: {
    onRefresh: () => void;
    onUp: () => void;
    onBack: () => void;
    onForward: () => void;
    onCancel: () => void;
    loading?: boolean;
    loadingJobId?: JobId | null;
    canGoBack?: boolean;
    canGoForward?: boolean;
  } = $props();

  let showCancel = $state(false);
  let cancelDelayTimer: ReturnType<typeof setTimeout> | null = null;
  let showRefreshSpin = $state(false);
  let refreshSpinTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (loading) {
      const cancelVisualJobId = loadingJobId;
      if (!cancelDelayTimer) {
        cancelDelayTimer = setTimeout(() => {
          showCancel = true;
          markLoadingVisual(cancelVisualJobId, "toolbar_cancel", {
            thresholdMs: LOADING_VISUAL_DELAY_MS
          });
          cancelDelayTimer = null;
        }, LOADING_VISUAL_DELAY_MS);
      }

      return () => {
        if (cancelDelayTimer) {
          clearTimeout(cancelDelayTimer);
          cancelDelayTimer = null;
        }
      };
    }

    if (cancelDelayTimer) {
      clearTimeout(cancelDelayTimer);
      cancelDelayTimer = null;
    }

    showCancel = false;
  });

  function handleRefreshClick() {
    if (loading) {
      return;
    }

    showRefreshSpin = true;
    markLoadingVisual(loadingJobId, "toolbar_refresh", {
      durationMs: REFRESH_CONFIRMATION_SPIN_MS,
      immediate: true
    });

    if (refreshSpinTimer) {
      clearTimeout(refreshSpinTimer);
    }

    refreshSpinTimer = setTimeout(() => {
      showRefreshSpin = false;
      refreshSpinTimer = null;
    }, REFRESH_CONFIRMATION_SPIN_MS);

    onRefresh();
  }

  onDestroy(() => {
    if (cancelDelayTimer) {
      clearTimeout(cancelDelayTimer);
    }

    if (refreshSpinTimer) {
      clearTimeout(refreshSpinTimer);
    }
  });
</script>

<div class="toolbar" aria-label="Navigation controls">
  <Button className="toolbar-button" disabled={!canGoBack} title="Back" ariaLabel="Back" onclick={onBack} iconOnly>
    {#snippet icon()}
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.75 3.25 5 8l4.75 4.75" />
      </svg>
    {/snippet}
  </Button>

  <Button className="toolbar-button" disabled={!canGoForward} title="Forward" ariaLabel="Forward" onclick={onForward} iconOnly>
    {#snippet icon()}
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6.25 3.25 11 8l-4.75 4.75" />
      </svg>
    {/snippet}
  </Button>

  <Button className="toolbar-button" title="Up" ariaLabel="Up" onclick={onUp} iconOnly>
    {#snippet icon()}
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3.25v9.5" />
        <path d="M4.75 6.5 8 3.25 11.25 6.5" />
      </svg>
    {/snippet}
  </Button>

  <Button
    className={`toolbar-button refresh-button ${!showCancel && showRefreshSpin ? "spinning" : ""}`}
    title={showCancel ? "Cancel" : "Refresh"}
    ariaLabel={showCancel ? "Cancel" : "Refresh"}
    onclick={showCancel ? onCancel : handleRefreshClick}
    iconOnly
  >
    {#snippet icon()}
      {#if showCancel}
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.25 4.25 11.75 11.75" />
          <path d="M11.75 4.25 4.25 11.75" />
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M12.5 5.5A4.75 4.75 0 1 0 13 8" />
          <path d="M12.5 2.75V5.5H9.75" />
        </svg>
      {/if}
    {/snippet}
  </Button>
</div>

<style>
  .toolbar {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    user-select: none;
    -webkit-user-select: none;
  }

  :global(.toolbar-button.refresh-button.spinning svg) {
    animation: spin 0.2s linear 1;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }
</style>
