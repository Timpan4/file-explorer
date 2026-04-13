<script lang="ts">
  let { message }: { message: string } = $props();
</script>

<div class="state error">
  <h3>Could not open this location</h3>
  <p>{message}</p>
</div>

<style>
  .state {
    padding: 28px 16px;
  }

  .error {
    color: #d66f5b;
  }

  h3 {
    margin: 0 0 10px;
    font-size: 0.95rem;
  }

  p {
    margin: 0;
  }
</style>
