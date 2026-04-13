<script lang="ts">
  const rows = Array.from({ length: 9 }, (_, index) => index);
  const nameWidths = [180, 220, 160, 210, 140, 195, 170, 205, 150];
  const typeWidths = [72, 84, 68, 80, 76, 88, 70, 82, 74];
  const modifiedWidths = [128, 144, 136, 152, 132, 148, 140, 146, 138];
  const sizeWidths = [56, 64, 48, 60, 52, 68, 58, 54, 62];
</script>

<div class="skeleton" aria-hidden="true">
  {#each rows as row, index}
    <div class="row" style={`animation-delay:${index * 35}ms;`}>
      <div class="name-cell">
        <span class="icon"></span>
        <span class="line strong" style={`width:${nameWidths[row]}px;`}></span>
      </div>
      <span class="line" style={`width:${typeWidths[row]}px;`}></span>
      <span class="line" style={`width:${modifiedWidths[row]}px;`}></span>
      <span class="line size" style={`width:${sizeWidths[row]}px;`}></span>
    </div>
  {/each}
</div>

<style>
  .skeleton {
    display: grid;
    gap: 0;
    padding: 2px 8px 8px;
    user-select: none;
    -webkit-user-select: none;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(260px, 2fr) 140px 180px 120px;
    gap: 12px;
    align-items: center;
    height: 38px;
    margin: 2px 0;
    padding: 0 16px;
    border: 1px solid transparent;
    border-radius: 8px;
  }

  .name-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .icon,
  .line {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--surface-subtle) 88%, transparent) 0%,
      color-mix(in srgb, var(--surface-subtle) 68%, var(--surface-input)) 50%,
      color-mix(in srgb, var(--surface-subtle) 88%, transparent) 100%
    );
    background-size: 220% 100%;
    animation: pulse 1.4s ease-in-out infinite;
  }

  .icon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .line {
    display: block;
    height: 11px;
    border-radius: 999px;
  }

  .line.strong {
    height: 12px;
  }

  .line.size {
    justify-self: end;
  }

  @keyframes pulse {
    0% {
      background-position: 100% 0;
      opacity: 0.7;
    }

    50% {
      opacity: 0.95;
    }

    100% {
      background-position: -100% 0;
      opacity: 0.7;
    }
  }
</style>
