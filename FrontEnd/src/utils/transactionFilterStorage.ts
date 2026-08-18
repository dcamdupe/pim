import type { AmountSign } from './transactionFilters'

const STORAGE_KEY = 'pim.transactionFilters'

// `month:YYYY-MM` is a dynamic option (one per past-6-months entry, e.g. "month:2026-06") - see
// transactionDateRange.ts's pastSixMonthOptions().
export type RangeOption = 'week' | 'month' | 'threeMonths' | 'year' | 'financialYear' | 'allTime' | `month:${string}`

const FIXED_RANGE_OPTIONS: RangeOption[] = ['week', 'month', 'threeMonths', 'year', 'financialYear', 'allTime']
const MONTH_RANGE_OPTION = /^month:\d{4}-\d{2}$/

function isRangeOption(value: unknown): value is RangeOption {
  return typeof value === 'string' && (FIXED_RANGE_OPTIONS.includes(value as RangeOption) || MONTH_RANGE_OPTION.test(value))
}

const AMOUNT_SIGN_OPTIONS: AmountSign[] = ['', 'positive', 'negative']

function isAmountSign(value: unknown): value is AmountSign {
  return typeof value === 'string' && AMOUNT_SIGN_OPTIONS.includes(value as AmountSign)
}

export interface TransactionFiltersState {
  range: RangeOption
  search: string
  account: string
  category: string
  needsCategoryOnly: boolean
  amountSign: AmountSign
}

function isTransactionFiltersState(value: unknown): value is TransactionFiltersState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const v = value as Record<string, unknown>
  return (
    isRangeOption(v.range) &&
    typeof v.search === 'string' &&
    typeof v.account === 'string' &&
    typeof v.category === 'string' &&
    typeof v.needsCategoryOnly === 'boolean' &&
    isAmountSign(v.amountSign)
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
