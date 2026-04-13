<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import ExplorerIcon from "$lib/components/explorer/ExplorerIcon.svelte";
  import { explorerSession } from "$lib/stores/explorerSession";
  import TopToolbar from "$lib/components/explorer/TopToolbar.svelte";
  import { findMatchingSidebarRoot } from "$lib/types/explorer";
  import { markExplorerLoadingVisual } from "$lib/utils/explorerTimingTrace";

  const LOADING_VISUAL_DELAY_MS = 200;

  let { onNavigate }: { onNavigate: (path: string) => void } = $props();
  const explorerState = $derived($explorerSession);
  const currentPath = $derived(explorerState.currentPath);
  const stagedSearchQuery = $derived(($explorerSession as any).stagedSearchQuery as string);
  const status = $derived(explorerState.status);
  const backHistory = $derived(explorerState.backHistory);
  const forwardHistory = $derived(explorerState.forwardHistory);
  const activeJobId = $derived(explorerState.activeJobId);
  const isRefreshing = $derived(explorerState.isRefreshing);
  const currentRootIconDataUrl = $derived(findMatchingSidebarRoot(explorerState.currentPath, explorerState.roots)?.iconDataUrl);
  let draftPath = $state("");
  let isEditing = $state(false);
  let pathInput = $state<HTMLInputElement | null>(null);
  let addressShell = $state<HTMLDivElement | null>(null);
  let showProgress = $state(false);
  let progressFinishing = $state(false);
  let progressTimer: ReturnType<typeof setTimeout> | null = null;
  let progressFinishTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (!isEditing) {
      draftPath = currentPath;
    }
  });

  $effect(() => {
    if (isRefreshing) {
      const progressJobId = activeJobId;
      progressFinishing = false;
      if (!showProgress && !progressTimer) {
        progressTimer = setTimeout(() => {
          showProgress = true;
          markExplorerLoadingVisual(progressJobId, "progress", {
            thresholdMs: LOADING_VISUAL_DELAY_MS,
            isRefreshing
          });
          progressTimer = null;
        }, LOADING_VISUAL_DELAY_MS);
      }

      return () => {
        if (progressTimer) {
          clearTimeout(progressTimer);
          progressTimer = null;
        }
      };
    }

    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = null;
    }

    if (showProgress) {
      progressFinishing = true;
      if (progressFinishTimer) {
        clearTimeout(progressFinishTimer);
      }
      progressFinishTimer = setTimeout(() => {
        progressFinishing = false;
        showProgress = false;
        progressFinishTimer = null;
      }, LOADING_VISUAL_DELAY_MS);
    }
  });

  onDestroy(() => {
    if (progressTimer) {
      clearTimeout(progressTimer);
    }
    if (progressFinishTimer) {
      clearTimeout(progressFinishTimer);
    }
  });

  const segments = $derived.by(() => buildSegments(currentPath));

  function submit() {
    isEditing = false;
    onNavigate(draftPath);
  }

  async function enterEditMode() {
    isEditing = true;
    await tick();
    pathInput?.focus();
    pathInput?.select();
  }

  function exitEditMode() {
    isEditing = false;
    draftPath = currentPath;
  }

  function handleAddressShellClick(event: MouseEvent) {
    if (isEditing) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest(".segment")) {
      return;
    }

    void enterEditMode();
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!isEditing || !addressShell) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && !addressShell.contains(target)) {
      exitEditMode();
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="omnibar">
  <TopToolbar
    onRefresh={() => explorerSession.refresh()}
    onUp={() => explorerSession.goUp()}
    onBack={() => explorerSession.goBack()}
    onForward={() => explorerSession.goForward()}
    onCancel={() => explorerSession.cancelActiveNavigation()}
    loading={status === "loading"}
    loadingJobId={activeJobId}
    canGoBack={backHistory.length > 0}
    canGoForward={forwardHistory.length > 0}
  />

  <div
    bind:this={addressShell}
    class="address-shell"
    class:editing={isEditing}
    role="button"
    tabindex="0"
    onclick={handleAddressShellClick}
    onkeydown={(event) => {
      if (isEditing) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void enterEditMode();
      }
    }}
  >
    <span class="leading-icon">
      {#if currentRootIconDataUrl}
        <img class="system-icon" src={currentRootIconDataUrl} alt="" />
      {:else}
        <ExplorerIcon name="home" size={16} />
      {/if}
    </span>

    {#if isEditing}
      <form class="editor" onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}>
        <input
          bind:this={pathInput}
          bind:value={draftPath}
          placeholder="Enter a path"
          onkeydown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              exitEditMode();
            }
          }}
        />
      </form>
    {:else}
      <div class="crumb-track" role="navigation" aria-label="Current path">
        {#if segments.length === 0}
          <button class="segment root" onclick={() => onNavigate(currentPath || "C:\\")}>Home</button>
        {:else}
          {#each segments as segment, index}
            <button
              class="segment"
              class:current={index === segments.length - 1}
              onclick={() => onNavigate(segment.path)}
            >
              {segment.label}
            </button>
            {#if index < segments.length - 1}
              <span class="separator">/</span>
            {/if}
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <label class="search-shell">
    <span class="search-label">Search</span>
    <span class="search-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3 3" />
      </svg>
    </span>
    <input
      class="search-input"
      type="search"
      value={stagedSearchQuery}
      placeholder="Search this folder"
      oninput={(event) => {
        void explorerSession.setSearchQuery((event.currentTarget as HTMLInputElement).value);
      }}
    />
  </label>

  <div class="progress-track" aria-hidden="true">
    <div class:active={showProgress && !progressFinishing} class:finishing={progressFinishing} class="progress-bar"></div>
  </div>
</div>

<style>
  .omnibar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 248px;
    grid-template-rows: auto 3px;
    gap: 8px;
    align-items: center;
    padding: 0;
    user-select: none;
    -webkit-user-select: none;
  }

  .address-shell,
  .search-shell {
    min-height: 40px;
    border: 1px solid var(--button-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
    color: var(--text-primary);
  }

  .address-shell {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    box-shadow: 0 1px 1px rgba(15, 23, 42, 0.03);
    cursor: text;
  }

  .system-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .address-shell:hover {
    border-color: var(--button-hover-border);
  }

  .address-shell.editing {
    border-color: var(--focus-ring);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 45%, transparent);
  }

  .leading-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    opacity: 0.86;
    margin-right: 2px;
  }

  .crumb-track,
  .editor {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 3px;
    overflow: hidden;
    white-space: nowrap;
    flex: 1;
  }

  .segment {
    min-width: 0;
    padding: 4px 7px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
    font-size: 0.88rem;
    user-select: none;
    -webkit-user-select: none;
  }

  .segment:hover {
    background: color-mix(in srgb, var(--accent-soft-strong) 62%, transparent);
  }

  .segment.current {
    font-weight: 600;
    background: color-mix(in srgb, var(--surface-subtle) 72%, transparent);
  }

  .separator {
    color: var(--text-muted);
    font-size: 0.74rem;
    flex-shrink: 0;
    opacity: 0.78;
  }

  .editor input,
  .search-input {
    width: 100%;
    min-width: 0;
    height: 40px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 0.88rem;
    outline: none;
  }

  .editor input,
  .search-input {
    user-select: text;
    -webkit-user-select: text;
  }

  .search-shell {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    min-width: 0;
    padding: 0 10px;
    gap: 8px;
    box-shadow: 0 1px 1px rgba(15, 23, 42, 0.03);
    background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
  }

  .search-label {
    display: none;
  }

  .search-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: color-mix(in srgb, var(--text-muted) 88%, transparent);
    opacity: 0.92;
  }

  .search-icon svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .search-shell:focus-within {
    border-color: var(--focus-ring);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 45%, transparent);
  }

  .search-input::placeholder {
    color: color-mix(in srgb, var(--text-muted) 92%, transparent);
  }

  .progress-track {
    grid-column: 1 / -1;
    position: relative;
    height: 3px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-subtle) 60%, transparent);
  }

  .progress-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -26%;
    width: 26%;
    border-radius: 999px;
    background: color-mix(in srgb, var(--pill-text) 72%, transparent);
    opacity: 0;
    transition: opacity 140ms ease, transform 160ms ease;
  }

  .progress-bar.active {
    opacity: 1;
    animation: progress-slide 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  .progress-bar.finishing {
    opacity: 0;
    left: auto;
    right: 0;
    width: 18%;
    animation: none;
  }

  @keyframes progress-slide {
    0% {
      left: -26%;
      width: 24%;
    }

    50% {
      width: 34%;
    }

    100% {
      left: 100%;
      width: 24%;
    }
  }

  @media (max-width: 900px) {
    .omnibar {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto 3px;
    }
  }
</style>

<script lang="ts" module>
  function buildSegments(path: string) {
    if (!path) {
      return [];
    }

    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 0) {
      return [];
    }

    let current = "";

    return parts.map((part, index) => {
      if (index === 0 && /:$/.test(part)) {
        current = `${part}\\`;
      } else if (current.endsWith("\\")) {
        current = `${current}${part}`;
      } else {
        current = `${current}\\${part}`;
      }

      return {
        label: part,
        path: current
      };
    });
  }
</script>
