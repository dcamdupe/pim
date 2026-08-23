<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { completeGoogleLogin } from '../services/auth/cognitoAuthService'
import { warmCachesAfterLogin } from '../services/auth/postLogin'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const error = ref('')

onMounted(async () => {
  const code = route.query.code
  if (typeof code !== 'string') {
    error.value = 'Sign-in failed. Please try again.'
    return
  }

  try {
    const session = await completeGoogleLogin(code)
    authStore.setToken(session.idToken, session.refreshToken)
    warmCachesAfterLogin()
    router.push('/dashboard')
  } catch {
    error.value = 'Sign-in failed. Please try again.'
  }
})
</script>

<template>
  <div class="callback-page">
    <p v-if="error">{{ error }}</p>
    <p v-else>Signing in…</p>
  </div>
</template>

<style scoped>
.callback-page {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
