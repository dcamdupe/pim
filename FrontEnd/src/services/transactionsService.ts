import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export interface Transaction {
  account: string
  date: string
  description: string
  category: string
  amount: number
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

export async function getTransactions(startDate: string, endDate: string): Promise<Transaction[]> {
  const params = new URLSearchParams({ startDate, endDate })
  const response = await fetch(`${API_BASE_URL}/transactions?${params}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new TransactionsRequestFailedError()
  }

  const data = (await response.json()) as { transactions: Transaction[] }
  return data.transactions
}
