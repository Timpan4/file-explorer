<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    icon,
    suffix,
    variant = "ghost",
    size = "md",
    active = false,
    disabled = false,
    iconOnly = false,
    align = "center",
    title,
    ariaLabel,
    type = "button",
    className = "",
    onclick,
    onpointerdown
  }: {
    children?: Snippet;
    icon?: Snippet;
    suffix?: Snippet;
    variant?: "ghost" | "subtle" | "solid" | "danger";
    size?: "sm" | "md";
    active?: boolean;
    disabled?: boolean;
    iconOnly?: boolean;
    align?: "start" | "center" | "end" | "between";
    title?: string;
    ariaLabel?: string;
    type?: "button" | "submit" | "reset";
    className?: string;
    onclick?: (event: MouseEvent) => void;
    onpointerdown?: (event: PointerEvent) => void;
  } = $props();

  const showLabel = $derived(Boolean(children) && !iconOnly);
</script>

<button
  class={`button ${variant} ${size} align-${align} ${iconOnly ? "icon-only" : ""} ${active ? "active" : ""} ${className}`}
  {disabled}
  {title}
  aria-label={ariaLabel}
  {type}
  onclick={onclick}
  onpointerdown={onpointerdown}
>
  {#if icon}
    <span class="icon" aria-hidden="true">
      {@render icon()}
    </span>
  {/if}

  {#if showLabel}
    <span class="label">
      {@render children?.()}
    </span>
  {/if}

  {#if suffix}
    <span class="icon suffix" aria-hidden="true">
      {@render suffix()}
    </span>
  {/if}
</button>

<style>
  .button {
    --button-height: 28px;
    --button-padding-inline: 10px;
    --button-radius: 8px;
    --button-gap: 8px;
    --button-icon-size: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--button-gap);
    min-height: var(--button-height);
    padding: 0 var(--button-padding-inline);
    border: 1px solid transparent;
    border-radius: var(--button-radius);
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: 0.84rem;
    line-height: 1;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    transition: border-color 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
  }

  .button.align-start {
    justify-content: flex-start;
  }

  .button.align-center {
    justify-content: center;
  }

  .button.align-end {
    justify-content: flex-end;
  }

  .button.align-between {
    justify-content: space-between;
  }

  .button.sm {
    --button-height: 20px;
    --button-padding-inline: 6px;
    --button-radius: 6px;
    --button-gap: 6px;
    --button-icon-size: 12px;
    font-size: 0.78rem;
  }

  .button.icon-only {
    width: var(--button-height);
    min-width: var(--button-height);
    padding: 0;
  }

  .button.icon-only.align-start,
  .button.icon-only.align-center,
  .button.icon-only.align-end,
  .button.icon-only.align-between {
    justify-content: center;
  }

  .button.subtle {
    border-color: color-mix(in srgb, var(--button-border) 88%, transparent);
    background: color-mix(in srgb, var(--button-bg) 86%, transparent);
  }

  .button.solid {
    border-color: color-mix(in srgb, var(--selection-border) 94%, transparent);
    background: color-mix(in srgb, var(--accent-soft) 82%, var(--surface-raised));
    color: var(--accent-text);
  }

  .button.danger {
    color: color-mix(in srgb, #cf5a50 82%, var(--text-primary));
  }

  .button.active {
    border-color: color-mix(in srgb, var(--selection-border) 88%, transparent);
    background: color-mix(in srgb, var(--accent-soft) 72%, transparent);
    color: var(--accent-text);
  }

  .button:hover:enabled {
    border-color: color-mix(in srgb, var(--button-hover-border) 72%, transparent);
    background: color-mix(in srgb, var(--button-hover-bg) 72%, transparent);
    color: var(--text-primary);
  }

  .button.subtle:hover:enabled,
  .button.solid:hover:enabled,
  .button.active:hover:enabled {
    box-shadow: 0 1px 0 color-mix(in srgb, var(--surface-raised) 58%, transparent) inset;
  }

  .button.solid:hover:enabled {
    background: color-mix(in srgb, var(--accent-soft) 92%, var(--surface-raised));
  }

  .button.danger:hover:enabled {
    border-color: color-mix(in srgb, var(--warn-hover-border) 76%, transparent);
    background: color-mix(in srgb, var(--warn-hover-bg) 72%, transparent);
    color: color-mix(in srgb, #cf5a50 92%, var(--text-strong));
  }

  .button:active:enabled {
    box-shadow: 0 1px 2px color-mix(in srgb, black 10%, transparent) inset;
  }

  .button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 40%, transparent);
  }

  .button:disabled {
    opacity: 0.34;
    cursor: not-allowed;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .label {
    min-width: 0;
    white-space: nowrap;
  }

  .button.align-between .label {
    flex: 1;
  }

  .button .icon :global(svg) {
    width: var(--button-icon-size);
    height: var(--button-icon-size);
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.92;
  }
</style>
