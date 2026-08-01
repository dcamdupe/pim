import type { Transaction } from '../services/transactionsService'
import { categoryColor } from '../constants/categories'

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

export interface CategoryExpense {
  category: string
  amount: number
  pct: number
  color: string | undefined
}

export interface MonthlyFlow {
  month: string
  year: number
  income: number
  expense: number
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
  return total === 0 ? 0 : -total
}

// Per-category expense breakdown for the current month, excluding Income and Internal Transfer
// (not expense categories) and inactive transactions, sorted highest-spend first.
export function computeExpensesByCategory(transactions: Transaction[], today: Date): CategoryExpense[] {
  const currentMonthTransactions = transactions.filter((t) => isWithinRange(t, getCurrentMonthRange(today)))
  const totals = new Map<string, number>()

  for (const t of currentMonthTransactions) {
    if (!isCounted(t) || t.category === 'Income' || t.category === 'Internal Transfer') {
      continue
    }
    totals.set(t.category, (totals.get(t.category) ?? 0) - t.amount)
  }

  // A category that nets a refund/credit for the month (inflow exceeds outflow) has no real net
  // spend to show as a slice - excluding it (rather than letting it drag the total negative) keeps
  // every other category's percentage positive and summing to 100%, and the doughnut's arc math
  // (sweep = pct * 3.6) sane.
  const positiveTotals = [...totals.entries()].filter(([, amount]) => amount > 0)
  const total = positiveTotals.reduce((sum, [, amount]) => sum + amount, 0)

  return positiveTotals
    .map(([category, amount]) => ({
      category,
      amount,
      pct: total === 0 ? 0 : (amount / total) * 100,
      color: categoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount)
}

// Fixed English abbreviations rather than toLocaleDateString(undefined, { month: 'short' }) -
// that depends on the runtime's ICU data, which varies by environment (e.g. "Sep" vs "Sept" for
// September between local dev and CI) and would make the chart's month labels non-deterministic.
const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

// The 6 calendar months ending with the current month (unlike getPreviousSixMonthsRange, which
// excludes the current month) - matches the "last 6 months" income vs. expenses bar chart.
export function computeMonthlyIncomeExpenses(transactions: Transaction[], today: Date): MonthlyFlow[] {
  const months: MonthlyFlow[] = []

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const monthTransactions = transactions.filter((t) => isWithinRange(t, { start: monthStart, end: monthEnd }))

    months.push({
      month: MONTH_ABBREVIATIONS[monthStart.getMonth()],
      year: monthStart.getFullYear(),
      income: sumIncome(monthTransactions),
      expense: sumExpenses(monthTransactions),
    })
  }

  return months
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
