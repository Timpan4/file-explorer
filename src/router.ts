import {createRouter, createWebHistory} from "vue-router";


import VolumeList from "./components/volumes/VolumeList.vue";
import DirectoryList from "./components/directories/DirectoryList.vue";

const routes = [
  {
    path: "/",
    component: VolumeList,
  },
    {
    path: "/files",
    component: DirectoryList,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;