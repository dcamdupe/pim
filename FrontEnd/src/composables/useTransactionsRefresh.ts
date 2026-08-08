import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTransactionsStore } from '../stores/transactions'

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Keeps the shared transactions cache warm for the app's whole lifetime (App.vue calls this once,
// same convention as useTokenRefresh) - load() on mount hydrates/fetches as needed (see
// stores/transactions.ts's own EXPIRY_MS check), then the interval unconditionally re-fetches every
// 5 minutes so a long-open session doesn't go stale. Guarded on isAuthenticated (checked fresh each
// tick, same as useTokenRefresh) so it doesn't fetch before login or keep polling after logout - a
// single interval that no-ops while unauthenticated is simpler than starting/stopping one on auth
// changes.
export function useTransactionsRefresh(intervalMs = REFRESH_INTERVAL_MS): void {
  const authStore = useAuthStore()
  const transactionsStore = useTransactionsStore()
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
    void tick(() => transactionsStore.load())
    intervalId = setInterval(() => void tick(() => transactionsStore.refresh()), intervalMs)
  })
  onUnmounted(() => {
    clearInterval(intervalId)
  })
}
