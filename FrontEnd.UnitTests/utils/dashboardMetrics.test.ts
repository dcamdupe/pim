import { describe, it, expect } from 'vitest'
import {
  getCurrentMonthRange,
  getPreviousSixMonthsRange,
  computeDashboardTiles,
  computeExpensesByCategory,
  computeMonthlyIncomeExpenses,
  formatMonthYear,
  formatSixMonthRangeLabel,
  computeAvailableMonths,
  parseMonthKey,
} from '../../FrontEnd/src/utils/dashboardMetrics'
import type { Transaction } from '../../FrontEnd/src/services/transactionsService'

const today = new Date(2026, 6, 3) // 3 Jul 2026, the ticket's own worked example

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    account: 'Everyday',
    date: '2026-07-01',
    description: 'Test',
    category: '',
    amount: -1,
    inactive: null,
    ...overrides,
  }
}

describe('getCurrentMonthRange', () => {
  it('returns the full current calendar month', () => {
    const range = getCurrentMonthRange(today)

    expect(range.start).toEqual(new Date(2026, 6, 1))
    expect(range.end).toEqual(new Date(2026, 6, 31))
  })
})

describe('getPreviousSixMonthsRange', () => {
  it('returns the 6 full calendar months before the current month, per the ticket example', () => {
    const range = getPreviousSixMonthsRange(today)

    expect(range.start).toEqual(new Date(2026, 0, 1)) // 1 Jan 2026
    expect(range.end).toEqual(new Date(2026, 5, 30)) // 30 Jun 2026
  })

  it('crosses a year boundary correctly', () => {
    const range = getPreviousSixMonthsRange(new Date(2026, 1, 15)) // 15 Feb 2026

    expect(range.start).toEqual(new Date(2025, 7, 1)) // 1 Aug 2025
    expect(range.end).toEqual(new Date(2026, 0, 31)) // 31 Jan 2026
  })
})

describe('computeDashboardTiles', () => {
  it('sums Income-category transactions as income, everything else as expenses', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Groceries', amount: -200 }),
      tx({ date: '2026-07-07', category: '', amount: -50 }), // uncategorized counts as an expense
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(250)
    expect(tiles.currentMonthProfit).toBe(3000 - 250)
  })

  it('excludes transactions where inactive is true, includes false and null', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', amount: 1000, inactive: null }),
      tx({ date: '2026-07-06', category: 'Income', amount: 500, inactive: false }),
      tx({ date: '2026-07-07', category: 'Income', amount: 9999, inactive: true }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfit).toBe(1500)
  })

  it('buckets transactions into current-month vs previous-6-months by date, excluding anything outside both', () => {
    const transactions = [
      tx({ date: '2026-07-15', category: 'Income', amount: 100 }), // current month
      tx({ date: '2026-06-15', category: 'Income', amount: 200 }), // previous 6 months
      tx({ date: '2026-01-01', category: 'Income', amount: 300 }), // previous 6 months (start boundary)
      tx({ date: '2025-12-31', category: 'Income', amount: 9999 }), // outside both ranges
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfit).toBe(100)
    expect(tiles.previousSixMonthsProfit).toBe(500)
  })

  it('computes the delta percentage against the average of the previous 6 months, not the total', () => {
    const transactions = [
      tx({ date: '2026-07-01', category: 'Income', amount: 1200 }), // current month profit = 1200
      // previous 6 months total profit = 3600 -> average = 600 -> (1200-600)/600 = 100%
      tx({ date: '2026-01-01', category: 'Income', amount: 3600 }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfitDeltaPct).toBe(100)
  })

  it('returns a null delta when the previous-6-months average is zero', () => {
    const transactions = [tx({ date: '2026-07-01', category: 'Income', amount: 500 })]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfitDeltaPct).toBeNull()
    expect(tiles.currentMonthExpensesDeltaPct).toBeNull()
  })

  it('nets a refund against expenses in the same month rather than double-counting it', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Shopping', amount: -100 }),
      tx({ date: '2026-07-06', category: 'Shopping', amount: 20 }), // partial refund
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(80)
  })

  it('excludes Internal Transfer transactions from expenses', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', amount: -200 }),
      tx({ date: '2026-07-06', category: 'Internal Transfer', amount: -500 }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(200)
  })

  it('excludes Internal Transfer transactions from profit, on both the income and expense side', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Groceries', amount: -200 }),
      tx({ date: '2026-07-07', category: 'Internal Transfer', amount: -500 }),
      tx({ date: '2026-07-08', category: 'Internal Transfer', amount: 500 }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfit).toBe(3000 - 200)
  })
})

