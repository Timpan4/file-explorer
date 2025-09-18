import {defineStore} from 'pinia'
import {ref, watch} from "vue";

import {invoke} from "@tauri-apps/api/core";

export type DirectoryItem = {
    name: string;
    path: string;
    is_dir: boolean;
    last_modified: string;
    size: number;
    file_type: string;
}
export const useDirectoryStore = defineStore('directory', () => {
  const currentDirectory = ref(localStorage.getItem("currentDirectory") || "");
  const currentDirectoryItems = ref<DirectoryItem[]>(JSON.parse(localStorage.getItem("currentDirectoryItems") || "[]"));

    watch(currentDirectory, (newPath) => {
        localStorage.setItem("currentDirectory", newPath);
    });

    watch(currentDirectoryItems, (newItems) => {
        localStorage.setItem("currentDirectoryItems", JSON.stringify(newItems));
    });

  async function getDirectory(path: string) {
      try {
          const result = await invoke<DirectoryItem[]>("get_directory", {path: path || currentDirectory.value});
          currentDirectoryItems.value = result;
          currentDirectory.value = path;
      } catch (error) {
          console.error("store.ts: Error invoking get_directory:", error);
          currentDirectoryItems.value = []; // Clear items on error
      }
  }
  return {
      currentDirectory,
      currentDirectoryItems,
      getDirectory
  }
})