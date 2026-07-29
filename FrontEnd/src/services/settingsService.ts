import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export type AccountType = 'Credit' | 'Transaction' | 'Savings'

export interface Account {
  name: string
  number: string
  type: AccountType
}

export class SettingsRequestFailedError extends Error {
  constructor() {
    super('Settings request failed')
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${useAuthStore().token}` }
}

export async function getSettings(): Promise<Account[]> {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }

  const data = (await response.json()) as { accounts: Account[] }
  return data.accounts
}

export async function saveSettings(accounts: Account[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ accounts }),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }
}
