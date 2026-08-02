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

export interface Settings {
  accounts: Account[]
  minTransactionDate: string | null
}

export async function getSettings(): Promise<Settings> {
  const response = await fetch(`${API_BASE_URL}/settings`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }

  return (await response.json()) as Settings
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

// Deletes immediately (not deferred to the next PUT /settings) - the Api cascades this to delete
// every transaction linked to the account too.
export async function deleteAccount(account: Account): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(account),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }
}
