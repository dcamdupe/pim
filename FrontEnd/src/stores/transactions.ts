import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getTransactions, updateTransactions, type Transaction } from '../services/transactionsService'
import { formatDateForApi } from '../utils/dateFormat'

const STORAGE_KEY = 'pim.transactions'
const EXPIRY_MS = 10 * 60 * 1000

interface StoredTransactions {
  transactions: Transaction[]
  loadedAt: number
}

function loadStored(): StoredTransactions | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as StoredTransactions
    return Array.isArray(parsed.transactions) && typeof parsed.loadedAt === 'number' ? parsed : null
  } catch {
    return null
  }
}

export const useTransactionsStore = defineStore('transactions', () => {
  const stored = loadStored()
  const transactions = ref<Transaction[]>(stored?.transactions ?? [])
  const loadedAt = ref<number | null>(stored?.loadedAt ?? null)

  function persist() {
    if (loadedAt.value === null) {
      return
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ transactions: transactions.value, loadedAt: loadedAt.value } satisfies StoredTransactions),
    )
  }

  // Vue fires a child component's onMounted before its parent's, so a view calling load() on mount
  // (to know when its own data is ready) races App.vue's own load() call on the exact same page
  // load. Deduping to a single in-flight promise means both callers await the same fetch instead of
  // firing two.
  let inFlightRefresh: Promise<void> | null = null

  async function refresh() {
    if (inFlightRefresh) {
      return inFlightRefresh
    }
    inFlightRefresh = (async () => {
      transactions.value = await getTransactions(undefined, formatDateForApi(new Date()))
      loadedAt.value = Date.now()
      persist()
    })().finally(() => {
      inFlightRefresh = null
    })
    return inFlightRefresh
  }

  // Only fetches if there's no cache or it's past EXPIRY_MS - the 5-minute interval keeps a
  // long-open session fresh after that; this just avoids a redundant fetch on login/page load.
  async function load() {
    if (loadedAt.value !== null && Date.now() - loadedAt.value < EXPIRY_MS) {
      return
    }
    await refresh()
  }

  async function updateTransaction(transaction: Transaction, changes: Partial<Transaction>) {
    const [updated] = await updateTransactions([{ ...transaction, ...changes }])
    // Merge the server's response, not just `changes` - the Api can stamp Type/Ignore as a side
    // effect of a Category change, so the response is authoritative beyond what was sent.
    Object.assign(transaction, updated)
    persist()
  }

  function clear() {
    transactions.value = []
    loadedAt.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { transactions, loadedAt, load, refresh, updateTransaction, clear }
})
