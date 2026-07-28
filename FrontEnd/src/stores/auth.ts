import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'pim.auth'

interface StoredAuth {
  token: string
  expiresAt: number
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

  const isAuthenticated = computed(
    () => token.value !== null && expiresAt.value !== null && expiresAt.value > Date.now(),
  )

  function setToken(value: string) {
    const expiry = decodeExpiry(value)
    token.value = value
    expiresAt.value = expiry
    if (expiry !== null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: value, expiresAt: expiry } satisfies StoredAuth))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function clearToken() {
    token.value = null
    expiresAt.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { token, expiresAt, isAuthenticated, setToken, clearToken }
})
