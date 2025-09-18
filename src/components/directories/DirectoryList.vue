<script setup lang="ts">
import {useDirectoryStore} from "../../stores/store";
import DirectoryItem from "./DirectoryItem.vue";
import {useRoute} from "vue-router";
import {onMounted, watch} from "vue";

const directoryStore = useDirectoryStore();
const route = useRoute();

const props = defineProps<{
  navigateToDirectory: (path: string) => Promise<void>;
}>();

const getPathFromRoute = () => {
  const pathMatch = route.params.pathMatch as string[];
  return pathMatch ? decodeURIComponent(pathMatch.join('/')) : '';
};

onMounted(async () => {
  const currentPath = getPathFromRoute();
  if (currentPath) {
    await directoryStore.getDirectory(currentPath);
  }
});

watch(() => route.params.pathMatch, async () => {
  const newPath = getPathFromRoute();
  if (newPath) {
    await directoryStore.getDirectory(newPath);
  }
});

</script>

<template>
  <div class="flex flex-col">
    <div class="flex flex-row p-2 font-bold border-b border-base-300 text-xs">
      <div class="w-1/2">Name</div>
      <div class="w-1/4">Type</div>
      <div class="w-1/4">Last Modified</div>
      <div class="w-1/4">Size</div>
    </div>
    <div class="flex flex-col">
      <template v-for="item in directoryStore.currentDirectoryItems">
        <DirectoryItem :item="item" @navigate="props.navigateToDirectory"/>
      </template>
    </div>
  </div>
</template>

<style scoped>

</style>