describe('computeExpensesByCategory', () => {
  it('sums expenses per category, sorted highest-spend first', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', amount: -100 }),
      tx({ date: '2026-07-06', category: 'Groceries', amount: -50 }),
      tx({ date: '2026-07-07', category: 'Dining', amount: -300 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result.map(({ category, amount, color }) => ({ category, amount, color }))).toEqual([
      { category: 'Dining', amount: 300, color: expect.any(String) },
      { category: 'Groceries', amount: 150, color: expect.any(String) },
    ])
    expect(result[0].pct).toBeCloseTo(200 / 3)
    expect(result[1].pct).toBeCloseTo(100 / 3)
  })

  it('excludes Income and Internal Transfer categories', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Internal Transfer', amount: -500 }),
      tx({ date: '2026-07-07', category: 'Groceries', amount: -200 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Groceries', amount: 200, pct: 100, color: expect.any(String) }])
  })

  it('excludes transactions where inactive is true, includes false and null', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', amount: -200, inactive: null }),
      tx({ date: '2026-07-06', category: 'Groceries', amount: -100, inactive: false }),
      tx({ date: '2026-07-07', category: 'Groceries', amount: -9999, inactive: true }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Groceries', amount: 300, pct: 100, color: expect.any(String) }])
  })

  it('excludes transactions outside the current month', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', amount: -200 }),
      tx({ date: '2026-06-05', category: 'Groceries', amount: -9999 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Groceries', amount: 200, pct: 100, color: expect.any(String) }])
  })

  it('nets a refund against a category rather than double-counting it', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Shopping', amount: -100 }),
      tx({ date: '2026-07-06', category: 'Shopping', amount: 20 }), // partial refund
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Shopping', amount: 80, pct: 100, color: expect.any(String) }])
  })

  it('returns an empty array when there are no expenses this month', () => {
    const result = computeExpensesByCategory([], today)

    expect(result).toEqual([])
  })

  it('excludes a category that nets a refund/credit for the month, without dragging other percentages negative', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Housing', amount: -400 }),
      // A big refund exceeding this month's Uncategorized spend - nets to a credit, not an expense.
      tx({ date: '2026-07-06', category: '', amount: -100 }),
      tx({ date: '2026-07-07', category: '', amount: 900 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Housing', amount: 400, pct: 100, color: expect.any(String) }])
  })

  it('looks up the display color from CATEGORY_COLORS', () => {
    const transactions = [tx({ date: '2026-07-05', category: 'Groceries', amount: -100 })]

    const result = computeExpensesByCategory(transactions, today)

    expect(result[0].color).toBe('#eb6834')
  })
})

describe('computeMonthlyIncomeExpenses', () => {
  it('returns 6 months ending with the current month, in order', () => {
    const result = computeMonthlyIncomeExpenses([], today)

    expect(result.map((m) => `${m.month} ${m.year}`)).toEqual([
      'Feb 2026',
      'Mar 2026',
      'Apr 2026',
      'May 2026',
      'Jun 2026',
      'Jul 2026',
    ])
  })

  it('crosses a year boundary correctly', () => {
    const result = computeMonthlyIncomeExpenses([], new Date(2026, 1, 15)) // 15 Feb 2026

    expect(result.map((m) => `${m.month} ${m.year}`)).toEqual([
      'Sep 2025',
      'Oct 2025',
      'Nov 2025',
      'Dec 2025',
      'Jan 2026',
      'Feb 2026',
    ])
  })

  it('sums income and expenses into the matching month bucket', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Groceries', amount: -200 }),
      tx({ date: '2026-06-10', category: 'Income', amount: 1000 }),
      tx({ date: '2026-06-11', category: 'Dining', amount: -300 }),
    ]

    const result = computeMonthlyIncomeExpenses(transactions, today)

    expect(result.find((m) => m.month === 'Jul')).toMatchObject({ income: 3000, expense: 200 })
    expect(result.find((m) => m.month === 'Jun')).toMatchObject({ income: 1000, expense: 300 })
  })

  it('excludes Internal Transfer and inactive transactions', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Internal Transfer', amount: -500 }),
      tx({ date: '2026-07-07', category: 'Groceries', amount: -200, inactive: true }),
    ]

    const result = computeMonthlyIncomeExpenses(transactions, today)

    expect(result.find((m) => m.month === 'Jul')).toMatchObject({ income: 3000, expense: 0 })
  })

  it('excludes transactions outside the 6-month window', () => {
    const transactions = [tx({ date: '2026-01-15', category: 'Income', amount: 9999 })]

    const result = computeMonthlyIncomeExpenses(transactions, today)

    expect(result.reduce((sum, m) => sum + m.income, 0)).toBe(0)
  })

  it('returns zero for months with no matching transactions', () => {
    const result = computeMonthlyIncomeExpenses([], today)

    expect(result).toEqual(
      result.map((m) => ({ ...m, income: 0, expense: 0 })),
    )
  })
})

