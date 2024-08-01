<script setup lang="ts">
import type {DirectoryItem} from "../../stores/store";

defineProps<{
  item: DirectoryItem
}>();

</script>

<template>
  <div class="flex flex-row">
    <div class="flex flex-row items-center">
      <svg v-if="item.is_dir" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <p class="ml-2">{{item.name}}</p>
      <p class="ml-2">{{item.last_modified}}</p>
      <p v-if="!item.is_dir" class="ml-2">{{item.size}}</p>
    </div>
  </div>
</template>

<style scoped>

</style>