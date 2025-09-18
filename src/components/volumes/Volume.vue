<script setup lang="ts">
import type {Volume} from "./volumes";
import {useDirectoryStore} from "../../stores/store";
import {useRouter} from "vue-router";
const router = useRouter();

defineProps<{
  volume: Volume
}>();

const directoryStore = useDirectoryStore();

function bytesToGigabytes(bytes: number, precision: number = 2) {
  if (bytes === 0) return "0 GB";

  return Math.round(bytes * 10 ** precision / 1_000_000_000) / 10 ** precision;
}

async function getDirectory(path: string) {
  await directoryStore.getDirectory(path);
    await router.push(`/files/${encodeURIComponent(path)}`);
}

</script>

<template>
  <div class="bg-gray-600 shadow-2xl rounded-lg p-4 m-4 w-56 select-none" @click="getDirectory(volume.mount_point)">
    <p>{{volume.name || "Local Disk"}} ({{volume.mount_point}})</p>
    <p>{{bytesToGigabytes(volume.available_space)}} GB</p>
    <p>{{bytesToGigabytes(volume.total_space)}} GB</p>
    <p>{{bytesToGigabytes(volume.used_space)}} GB</p>
  </div>
</template>

<style scoped>

</style>