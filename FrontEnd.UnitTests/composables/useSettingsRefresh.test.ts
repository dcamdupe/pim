import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'
import { useSettingsRefresh } from '../../FrontEnd/src/composables/useSettingsRefresh'
import * as settingsService from '../../FrontEnd/src/services/settingsService'

const STORAGE_KEY = 'pim.settings'

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function makeToken(claims: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  return `${header}.${payload}.signature`
}

function authenticate() {
  useAuthStore().setToken(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }))
}

// Seeds an already-loaded cache so the mount-time load() no-ops (stores/settings.ts's load() has no
// expiry window, unlike transactions - any loadedAt at all counts as loaded) - isolates a test to
// just the interval's own refresh() calls.
function seedLoadedCache() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accounts: [], categories: [], minTransactionDate: null, loadedAt: Date.now() }),
  )
}

function mountWithRefresh(intervalMs: number) {
  const TestComponent = defineComponent({
    setup() {
      useSettingsRefresh(intervalMs)
      return () => h('div')
    },
  })
  return mount(TestComponent)
}

describe('useSettingsRefresh', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads on mount while authenticated', async () => {
    authenticate()
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue({
      accounts: [],
      categories: [],
      minTransactionDate: null,
    })

    const wrapper = mountWithRefresh(60_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(getSpy).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('does not load or refresh while unauthenticated', async () => {
    const getSpy = vi.spyOn(settingsService, 'getSettings')

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(getSpy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('refreshes on each tick while authenticated', async () => {
    authenticate()
    seedLoadedCache()
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue({
      accounts: [],
      categories: [],
      minTransactionDate: null,
    })

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(0)
    expect(getSpy).not.toHaveBeenCalled() // mount-time load() no-ops - already loaded

    await vi.advanceTimersByTimeAsync(1000)
    expect(getSpy).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('swallows a failed tick rather than throwing', async () => {
    authenticate()
    vi.spyOn(settingsService, 'getSettings').mockRejectedValue(new Error('network blip'))

    const wrapper = mountWithRefresh(1000)

    await expect(vi.advanceTimersByTimeAsync(1000)).resolves.not.toThrow()

    wrapper.unmount()
  })

  it('ticks repeatedly on the given interval', async () => {
    authenticate()
    seedLoadedCache()
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue({
      accounts: [],
      categories: [],
      minTransactionDate: null,
    })

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(3500)

    expect(getSpy).toHaveBeenCalledTimes(3)

    wrapper.unmount()
  })

  it('stops ticking after unmount', async () => {
    authenticate()
    seedLoadedCache()
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockResolvedValue({
      accounts: [],
      categories: [],
      minTransactionDate: null,
    })

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(0)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(5000)

    expect(getSpy).not.toHaveBeenCalled()
  })
})
