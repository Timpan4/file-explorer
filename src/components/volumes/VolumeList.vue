<script setup lang="ts">
import { ref } from "vue";
import VolumeDisplay from "./Volume.vue";
import type {Volume} from "./volumes";
import {invoke} from "@tauri-apps/api/core";
const volumes = ref<Volume[]>([]);
getVolumes();

async function getVolumes() {
  const result = await invoke<Volume[]>("get_volumes");
  console.log(result);
  volumes.value = result;
}
</script>

<template>
<div class="flex flex-wrap">
  <template v-for="volume in volumes" class="flex flex-row">
    <VolumeDisplay :volume="volume"/>
  </template>
</div>

</template>

<style scoped>

</style>