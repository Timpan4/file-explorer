<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { explorerFileOperations } from "$lib/stores/explorerFileOperations";
  import type { FileConflictResolution } from "$lib/types/explorer";

  let { pendingConflict, operations } = $derived($explorerFileOperations);
  const operation = $derived(
    pendingConflict
      ? operations.find((candidate) => candidate.id === pendingConflict.operationId) ?? null
      : null
  );
  let resolving = $state<FileConflictResolution | "cancel" | null>(null);

  $effect(() => {
    if (!pendingConflict) {
      resolving = null;
    }
  });

  async function resolve(resolution: Exclude<FileConflictResolution, "ask">) {
    if (!pendingConflict || resolving) {
      return;
    }

    resolving = resolution;
    try {
      await explorerFileOperations.resolveConflict(
        pendingConflict.operationId,
        pendingConflict.conflictId,
        resolution
      );
    } finally {
      resolving = null;
    }
  }

  async function cancelOperation() {
    if (!pendingConflict || resolving) {
      return;
    }

    resolving = "cancel";
    try {
      await explorerFileOperations.cancel(pendingConflict.operationId);
    } finally {
      resolving = null;
    }
  }

  function shortPath(path: string) {
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 3) {
      return path;
    }

    return `...\\${parts.slice(-3).join("\\")}`;
  }
</script>

{#if pendingConflict}
  <div
    class="conflict"
    role="dialog"
    tabindex="-1"
    aria-labelledby="file-conflict-title"
    aria-describedby="file-conflict-description"
  >
    <div class="copy">
      <p class="eyebrow">{operation?.kind === "move" ? "Move conflict" : "Copy conflict"}</p>
      <h3 id="file-conflict-title">"{pendingConflict.name}" already exists</h3>
      <p id="file-conflict-description">
        Choose what to do with the item in {shortPath(pendingConflict.destinationPath)}.
      </p>
      <p class="source" title={pendingConflict.sourcePath}>From {shortPath(pendingConflict.sourcePath)}</p>
    </div>

    <div class="actions">
      <Button
        className="conflict-action"
        disabled={Boolean(resolving)}
        onclick={() => resolve("keepBoth")}
        variant="solid"
      >
        Keep both
      </Button>
      <Button
        className="conflict-action"
        disabled={Boolean(resolving)}
        onclick={() => resolve("replace")}
        variant="subtle"
      >
        Replace
      </Button>
      <Button
        className="conflict-action"
        disabled={Boolean(resolving)}
        onclick={() => resolve("skip")}
        variant="subtle"
      >
        Skip
      </Button>
      <Button
        className="conflict-action"
        disabled={Boolean(resolving)}
        onclick={cancelOperation}
        variant="ghost"
      >
        Cancel operation
      </Button>
    </div>
  </div>
{/if}

<style>
  .conflict {
    position: fixed;
    right: 18px;
    bottom: 44px;
    z-index: 1200;
    display: grid;
    grid-template-columns: minmax(220px, 1fr) auto;
    gap: 18px;
    width: min(620px, calc(100vw - 36px));
    padding: 14px;
    border: 1px solid color-mix(in srgb, var(--selection-border) 70%, var(--panel-border));
    border-radius: 8px;
    background: var(--surface-raised);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
    color: var(--text-primary);
  }

  .copy {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .eyebrow,
  h3,
  p {
    margin: 0;
  }

  .eyebrow {
    color: var(--pill-text);
    font-size: 0.72rem;
    font-weight: 700;
  }

  h3 {
    color: var(--text-strong);
    font-size: 0.92rem;
  }

  p {
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .source {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: wrap;
    max-width: 300px;
  }

  :global(.conflict-action) {
    min-height: 28px;
  }

  @media (max-width: 720px) {
    .conflict {
      left: 12px;
      right: 12px;
      bottom: 38px;
      grid-template-columns: 1fr;
      width: auto;
    }

    .actions {
      justify-content: flex-start;
      max-width: none;
    }
  }
</style>
