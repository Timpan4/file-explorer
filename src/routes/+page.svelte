<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";

  type BootstrapSummary = {
    productName: string;
    targetPlatform: string;
    renderer: string;
    backend: string;
    strategy: string;
  };

  const principles = [
    "Rust owns navigation, search, sort, file operations, metadata, caching, and cancellation.",
    "Tauri + Svelte only render streamed state and collect user intent.",
    "Windows-first optimizations come before cross-platform abstractions.",
    "Every list, tree, and search result is virtualized from day one."
  ];

  const milestones = [
    "Performance harness and budgets",
    "Streamed directory engine in Rust",
    "Virtualized details view",
    "Tabs, panes, omnibar, and keyboard flow",
    "File operations queue and preview pipeline"
  ];

  let summary = $state<BootstrapSummary | null>(null);

  const loadSummary = async () => {
    summary = await invoke<BootstrapSummary>("get_bootstrap_summary");
  };

  loadSummary();
</script>

<svelte:head>
  <title>File Explorer</title>
  <meta
    name="description"
    content="Windows-first file explorer with a Rust core and a thin Tauri renderer."
  />
</svelte:head>

<main class="shell">
  <section class="hero">
    <p class="eyebrow">Windows-first reboot</p>
    <h1>File Explorer is being rebuilt as a Rust-first desktop shell.</h1>
    <p class="lede">
      The frontend is only the renderer. Navigation, listing, search, file operations, enrichment,
      caching, and performance-critical orchestration all live in Rust.
    </p>
  </section>

  <section class="grid">
    <article class="panel status">
      <p class="label">Bootstrap</p>
      {#if summary}
        <dl>
          <div>
            <dt>Product</dt>
            <dd>{summary.productName}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{summary.targetPlatform}</dd>
          </div>
          <div>
            <dt>Renderer</dt>
            <dd>{summary.renderer}</dd>
          </div>
          <div>
            <dt>Backend</dt>
            <dd>{summary.backend}</dd>
          </div>
        </dl>
        <p class="strategy">{summary.strategy}</p>
      {:else}
        <p class="muted">Loading Rust bootstrap summary...</p>
      {/if}
    </article>

    <article class="panel">
      <p class="label">Design rules</p>
      <ul>
        {#each principles as principle}
          <li>{principle}</li>
        {/each}
      </ul>
    </article>

    <article class="panel wide">
      <p class="label">First milestones</p>
      <ol>
        {#each milestones as milestone}
          <li>{milestone}</li>
        {/each}
      </ol>
      <div class="links">
        <a href="https://v2.tauri.app/" target="_blank" rel="noreferrer">Tauri docs</a>
        <a href="https://kit.svelte.dev/" target="_blank" rel="noreferrer">SvelteKit docs</a>
      </div>
    </article>
  </section>
</main>

<style>
  :global(:root) {
    color: #f4efe7;
    background:
      radial-gradient(circle at top, rgba(236, 172, 92, 0.18), transparent 34%),
      linear-gradient(180deg, #0b1015 0%, #111b24 48%, #081118 100%);
    font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(body) {
    margin: 0;
    min-height: 100vh;
  }

  .shell {
    min-height: 100vh;
    padding: 48px;
    box-sizing: border-box;
  }

  .hero {
    max-width: 920px;
    margin-bottom: 32px;
  }

  .eyebrow,
  .label {
    margin: 0 0 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.75rem;
    color: #f1b365;
  }

  h1 {
    margin: 0;
    max-width: 900px;
    font-size: clamp(2.5rem, 6vw, 4.8rem);
    line-height: 0.96;
    letter-spacing: -0.04em;
  }

  .lede {
    margin: 20px 0 0;
    max-width: 720px;
    font-size: 1.05rem;
    line-height: 1.65;
    color: rgba(244, 239, 231, 0.8);
  }

  .grid {
    display: grid;
    gap: 20px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel {
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    background: rgba(7, 13, 18, 0.58);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(18px);
  }

  .wide {
    grid-column: 1 / -1;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 0;
  }

  dt {
    margin-bottom: 6px;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(244, 239, 231, 0.5);
  }

  dd {
    margin: 0;
    font-size: 1rem;
    color: #fff4e3;
  }

  .strategy,
  .muted,
  li {
    color: rgba(244, 239, 231, 0.82);
    line-height: 1.6;
  }

  ul,
  ol {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 10px;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 20px;
  }

  a {
    color: #ffd296;
    text-decoration: none;
  }

  a:hover {
    color: #fff0d5;
  }

  @media (max-width: 900px) {
    .shell {
      padding: 24px;
    }

    .grid {
      grid-template-columns: 1fr;
    }

    .wide {
      grid-column: auto;
    }

    dl {
      grid-template-columns: 1fr;
    }
  }
</style>
