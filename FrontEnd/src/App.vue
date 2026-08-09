<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import { useTokenRefresh } from './composables/useTokenRefresh'
import { useTransactionsRefresh } from './composables/useTransactionsRefresh'
import { useSettingsRefresh } from './composables/useSettingsRefresh'

const route = useRoute()
useTokenRefresh()
useTransactionsRefresh()
useSettingsRefresh()
</script>

<template>
  <NavBar v-if="route.name !== 'login'" />
  <RouterView />
</template>
