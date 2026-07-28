import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

const STORAGE_KEY = 'pim.auth'

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function makeToken(claims: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  return `${header}.${payload}.signature`
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts unauthenticated with no stored token', () => {
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBeNull()
  })

  it('setToken stores the token and its decoded expiry in localStorage', () => {
    const store = useAuthStore()
    const expSeconds = Math.floor(Date.now() / 1000) + 3600
    const token = makeToken({ sub: 'user@example.com', exp: expSeconds })

    store.setToken(token)

    expect(store.isAuthenticated).toBe(true)
    expect(store.expiresAt).toBe(expSeconds * 1000)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(stored).toEqual({ token, expiresAt: expSeconds * 1000 })
  })

  it('is not authenticated once the token has expired', () => {
    const store = useAuthStore()
    const expSeconds = Math.floor(Date.now() / 1000) - 60
    store.setToken(makeToken({ sub: 'user@example.com', exp: expSeconds }))

    expect(store.isAuthenticated).toBe(false)
  })

  it('restores a valid session from localStorage when the store is (re)created', () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 3600
    const token = makeToken({ sub: 'user@example.com', exp: expSeconds })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt: expSeconds * 1000 }))

    // simulate a fresh page load: new pinia, new store instance
    setActivePinia(createPinia())
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(true)
    expect(store.token).toBe(token)
  })

  it('does not restore an expired session from localStorage', () => {
    const expSeconds = Math.floor(Date.now() / 1000) - 60
    const token = makeToken({ sub: 'user@example.com', exp: expSeconds })
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt: expSeconds * 1000 }))

    setActivePinia(createPinia())
    const store = useAuthStore()

    expect(store.isAuthenticated).toBe(false)
  })

  it('clearToken removes the session from state and localStorage', () => {
    const store = useAuthStore()
    store.setToken(makeToken({ sub: 'user@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }))

    store.clearToken()

    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('treats a token without an exp claim as unauthenticated and does not persist it', () => {
    const store = useAuthStore()

    store.setToken(makeToken({ sub: 'user@example.com' }))

    expect(store.isAuthenticated).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
