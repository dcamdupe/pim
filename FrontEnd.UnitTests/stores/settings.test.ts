import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../FrontEnd/src/stores/settings'
import * as settingsService from '../../FrontEnd/src/services/settingsService'
import type { Settings } from '../../FrontEnd/src/services/settingsService'

const STORAGE_KEY = 'pim.settings'

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    accounts: [{ name: 'Everyday', type: 'Transaction' }],
    categories: [{ name: 'Dining', colour: '#eda100', type: 'Expense' }],
    minTransactionDate: '2020-01-01',
    apiKey: null,
    ...overrides,
  }
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts empty with no cached data', () => {
    const store = useSettingsStore()

    expect(store.accounts).toEqual([])
    expect(store.categories).toEqual([])
    expect(store.minTransactionDate).toBeNull()
    expect(store.loadedAt).toBeNull()
  })

  it('load() fetches settings when there is no cache', async () => {
    const settings = makeSettings()
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue(settings)

    const store = useSettingsStore()
    await store.load()

    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(store.accounts).toEqual(settings.accounts)
    expect(store.categories).toEqual(settings.categories)
    expect(store.minTransactionDate).toBe(settings.minTransactionDate)
    expect(store.loadedAt).not.toBeNull()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(stored.accounts).toEqual(settings.accounts)
  })

  // No expiry window here (unlike stores/transactions.ts) - the ticket only asks for "load on
  // login" plus the 1-minute interval/save-triggered refreshes, so load() only ever cares whether
  // it's been loaded at all, not how long ago.
  it('load() skips the fetch once already loaded, regardless of age', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...makeSettings(), loadedAt: Date.now() - 24 * 60 * 60 * 1000 }),
    )
    const getSpy = vi.spyOn(settingsService, 'getSettings')

    const store = useSettingsStore()
    await store.load()

    expect(getSpy).not.toHaveBeenCalled()
  })

  it('treats corrupt localStorage data as no cache', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue(makeSettings())

    const store = useSettingsStore()
    expect(store.accounts).toEqual([])
    await store.load()

    expect(getSpy).toHaveBeenCalledTimes(1)
  })

  it('refresh() dedupes concurrent calls into a single fetch', async () => {
    let resolveFetch: (value: Settings) => void = () => {}
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const store = useSettingsStore()
    const first = store.refresh()
    const second = store.refresh()
    resolveFetch(makeSettings())
    await Promise.all([first, second])

    expect(getSpy).toHaveBeenCalledTimes(1)
  })

  it('refresh() re-fetches even when already loaded', async () => {
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue(makeSettings())
    const store = useSettingsStore()
    await store.load()

    await store.refresh()

    expect(getSpy).toHaveBeenCalledTimes(2)
  })

  it('refresh() leaves existing state untouched when the fetch fails', async () => {
    vi.spyOn(settingsService, 'getSettings').mockRejectedValue(new Error('network blip'))

    const store = useSettingsStore()
    await expect(store.refresh()).rejects.toThrow('network blip')

    expect(store.accounts).toEqual([])
    expect(store.loadedAt).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('load() caches the API key returned by the service', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(makeSettings({ apiKey: 'key-abc' }))

    const store = useSettingsStore()
    await store.load()

    expect(store.apiKey).toBe('key-abc')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(stored.apiKey).toBe('key-abc')
  })

  it('regenerateApiKey() stores the new key and persists it', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(makeSettings({ apiKey: 'old-key' }))
    const generateSpy = vi.spyOn(settingsService, 'generateApiKey').mockResolvedValue('new-key')
    const store = useSettingsStore()
    await store.load()

    await store.regenerateApiKey()

    expect(generateSpy).toHaveBeenCalledTimes(1)
    expect(store.apiKey).toBe('new-key')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(stored.apiKey).toBe('new-key')
  })

  it('clear() resets state and removes the localStorage cache', async () => {
    vi.spyOn(settingsService, 'getSettings').mockResolvedValue(makeSettings())
    const store = useSettingsStore()
    await store.load()

    store.clear()

    expect(store.accounts).toEqual([])
    expect(store.categories).toEqual([])
    expect(store.minTransactionDate).toBeNull()
    expect(store.apiKey).toBeNull()
    expect(store.loadedAt).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
