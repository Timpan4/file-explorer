<script setup lang="ts">
import type {DirectoryItem} from "../../stores/store";
import { computed } from 'vue';

const emit = defineEmits(['navigate']);

const props = defineProps<{
  item: DirectoryItem
}>();

const handleClick = (path: string) => {
  emit('navigate', path);
};

const humanReadableSize = computed(() => {
  if (props.item.is_dir) return '';
  const bytes = props.item.size;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

const getFileIconPath = computed(() => {
  if (props.item.is_dir) {
    return "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"; // Folder icon
  } else {
    switch (props.item.file_type) {
      case "PNG":
      case "JPG":
      case "JPEG":
      case "GIF":
      case "BMP":
      case "WEBP":
        return "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"; // Image icon
      case "PDF":
        return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"; // PDF icon
      case "ZIP":
      case "RAR":
      case "7Z":
        return "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-2m-4 0V4m0 2h4m-4 6h.01M9 16h.01"; // Archive icon
      case "TXT":
        return "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"; // Generic document icon (same as PDF for now)
      case "JS":
      case "TS":
      case "JSON":
      case "HTML":
      case "CSS":
      case "VUE":
        return "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"; // Code icon
      default:
        return "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"; // Generic file icon
    }
  }
});

</script>

<template>
  <div class="flex flex-row p-2 hover:bg-base-200" :class="{'cursor-pointer': item.is_dir}" @click="item.is_dir && handleClick(item.path)">
    <div class="w-1/2 flex items-center space-x-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="{'text-blue-500': item.is_dir}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getFileIconPath" />
      </svg>
      <div class="font-normal text-xs">{{item.name}}</div>
    </div>
    <div class="w-1/4 text-xs flex items-center h-6">{{item.file_type}}</div>
    <div class="w-1/4 text-xs flex items-center h-6">{{item.last_modified}}</div>
    <div class="w-1/4 flex items-center h-6">
      <span v-if="!item.is_dir" class="text-xs">{{humanReadableSize}}</span>
    </div>
  </div>
</template>

<style scoped>

</style>