import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'

export const REFRESH_INTERVAL_MS = 60 * 1000

// Keeps the shared settings cache warm for the app's lifetime, same convention as
// useTokenRefresh/useTransactionsRefresh - see those for the full rationale.
export function useSettingsRefresh(intervalMs = REFRESH_INTERVAL_MS): void {
  const authStore = useAuthStore()
  const settingsStore = useSettingsStore()
  let intervalId: ReturnType<typeof setInterval> | undefined

  async function tick(fn: () => Promise<void>) {
    if (!authStore.isAuthenticated) {
      return
    }
    try {
      await fn()
    } catch {
      // Swallowed - a failed fetch leaves the existing (possibly stale) cache in place rather than
      // crashing the app; the next successful tick catches it back up.
    }
  }

  onMounted(() => {
    void tick(() => settingsStore.load())
    intervalId = setInterval(() => void tick(() => settingsStore.refresh()), intervalMs)
  })
  onUnmounted(() => {
    clearInterval(intervalId)
  })
}
