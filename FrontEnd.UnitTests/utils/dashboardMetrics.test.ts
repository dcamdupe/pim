import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../FrontEnd/src/stores/settings'
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
  computeRecentTransactions,
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
    ignore: null,
    type: null,
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
  it('sums Income-Type transactions as income, and Expense-Type plus negative-amount uncategorized transactions as expenses', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', type: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Groceries', type: 'Expense', amount: -200 }),
      tx({ date: '2026-07-07', category: '', type: null, amount: -50 }), // uncategorized, negative amount - still money out
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(250)
    expect(tiles.currentMonthProfit).toBe(3000 - 250)
  })

  it('excludes positive-amount uncategorized transactions from both income and expenses', () => {
    const transactions = [tx({ date: '2026-07-05', category: '', type: null, amount: 500 })]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(0)
    expect(tiles.currentMonthProfit).toBe(0)
  })

  it('excludes transactions where ignore is true, includes false and null', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', type: 'Income', amount: 1000, ignore: null }),
      tx({ date: '2026-07-06', category: 'Income', type: 'Income', amount: 500, ignore: false }),
      tx({ date: '2026-07-07', category: 'Income', type: 'Income', amount: 9999, ignore: true }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfit).toBe(1500)
  })

  it('buckets transactions into current-month vs previous-6-months by date, excluding anything outside both', () => {
    const transactions = [
      tx({ date: '2026-07-15', category: 'Income', type: 'Income', amount: 100 }), // current month
      tx({ date: '2026-06-15', category: 'Income', type: 'Income', amount: 200 }), // previous 6 months
      tx({ date: '2026-01-01', category: 'Income', type: 'Income', amount: 300 }), // previous 6 months (start boundary)
      tx({ date: '2025-12-31', category: 'Income', type: 'Income', amount: 9999 }), // outside both ranges
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfit).toBe(100)
    expect(tiles.previousSixMonthsProfitAverage).toBeCloseTo(500 / 6)
  })

  it('computes the delta percentage against the average of the previous 6 months, not the total', () => {
    const transactions = [
      tx({ date: '2026-07-01', category: 'Income', type: 'Income', amount: 1200 }), // current month profit = 1200
      // previous 6 months total profit = 3600 -> average = 600 -> (1200-600)/600 = 100%
      tx({ date: '2026-01-01', category: 'Income', type: 'Income', amount: 3600 }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfitDeltaPct).toBe(100)
  })

  it('returns a null delta when the previous-6-months average is zero', () => {
    const transactions = [tx({ date: '2026-07-01', category: 'Income', type: 'Income', amount: 500 })]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfitDeltaPct).toBeNull()
    expect(tiles.currentMonthExpensesDeltaPct).toBeNull()
  })

  it('nets a refund against expenses in the same month rather than double-counting it', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Shopping', type: 'Expense', amount: -100 }),
      tx({ date: '2026-07-06', category: 'Shopping', type: 'Expense', amount: 20 }), // partial refund
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(80)
  })

  // Internal Transfer's category is stamped Ignore by the Api (UBE-75/UBE-76), so it drops out via
  // the ignore filter rather than any Type/category-name check here.
  it('excludes Internal Transfer transactions from expenses', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', type: 'Expense', amount: -200 }),
      tx({ date: '2026-07-06', category: 'Internal Transfer', type: 'Expense', ignore: true, amount: -500 }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthExpenses).toBe(200)
  })

  it('excludes Internal Transfer transactions from profit, on both the income and expense side', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', type: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Groceries', type: 'Expense', amount: -200 }),
      tx({ date: '2026-07-07', category: 'Internal Transfer', type: 'Expense', ignore: true, amount: -500 }),
      tx({ date: '2026-07-08', category: 'Internal Transfer', type: 'Income', ignore: true, amount: 500 }),
    ]

    const tiles = computeDashboardTiles(transactions, today)

    expect(tiles.currentMonthProfit).toBe(3000 - 200)
  })
})

