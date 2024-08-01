<script setup lang="ts">
import {useDirectoryStore} from "../../stores/store";
import DirectoryItem from "./DirectoryItem.vue";

const directoryStore = useDirectoryStore();



</script>

<template>
  <div>
    <template v-for="item in directoryStore.currentDirectoryItems" class="flex flex-row">
      <DirectoryItem :item="item"/>
    </template>
  </div>
</template>

<style scoped>

</style>