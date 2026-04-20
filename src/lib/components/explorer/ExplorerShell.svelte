<script lang="ts">
  import { explorerSession } from "$lib/stores/explorerSession";
  import Sidebar from "$lib/components/explorer/Sidebar.svelte";
import BreadcrumbOmnibar from "$lib/components/explorer/BreadcrumbOmnibar.svelte";
import MainPane from "$lib/components/explorer/MainPane.svelte";
import StatusBar from "$lib/components/explorer/StatusBar.svelte";

  function handleWindowKeydown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") {
      return;
    }

    const target = event.target;
    if (isTextEntryTarget(target)) {
      return;
    }

    event.preventDefault();
    explorerSession.selectAllVisible();
  }

  function isTextEntryTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="shell">
  <aside class="sidebar-column">
    <Sidebar />
  </aside>

  <section class="content-column">
    <div class="header-stack">
      <BreadcrumbOmnibar onNavigate={(path) => explorerSession.navigate(path)} />
    </div>

    <div class="content-scroll-region">
      <MainPane />
    </div>

    <div class="footer-shell">
      <StatusBar />
    </div>
  </section>
</div>

<style>
  :global(:root) {
    color-scheme: light dark;
    --app-bg-solid: #edf1f5;
    --text-primary: #1f2937;
    --text-strong: #111827;
    --text-muted: #5f6978;
    --panel-border: rgba(15, 23, 42, 0.08);
    --header-bg: #f7f9fb;
    --content-bg: #ffffff;
    --sidebar-bg-start: #f4f6f8;
    --sidebar-bg-end: #f4f6f8;
    --sidebar-divider: rgba(15, 23, 42, 0.08);
    --button-bg: #ffffff;
    --button-border: rgba(15, 23, 42, 0.1);
    --button-hover-border: rgba(59, 130, 246, 0.14);
    --button-hover-bg: #f2f6fb;
    --warn-hover-border: rgba(239, 68, 68, 0.18);
    --warn-hover-bg: #fdf1f1;
    --accent-soft: rgba(37, 99, 235, 0.12);
    --accent-soft-strong: rgba(37, 99, 235, 0.06);
    --accent-text: #0f3d91;
    --pill-text: #2458b8;
    --surface-raised: #ffffff;
    --surface-subtle: #f5f7fa;
    --surface-input: #ffffff;
    --row-border: rgba(15, 23, 42, 0.06);
    --focus-ring: #3b82f6;
    --selection-bg: rgba(37, 99, 235, 0.14);
    --selection-border: rgba(37, 99, 235, 0.2);
    --selection-text: #123e91;
    --icon-folder-start: #f7d96d;
    --icon-folder-end: #e2b449;
    --icon-file-start: #9ec2ff;
    --icon-file-end: #5f96ff;
    --icon-link-start: #afe5d4;
    --icon-link-end: #5eb89a;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --app-bg-solid: #111418;
      --text-primary: #e7ebf0;
      --text-strong: #f4f7fb;
      --text-muted: #b0b9c6;
      --panel-border: rgba(255, 255, 255, 0.08);
      --header-bg: #1d2229;
      --content-bg: #191d23;
      --sidebar-bg-start: #171c22;
      --sidebar-bg-end: #171c22;
      --sidebar-divider: rgba(255, 255, 255, 0.07);
      --button-bg: #242a33;
      --button-border: rgba(255, 255, 255, 0.08);
      --button-hover-border: rgba(96, 165, 250, 0.16);
      --button-hover-bg: #2a313b;
      --warn-hover-border: rgba(248, 113, 113, 0.2);
      --warn-hover-bg: #4a2424;
      --accent-soft: rgba(96, 165, 250, 0.16);
      --accent-soft-strong: rgba(96, 165, 250, 0.08);
      --accent-text: #cfe1ff;
      --pill-text: #b9d4ff;
      --surface-raised: #20262e;
      --surface-subtle: #1c2128;
      --surface-input: #13171d;
      --row-border: rgba(255, 255, 255, 0.06);
      --focus-ring: #79aafc;
      --selection-bg: rgba(96, 165, 250, 0.18);
      --selection-border: rgba(96, 165, 250, 0.24);
      --selection-text: #d6e5ff;
      --icon-folder-start: #e9cf6c;
      --icon-folder-end: #c99932;
      --icon-file-start: #8cb3ff;
      --icon-file-end: #5d87eb;
      --icon-link-start: #7ad4b4;
      --icon-link-end: #42977a;
    }
  }

  :global(html) {
    height: 100%;
    overflow: hidden;
    background: var(--app-bg-solid);
  }

  :global(body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
    color: var(--text-primary);
    background: var(--app-bg-solid);
    font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .shell {
    display: grid;
    grid-template-columns: 248px minmax(0, 1fr);
    height: 100%;
    overflow: hidden;
    background: var(--app-bg-solid);
  }

  .sidebar-column {
    min-height: 0;
    padding: 4px 0 6px 6px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .content-column {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 0;
    min-height: 0;
    padding: 4px 6px 6px 4px;
    min-width: 0;
    box-sizing: border-box;
  }

  .header-stack {
    position: relative;
    z-index: 2;
    display: grid;
    gap: 0;
    padding: 5px 6px 6px;
    border: 1px solid var(--panel-border);
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    background: var(--header-bg);
  }

  .content-scroll-region {
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--panel-border);
    border-top: none;
    border-bottom: none;
    border-radius: 0;
    background: var(--content-bg);
  }

  .footer-shell {
    overflow: hidden;
    border: 1px solid var(--panel-border);
    border-top: none;
    border-radius: 0;
    background: var(--content-bg);
  }

  @media (max-width: 960px) {
    .shell {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .sidebar-column {
      padding: 6px 6px 0;
    }

    .content-column {
      padding: 0 6px 6px;
    }
  }
</style>