describe('formatMonthYear', () => {
  it('formats as "<full month name> <year>"', () => {
    expect(formatMonthYear(new Date(2026, 7, 1))).toBe('August 2026')
    expect(formatMonthYear(new Date(2026, 8, 15))).toBe('September 2026')
  })
})

describe('formatSixMonthRangeLabel', () => {
  it('formats the previous-6-months range, per the ticket example', () => {
    // Selected month August 2026 -> previous 6 months = February 2026 - July 2026.
    expect(formatSixMonthRangeLabel(new Date(2026, 7, 1))).toBe('February 2026 - July 2026')
  })

  it('crosses a year boundary correctly', () => {
    expect(formatSixMonthRangeLabel(new Date(2026, 1, 15))).toBe('August 2025 - January 2026')
  })
})

describe('computeAvailableMonths', () => {
  it('lists every month from minTransactionDate through today, newest first', () => {
    const result = computeAvailableMonths(new Date(2026, 4, 10), new Date(2026, 6, 3))

    expect(result).toEqual([
      { value: '2026-07', label: 'July 2026' },
      { value: '2026-06', label: 'June 2026' },
      { value: '2026-05', label: 'May 2026' },
    ])
  })

  it('crosses a year boundary correctly', () => {
    const result = computeAvailableMonths(new Date(2025, 10, 1), new Date(2026, 0, 15))

    expect(result.map((m) => m.value)).toEqual(['2026-01', '2025-12', '2025-11'])
  })

  it('falls back to just the current month when there is no transaction history', () => {
    const result = computeAvailableMonths(null, new Date(2026, 6, 3))

    expect(result).toEqual([{ value: '2026-07', label: 'July 2026' }])
  })

  it('returns a single month when minTransactionDate is in the current month', () => {
    const result = computeAvailableMonths(new Date(2026, 6, 20), new Date(2026, 6, 3))

    expect(result).toEqual([{ value: '2026-07', label: 'July 2026' }])
  })
})

describe('parseMonthKey', () => {
  it('parses a "YYYY-MM" key back to the 1st of that month', () => {
    expect(parseMonthKey('2026-08')).toEqual(new Date(2026, 7, 1))
  })
})
