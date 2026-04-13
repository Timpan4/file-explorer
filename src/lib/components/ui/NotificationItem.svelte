<script lang="ts">
  import Button from "$lib/components/ui/Button.svelte";
  import { notifications } from "$lib/stores/notifications";
  import type { Notification } from "$lib/stores/notifications";

  let { notification }: { notification: Notification } = $props();

  function dismiss() {
    notifications.dismiss(notification.id);
  }

  function runAction() {
    notification.action?.onAction();
    dismiss();
  }
</script>

<article class={`toast ${notification.kind}`} role="status" aria-live="polite">
  <div class="content">
    {#if notification.title}
      <p class="title">{notification.title}</p>
    {/if}
    <p class="message">{notification.message}</p>
  </div>

  <div class="actions">
    {#if notification.action}
      <button class="action" onclick={runAction} type="button">{notification.action.label}</button>
    {/if}

    {#if notification.dismissible}
      <Button className="dismiss" onclick={dismiss} ariaLabel="Dismiss notification" title="Dismiss notification" iconOnly>
        {#snippet icon()}
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4.25 4.25 11.75 11.75" />
            <path d="M11.75 4.25 4.25 11.75" />
          </svg>
        {/snippet}
      </Button>
    {/if}
  </div>
</article>

<style>
  .toast {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    width: min(320px, calc(100vw - 32px));
    padding: 12px 12px 12px 14px;
    border: 1px solid color-mix(in srgb, var(--panel-border) 92%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface-raised) 96%, transparent);
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(10px);
  }

  .toast.info {
    border-left: 3px solid color-mix(in srgb, var(--pill-text) 82%, transparent);
  }

  .toast.success {
    border-left: 3px solid #2ca46b;
  }

  .toast.warning {
    border-left: 3px solid #d89b2b;
  }

  .toast.error {
    border-left: 3px solid #cf5a50;
  }

  .content {
    min-width: 0;
  }

  .title,
  .message {
    margin: 0;
  }

  .title {
    margin-bottom: 4px;
    color: var(--text-strong);
    font-size: 0.84rem;
    font-weight: 600;
  }

  .message {
    color: var(--text-primary);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .action {
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }

  .action {
    min-height: 26px;
    padding: 0 8px;
    border-radius: 8px;
    font-size: 0.78rem;
    color: var(--pill-text);
  }

  :global(.dismiss) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    color: var(--text-muted);
  }

  .action:hover,
  :global(.dismiss:hover) {
    border-color: var(--button-hover-border);
    background: color-mix(in srgb, var(--button-hover-bg) 72%, transparent);
  }
</style>
