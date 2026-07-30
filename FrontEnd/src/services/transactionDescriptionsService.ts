import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const STORAGE_KEY = 'pim.transactionDescriptions'

export class TransactionDescriptionsRequestFailedError extends Error {
  constructor() {
    super('Transaction descriptions request failed')
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${useAuthStore().token}` }
}

// Cached synchronously so the category-matching UI (TransactionsView) can read it without an
// awaited round trip - refreshTransactionDescriptions() is what keeps it up to date.
export function getCachedTransactionDescriptions(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function refreshTransactionDescriptions(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/transactions/descriptions`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionDescriptionsRequestFailedError()
  }

  const data = (await response.json()) as { descriptions: string[] }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data.descriptions))
  return data.descriptions
}
