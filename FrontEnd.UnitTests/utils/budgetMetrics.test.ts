import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { computeBudgetProjection, computeMonthlyBudgetVsActual } from '../../FrontEnd/src/utils/budgetMetrics'
import type { Transaction } from '../../FrontEnd/src/services/transactionsService'

const budgets = [
  { category: 'Groceries', amount: 600 },
  { category: 'Dining', amount: 200 },
]

function tx(date: string, category: string, amount: number, ignore: boolean | null = null): Transaction {
  return { account: 'Everyday', date, description: 'Test', category, amount, ignore, type: 'Expense' }
}

describe('computeBudgetProjection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('projects spend so far to the end of the current month', () => {
    // 10 of 30 days in November -> x3.
    const result = computeBudgetProjection(
      [tx('2026-11-02', 'Groceries', -150), tx('2026-11-09', 'Dining', -80)],
      budgets,
      new Date(2026, 10, 1),
      new Date(2026, 10, 10),
    )

    expect(result.isProjected).toBe(true)
    expect(result.daysElapsed).toBe(10)
    expect(result.daysInMonth).toBe(30)
    expect(result.rows.map((r) => [r.category, r.actual, r.projected, r.overBudget])).toEqual([
      ['Groceries', 150, 450, false],
      ['Dining', 80, 240, true],
    ])
    expect(result.totalBudget).toBe(800)
    expect(result.totalActual).toBe(230)
    expect(result.totalProjected).toBe(690)
  })

  it('uses the final actual, not a projection, for a past month', () => {
    const result = computeBudgetProjection([tx('2026-10-05', 'Groceries', -700)], budgets, new Date(2026, 9, 1), new Date(2026, 10, 10))

    expect(result.isProjected).toBe(false)
    expect(result.rows[0]).toMatchObject({ category: 'Groceries', actual: 700, projected: 700, overBudget: true })
  })

  it('nets refunds, skips ignored, unbudgeted and out-of-month transactions', () => {
    const result = computeBudgetProjection(
      [
        tx('2026-10-05', 'Groceries', -300),
        tx('2026-10-06', 'Groceries', 50),
        tx('2026-10-07', 'Groceries', -999, true),
        tx('2026-10-08', 'Shopping', -999),
        tx('2026-09-30', 'Groceries', -999),
        tx('2026-11-01', 'Groceries', -999),
      ],
      budgets,
      new Date(2026, 9, 1),
      new Date(2026, 10, 10),
    )

    expect(result.rows.find((r) => r.category === 'Groceries')!.actual).toBe(250)
    expect(result.rows.find((r) => r.category === 'Dining')!.actual).toBe(0)
  })

  it('never shows negative spend for a category with net refunds', () => {
    const result = computeBudgetProjection([tx('2026-10-05', 'Dining', 40)], budgets, new Date(2026, 9, 1), new Date(2026, 10, 10))

    expect(result.rows.find((r) => r.category === 'Dining')!.actual).toBe(0)
  })

  it('returns no rows with no budgets', () => {
    const result = computeBudgetProjection([tx('2026-11-02', 'Groceries', -150)], [], new Date(2026, 10, 1), new Date(2026, 10, 10))

    expect(result.rows).toEqual([])
    expect(result.totalBudget).toBe(0)
  })
})

describe('computeMonthlyBudgetVsActual', () => {
  const transactions = [
    tx('2026-06-10', 'Groceries', -500),
    tx('2026-06-12', 'Dining', -100),
    tx('2026-06-15', 'Shopping', -999),
    tx('2026-11-03', 'Groceries', -50),
    tx('2026-05-31', 'Groceries', -999),
  ]

  it('covers the 6 months ending with the selected month', () => {
    const result = computeMonthlyBudgetVsActual(transactions, budgets, new Date(2026, 10, 1))

    expect(result.map((m) => `${m.month} ${m.year}`)).toEqual([
      'Jun 2026',
      'Jul 2026',
      'Aug 2026',
      'Sep 2026',
      'Oct 2026',
      'Nov 2026',
    ])
  })

  it('sums every budgeted category for "all", ignoring unbudgeted spend', () => {
    const result = computeMonthlyBudgetVsActual(transactions, budgets, new Date(2026, 10, 1))

    expect(result[0]).toMatchObject({ budget: 800, actual: 600 })
    expect(result[1]).toMatchObject({ budget: 800, actual: 0 })
    expect(result[5]).toMatchObject({ budget: 800, actual: 50 })
  })

  it('filters to a single category', () => {
    const result = computeMonthlyBudgetVsActual(transactions, budgets, new Date(2026, 10, 1), 'Dining')

    expect(result[0]).toMatchObject({ budget: 200, actual: 100 })
    expect(result[5]).toMatchObject({ budget: 200, actual: 0 })
  })

  it('crosses a year boundary', () => {
    const result = computeMonthlyBudgetVsActual([], budgets, new Date(2027, 1, 1))

    expect(result.map((m) => `${m.month} ${m.year}`)).toEqual([
      'Sep 2026',
      'Oct 2026',
      'Nov 2026',
      'Dec 2026',
      'Jan 2027',
      'Feb 2027',
    ])
  })
})
