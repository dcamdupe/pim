import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../../FrontEnd/src/router'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

function base64UrlEncode(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function validToken(): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
  return `${header}.${payload}.signature`
}

describe('router auth guard', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('redirects to login when navigating to a protected route while unauthenticated', async () => {
    await router.push('/dashboard')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('allows navigation to a protected route once authenticated', async () => {
    useAuthStore().setToken(validToken())

    await router.push('/dashboard')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('always allows navigation to the login route itself', async () => {
    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('login')
  })
})
