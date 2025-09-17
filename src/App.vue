<script setup lang="ts">
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import Header from "./components/Header.vue";
import { useDirectoryStore } from "./stores/store";

const directoryStore = useDirectoryStore();
</script>

<template>
    <Header />
    <p>{{ directoryStore.currentDirectory }}</p>
    <main>
        <RouterView />
    </main>
</template>

<style scoped></style>
