<script lang="ts">
  import { onMount } from "svelte";
  import WindowChrome from "$lib/components/window/WindowChrome.svelte";
  import ExplorerShell from "$lib/components/explorer/ExplorerShell.svelte";
  import { explorerWorkspace } from "$lib/stores/explorerWorkspace";

  onMount(() => {
    const bootstrap = explorerWorkspace.consumeBootstrapFromUrl();

    void explorerWorkspace.initialize({ bootstrap }).then(async () => {
      if (bootstrap?.transferId) {
        await explorerWorkspace.acknowledgeDetachedTab(
          {
            transferId: bootstrap.transferId,
            ok: true
          },
          bootstrap.sourceWindowId
        );
      }
    }).catch(async () => {
      if (bootstrap?.transferId) {
        await explorerWorkspace.acknowledgeDetachedTab(
          {
            transferId: bootstrap.transferId,
            ok: false
          },
          bootstrap.sourceWindowId
        );
      }
    });

    return () => {
      explorerWorkspace.dispose();
    };
  });
</script>

<svelte:head>
  <title>File Explorer</title>
  <meta
    name="description"
    content="Windows-first file explorer with a Rust core and a thin Tauri renderer."
  />
</svelte:head>

<WindowChrome>
  <ExplorerShell />
</WindowChrome>
