import {defineStore} from 'pinia'
import {ref, watch} from "vue";

import {invoke} from "@tauri-apps/api/core";

export type DirectoryItem = {
    name: string;
    path: string;
    is_dir: boolean;
    last_modified: string;
    size: number;
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
      console.log("getDirectory", path);
      currentDirectoryItems.value = await invoke<DirectoryItem[]>("get_directory", {path: path || currentDirectory.value});
      currentDirectory.value = path;
  }
  return {
      currentDirectory,
      currentDirectoryItems,
      getDirectory
  }
})