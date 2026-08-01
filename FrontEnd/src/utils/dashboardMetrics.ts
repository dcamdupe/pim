import type { Transaction } from '../services/transactionsService'

export interface DateRange {
  start: Date
  end: Date
}

export interface DashboardTiles {
  currentMonthProfit: number
  currentMonthProfitDeltaPct: number | null
  previousSixMonthsProfit: number
  currentMonthExpenses: number
  currentMonthExpensesDeltaPct: number | null
  previousSixMonthsExpenses: number
}

export function getCurrentMonthRange(today: Date): DateRange {
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return { start, end }
}

// The 6 full calendar months before the current month - e.g. on 3 Jul 2026, 1 Jan-30 Jun 2026.
export function getPreviousSixMonthsRange(today: Date): DateRange {
  const end = new Date(today.getFullYear(), today.getMonth(), 0)
  const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
  return { start, end }
}

function isCounted(transaction: Transaction): boolean {
  return !transaction.inactive
}

function isWithinRange(transaction: Transaction, range: DateRange): boolean {
  const date = new Date(`${transaction.date}T00:00:00`)
  return date >= range.start && date <= range.end
}

function sumIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => isCounted(t) && t.category === 'Income')
    .reduce((sum, t) => sum + t.amount, 0)
}

// Expense-category transactions are naturally negative amounts (money out); negating the sum
// gives a positive dollar figure to display, and keeps Profit = Income - Expenses correct when
// both are displayed as positive magnitudes.
function sumExpenses(transactions: Transaction[]): number {
  const total = transactions
    .filter((t) => isCounted(t) && t.category !== 'Income' && t.category !== 'Internal Transfer')
    .reduce((sum, t) => sum + t.amount, 0)
  return -total
}

function computeProfit(transactions: Transaction[]): number {
  return sumIncome(transactions) - sumExpenses(transactions)
}

// Compares `current` to the average of `baselineTotal` over `months` - null when that average is
// zero (e.g. no historical data yet), since a percentage change against a zero baseline is
// undefined.
function percentChangeVsAverage(current: number, baselineTotal: number, months: number): number | null {
  const baselineAverage = baselineTotal / months
  if (baselineAverage === 0) {
    return null
  }
  return ((current - baselineAverage) / Math.abs(baselineAverage)) * 100
}

export function computeDashboardTiles(transactions: Transaction[], today: Date): DashboardTiles {
  const currentMonthTransactions = transactions.filter((t) => isWithinRange(t, getCurrentMonthRange(today)))
  const previousSixMonthsTransactions = transactions.filter((t) => isWithinRange(t, getPreviousSixMonthsRange(today)))

  const currentMonthProfit = computeProfit(currentMonthTransactions)
  const previousSixMonthsProfit = computeProfit(previousSixMonthsTransactions)
  const currentMonthExpenses = sumExpenses(currentMonthTransactions)
  const previousSixMonthsExpenses = sumExpenses(previousSixMonthsTransactions)

  return {
    currentMonthProfit,
    currentMonthProfitDeltaPct: percentChangeVsAverage(currentMonthProfit, previousSixMonthsProfit, 6),
    previousSixMonthsProfit,
    currentMonthExpenses,
    currentMonthExpensesDeltaPct: percentChangeVsAverage(currentMonthExpenses, previousSixMonthsExpenses, 6),
    previousSixMonthsExpenses,
  }
}
