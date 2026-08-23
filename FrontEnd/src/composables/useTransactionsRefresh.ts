import { onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTransactionsStore } from '../stores/transactions'

export const REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Keeps the shared transactions cache warm for the app's lifetime, same convention as
// useTokenRefresh - see that for the full rationale.
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
