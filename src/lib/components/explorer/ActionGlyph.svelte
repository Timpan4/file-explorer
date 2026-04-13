<script lang="ts">
  import type { ExplorerActionIcon } from "$lib/types/actions";

  let { icon, size = 16 }: { icon: ExplorerActionIcon; size?: number } = $props();
</script>

<span class="glyph" style={`width:${size}px;height:${size}px;`} aria-hidden="true">
  <svg viewBox="0 0 16 16" fill="none">
    {#if icon === "new"}
      <path d="M8 3.25v9.5" />
      <path d="M3.25 8h9.5" />
    {:else if icon === "rename"}
      <path d="M3.75 11.5h2.4l4.9-4.9-2.4-2.4-4.9 4.9v2.4Z" />
      <path d="m8.2 4.65 2.4 2.4" />
    {:else if icon === "delete"}
      <path d="M4.75 5.25v6.1" />
      <path d="M8 5.25v6.1" />
      <path d="M11.25 5.25v6.1" />
      <path d="M3.4 4h9.2" />
      <path d="M6 4V2.8h4V4" />
      <path d="M5 13.2h6a.8.8 0 0 0 .8-.8V4H4.2v8.4c0 .44.36.8.8.8Z" />
    {:else if icon === "cut"}
      <circle cx="5" cy="5.2" r="1.45" />
      <circle cx="5" cy="10.8" r="1.45" />
      <path d="M6.15 6.3 11.6 2.9" />
      <path d="M6.15 9.7 11.6 13.1" />
      <path d="M6.2 8h5.1" />
    {:else if icon === "copy"}
      <rect x="5.25" y="3.25" width="6.5" height="8.5" rx="1" />
      <path d="M4.25 10.75h-1A1.25 1.25 0 0 1 2 9.5v-6A1.25 1.25 0 0 1 3.25 2.25h4.5" />
    {:else if icon === "paste"}
      <path d="M5.25 4H4.5A1.25 1.25 0 0 0 3.25 5.25v6A1.25 1.25 0 0 0 4.5 12.5h7A1.25 1.25 0 0 0 12.75 11.25v-6A1.25 1.25 0 0 0 11.5 4h-.75" />
      <rect x="5.5" y="2.25" width="5" height="2.5" rx="0.8" />
    {:else if icon === "properties"}
      <circle cx="8" cy="8" r="5.25" />
      <path d="M8 7v3" />
      <circle cx="8" cy="4.75" r=".6" fill="currentColor" stroke="none" />
    {:else if icon === "open"}
      <path d="M6.25 4.25h5.5v5.5" />
      <path d="m11.75 4.25-7 7" />
      <path d="M9.75 8.5v3.25a1 1 0 0 1-1 1H4.25a1 1 0 0 1-1-1v-4.5a1 1 0 0 1 1-1H7.5" />
    {:else if icon === "refresh"}
      <path d="M12.35 5.6A4.6 4.6 0 1 0 12.8 8" />
      <path d="M12.5 2.75V5.5H9.75" />
    {/if}
  </svg>
</span>

<style>
  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    flex-shrink: 0;
  }

  svg {
    width: 100%;
    height: 100%;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
