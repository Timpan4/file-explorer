<script lang="ts">
  import { explorerUi, getGridTemplate } from "$lib/stores/explorerUi";
  import { explorerSession } from "$lib/stores/explorerSession";
  import type { SortField } from "$lib/types/explorer";

  let { sort } = $derived($explorerSession);
  let { columnWidths } = $derived($explorerUi);

  const columns: Array<{ field: SortField; label: string; align?: "left" | "right" }> = [
    { field: "name", label: "Name" },
    { field: "type", label: "Type" },
    { field: "modifiedAt", label: "Modified" },
    { field: "size", label: "Size", align: "right" }
  ];

  const gridTemplate = $derived(getGridTemplate(columnWidths));

  function ariaSort(field: SortField) {
    if (sort.field !== field) {
      return "none";
    }

    return sort.direction === "asc" ? "ascending" : "descending";
  }

  function startResize(column: keyof typeof columnWidths, event: PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const initialWidth = columnWidths[column];

    const onMove = (moveEvent: PointerEvent) => {
      explorerUi.setColumnWidth(column, initialWidth + (moveEvent.clientX - startX));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
</script>

<div class="header-bar">
  <div class="header-columns" style={`grid-template-columns:${gridTemplate};`}>
    {#each columns as column}
      <div class:align-right={column.align === "right"} class="column" role="columnheader" aria-sort={ariaSort(column.field)}>
        <button
          class:active={sort.field === column.field}
          class:align-right={column.align === "right"}
          class="sort-button"
          onclick={() => explorerSession.setSort(column.field)}
          type="button"
        >
          <span class="label-wrap">
            <span class="label">{column.label}</span>
          </span>
          <span class="indicator" aria-hidden="true">
            <svg class:descending={sort.direction === "desc"} viewBox="0 0 16 16" fill="none">
              <path d="M8 3.25v9.5" />
              <path d="M4.75 6.5 8 3.25 11.25 6.5" />
            </svg>
          </span>
        </button>
        <button class="resize-handle" onpointerdown={(event) => startResize(column.field, event)} type="button" tabindex="-1" aria-label={`Resize ${column.label} column`}></button>
      </div>
    {/each}
  </div>
</div>

<style>
  .header-bar {
    border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
    background: var(--surface-subtle);
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .header-columns {
    display: grid;
    gap: 10px;
    width: fit-content;
    padding: 6px 12px;
    color: var(--text-muted);
    font-size: 0.75rem;
    letter-spacing: 0.01em;
    font-weight: 600;
  }

  .column,
  .sort-button {
    min-width: 0;
  }

  .column {
    position: relative;
  }

  .column + .column::before {
    content: "";
    position: absolute;
    left: -5px;
    top: 4px;
    bottom: 4px;
    width: 1px;
    background: color-mix(in srgb, var(--panel-border) 96%, transparent);
    pointer-events: none;
  }

  .sort-button {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 12px;
    column-gap: 6px;
    align-items: center;
    width: 100%;
    min-width: 0;
    min-height: 24px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .sort-button:hover {
    background: color-mix(in srgb, var(--button-hover-bg) 36%, transparent);
    color: var(--text-primary);
  }

  .sort-button.active {
    background: color-mix(in srgb, var(--accent-soft) 36%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--selection-border) 52%, transparent);
    color: var(--text-primary);
  }

  .sort-button:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-ring) 30%, transparent);
  }

  .label-wrap {
    min-width: 0;
  }

  .label {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .indicator {
    width: 12px;
    height: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--pill-text);
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .indicator svg {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .indicator svg.descending {
    transform: rotate(180deg);
  }

  .sort-button:hover .indicator,
  .sort-button.active .indicator {
    opacity: 1;
  }

  .align-right,
  .sort-button.align-right {
    text-align: right;
    padding-right: 6px;
    padding-left: 6px;
  }

  .sort-button.align-right .label-wrap {
    display: flex;
    justify-content: flex-end;
  }

  .sort-button.align-right .label {
    text-align: right;
  }

  .resize-handle {
    position: absolute;
    top: -2px;
    right: -6px;
    width: 12px;
    height: calc(100% + 4px);
    cursor: col-resize;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    opacity: 0.5;
    transition: opacity 120ms ease;
  }

  .resize-handle::before {
    content: "";
    position: absolute;
    top: 5px;
    bottom: 5px;
    left: 50%;
    width: 1px;
    transform: translateX(-50%);
    background: color-mix(in srgb, var(--panel-border) 100%, transparent);
    border-radius: 999px;
  }

  .header-bar:hover .resize-handle {
    opacity: 0.72;
  }

  .column:hover .resize-handle,
  .resize-handle:focus-visible {
    opacity: 1;
  }
</style>
