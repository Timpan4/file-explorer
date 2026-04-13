<script lang="ts">
  import NotificationItem from "$lib/components/ui/NotificationItem.svelte";
  import { notifications } from "$lib/stores/notifications";

  let activeNotifications = $derived($notifications);
</script>

<div class="host" aria-live="polite" aria-atomic="false">
  {#each activeNotifications as notification (notification.id)}
    <NotificationItem {notification} />
  {/each}
</div>

<style>
  .host {
    position: fixed;
    right: 16px;
    bottom: 52px;
    z-index: 1000;
    display: grid;
    gap: 10px;
    justify-items: end;
    pointer-events: none;
  }

  .host :global(article) {
    pointer-events: auto;
  }
  </style>
