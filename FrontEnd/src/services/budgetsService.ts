import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// A recurring monthly budget for one Expense category (UBE-119).
export interface Budget {
  category: string
  amount: number
}

export class BudgetsRequestFailedError extends Error {
  constructor() {
    super('Budgets request failed')
  }
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${useAuthStore().token}` }
}

export async function getBudgets(): Promise<Budget[]> {
  const response = await fetch(`${API_BASE_URL}/budgets`, { headers: authHeaders() })
  if (!response.ok) {
    throw new BudgetsRequestFailedError()
  }
  return (await response.json()) as Budget[]
}

// Replaces every budget - a category left out has no budget.
export async function saveBudgets(budgets: Budget[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/budgets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(budgets),
  })
  if (!response.ok) {
    throw new BudgetsRequestFailedError()
  }
}
