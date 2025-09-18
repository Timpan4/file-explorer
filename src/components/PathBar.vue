<script setup lang="ts">
import { computed } from 'vue';
import { useDirectoryStore } from '../stores/store';

const emit = defineEmits(['navigate', 'go-up']);

const directoryStore = useDirectoryStore();

const pathSegments = computed(() => {
  const currentPath = directoryStore.currentDirectory;
  if (!currentPath) return [];

  // Handle Windows drive letters (e.g., C:/)
  if (currentPath.match(/^[A-Za-z]:[\\/]$/)) {
    return [{ name: currentPath, path: currentPath }];
  }

  const segments = currentPath.split(/[\\/]/).filter(s => s.length > 0);
  let fullPath = '';
  return segments.map((segment, index) => {
    if (index === 0 && currentPath.match(/^[A-Za-z]:/)) { // Handle drive letter
      fullPath = segment + '/';
    } else if (currentPath.startsWith('/')) { // Handle Unix-like root
      fullPath += '/' + segment;
    } else {
      fullPath += (index === 0 ? '' : '/') + segment;
    }
    return { name: segment, path: fullPath };
  });
});

const handleSegmentClick = (path: string) => {
  emit('navigate', path);
};

const handleGoUp = () => {
  emit('go-up');
};

const isUpButtonDisabled = computed(() => {
  const currentPath = directoryStore.currentDirectory;
  return !currentPath;
});
</script>

<template>
  <div class="flex items-center min-w-xs">
    <button
      class="btn btn-ghost btn-sm mr-2"
      @click="handleGoUp"
      :disabled="isUpButtonDisabled"
      title="Go up one level"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>

    <div class="flex-grow flex flex-wrap items-center bg-base-200 border border-base-300 rounded-md px-2 py-1">
      <template v-for="(segment, index) in pathSegments" :key="segment.path">
        <span
          class="text-sm cursor-pointer hover:text-primary transition-colors duration-200"
          @click="handleSegmentClick(segment.path)"
        >
          {{ segment.name }}
        </span>
        <span v-if="index < pathSegments.length - 1" class="mx-1 text-base-content">/</span>
      </template>
      <span v-if="pathSegments.length === 0" class="text-sm text-base-content-content">Select a drive or folder</span>
    </div>
  </div>
</template>

<style scoped>
/* Add any specific styles here if needed, but Tailwind should handle most */
</style>
