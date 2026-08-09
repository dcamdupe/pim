import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'

export const REFRESH_INTERVAL_MS = 60 * 1000

// Keeps the shared settings cache warm for the app's whole lifetime (App.vue calls this once, same
// convention as useTokenRefresh/useTransactionsRefresh) - load() on mount fetches once if there's no
// cache yet, then the interval unconditionally re-fetches every 1 minute (UBE-87) so a long-open
// session doesn't go stale; SettingsView.vue's own forced refresh() calls after every save/add/
// delete cover the "or when settings are saved" half of the ticket. Guarded on isAuthenticated
// (checked fresh each tick, same as the other two refresh composables) so it doesn't fetch before
// login or keep polling after logout.
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
