import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface Transaction {
  account: string
  date: string
  description: string
  category: string
  amount: number
  ignore: boolean | null
  type: 'Income' | 'Expense' | 'Ignore' | null
}

export class TransactionsUploadFailedError extends Error {
  constructor() {
    super('Transactions upload failed')
  }
}

export class TransactionsRequestFailedError extends Error {
  constructor() {
    super('Transactions request failed')
  }
}

export class TransactionsUpdateFailedError extends Error {
  constructor() {
    super('Transactions update failed')
  }
}

export class DescriptionMappingRequestFailedError extends Error {
  constructor() {
    super('Description mapping request failed')
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${useAuthStore().token}` }
}

export async function uploadTransactions(account: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('account', account)
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/transactions/file`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  })

  if (!response.ok) {
    throw new TransactionsUploadFailedError()
  }
}

export async function getTransactions(startDate: string | undefined, endDate: string): Promise<Transaction[]> {
  const params = new URLSearchParams()
  if (startDate) {
    params.set('startDate', startDate)
  }
  params.set('endDate', endDate)

  const response = await fetch(`${API_BASE_URL}/transactions?${params}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionsRequestFailedError()
  }

  const data = (await response.json()) as { transactions: Transaction[] }
  return data.transactions
}

// Returns the server's updated transactions (not void) - PUT /transactions can stamp Type/Ignore
// server-side from the category definition whenever Category changes, so the response, not the
// request body, is the authoritative result (see stores/transactions.ts's updateTransaction).
export async function updateTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE_URL}/transactions`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(transactions),
  })

  if (!response.ok) {
    throw new TransactionsUpdateFailedError()
  }

  const data = (await response.json()) as { transactions: Transaction[] }
  return data.transactions
}

export async function saveDescriptionMapping(descriptionStart: string, category: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/mapping/description`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptionStart, category }),
  })

  if (!response.ok) {
    throw new DescriptionMappingRequestFailedError()
  }
}