describe('computeExpensesByCategory', () => {
  beforeEach(() => {
    // categoryColor() (dashboardMetrics.ts -> categoriesService.ts) reads the shared settings store
    // directly (UBE-87), not its own localStorage cache anymore - seed the store's state directly
    // rather than simulating a full load().
    setActivePinia(createPinia())
    useSettingsStore().categories = [
      { name: 'Housing', colour: '#2a78d6', type: 'Expense' },
      { name: 'Groceries', colour: '#eb6834', type: 'Expense' },
      { name: 'Dining', colour: '#eda100', type: 'Expense' },
      { name: 'Shopping', colour: '#e87ba4', type: 'Expense' },
    ]
  })

  it('sums expenses per category, sorted highest-spend first', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', type: 'Expense', amount: -100 }),
      tx({ date: '2026-07-06', category: 'Groceries', type: 'Expense', amount: -50 }),
      tx({ date: '2026-07-07', category: 'Dining', type: 'Expense', amount: -300 }),
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
      tx({ date: '2026-07-05', category: 'Income', type: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Internal Transfer', type: 'Expense', ignore: true, amount: -500 }),
      tx({ date: '2026-07-07', category: 'Groceries', type: 'Expense', amount: -200 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Groceries', amount: 200, pct: 100, color: expect.any(String) }])
  })

  it('excludes transactions where ignore is true, includes false and null', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', type: 'Expense', amount: -200, ignore: null }),
      tx({ date: '2026-07-06', category: 'Groceries', type: 'Expense', amount: -100, ignore: false }),
      tx({ date: '2026-07-07', category: 'Groceries', type: 'Expense', amount: -9999, ignore: true }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Groceries', amount: 300, pct: 100, color: expect.any(String) }])
  })

  it('excludes transactions outside the current month', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Groceries', type: 'Expense', amount: -200 }),
      tx({ date: '2026-06-05', category: 'Groceries', type: 'Expense', amount: -9999 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Groceries', amount: 200, pct: 100, color: expect.any(String) }])
  })

  it('nets a refund against a category rather than double-counting it', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Shopping', type: 'Expense', amount: -100 }),
      tx({ date: '2026-07-06', category: 'Shopping', type: 'Expense', amount: 20 }), // partial refund
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([{ category: 'Shopping', amount: 80, pct: 100, color: expect.any(String) }])
  })

  it('returns an empty array when there are no expenses this month', () => {
    const result = computeExpensesByCategory([], today)

    expect(result).toEqual([])
  })

  it('groups negative-amount uncategorized transactions into an "Uncategorized" (empty-category) bucket, excludes positive-amount ones', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Housing', type: 'Expense', amount: -400 }),
      tx({ date: '2026-07-06', category: '', type: null, amount: -100 }),
      // Positive amount - money in, not an expense even though uncategorized.
      tx({ date: '2026-07-07', category: '', type: null, amount: 900 }),
    ]

    const result = computeExpensesByCategory(transactions, today)

    expect(result).toEqual([
      { category: 'Housing', amount: 400, pct: 80, color: expect.any(String) },
      { category: '', amount: 100, pct: 20, color: undefined },
    ])
  })

  it('looks up the display color from CATEGORY_COLORS', () => {
    const transactions = [tx({ date: '2026-07-05', category: 'Groceries', type: 'Expense', amount: -100 })]

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
      tx({ date: '2026-07-05', category: 'Income', type: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Groceries', type: 'Expense', amount: -200 }),
      tx({ date: '2026-06-10', category: 'Income', type: 'Income', amount: 1000 }),
      tx({ date: '2026-06-11', category: 'Dining', type: 'Expense', amount: -300 }),
    ]

    const result = computeMonthlyIncomeExpenses(transactions, today)

    expect(result.find((m) => m.month === 'Jul')).toMatchObject({ income: 3000, expense: 200 })
    expect(result.find((m) => m.month === 'Jun')).toMatchObject({ income: 1000, expense: 300 })
  })

  it('excludes Internal Transfer and ignored transactions', () => {
    const transactions = [
      tx({ date: '2026-07-05', category: 'Income', type: 'Income', amount: 3000 }),
      tx({ date: '2026-07-06', category: 'Internal Transfer', type: 'Expense', ignore: true, amount: -500 }),
      tx({ date: '2026-07-07', category: 'Groceries', type: 'Expense', amount: -200, ignore: true }),
    ]

    const result = computeMonthlyIncomeExpenses(transactions, today)

    expect(result.find((m) => m.month === 'Jul')).toMatchObject({ income: 3000, expense: 0 })
  })

  it('excludes transactions outside the 6-month window', () => {
    const transactions = [tx({ date: '2026-01-15', category: 'Income', type: 'Income', amount: 9999 })]

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

describe('computeRecentTransactions', () => {
  it('sorts by date descending, most recent first', () => {
    const transactions = [
      tx({ date: '2026-07-01', description: 'Oldest' }),
      tx({ date: '2026-07-15', description: 'Newest' }),
      tx({ date: '2026-07-08', description: 'Middle' }),
    ]

    const result = computeRecentTransactions(transactions)

    expect(result.map((t) => t.description)).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('caps to the given limit', () => {
    const transactions = Array.from({ length: 25 }, (_, i) =>
      tx({ date: `2026-07-${String(i + 1).padStart(2, '0')}`, description: `Tx${i}` }),
    )

    const result = computeRecentTransactions(transactions, 20)

    expect(result).toHaveLength(20)
    expect(result[0].description).toBe('Tx24')
  })

  it('defaults the limit to 20', () => {
    const transactions = Array.from({ length: 25 }, (_, i) =>
      tx({ date: `2026-07-${String(i + 1).padStart(2, '0')}` }),
    )

    const result = computeRecentTransactions(transactions)

    expect(result).toHaveLength(20)
  })

  it('preserves original order for same-day transactions (stable sort)', () => {
    const transactions = [
      tx({ date: '2026-07-01', description: 'First' }),
      tx({ date: '2026-07-01', description: 'Second' }),
      tx({ date: '2026-07-01', description: 'Third' }),
    ]

    const result = computeRecentTransactions(transactions)

    expect(result.map((t) => t.description)).toEqual(['First', 'Second', 'Third'])
  })

  it('returns an empty array for no transactions', () => {
    expect(computeRecentTransactions([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const transactions = [tx({ date: '2026-07-01' }), tx({ date: '2026-07-15' })]
    const original = [...transactions]

    computeRecentTransactions(transactions)

    expect(transactions).toEqual(original)
  })
})
