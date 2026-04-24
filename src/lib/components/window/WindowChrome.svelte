<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, tick } from "svelte";
  import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
  import ExplorerIcon from "$lib/components/explorer/ExplorerIcon.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { explorerWorkspace } from "$lib/stores/explorerWorkspace";

  let {
    children
  }: {
    children?: Snippet;
  } = $props();

  let isMaximized = $state(false);
  const appWindow = getCurrentWebviewWindow();
  let { tabs } = $derived($explorerWorkspace);
  let tabElements = $state<Record<string, HTMLElement>>({});
  let dragState = $state<{
    tabId: string;
    pointerId: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
    detached: boolean;
    targetWindowId: string | null;
    reorderTargetTabId: string | null;
  } | null>(null);
  let suppressTabClick = $state(false);
  let dropIndicatorX = $state<number | null>(null);
  let editingTabId = $state<string | null>(null);
  let draftTabTitle = $state("");
  let renameInput = $state<HTMLInputElement | null>(null);

  onMount(() => {
    void syncWindowState();

    const onResize = () => {
      void syncWindowState();
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  });

  async function minimizeWindow() {
    try {
      await appWindow.minimize();
    } catch (error) {
      console.error("Failed to minimize window", error);
    }
  }

  async function toggleWindowMaximize() {
    try {
      await appWindow.toggleMaximize();
      await syncWindowState();
    } catch (error) {
      console.error("Failed to toggle maximize", error);
    }
  }

  async function closeWindow() {
    try {
      await appWindow.close();
    } catch (error) {
      console.error("Failed to close window", error);
    }
  }

  async function syncWindowState() {
    try {
      isMaximized = await appWindow.isMaximized();
    } catch (error) {
      isMaximized = false;
      console.error("Failed to read maximize state", error);
    }
  }

  async function handleNewTab() {
    await explorerWorkspace.newTab();
  }

  function handleTabClick(tabId: string) {
    if (editingTabId) {
      return;
    }

    if (suppressTabClick || dragState?.hasMoved) {
      suppressTabClick = false;
      return;
    }

    explorerWorkspace.activateTab(tabId);
  }

  async function handleCloseTab(tabId: string, event: MouseEvent) {
    event.stopPropagation();
    await explorerWorkspace.closeTab(tabId);
  }

  function handleTabPointerDown(tabId: string, event: PointerEvent) {
    if (event.button !== 0 || editingTabId === tabId) {
      return;
    }

    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);

    dragState = {
      tabId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      detached: false,
      targetWindowId: null,
      reorderTargetTabId: null
    };
  }

  async function handleWindowPointerUp(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (editingTabId) {
      dragState = null;
      dropIndicatorX = null;
      return;
    }

    const shouldDetach = dragState.detached;
    const targetWindowId = dragState.targetWindowId;
    const reorderTargetTabId = dragState.reorderTargetTabId;
    const hasMoved = dragState.hasMoved;
    const tabId = dragState.tabId;
    dragState = null;
    dropIndicatorX = null;

    if (shouldDetach) {
      suppressTabClick = true;
      await explorerWorkspace.detachTab(tabId, { x: event.screenX, y: event.screenY });
      window.setTimeout(() => {
        suppressTabClick = false;
      }, 0);
      return;
    }

    if (targetWindowId) {
      suppressTabClick = true;
      await explorerWorkspace.importTabIntoWindow(tabId, targetWindowId);
      window.setTimeout(() => {
        suppressTabClick = false;
      }, 0);
      return;
    }

    if (hasMoved) {
      explorerWorkspace.moveTabBefore(tabId, reorderTargetTabId);
      suppressTabClick = true;
      window.setTimeout(() => {
        suppressTabClick = false;
      }, 0);
    }
  }

  function handleWindowPointerMove(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (editingTabId) {
      return;
    }

    const movedEnough = Math.abs(event.clientX - dragState.startX) > 12 || Math.abs(event.clientY - dragState.startY) > 12;
    if (!movedEnough) {
      return;
    }

    const detached = isOutsideDetachThreshold(event.clientX, event.clientY);
    const targetWindowId = detached ? explorerWorkspace.findWindowAtPosition(event.screenX, event.screenY) : null;
    const shouldDetachToNewWindow = detached && !targetWindowId;
    const reorderTargetTabId = !detached ? getReorderTargetTabId(event.clientX, dragState.tabId) : null;

    dropIndicatorX = !detached ? getDropIndicatorX(reorderTargetTabId) : null;

    dragState = {
      ...dragState,
      hasMoved: true,
      detached: shouldDetachToNewWindow,
      targetWindowId,
      reorderTargetTabId
    };
  }

  function isDraggingTab(tabId: string) {
    return dragState?.tabId === tabId;
  }

  function isOutsideDetachThreshold(clientX: number, clientY: number) {
    const threshold = 56;
    const withinHorizontal = clientX >= -threshold && clientX <= window.innerWidth + threshold;
    const withinVertical = clientY >= -threshold && clientY <= 92;
    return !(withinHorizontal && withinVertical);
  }

  function registerTabElement(tabId: string, element: HTMLElement | null) {
    if (element) {
      tabElements[tabId] = element;
    } else {
      delete tabElements[tabId];
    }
  }

  function tabElementAction(element: HTMLElement, tabId: string) {
    registerTabElement(tabId, element);

    return {
      destroy() {
        registerTabElement(tabId, null);
      }
    };
  }

  function getReorderTargetTabId(clientX: number, draggingTabId: string) {
    const orderedTabs = tabs.filter((tab: { id: string }) => tab.id !== draggingTabId);
    for (const tab of orderedTabs) {
      const element = tabElements[tab.id];
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        return tab.id;
      }
    }

    return null;
  }

  function getDropIndicatorX(targetTabId: string | null) {
    if (targetTabId) {
      const element = tabElements[targetTabId];
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return rect.left - 2;
    }

    const orderedTabs = tabs;
    const lastTab = orderedTabs.at(-1);
    const lastElement = lastTab ? tabElements[lastTab.id] : null;
    if (!lastElement) {
      return null;
    }

    const rect = lastElement.getBoundingClientRect();
    return rect.right + 1;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (editingTabId) {
      return;
    }

    if (isTextEntryTarget(event.target)) {
      return;
    }

    const isPrimary = event.ctrlKey || event.metaKey;
    if (!isPrimary) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "t") {
      event.preventDefault();
      void explorerWorkspace.newTab();
      return;
    }

    if (key === "w") {
      const activeTabId = explorerWorkspace.getActiveTabId();
      if (activeTabId) {
        event.preventDefault();
        void explorerWorkspace.closeTab(activeTabId);
      }
      return;
    }

    if (key === "tab") {
      event.preventDefault();
      explorerWorkspace.activateAdjacentTab(event.shiftKey ? -1 : 1);
    }
  }

  function isTextEntryTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
  }

  async function beginRenameTab(tabId: string) {
    const tab = tabs.find((candidate: { id: string; title: string; customTitle: string | null }) => candidate.id === tabId);
    if (!tab) {
      return;
    }

    editingTabId = tabId;
    draftTabTitle = tab.customTitle ?? tab.title;
    dragState = null;
    dropIndicatorX = null;
    await tick();
    renameInput?.focus();
    renameInput?.select();
  }

  function cancelRenameTab() {
    editingTabId = null;
    draftTabTitle = "";
  }

  function commitRenameTab() {
    if (!editingTabId) {
      return;
    }

    const nextTitle = draftTabTitle.trim();
    if (nextTitle) {
      explorerWorkspace.renameTab(editingTabId, nextTitle);
    } else {
      explorerWorkspace.clearTabTitle(editingTabId);
    }

    editingTabId = null;
    draftTabTitle = "";
  }
