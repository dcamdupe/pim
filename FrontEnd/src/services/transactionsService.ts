import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export class TransactionsUploadFailedError extends Error {
  constructor() {
    super('Transactions upload failed')
  }
}

export async function uploadTransactions(account: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('account', account)
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/transactions/file`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${useAuthStore().token}` },
    body: formData,
  })

  if (!response.ok) {
    throw new TransactionsUploadFailedError()
  }
}
