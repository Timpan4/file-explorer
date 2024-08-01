import {defineStore} from 'pinia'
import {ref} from "vue";

import {invoke} from "@tauri-apps/api/core";

export type DirectoryItem = {
    name: string;
    path: string;
    is_dir: boolean;
    last_modified: string;
    size: number;
}
export const useDirectoryStore = defineStore('directory', () => {
  const currentDirectory = ref("");
  const currentDirectoryItems = ref<DirectoryItem[]>([]);

  async function getDirectory(path: string) {
      console.log("getDirectory", path);
      const result = await invoke<DirectoryItem[]>("get_directory", {path: path || currentDirectory.value});
      console.table(result);
      currentDirectoryItems.value = result;
  }
  return {
      currentDirectory,
      currentDirectoryItems,
      getDirectory
  }
})