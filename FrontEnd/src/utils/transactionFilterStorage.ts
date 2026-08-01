const STORAGE_KEY = 'pim.transactionFilters'

export type RangeOption = 'week' | 'month' | 'threeMonths' | 'allTime'

const RANGE_OPTIONS: RangeOption[] = ['week', 'month', 'threeMonths', 'allTime']

export interface TransactionFiltersState {
  range: RangeOption
  search: string
  account: string
  category: string
  needsCategoryOnly: boolean
}

function isTransactionFiltersState(value: unknown): value is TransactionFiltersState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const v = value as Record<string, unknown>
  return (
    typeof v.range === 'string' &&
    RANGE_OPTIONS.includes(v.range as RangeOption) &&
    typeof v.search === 'string' &&
    typeof v.account === 'string' &&
    typeof v.category === 'string' &&
    typeof v.needsCategoryOnly === 'boolean'
  )
}

export function loadStoredTransactionFilters(): TransactionFiltersState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    return isTransactionFiltersState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveTransactionFilters(filters: TransactionFiltersState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
}
