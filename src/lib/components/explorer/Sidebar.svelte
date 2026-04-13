<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { settingsUi } from "$lib/stores/settingsUi";
  import { explorerSession } from "$lib/stores/explorerSession";
  import ExplorerIcon from "$lib/components/explorer/ExplorerIcon.svelte";
  import type { SidebarRoot as SidebarRootType } from "$lib/types/explorer";

  let { roots, currentPath } = $derived($explorerSession);
  let { open } = $derived($settingsUi);

  const favorites = $derived(roots.filter((root) => root.kind === "favorite"));
  const drives = $derived(roots.filter((root) => root.kind === "drive"));

  function isActive(root: SidebarRootType) {
    return currentPath === root.path;
  }
</script>

<nav class="sidebar">
  <div class="main-nav">
    <section>
      <p class="section-label">Home</p>
      {#each favorites as root}
        <button class:active={isActive(root)} onclick={() => explorerSession.openRoot(root)}>
          {#if root.iconDataUrl}
            <img class="system-icon" src={root.iconDataUrl} alt="" />
          {:else}
            <ExplorerIcon name="home" size={16} />
          {/if}
          {root.label}
        </button>
      {/each}
    </section>

    <section>
      <div class="section-header">
        <p class="section-label">Drives</p>
        <Button className="sidebar-refresh" size="sm" onclick={() => explorerSession.refreshRoots()}>Refresh</Button>
      </div>
      {#each drives as root}
        <button class:active={isActive(root)} onclick={() => explorerSession.openRoot(root)}>
          {#if root.iconDataUrl}
            <img class="system-icon" src={root.iconDataUrl} alt="" />
          {:else}
            <ExplorerIcon name="drive" size={16} />
          {/if}
          {root.label}
        </button>
      {/each}
    </section>
  </div>

  <div class="footer-nav">
    <Button className="settings-link" active={open} onclick={() => settingsUi.openSettings()}>
      {#snippet icon()}
        <ExplorerIcon name="home" size={16} />
      {/snippet}
      Settings
    </Button>
  </div>
</nav>

<style>
  .sidebar {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px 6px 10px;
    border-right: 1px solid var(--sidebar-divider);
    border-radius: 14px;
    background: linear-gradient(180deg, var(--sidebar-bg-start), var(--sidebar-bg-end));
    user-select: none;
    -webkit-user-select: none;
    box-sizing: border-box;
  }

  .main-nav {
    display: grid;
    align-content: start;
  }

  .section-label {
    margin: 0 0 6px;
    padding: 0 10px;
    font-size: 0.74rem;
    letter-spacing: 0.01em;
    color: var(--text-muted);
    font-weight: 600;
  }

  section + section {
    margin-top: 12px;
  }

  .footer-nav {
    padding-top: 12px;
    border-top: 1px solid color-mix(in srgb, var(--sidebar-divider) 82%, transparent);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 32px;
    margin-bottom: 1px;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
    font-size: 0.88rem;
    user-select: none;
    -webkit-user-select: none;
  }

  :global(.settings-link) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 34px;
    width: 100%;
    padding: 7px 10px;
    color: var(--text-primary);
    text-align: left;
  }

  :global(.settings-link:hover) {
    background: var(--accent-soft-strong);
  }

  :global(.settings-link.active) {
    background: var(--accent-soft);
    border-color: var(--selection-border);
    color: var(--accent-text);
  }

  button:hover {
    background: var(--accent-soft-strong);
  }

  button.active {
    background: var(--accent-soft);
    border-color: var(--selection-border);
    color: var(--accent-text);
  }

  :global(.sidebar-refresh) {
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 4px 8px;
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .system-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
</style>
