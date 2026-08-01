import type { Transaction } from '../services/transactionsService'

export interface TransactionFilters {
  search: string
  account: string
  category: string
  needsCategoryOnly: boolean
}

// account/category are the empty string for "All accounts"/"All categories" (no filtering on
// that dimension) - matches the <select> sentinel option's value being "".
export function filterTransactions(transactions: Transaction[], filters: TransactionFilters): Transaction[] {
  const search = filters.search.trim().toLowerCase()

  return transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search)) {
      return false
    }
    if (filters.account && t.account !== filters.account) {
      return false
    }
    if (filters.category && t.category !== filters.category) {
      return false
    }
    if (filters.needsCategoryOnly && t.category) {
      return false
    }
    return true
  })
}
