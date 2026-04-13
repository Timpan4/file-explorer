<script lang="ts">
  let {
    name,
    size = 16,
    decorative = true
  }: {
    name: "home" | "folder" | "drive" | "file" | "symlink";
    size?: number;
    decorative?: boolean;
  } = $props();
</script>

<span
  class="icon"
  class:small={size <= 16}
  style={`width:${size}px;height:${size}px;`}
  aria-hidden={decorative}
>
  {#if name === "home"}
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M2.25 7.05 8 2.5l5.75 4.55v6.15a.8.8 0 0 1-.8.8H9.8V10.2a.6.6 0 0 0-.6-.6H6.8a.6.6 0 0 0-.6.6V14H3.05a.8.8 0 0 1-.8-.8V7.05Z" class="accent"/>
      <path d="M8 1.75 1.7 6.74a.5.5 0 1 0 .62.78L8 3.01l5.68 4.51a.5.5 0 1 0 .62-.78L8 1.75Z" class="stroke"/>
    </svg>
  {:else if name === "folder"}
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M1.75 4.5c0-.97.78-1.75 1.75-1.75h2.28c.36 0 .7.14.97.39l1 1h3.75c.97 0 1.75.78 1.75 1.75v.36H1.75V4.5Z" class="accent-soft"/>
      <path d="M1.75 6h12.5v5.75c0 .97-.78 1.75-1.75 1.75H3.5a1.75 1.75 0 0 1-1.75-1.75V6Z" class="accent"/>
      <path d="M1.75 5.75h12.5" class="stroke-line"/>
    </svg>
  {:else if name === "drive"}
    <svg viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="8.75" rx="2" class="surface"/>
      <path d="M3.25 8.75h9.5" class="stroke-line"/>
      <circle cx="11.25" cy="10.25" r=".8" class="accent"/>
      <circle cx="13" cy="10.25" r=".55" class="muted"/>
    </svg>
  {:else if name === "symlink"}
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5h5.2l2.8 2.8V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" class="surface"/>
      <path d="M9.2 2.5v2.05c0 .41.34.75.75.75H12" class="stroke-line"/>
      <path d="M5.2 10.2h2.55c1.52 0 2.75-1.23 2.75-2.75V6.8" class="link-line"/>
      <path d="m8.95 7.05 1.55-1.55 1.55 1.55" class="link-line"/>
    </svg>
  {:else}
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5h5.2l2.8 2.8V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" class="surface"/>
      <path d="M9.2 2.5v2.05c0 .41.34.75.75.75H12" class="stroke-line"/>
      <path d="M5.25 8.15h5.5M5.25 10.15h4.25" class="stroke-line"/>
    </svg>
  {/if}
</span>

<style>
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  svg {
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .accent {
    fill: var(--icon-folder-end);
  }

  .accent-soft {
    fill: var(--icon-folder-start);
  }

  .surface {
    fill: var(--surface-input);
    stroke: color-mix(in srgb, var(--text-muted) 20%, transparent);
    stroke-width: 0.9;
  }

  .stroke {
    fill: var(--text-muted);
  }

  .stroke-line {
    stroke: color-mix(in srgb, var(--text-muted) 70%, transparent);
    stroke-width: 1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .link-line {
    stroke: var(--icon-link-end);
    stroke-width: 1.1;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .muted {
    fill: var(--text-muted);
  }
</style>
