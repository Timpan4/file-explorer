<script lang="ts">
  import { tick } from "svelte";
  import ExplorerIcon from "$lib/components/explorer/ExplorerIcon.svelte";
  import { explorerUi, getGridTemplate } from "$lib/stores/explorerUi";
  import type { DirectoryItemStub } from "$lib/types/explorer";

  type RenameState = {
    itemId: string;
    draftName: string;
    status: "editing" | "submitting";
    error: string | null;
  } | null;

  let {
    item,
    rowId,
    selected = false,
    focused = false,
    rename = null,
    onSelect,
    onContextMenu,
    onOpen,
    onRenameDraftChange,
    onRenameSubmit,
    onRenameCancel
  }: {
    item: DirectoryItemStub;
    rowId?: string;
    selected?: boolean;
    focused?: boolean;
    rename?: RenameState;
    onSelect: (item: DirectoryItemStub, event: MouseEvent) => void;
    onContextMenu: (item: DirectoryItemStub, event: MouseEvent) => void;
    onOpen: (item: DirectoryItemStub) => void;
    onRenameDraftChange: (draftName: string) => void;
    onRenameSubmit: () => Promise<boolean>;
    onRenameCancel: () => boolean;
  } = $props();

  const kindLabel = $derived(item.kind === "directory" ? "Folder" : item.kind === "symlink" ? "Shortcut" : item.kind);
  const sizeLabel = $derived(item.size ? formatBytes(item.size) : "-");
  const iconName = $derived.by(() => {
    if (item.kind === "directory") {
      return "folder" as const;
    }

    if (item.kind === "symlink") {
      return "symlink" as const;
    }

    return "file" as const;
  });
  let { columnWidths } = $derived($explorerUi);
  const gridTemplate = $derived(getGridTemplate(columnWidths));
  const isRenaming = $derived(rename?.itemId === item.id);
  const renameDraft = $derived(isRenaming ? rename?.draftName ?? item.name : item.name);
  const renameError = $derived(isRenaming ? rename?.error ?? null : null);
  const renameSubmitting = $derived(isRenaming && rename?.status === "submitting");
  let renameInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!isRenaming || renameSubmitting) {
      return;
    }

    void tick().then(() => {
      renameInput?.focus();
      renameInput?.select();
    });
  });
</script>

{#if isRenaming}
  <div
    id={rowId}
    class:selected
    class:focused
    class:renaming={isRenaming}
    class="row"
    role="button"
    style={`grid-template-columns:${gridTemplate};`}
    tabindex="-1"
    onclick={(event) => onSelect(item, event)}
    oncontextmenu={(event) => onContextMenu(item, event)}
    onkeydown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(item, event as unknown as MouseEvent);
      }
    }}
  >
    <span class="name">
      {#if item.iconDataUrl}
        <img class="system-icon" src={item.iconDataUrl} alt="" />
      {:else}
        <ExplorerIcon name={iconName} size={16} />
      {/if}
      <input
        bind:this={renameInput}
        class:error={Boolean(renameError)}
        class="rename-input"
        value={renameDraft}
        aria-invalid={renameError ? "true" : undefined}
        aria-label={`Rename ${item.name}`}
        disabled={renameSubmitting}
        spellcheck="false"
        type="text"
        oninput={(event) => onRenameDraftChange((event.currentTarget as HTMLInputElement).value)}
        onpointerdown={(event) => event.stopPropagation()}
        onclick={(event) => event.stopPropagation()}
        ondblclick={(event) => event.stopPropagation()}
        onkeydown={async (event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            await onRenameSubmit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onRenameCancel();
          }
        }}
      />
    </span>
    <span class="meta">{kindLabel}</span>
    <span class="meta">{item.modifiedAt ?? "-"}</span>
    <span class="meta size">{sizeLabel}</span>
  </div>
{:else}
  <button
    id={rowId}
    class:selected
    class:focused
    class="row"
    style={`grid-template-columns:${gridTemplate};`}
    tabindex="-1"
    onclick={(event) => onSelect(item, event)}
    oncontextmenu={(event) => onContextMenu(item, event)}
    ondblclick={() => onOpen(item)}
    onpointerdown={(event) => event.preventDefault()}
    type="button"
  >
    <span class="name">
      {#if item.iconDataUrl}
        <img class="system-icon" src={item.iconDataUrl} alt="" />
      {:else}
        <ExplorerIcon name={iconName} size={16} />
      {/if}
      <span class="filename">{item.name}</span>
    </span>
    <span class="meta">{kindLabel}</span>
    <span class="meta">{item.modifiedAt ?? "-"}</span>
    <span class="meta size">{sizeLabel}</span>
  </button>
{/if}

<style>
  .row {
    display: grid;
    gap: 10px;
    align-items: center;
    height: 32px;
    margin: 2px 0;
    box-sizing: border-box;
    padding: 0 12px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.84rem;
    text-align: left;
    border-radius: 4px;
    user-select: none;
    -webkit-user-select: none;
    width: fit-content;
  }

  .row > span {
    position: relative;
  }

  .row > span + span {
    padding-left: 10px;
  }

  .row > span + span::before {
    content: "";
    position: absolute;
    left: -5px;
    top: 3px;
    bottom: 3px;
    width: 1px;
    background: color-mix(in srgb, var(--row-border) 92%, transparent);
    pointer-events: none;
  }

  .row.renaming {
    cursor: default;
  }

  .row:hover {
    background: color-mix(in srgb, var(--accent-soft-strong) 52%, transparent);
    border-color: color-mix(in srgb, var(--row-border) 56%, transparent);
  }

  .row.selected {
    background: color-mix(in srgb, var(--selection-bg) 96%, transparent);
    border-color: color-mix(in srgb, var(--selection-border) 68%, transparent);
    color: var(--selection-text);
  }

  .row.focused {
    outline: 1px solid color-mix(in srgb, var(--focus-ring) 78%, transparent);
    outline-offset: -1px;
  }

  .name {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .filename {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    user-select: none;
    -webkit-user-select: none;
  }

  .rename-input {
    min-width: 0;
    width: min(100%, 420px);
    border: 1px solid color-mix(in srgb, var(--focus-ring) 38%, transparent);
    border-radius: 4px;
    background: var(--surface-input);
    color: inherit;
    font: inherit;
    font-weight: 500;
    padding: 4px 8px;
    outline: none;
  }

  .rename-input:focus {
    border-color: color-mix(in srgb, var(--focus-ring) 80%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 28%, transparent);
  }

  .rename-input.error {
    border-color: color-mix(in srgb, var(--danger, #c42b1c) 72%, transparent);
  }

  .rename-input:disabled {
    opacity: 0.72;
  }

  .meta {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: none;
    -webkit-user-select: none;
    font-size: 0.82rem;
  }

  .row.selected .meta {
    color: color-mix(in srgb, var(--selection-text) 68%, var(--text-muted));
  }

  .size {
    text-align: right;
  }

  .system-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
</style>

<script lang="ts" module>
  function formatBytes(bytes: number) {
    if (bytes === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  }
</script>
