import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const STORAGE_KEY = 'pim.transactionDescriptions'

export interface TransactionDescriptionStat {
  description: string
  transactionCount: number
  unclassifiedCount: number
}

export class TransactionDescriptionsRequestFailedError extends Error {
  constructor() {
    super('Transaction descriptions request failed')
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${useAuthStore().token}` }
}

function isTransactionDescriptionStat(value: unknown): value is TransactionDescriptionStat {
  return typeof value === 'object' && value !== null && typeof (value as TransactionDescriptionStat).description === 'string'
}

// Cached synchronously so the category-matching UI (TransactionsView) can read it without an
// awaited round trip - refreshTransactionDescriptions() is what keeps it up to date.
export function getCachedTransactionDescriptions(): TransactionDescriptionStat[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    // A cache written before stats were tracked holds a plain string[] - treat that shape (and
    // anything else unexpected) as empty rather than throwing.
    return Array.isArray(parsed) && parsed.every(isTransactionDescriptionStat) ? parsed : []
  } catch {
    return []
  }
}

export async function refreshTransactionDescriptions(): Promise<TransactionDescriptionStat[]> {
  const response = await fetch(`${API_BASE_URL}/transactions/descriptions`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionDescriptionsRequestFailedError()
  }

  const data = (await response.json()) as { descriptions: TransactionDescriptionStat[] }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data.descriptions))
  return data.descriptions
}
