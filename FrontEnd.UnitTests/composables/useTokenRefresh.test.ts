import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'
import { useTokenRefresh } from '../../FrontEnd/src/composables/useTokenRefresh'
import * as authService from '../../FrontEnd/src/services/authService'
import * as cognitoAuthService from '../../FrontEnd/src/services/auth/cognitoAuthService'
import type { AuthProvider } from '../../FrontEnd/src/config/auth'

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function makeToken(claims: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  return `${header}.${payload}.signature`
}

function mountWithRefresh(intervalMs: number, authProvider?: AuthProvider) {
  const TestComponent = defineComponent({
    setup() {
      useTokenRefresh(intervalMs, authProvider)
      return () => h('div')
    },
  })
  return mount(TestComponent)
}

describe('useTokenRefresh', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('refreshes the token on each tick while authenticated', async () => {
    const store = useAuthStore()
    store.setToken(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }))
    const newToken = makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 7200 })
    const refreshSpy = vi.spyOn(authService, 'refreshToken').mockResolvedValue(newToken)

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(store.token).toBe(newToken)

    wrapper.unmount()
  })

  it('does not call refresh while unauthenticated', async () => {
    const refreshSpy = vi.spyOn(authService, 'refreshToken')

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(refreshSpy).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('leaves the existing token in place when refresh fails', async () => {
    const store = useAuthStore()
    const originalToken = makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 })
    store.setToken(originalToken)
    vi.spyOn(authService, 'refreshToken').mockRejectedValue(new Error('network blip'))

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(1000)

    expect(store.token).toBe(originalToken)

    wrapper.unmount()
  })

  it('ticks repeatedly on the given interval', async () => {
    const store = useAuthStore()
    store.setToken(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }))
    const refreshSpy = vi
      .spyOn(authService, 'refreshToken')
      .mockResolvedValue(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 7200 }))

    const wrapper = mountWithRefresh(1000)
    await vi.advanceTimersByTimeAsync(3500)

    expect(refreshSpy).toHaveBeenCalledTimes(3)

    wrapper.unmount()
  })

  it('stops ticking after unmount', async () => {
    const store = useAuthStore()
    store.setToken(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }))
    const refreshSpy = vi
      .spyOn(authService, 'refreshToken')
      .mockResolvedValue(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 7200 }))

    const wrapper = mountWithRefresh(1000)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(5000)

    expect(refreshSpy).not.toHaveBeenCalled()
  })

  describe('when authProvider is cognito', () => {
    it('refreshes via the Cognito refresh token grant and keeps the refresh token', () => {
      const store = useAuthStore()
      store.setToken(
        makeToken({ email: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }),
        'the-refresh-token',
      )
      const newIdToken = makeToken({ email: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 7200 })
      const refreshSpy = vi.spyOn(cognitoAuthService, 'refreshCognitoToken').mockResolvedValue(newIdToken)
      const localRefreshSpy = vi.spyOn(authService, 'refreshToken')

      const wrapper = mountWithRefresh(1000, 'cognito')
      return vi.advanceTimersByTimeAsync(1000).then(() => {
        expect(refreshSpy).toHaveBeenCalledWith('the-refresh-token')
        expect(localRefreshSpy).not.toHaveBeenCalled()
        expect(store.token).toBe(newIdToken)
        expect(store.refreshTokenValue).toBe('the-refresh-token')

        wrapper.unmount()
      })
    })

    it('does not call refresh when there is no stored refresh token', async () => {
      const store = useAuthStore()
      store.setToken(makeToken({ email: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }))
      const refreshSpy = vi.spyOn(cognitoAuthService, 'refreshCognitoToken')

      const wrapper = mountWithRefresh(1000, 'cognito')
      await vi.advanceTimersByTimeAsync(1000)

      expect(refreshSpy).not.toHaveBeenCalled()

      wrapper.unmount()
    })
  })
})
