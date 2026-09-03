import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export type AccountType = 'Credit' | 'Transaction' | 'Savings'

export interface Account {
  name: string
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

export type CategoryType = 'Income' | 'Expense' | 'Ignore'

export interface CategoryDefinition {
  name: string
  colour: string
  type: CategoryType
}

export interface Settings {
  accounts: Account[]
  categories: CategoryDefinition[]
  minTransactionDate: string | null
  apiKey: string | null
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

// Generates (or, if one already exists, invalidates and regenerates) the caller's API key and
// returns the new value. The old key stops working immediately.
export async function generateApiKey(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/settings/api`, {
    method: 'POST',
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }

  return ((await response.json()) as { apiKey: string }).apiKey
}

// Deletes immediately (not deferred to the next PUT /settings) - the Api cascades this to delete
// every transaction linked to the account too. Name is the account's key, so that's all it needs.
export async function deleteAccount(name: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }
}

export async function addCategory(category: CategoryDefinition): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(category),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }
}

// Deletes immediately (not deferred to the next PUT /settings) - the Api cascades this to clear the
// category from every transaction that had it.
export async function deleteCategory(category: CategoryDefinition): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/settings/category`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(category),
  })

  if (!response.ok) {
    throw new SettingsRequestFailedError()
  }
}
