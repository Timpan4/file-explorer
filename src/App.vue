<script setup lang="ts">
import Header from "./components/Header.vue";
import PathBar from "./components/PathBar.vue";
import { useDirectoryStore } from "./stores/store";
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";

const directoryStore = useDirectoryStore();
const route = useRoute();
const router = useRouter();

const navigateToDirectory = async (path: string) => {
  await directoryStore.getDirectory(path);
  await router.push(`/files/${encodeURIComponent(path)}`);
};

const parentPath = computed(() => {
  const currentPath = directoryStore.currentDirectory;
  const parts = currentPath.split(/[\/]/).filter(p => p.length > 0);
  if (parts.length <= 1) {
    return ''; // Root or drive letter, no parent
  }
  return parts.slice(0, parts.length - 1).join('/') + (currentPath.startsWith('/') ? '/' : '');
});

const goUp = () => {
  if (parentPath.value) {
    navigateToDirectory(parentPath.value);
  } else {
    router.push('/'); // Go back to volume list if at root
  }
};

const showPathBar = computed(() => {
  return route.matched.some(record => record.path.startsWith('/files'));
});

</script>

<template>
    <Header>
      <template #path-bar v-if="showPathBar">
        <PathBar @navigate="navigateToDirectory" @go-up="goUp" class="pr-4 flex-grow" />
      </template>
    </Header>
    <main class="flex flex-grow">
        <div class="flex-grow">
            <RouterView v-slot="{ Component }">
              <component :is="Component" :navigate-to-directory="navigateToDirectory" />
            </RouterView>
        </div>
    </main>
</template>

<style scoped></style>
