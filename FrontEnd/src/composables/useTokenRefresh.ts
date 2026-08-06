import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { refreshToken } from '../services/authService'

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Keeps a long-lived session alive by renewing the JWT before it expires (App.vue calls this once,
// for the app's whole lifetime - it persists across login/logout without a page reload, so a single
// interval that no-ops while unauthenticated is simpler than starting/stopping one on auth changes).
// A failed refresh (network blip, etc.) is swallowed - the existing expiry-based isAuthenticated
// check already logs the user out if refreshing keeps failing, same as today's behavior without this
// composable at all.
export function useTokenRefresh(intervalMs = REFRESH_INTERVAL_MS): void {
  const authStore = useAuthStore()
  let intervalId: ReturnType<typeof setInterval> | undefined

  async function tick() {
    if (!authStore.isAuthenticated || authStore.token === null) {
      return
    }
    try {
      const newToken = await refreshToken(authStore.token)
      authStore.setToken(newToken)
    } catch {
      // Left as-is - see the module comment above.
    }
  }

  onMounted(() => {
    intervalId = setInterval(tick, intervalMs)
  })
  onUnmounted(() => {
    clearInterval(intervalId)
  })
}
