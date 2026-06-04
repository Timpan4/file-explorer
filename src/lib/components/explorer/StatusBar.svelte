<script lang="ts">
  import { onDestroy } from "svelte";
  import { explorerFileOperations } from "$lib/stores/explorerFileOperations";
  import { explorerSession } from "$lib/stores/explorerSession";

  const LOADING_VISUAL_DELAY_MS = 200;

  let { status, totalKnown, lastDurationMs, selectedIds, items, isRefreshing } = $derived($explorerSession);
  let { operations } = $derived($explorerFileOperations);
  let statusText = $state("Ready");
  let loadingTimer: ReturnType<typeof setTimeout> | null = null;

  const activeOperation = $derived.by(() =>
    operations.find((operation) => operation.status === "running" || operation.status === "waiting")
      ?? operations.find((operation) => operation.status === "queued")
      ?? null
  );
  const operationLabel = $derived.by(() => {
    if (!activeOperation) {
      return null;
    }

    if (activeOperation.status === "queued") {
      return `${operationVerb(activeOperation.kind)} queued`;
    }

    if (activeOperation.status === "waiting") {
      return activeOperation.message ?? `${operationVerb(activeOperation.kind)} waiting`;
    }

    return `${operationVerb(activeOperation.kind)} ${activeOperation.processedItems}/${activeOperation.totalItems}`;
  });
  const itemLabel = $derived(`${totalKnown} item${totalKnown === 1 ? "" : "s"}`);
  const selectionLabel = $derived(
    selectedIds.length > 0 ? `${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} selected` : null
  );
  const timingLabel = $derived(lastDurationMs !== null ? `${lastDurationMs} ms` : null);
  const selectedFileSizeLabel = $derived.by(() => {
    if (selectedIds.length === 0) {
      return null;
    }

    const selectedIdSet = new Set(selectedIds);
    const totalSelectedFileBytes = items.reduce((total, item) => {
      if (!selectedIdSet.has(item.id) || item.kind === "directory") {
        return total;
      }

      return total + (item.size ?? 0);
    }, 0);

    return totalSelectedFileBytes > 0 ? formatBytes(totalSelectedFileBytes) : null;
  });

  $effect(() => {
    const nextStatusText = status === "ready"
      ? "Ready"
      : status === "loading"
        ? (isRefreshing ? "Refreshing" : "Loading")
        : status.charAt(0).toUpperCase() + status.slice(1);

    if (nextStatusText === "Ready" && (status === "ready" || isRefreshing)) {
      if (loadingTimer) {
        clearTimeout(loadingTimer);
        loadingTimer = null;
      }

      if (!isRefreshing) {
        statusText = "Ready";
      }
      return;
    }

    if (nextStatusText === "Loading" || nextStatusText === "Refreshing") {
      if (!loadingTimer) {
        loadingTimer = setTimeout(() => {
          statusText = nextStatusText;
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

    statusText = nextStatusText;
  });

  onDestroy(() => {
    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }
  });
</script>

<footer class="status-bar">
  <div class="left">
    <span class="status">{statusText}</span>
    <span>{itemLabel}</span>
    {#if selectionLabel}
      <span>{selectionLabel}</span>
    {/if}
    {#if selectedFileSizeLabel}
      <span>{selectedFileSizeLabel}</span>
    {/if}
    {#if timingLabel}
      <span>{timingLabel}</span>
    {/if}
    {#if operationLabel && activeOperation}
      <span class="operation">{operationLabel}</span>
      <button class="cancel-operation" type="button" onclick={() => explorerFileOperations.cancel(activeOperation.id)}>
        Cancel
      </button>
    {/if}
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    min-height: 30px;
    padding: 0 12px;
    border-top: 1px solid color-mix(in srgb, var(--panel-border) 88%, transparent);
    background: var(--surface-subtle);
    color: var(--text-muted);
    font-size: 0.78rem;
    user-select: none;
    -webkit-user-select: none;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .status {
    color: var(--pill-text);
    font-weight: 600;
  }

  .operation {
    color: var(--text-primary);
  }

  .cancel-operation {
    min-height: 22px;
    padding: 0 7px;
    border: 1px solid var(--button-border);
    border-radius: 6px;
    background: var(--button-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.74rem;
  }

  .cancel-operation:hover {
    border-color: var(--button-hover-border);
    background: var(--button-hover-bg);
  }
</style>

<script lang="ts" module>
  function operationVerb(kind: "copy" | "move") {
    return kind === "copy" ? "Copy" : "Move";
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) {
      return "0 B";
    }

    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }
</script>
