<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { settings, type ThemePreference } from "$lib/stores/settings";
  import { settingsUi, type SettingsSection } from "$lib/stores/settingsUi";

  let { open, section } = $derived($settingsUi);
  let { themePreference, artificialNavDelayMs, sessionRestoreEnabled } = $derived($settings);

  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: "general", label: "General" },
    { id: "appearance", label: "Appearance" },
    { id: "developer", label: "Developer" },
    { id: "about", label: "About" }
  ];

  const themes: Array<{ value: ThemePreference; label: string; description: string }> = [
    { value: "system", label: "System", description: "Follow the Windows theme automatically." },
    { value: "light", label: "Light", description: "Always use the light shell theme." },
    { value: "dark", label: "Dark", description: "Always use the dark shell theme." }
  ];

  function close() {
    settingsUi.closeSettings();
  }

  function updateSessionRestore(event: Event) {
    settings.setSessionRestoreEnabled((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }}
/>

{#if open}
  <div
    class="overlay"
    role="presentation"
    tabindex="-1"
    onclick={(event) => {
      if (event.target === event.currentTarget) {
        close();
      }
    }}
  >
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="titlebar">
        <h2 id="settings-title">Settings</h2>
        <Button className="settings-close" onclick={close} ariaLabel="Close settings" title="Close settings" iconOnly>
          {#snippet icon()}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.25 4.25 11.75 11.75" />
              <path d="M11.75 4.25 4.25 11.75" />
            </svg>
          {/snippet}
        </Button>
      </header>

      <div class="body">
        <nav class="sections" aria-label="Settings sections">
          {#each sections as item}
            <button class:active={section === item.id} onclick={() => settingsUi.setSection(item.id)} type="button">
              {item.label}
            </button>
          {/each}
        </nav>

        <div class="panel">
          {#if section === "general"}
            <header class="section-header">
              <p class="eyebrow">General</p>
              <h3>Startup</h3>
            </header>

            <div class="stack">
              <label class="setting-row choice-row feature-row">
                <span class="choice-copy">
                  <strong>Restore previous session</strong>
                  <small>Reopen tabs, navigation state, and selections on startup.</small>
                </span>
                <input
                  aria-label="Restore previous session"
                  checked={sessionRestoreEnabled}
                  class="switch-input"
                  onchange={updateSessionRestore}
                  role="switch"
                  type="checkbox"
                />
              </label>
            </div>
          {:else if section === "appearance"}
            <header class="section-header">
              <p class="eyebrow">Appearance</p>
              <h3>Theme</h3>
            </header>

            <div class="stack">
              {#each themes as theme}
                <label class="setting-row choice-row">
                  <span class="choice-copy">
                    <strong>{theme.label}</strong>
                    <small>{theme.description}</small>
                  </span>
                  <input
                    checked={themePreference === theme.value}
                    name="theme"
                    onchange={() => settings.setThemePreference(theme.value)}
                    type="radio"
                  />
                </label>
              {/each}
            </div>
          {:else if section === "developer"}
            <header class="section-header">
              <p class="eyebrow">Developer</p>
              <h3>Testing</h3>
            </header>

            <div class="stack">
              <div class="setting-row developer-row">
                <div class="choice-copy">
                  <strong>Artificial navigation delay</strong>
                  <small>Delay folder navigation to test refresh, progress, and loading states.</small>
                </div>
                <div class="delay-controls">
                  <input
                    min="0"
                    max="5000"
                    step="50"
                    type="number"
                    value={artificialNavDelayMs}
                    oninput={(event) => settings.setArtificialNavDelayMs(Number((event.currentTarget as HTMLInputElement).value))}
                  />
                  <span>ms</span>
                </div>
              </div>

              <div class="actions-row">
                <Button className="secondary" variant="subtle" onclick={() => settings.reset()}>Reset settings</Button>
              </div>
            </div>
          {:else}
            <header class="section-header">
              <p class="eyebrow">About</p>
              <h3>File Explorer</h3>
            </header>

            <div class="stack">
              <div class="setting-row about-row">
                <div class="choice-copy">
                  <strong>Windows-first file explorer</strong>
                  <small>Built with a Rust core, a thin Tauri renderer, and a native-feeling shell designed for daily use.</small>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1250;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--app-bg-solid) 42%, transparent);
    backdrop-filter: blur(4px);
  }

  .dialog {
    width: min(980px, calc(100vw - 56px));
    min-height: min(640px, calc(100vh - 72px));
    border: 1px solid color-mix(in srgb, var(--panel-border) 96%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface-raised) 99%, transparent);
    box-shadow: 0 22px 48px rgba(15, 23, 42, 0.24);
    overflow: hidden;
  }

  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 84%, transparent);
    background: color-mix(in srgb, var(--surface-subtle) 88%, transparent);
  }

  .titlebar h2,
  .section-header h3,
  .section-header p,
  .choice-copy strong,
  .choice-copy small {
    margin: 0;
  }

  .titlebar h2 {
    color: var(--text-strong);
    font-size: 1rem;
  }

  :global(.settings-close) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .body {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    min-height: min(580px, calc(100vh - 140px));
  }

  .sections {
    display: grid;
    align-content: start;
    gap: 6px;
    padding: 14px;
    border-right: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
    background: color-mix(in srgb, var(--surface-subtle) 82%, transparent);
  }

  .sections button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
    cursor: pointer;
  }

  .sections button.active {
    background: var(--accent-soft);
    border-color: var(--selection-border);
    color: var(--accent-text);
  }

  .panel {
    padding: 18px;
    overflow: auto;
  }

  .section-header {
    margin-bottom: 14px;
  }

  .eyebrow {
    color: var(--text-muted);
    font-size: 0.76rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .section-header h3 {
    color: var(--text-strong);
    font-size: 1.45rem;
  }

  .stack {
    display: grid;
    gap: 10px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 16px;
    border: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface-subtle) 74%, transparent);
  }

  .feature-row {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent-soft) 72%, transparent), transparent 58%),
      color-mix(in srgb, var(--surface-subtle) 80%, transparent);
    border-color: color-mix(in srgb, var(--selection-border) 46%, var(--panel-border));
  }

  .choice-copy {
    display: grid;
    gap: 4px;
  }

  .choice-copy strong {
    color: var(--text-strong);
    font-size: 0.92rem;
  }

  .choice-copy small {
    color: var(--text-muted);
    line-height: 1.45;
    font-size: 0.8rem;
  }

  .developer-row {
    align-items: flex-start;
  }

  .delay-controls {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }

  input[type="number"] {
    width: 120px;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid var(--button-border);
    border-radius: 8px;
    background: var(--surface-input);
    color: var(--text-primary);
  }

  .switch-input {
    appearance: none;
    position: relative;
    flex: 0 0 auto;
    width: 42px;
    height: 24px;
    margin: 0;
    border: 1px solid color-mix(in srgb, var(--button-border) 84%, var(--text-muted));
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface-input) 88%, var(--text-muted) 12%);
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.12);
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .switch-input::before {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--text-muted);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.28);
    transition:
      transform 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .switch-input:checked {
    border-color: color-mix(in srgb, var(--accent-text) 42%, var(--selection-border));
    background: color-mix(in srgb, var(--accent-soft-strong) 86%, var(--surface-input));
    box-shadow:
      inset 0 1px 2px rgba(15, 23, 42, 0.1),
      0 0 0 1px color-mix(in srgb, var(--accent-text) 12%, transparent);
  }

  .switch-input:checked::before {
    transform: translateX(18px);
    background: var(--accent-text);
    box-shadow: 0 2px 5px rgba(15, 23, 42, 0.32);
  }

  .switch-input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .switch-input:hover {
    border-color: color-mix(in srgb, var(--accent-text) 34%, var(--button-border));
  }

  .actions-row {
    display: flex;
    justify-content: flex-start;
  }

  :global(.secondary) {
    min-height: 34px;
    padding: 0 12px;
    color: var(--text-primary);
  }

  @media (max-width: 860px) {
    .dialog {
      width: calc(100vw - 24px);
      min-height: calc(100vh - 24px);
    }

    .body {
      grid-template-columns: 1fr;
    }

    .sections {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      overflow: auto;
      border-right: none;
      border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
    }

    .setting-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
