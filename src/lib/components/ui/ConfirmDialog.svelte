<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { dialogs } from "$lib/stores/dialogs";

  let { open, title, message, details, confirmLabel, cancelLabel, tone } = $derived($dialogs);

  function confirmAction() {
    dialogs.confirmAction();
  }

  function cancel() {
    dialogs.cancel();
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (!open) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }

    if (event.key === "Enter") {
      event.preventDefault();
      confirmAction();
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
      cancel();
    }
  }}
  >
    <div class={`dialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div class="body">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        {#if details}
          <p class="details">{details}</p>
        {/if}
      </div>

      <div class="actions">
        <Button className="secondary" variant="subtle" onclick={cancel}>{cancelLabel}</Button>
        <Button className={`primary ${tone}`} variant={tone === "danger" ? "danger" : "subtle"} onclick={confirmAction}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--app-bg-solid) 48%, transparent);
    backdrop-filter: blur(3px);
  }

  .dialog {
    width: min(420px, calc(100vw - 32px));
    padding: 18px;
    border: 1px solid color-mix(in srgb, var(--panel-border) 96%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface-raised) 99%, transparent);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
  }

  .body h2,
  .body p {
    margin: 0;
  }

  .body h2 {
    color: var(--text-strong);
    font-size: 1rem;
    margin-bottom: 8px;
  }

  .body p {
    color: var(--text-primary);
    line-height: 1.5;
    font-size: 0.9rem;
  }

  .details {
    margin-top: 8px;
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  :global(.actions .button) {
    min-height: 32px;
    padding: 0 12px;
  }

  :global(.secondary) {
    color: var(--text-primary);
  }

  :global(.primary) {
    color: var(--text-primary);
  }

  :global(.primary.warning) {
    background: color-mix(in srgb, #d89b2b 22%, transparent);
    border-color: color-mix(in srgb, #d89b2b 38%, transparent);
  }

  :global(.primary.danger) {
    background: color-mix(in srgb, #cf5a50 18%, transparent);
    border-color: color-mix(in srgb, #cf5a50 34%, transparent);
    color: color-mix(in srgb, #cf5a50 92%, var(--text-primary));
  }
</style>
