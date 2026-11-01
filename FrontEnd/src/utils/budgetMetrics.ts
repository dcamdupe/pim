import type { Budget } from '../services/budgetsService'
import type { Transaction } from '../services/transactionsService'
import { categoryColor } from '../services/categoriesService'
import { MONTH_ABBREVIATIONS } from './dashboardMetrics'

// Budget vs actual metrics for the dashboard's budget cards (UBE-124). Actual spend uses the same
// rules as the budget recommendations (UBE-123): net spend per category, ignored transactions skipped.

export interface BudgetProjectionRow {
  category: string
  color: string | undefined
  budget: number
  actual: number
  projected: number
  overBudget: boolean
}

export interface BudgetProjection {
  // False for a past month - `projected` then equals the final actual.
  isProjected: boolean
  daysElapsed: number
  daysInMonth: number
  rows: BudgetProjectionRow[]
  totalBudget: number
  totalActual: number
  totalProjected: number
}

export interface MonthlyBudgetVsActual {
  month: string
  year: number
  budget: number
  actual: number
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month + 1, 0).getDate()
  return { start: `${year}-${pad(month + 1)}-01`, end: `${year}-${pad(month + 1)}-${pad(lastDay)}` }
}

// Net spend per category in [start, end] (ISO dates); refunds reduce it, never below 0.
function spendByCategory(transactions: Transaction[], categories: Set<string>, start: string, end: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const t of transactions) {
    if (t.ignore || !categories.has(t.category) || t.date < start || t.date > end) {
      continue
    }
    totals.set(t.category, (totals.get(t.category) ?? 0) - t.amount)
  }
  for (const [category, amount] of totals) {
    totals.set(category, Math.max(0, amount))
  }
  return totals
}

// Budget vs actual for the selected month. For the current month, actual spend so far is projected
// linearly to the month end (actual / days elapsed * days in month); past months use the final actual.
export function computeBudgetProjection(
  transactions: Transaction[],
  budgets: Budget[],
  selectedMonth: Date,
  today: Date,
): BudgetProjection {
  const year = selectedMonth.getFullYear()
  const month = selectedMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isProjected = year === today.getFullYear() && month === today.getMonth()
  const daysElapsed = isProjected ? today.getDate() : daysInMonth

  const { start, end } = monthRange(year, month)
  const spend = spendByCategory(transactions, new Set(budgets.map((b) => b.category)), start, end)

  const rows = budgets
    .map((b) => {
      const actual = spend.get(b.category) ?? 0
      const projected = isProjected ? (actual / daysElapsed) * daysInMonth : actual
      return { category: b.category, color: categoryColor(b.category), budget: b.amount, actual, projected, overBudget: projected > b.amount }
    })
    .sort((a, b) => b.budget - a.budget || a.category.localeCompare(b.category))

  const sum = (pick: (r: BudgetProjectionRow) => number) => rows.reduce((total, r) => total + pick(r), 0)
  return {
    isProjected,
    daysElapsed,
    daysInMonth,
    rows,
    totalBudget: sum((r) => r.budget),
    totalActual: sum((r) => r.actual),
    totalProjected: sum((r) => r.projected),
  }
}

// Budget vs actual for the 6 months ending with the selected month. An empty `category` sums every
// budgeted category; actual only counts spend in budgeted categories. Budgets aren't versioned, so
// today's amounts apply to every month.
export function computeMonthlyBudgetVsActual(
  transactions: Transaction[],
  budgets: Budget[],
  selectedMonth: Date,
  category = '',
): MonthlyBudgetVsActual[] {
  const included = category ? budgets.filter((b) => b.category === category) : budgets
  const categories = new Set(included.map((b) => b.category))
  const budget = included.reduce((total, b) => total + b.amount, 0)

  const months: MonthlyBudgetVsActual[] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - i, 1)
    const { start, end } = monthRange(monthStart.getFullYear(), monthStart.getMonth())
    const spend = spendByCategory(transactions, categories, start, end)
    months.push({
      month: MONTH_ABBREVIATIONS[monthStart.getMonth()],
      year: monthStart.getFullYear(),
      budget,
      actual: [...spend.values()].reduce((total, amount) => total + amount, 0),
    })
  }
  return months
}
