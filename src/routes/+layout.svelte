<script lang="ts">
  import ConfirmDialog from "$lib/components/ui/ConfirmDialog.svelte";
  import NotificationHost from "$lib/components/ui/NotificationHost.svelte";
  import SettingsDialog from "$lib/components/settings/SettingsDialog.svelte";
</script>

<div class="layout-root">
  <slot />
  <SettingsDialog />
  <ConfirmDialog />
  <NotificationHost />
</div>

<style>
  :global(:root) {
    color-scheme: light dark;
    --app-bg-solid: #eff2f6;
    --app-bg-overlay: rgba(255, 255, 255, 0.72);
    --app-bg-gradient-start: #eef3f8;
    --app-bg-gradient-end: #f6f7fa;
    --text-primary: #1f2937;
    --text-strong: #111827;
    --text-muted: #6b7280;
    --panel-border: rgba(15, 23, 42, 0.08);
    --panel-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
    --header-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
    --header-bg: rgba(248, 250, 252, 0.92);
    --content-bg: rgba(255, 255, 255, 0.92);
    --sidebar-bg-start: rgba(246, 248, 250, 0.96);
    --sidebar-bg-end: rgba(241, 244, 248, 0.98);
    --sidebar-divider: rgba(15, 23, 42, 0.08);
    --button-bg: rgba(255, 255, 255, 0.88);
    --button-border: rgba(15, 23, 42, 0.1);
    --button-hover-border: rgba(59, 130, 246, 0.18);
    --button-hover-bg: rgba(239, 246, 255, 0.94);
    --warn-hover-border: rgba(239, 68, 68, 0.18);
    --warn-hover-bg: rgba(254, 242, 242, 0.94);
    --accent-soft: rgba(37, 99, 235, 0.14);
    --accent-soft-strong: rgba(37, 99, 235, 0.08);
    --accent-text: #0f3d91;
    --pill-text: #2458b8;
    --surface-raised: rgba(255, 255, 255, 0.96);
    --surface-subtle: #f7f9fb;
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

  :global(:root[data-theme="dark"]) {
    --app-bg-solid: #111418;
    --app-bg-overlay: rgba(9, 12, 16, 0.74);
    --app-bg-gradient-start: #171b21;
    --app-bg-gradient-end: #11151a;
    --text-primary: #e7ebf0;
    --text-strong: #f4f7fb;
    --text-muted: #a0a9b6;
    --panel-border: rgba(255, 255, 255, 0.08);
    --panel-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
    --header-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    --header-bg: rgba(25, 29, 35, 0.9);
    --content-bg: rgba(22, 26, 32, 0.96);
    --sidebar-bg-start: rgba(23, 27, 33, 0.98);
    --sidebar-bg-end: rgba(17, 21, 27, 0.98);
    --sidebar-divider: rgba(255, 255, 255, 0.07);
    --button-bg: rgba(39, 45, 55, 0.96);
    --button-border: rgba(255, 255, 255, 0.08);
    --button-hover-border: rgba(96, 165, 250, 0.2);
    --button-hover-bg: rgba(31, 58, 94, 0.7);
    --warn-hover-border: rgba(248, 113, 113, 0.2);
    --warn-hover-bg: rgba(79, 28, 28, 0.72);
    --accent-soft: rgba(96, 165, 250, 0.2);
    --accent-soft-strong: rgba(96, 165, 250, 0.1);
    --accent-text: #cfe1ff;
    --pill-text: #b9d4ff;
    --surface-raised: rgba(30, 35, 43, 0.98);
    --surface-subtle: #1b2027;
    --surface-input: #141920;
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

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"])) {
      --app-bg-solid: #111418;
      --app-bg-overlay: rgba(9, 12, 16, 0.74);
      --app-bg-gradient-start: #171b21;
      --app-bg-gradient-end: #11151a;
      --text-primary: #e7ebf0;
      --text-strong: #f4f7fb;
      --text-muted: #a0a9b6;
      --panel-border: rgba(255, 255, 255, 0.08);
      --panel-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
      --header-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      --header-bg: rgba(25, 29, 35, 0.9);
      --content-bg: rgba(22, 26, 32, 0.96);
      --sidebar-bg-start: rgba(23, 27, 33, 0.98);
      --sidebar-bg-end: rgba(17, 21, 27, 0.98);
      --sidebar-divider: rgba(255, 255, 255, 0.07);
      --button-bg: rgba(39, 45, 55, 0.96);
      --button-border: rgba(255, 255, 255, 0.08);
      --button-hover-border: rgba(96, 165, 250, 0.2);
      --button-hover-bg: rgba(31, 58, 94, 0.7);
      --warn-hover-border: rgba(248, 113, 113, 0.2);
      --warn-hover-bg: rgba(79, 28, 28, 0.72);
      --accent-soft: rgba(96, 165, 250, 0.2);
      --accent-soft-strong: rgba(96, 165, 250, 0.1);
      --accent-text: #cfe1ff;
      --pill-text: #b9d4ff;
      --surface-raised: rgba(30, 35, 43, 0.98);
      --surface-subtle: #1b2027;
      --surface-input: #141920;
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
    background:
      linear-gradient(180deg, var(--app-bg-overlay), var(--app-bg-overlay)),
      linear-gradient(180deg, var(--app-bg-gradient-start) 0%, var(--app-bg-gradient-end) 100%);
    font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .layout-root {
    display: contents;
  }
</style>
