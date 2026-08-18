import type { RangeOption } from './transactionFilterStorage'
import { formatDateForApi } from './dateFormat'
import { MONTH_NAMES, monthKey, parseMonthKey } from './dashboardMetrics'
import type { Transaction } from '../services/transactionsService'

export interface DateRangeQuery {
  startDate: string | undefined
  endDate: string
}

// The Australian financial year (1 Jul - 30 Jun) most recently completed as of `today` - a fixed,
// calendar-bound range, not a rolling window. E.g. on 5 Aug 2026 (inside FY Jul 2026 - Jun 2027),
// that's 1 Jul 2025 - 30 Jun 2026.
function lastFinancialYearRange(today: Date): { start: Date; end: Date } {
  const currentFinancialYearStart = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1
  return {
    start: new Date(currentFinancialYearStart - 1, 6, 1),
    end: new Date(currentFinancialYearStart, 5, 30),
  }
}

function calendarMonthRange(key: string): { start: Date; end: Date } {
  const start = parseMonthKey(key)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return { start, end }
}

// Dates are ISO "YYYY-MM-DD" strings, so a plain string comparison sorts/bounds chronologically -
// same trick computeRecentTransactions (dashboardMetrics.ts) relies on.
export function filterByDateRange(transactions: Transaction[], option: RangeOption, today: Date): Transaction[] {
  const { startDate, endDate } = computeRange(option, today)
  return transactions.filter((t) => (!startDate || t.date >= startDate) && t.date <= endDate)
}

export function computeRange(option: RangeOption, today: Date): DateRangeQuery {
  if (option === 'allTime') {
    // No startDate - the Api resolves this to the user's real earliest transaction date.
    return { startDate: undefined, endDate: formatDateForApi(today) }
  }

  if (option === 'financialYear') {
    const { start, end } = lastFinancialYearRange(today)
    return { startDate: formatDateForApi(start), endDate: formatDateForApi(end) }
  }

  if (option.startsWith('month:')) {
    const { start, end } = calendarMonthRange(option.slice('month:'.length))
    return { startDate: formatDateForApi(start), endDate: formatDateForApi(end) }
  }

  const start = new Date(today)
  switch (option) {
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'threeMonths':
      start.setMonth(start.getMonth() - 3)
      break
    case 'year':
      start.setMonth(start.getMonth() - 12)
      break
  }

  return { startDate: formatDateForApi(start), endDate: formatDateForApi(today) }
}

export interface MonthRangeOption {
  value: `month:${string}`
  label: string
}

// The current calendar month plus the 6 full calendar months before it, newest first (UBE-95) -
// the past-six-months portion mirrors the dashboard's getPreviousSixMonthsRange convention.
export function recentMonthOptions(today: Date): MonthRangeOption[] {
  const options: MonthRangeOption[] = []

  let year = today.getFullYear()
  let month = today.getMonth()

  options.push({ value: `month:${monthKey(year, month)}`, label: `${MONTH_NAMES[month]} ${year}` })

  for (let i = 0; i < 6; i++) {
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
    options.push({ value: `month:${monthKey(year, month)}`, label: `${MONTH_NAMES[month]} ${year}` })
  }

  return options
}
