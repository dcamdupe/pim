<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import { useTokenRefresh } from './composables/useTokenRefresh'

const route = useRoute()
useTokenRefresh()
</script>

<template>
  <NavBar v-if="route.name !== 'login'" />
  <RouterView />
</template>
