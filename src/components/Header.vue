<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted } from 'vue';

const router = useRouter()

function goHome() {
  router.push("/");
}

const toggleTheme = (event: Event) => {
  const htmlElement = document.documentElement;
  if (event.target instanceof HTMLInputElement) {
    if (event.target.checked) {
      htmlElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      htmlElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }
};

onMounted(() => {
  const htmlElement = document.documentElement;
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    htmlElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    htmlElement.setAttribute('data-theme', 'dark');
  } else {
    htmlElement.setAttribute('data-theme', 'light');
  }
});
</script>

<template>
  <div class="navbar bg-base-100 shadow-md border-b border-base-200 px-4 py-2">
    <div class="navbar-start flex">
      <button class="btn btn-ghost btn-sm mr-2" @click="goHome()" title="Go to Home">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 001 1h3m-11 0a1 1 0 01-1 1H9a1 1 0 01-1-1v-4a1 1 0 00-1-1H5a1 1 0 00-1 1v4a1 1 0 01-1 1H3" />
        </svg>
      </button>
      <slot name="path-bar"></slot>
    </div>
    <div class="navbar-end">
    </div>
  </div>
</template>

<style scoped>

</style>