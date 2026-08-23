import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'pim.auth'

interface StoredAuth {
  token: string
  expiresAt: number
  // Only present for Cognito sessions (see cognitoAuthService.ts) - the local email/password flow
  // has no refresh token of its own, /login/refresh just re-signs against the current bearer token.
  refreshToken?: string
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

function decodeExpiry(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) {
    return null
  }
  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as { exp?: number }
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null
  } catch {
    return null
  }
}

function loadStored(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const stored = loadStored()
  const token = ref<string | null>(stored?.token ?? null)
  const expiresAt = ref<number | null>(stored?.expiresAt ?? null)
  const refreshTokenValue = ref<string | null>(stored?.refreshToken ?? null)

  const isAuthenticated = computed(
    () => token.value !== null && expiresAt.value !== null && expiresAt.value > Date.now(),
  )

  function setToken(value: string, refreshToken?: string) {
    const expiry = decodeExpiry(value)
    token.value = value
    expiresAt.value = expiry
    // A Cognito refresh only re-issues the ID token, not a new refresh token (see
    // refreshCognitoToken) - falling back to the previously-stored one keeps it around across
    // refreshes instead of dropping it the moment refreshToken isn't passed.
    refreshTokenValue.value = refreshToken ?? refreshTokenValue.value
    if (expiry !== null) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: value,
          expiresAt: expiry,
          refreshToken: refreshTokenValue.value ?? undefined,
        } satisfies StoredAuth),
      )
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function clearToken() {
    token.value = null
    expiresAt.value = null
    refreshTokenValue.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { token, expiresAt, refreshTokenValue, isAuthenticated, setToken, clearToken }
})