</script>

<svelte:window onpointermove={handleWindowPointerMove} onpointerup={handleWindowPointerUp} onkeydown={handleWindowKeydown} />

<div class="window-shell">
  <header class="window-chrome">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="tab-strip">
      <div class="window-mark" data-tauri-drag-region style="app-region: drag;" ondblclick={toggleWindowMaximize}>
        <div class="app-badge">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.25" />
            <path d="M8 4.4v7.2" />
            <path d="M4.4 8h7.2" />
          </svg>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Open tabs" data-tauri-drag-region style="app-region: drag;">
        {#each tabs as tab, index (tab.id)}
          <div
            use:tabElementAction={tab.id}
            class:active={tab.active}
            class:dragging={isDraggingTab(tab.id)}
            class="tab"
            role="tab"
            aria-selected={tab.active}
            tabindex={tab.active ? 0 : -1}
            onclick={() => handleTabClick(tab.id)}
            ondblclick={() => void beginRenameTab(tab.id)}
            onpointerdown={(event) => handleTabPointerDown(tab.id, event)}
            onkeydown={(event) => {
              if (editingTabId === tab.id) {
                return;
              }

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleTabClick(tab.id);
              }
            }}
          >
            <span class="tab-highlight" aria-hidden="true"></span>
            <span class="tab-icon">
              {#if tab.iconDataUrl}
                <img class="system-icon" src={tab.iconDataUrl} alt="" />
              {:else}
                <ExplorerIcon name={tab.currentPath ? "folder" : "home"} size={15} />
              {/if}
            </span>
            {#if editingTabId === tab.id}
              <input
                bind:this={renameInput}
                bind:value={draftTabTitle}
                class="tab-rename-input"
                type="text"
                spellcheck="false"
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => event.stopPropagation()}
                onblur={commitRenameTab}
                onkeydown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitRenameTab();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRenameTab();
                  }
                }}
              />
            {:else}
              <span class="tab-label">{tab.title}</span>
            {/if}
            <Button
              className="tab-close"
              ariaLabel={`Close ${tab.title}`}
              title={`Close ${tab.title}`}
              iconOnly
              size="sm"
              onpointerdown={(event) => event.stopPropagation()}
              onclick={(event) => handleCloseTab(tab.id, event)}
            >
              {#snippet icon()}
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M5 5 11 11" />
                  <path d="M11 5 5 11" />
                </svg>
              {/snippet}
            </Button>
          </div>
        {/each}

        {#if dropIndicatorX !== null}
          <span class="drop-indicator" aria-hidden="true" style={`transform: translateX(${dropIndicatorX}px);`}></span>
        {/if}

        <Button className="new-tab" ariaLabel="New tab" title="New tab" onclick={handleNewTab} iconOnly>
          {#snippet icon()}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3.5v9" />
              <path d="M3.5 8h9" />
            </svg>
          {/snippet}
        </Button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="drag-spacer" data-tauri-drag-region style="app-region: drag;" ondblclick={toggleWindowMaximize}></div>

      <div class="caption-controls" aria-label="Window controls">
        <button class="caption-button" type="button" aria-label="Minimize" onclick={minimizeWindow}>
          <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5h6" />
          </svg>
        </button>

        <button
          class="caption-button"
          type="button"
          aria-label={isMaximized ? "Restore" : "Maximize"}
          onclick={toggleWindowMaximize}
        >
          <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
            {#if isMaximized}
              <path d="M2.75 4V2.75h4.5v4.5H6" />
              <path d="M3 4.25h4.25V8.5H3z" />
            {:else}
              <path d="M2.5 2.5h5v5h-5z" />
            {/if}
          </svg>
        </button>

        <button class="caption-button close-button" type="button" aria-label="Close" onclick={closeWindow}>
          <svg viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="m2.25 2.25 5.5 5.5" />
            <path d="M7.75 2.25 2.25 7.75" />
          </svg>
        </button>
      </div>
    </div>
  </header>

  <div class="window-body">
    {@render children?.()}
  </div>
</div>

<style>
  .window-shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100vh;
    overflow: hidden;
  }

  .window-chrome {
    position: relative;
    z-index: 5;
    border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 88%, transparent);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--header-bg) 96%, var(--surface-raised)) 0%, var(--header-bg) 100%),
      linear-gradient(180deg, color-mix(in srgb, var(--app-bg-overlay) 45%, transparent), transparent);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--surface-raised) 60%, transparent) inset;
  }

  .tab-strip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(48px, 1fr) auto;
    align-items: stretch;
    min-height: 46px;
    padding-left: 10px;
  }

  .window-mark {
    display: flex;
    align-items: center;
    padding-right: 10px;
  }

  .app-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: color-mix(in srgb, var(--text-muted) 92%, transparent);
  }

  .app-badge svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1;
  }

  .tabs {
    position: relative;
    display: flex;
    align-items: end;
    min-width: 0;
    padding-top: 6px;
    overflow: hidden;
  }

  .tab,
  .caption-button {
    border: none;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
  }

  .caption-button {
    cursor: pointer;
  }

  .tab {
    position: relative;
    display: inline-grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    width: min(220px, 28vw);
    min-width: 132px;
    max-width: 220px;
    height: 36px;
    margin-right: 2px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 10px 10px 0 0;
    color: color-mix(in srgb, var(--text-primary) 76%, var(--text-muted));
    user-select: none;
    -webkit-user-select: none;
    app-region: no-drag;
  }

  .tab::after {
    content: "";
    position: absolute;
    right: -1px;
    top: 10px;
    bottom: 7px;
    width: 1px;
    background: color-mix(in srgb, var(--panel-border) 72%, transparent);
    opacity: 0.9;
  }

  .tab:last-of-type::after,
  .tab.active::after,
  .tab.active + .tab::after {
    opacity: 0;
  }

  .tab-highlight {
    position: absolute;
    left: 12px;
    right: 12px;
    top: 6px;
    height: 1px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
    opacity: 0;
    transition: opacity 140ms ease;
  }

  .tab:hover {
    border-color: color-mix(in srgb, var(--panel-border) 72%, transparent);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-raised) 86%, transparent),
      color-mix(in srgb, var(--header-bg) 94%, var(--surface-raised))
    );
    color: var(--text-primary);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--surface-raised) 62%, transparent) inset;
  }

  .tab.dragging {
    opacity: 0.72;
  }

  .tab:has(.tab-rename-input) {
    cursor: default;
  }

  .drop-indicator {
    position: fixed;
    top: 9px;
    width: 3px;
    height: 28px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--focus-ring) 82%, white 18%);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 20%, transparent);
    pointer-events: none;
    z-index: 10;
  }

  .tab:hover .tab-highlight,
  .tab.active .tab-highlight {
    opacity: 1;
  }

  .tab.active {
    border-color: color-mix(in srgb, var(--panel-border) 84%, transparent);
    background: linear-gradient(180deg, color-mix(in srgb, var(--surface-raised) 98%, var(--header-bg)), var(--header-bg));
    color: var(--text-strong);
    box-shadow:
      0 1px 0 color-mix(in srgb, var(--surface-raised) 70%, transparent) inset,
      0 10px 20px rgba(15, 23, 42, 0.05);
  }

  .tab.active :global(.tab-close) {
    opacity: 0.76;
  }

  .tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .system-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .tab-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    font-size: 0.84rem;
    line-height: 1;
  }

  .tab-rename-input {
    width: 100%;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    border: 1px solid color-mix(in srgb, var(--focus-ring) 52%, var(--button-border));
    border-radius: 6px;
    background: color-mix(in srgb, var(--surface-input) 96%, transparent);
    color: var(--text-strong);
    font: inherit;
    font-size: 0.84rem;
    line-height: 1;
    outline: none;
    box-sizing: border-box;
    app-region: no-drag;
  }

  .tab-rename-input:focus {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 36%, transparent);
  }

  :global(.tab-close) {
    color: color-mix(in srgb, var(--text-muted) 88%, transparent);
    opacity: 0.62;
    app-region: no-drag;
  }

  :global(.tab-close:hover) {
    color: var(--text-primary);
  }

  :global(.tab-close:focus-visible) {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--focus-ring) 36%, transparent);
  }

  :global(.tab-close svg),
  :global(.new-tab svg),
  .caption-button svg {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  :global(.new-tab) {
    margin: 0 8px 4px 6px;
    color: color-mix(in srgb, var(--text-muted) 92%, transparent);
    flex-shrink: 0;
    app-region: no-drag;
  }

  :global(.new-tab:hover) {
    color: var(--text-primary);
  }

  .caption-controls {
    display: flex;
    align-items: stretch;
    margin-left: 12px;
  }

  .drag-spacer {
    min-width: 48px;
  }

  .caption-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    color: color-mix(in srgb, var(--text-primary) 84%, transparent);
    transition: background 120ms ease, color 120ms ease;
  }

  .caption-button:hover {
    background: color-mix(in srgb, var(--surface-raised) 42%, transparent);
    color: var(--text-strong);
  }

  .close-button:hover {
    background: #c42b1c;
    color: white;
  }

  .window-body {
    min-height: 0;
    overflow: hidden;
  }

  @media (max-width: 960px) {
    .window-mark {
      display: none;
    }

    .tab-strip {
      grid-template-columns: minmax(0, 1fr) minmax(24px, 1fr) auto;
      padding-left: 0;
    }

    .tab {
      min-width: 112px;
      width: 172px;
    }
  }

  @media (max-width: 720px) {
    .tab:nth-child(1),
    .tab:nth-child(2) {
      display: none;
    }

    .tab {
      width: min(220px, 50vw);
      min-width: 0;
    }
  }
</style>
