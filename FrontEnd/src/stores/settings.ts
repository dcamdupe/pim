import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getSettings, type Account, type CategoryDefinition } from '../services/settingsService'

const STORAGE_KEY = 'pim.settings'

interface StoredSettings {
  accounts: Account[]
  categories: CategoryDefinition[]
  minTransactionDate: string | null
  loadedAt: number
}

function loadStored(): StoredSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as StoredSettings
    return Array.isArray(parsed.accounts) && Array.isArray(parsed.categories) && typeof parsed.loadedAt === 'number'
      ? parsed
      : null
  } catch {
    return null
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const stored = loadStored()
  const accounts = ref<Account[]>(stored?.accounts ?? [])
  const categories = ref<CategoryDefinition[]>(stored?.categories ?? [])
  const minTransactionDate = ref<string | null>(stored?.minTransactionDate ?? null)
  const loadedAt = ref<number | null>(stored?.loadedAt ?? null)

  function persist() {
    if (loadedAt.value === null) {
      return
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accounts: accounts.value,
        categories: categories.value,
        minTransactionDate: minTransactionDate.value,
        loadedAt: loadedAt.value,
      } satisfies StoredSettings),
    )
  }

  // Same in-flight-promise dedup as stores/transactions.ts - a view's own load() on mount can race
  // App.vue's useSettingsRefresh() load() on the same page load.
  let inFlightRefresh: Promise<void> | null = null

  async function refresh() {
    if (inFlightRefresh) {
      return inFlightRefresh
    }
    inFlightRefresh = (async () => {
      const settings = await getSettings()
      accounts.value = settings.accounts
      categories.value = settings.categories
      minTransactionDate.value = settings.minTransactionDate
      loadedAt.value = Date.now()
      persist()
    })().finally(() => {
      inFlightRefresh = null
    })
    return inFlightRefresh
  }

  // Only fetches if never loaded before - no expiry window like stores/transactions.ts, just
  // "load on login"; the 1-minute interval and forced refresh() after save/add/delete keep it current.
  async function load() {
    if (loadedAt.value !== null) {
      return
    }
    await refresh()
  }

  function clear() {
    accounts.value = []
    categories.value = []
    minTransactionDate.value = null
    loadedAt.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { accounts, categories, minTransactionDate, loadedAt, load, refresh, clear }
})
