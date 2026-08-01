import { describe, it, expect } from 'vitest'
import {
  getCurrentMonthRange,
  getPreviousSixMonthsRange,
  computeDashboardTiles,
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
})
