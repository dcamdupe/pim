import { describe, it, expect } from 'vitest'
import {
  addMonths,
  analyse,
  computeCategoryInsights,
  computeDrivers,
  defaultInsightMonth,
  formatPct,
  formatSigned,
  groupInsights,
  headline,
  merchantKey,
  sixMonthWindow,
  summarise,
} from '../../FrontEnd/src/utils/spendingInsights'
import type { Transaction } from '../../FrontEnd/src/services/transactionsService'

const OCT = { year: 2026, month: 9 }

function tx(date: string, category: string, amount: number, description = 'Test', overrides: Partial<Transaction> = {}): Transaction {
  return {
    account: 'Everyday',
    date,
    description,
    category,
    amount,
    ignore: null,
    type: category ? 'Expense' : null,
    ...overrides,
  }
}

describe('month helpers', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
  })

  it('builds the six-month window ending with the selected month', () => {
    expect(sixMonthWindow(OCT).map((m) => m.month)).toEqual([4, 5, 6, 7, 8, 9])
  })

  it('defaults to the last full month when it is available', () => {
    expect(defaultInsightMonth(new Date(2026, 10, 1), ['2026-11', '2026-10'])).toBe('2026-10')
    expect(defaultInsightMonth(new Date(2026, 10, 1), ['2026-11'])).toBe('2026-11')
  })
})

describe('analyse', () => {
  it('flags a change over both $50 and 20%', () => {
    const a = analyse('Groceries', 'Groceries', [612, 640, 598, 655, 760, 972])

    expect(a.change).toBe(212)
    expect(a.ratio).toBeCloseTo(212 / 760)
    expect(a.flagged).toBe(true)
    expect(a.tags).toEqual(['Highest in 6 months', 'Rising 3 months'])
  })

  it('does not flag a big percentage change under $50, or a big dollar change under 20%', () => {
    expect(analyse('A', 'A', [0, 0, 0, 0, 10, 40]).flagged).toBe(false)
    expect(analyse('B', 'B', [0, 0, 0, 0, 1000, 1100]).flagged).toBe(false)
  })

  it('tags and flags a category new this month', () => {
    const a = analyse('Travel', 'Travel', [0, 0, 0, 0, 0, 640])

    expect(a.tags).toEqual(['New this month'])
    expect(a.ratio).toBeNull()
    expect(a.flagged).toBe(true)
  })

  it('tags the lowest month and a quarterly pattern', () => {
    expect(analyse('Shopping', 'Shopping', [420, 380, 515, 610, 690, 305]).tags).toContain('Lowest in 6 months')
    expect(analyse('Utilities', 'Utilities', [265, 238, 372, 214, 236, 384]).tags).toContain('Looks quarterly')
  })
})

describe('computeCategoryInsights', () => {
  it('nets refunds, skips ignored and income, and groups uncategorised money-out', () => {
    const insights = computeCategoryInsights(
      [
        tx('2026-10-02', 'Groceries', -300),
        tx('2026-10-03', 'Groceries', 50),
        tx('2026-10-04', 'Groceries', -999, 'Ignored', { ignore: true }),
        tx('2026-10-05', 'Salary', 5000, 'Pay', { type: 'Income' }),
        tx('2026-10-06', '', -40, 'Mystery'),
        tx('2026-04-30', 'Groceries', -999),
      ],
      OCT,
    )

    const byName = Object.fromEntries(insights.map((a) => [a.name, a]))
    expect(Object.keys(byName).sort()).toEqual(['Groceries', 'Uncategorised'])
    expect(byName.Groceries.cur).toBe(250)
    expect(byName.Uncategorised.cur).toBe(40)
    expect(byName.Uncategorised.category).toBe('')
  })
})

describe('groupInsights + summarise', () => {
  const insights = [
    analyse('Groceries', 'Groceries', [600, 600, 600, 600, 700, 900]),
    analyse('Dining', 'Dining', [300, 300, 300, 300, 400, 200]),
    analyse('Fuel', 'Fuel', [180, 180, 180, 180, 180, 190]),
  ]
  const groups = groupInsights(insights)

  it('splits flagged increases, decreases and minor changes', () => {
    expect(groups.up.map((a) => a.name)).toEqual(['Groceries'])
    expect(groups.down.map((a) => a.name)).toEqual(['Dining'])
    expect(groups.minor.map((a) => a.name)).toEqual(['Fuel'])
  })

  it('summarises totals and the biggest change', () => {
    const summary = summarise(insights, groups)

    expect(summary.totalCur).toBe(1290)
    expect(summary.totalPrev).toBe(1280)
    expect(summary.upChange).toBe(200)
    expect(summary.downChange).toBe(-200)
    expect(summary.biggest?.name).toBe('Groceries')
  })

  it('has no biggest change when nothing is flagged', () => {
    const quiet = [analyse('Fuel', 'Fuel', [180, 180, 180, 180, 180, 190])]
    expect(summarise(quiet, groupInsights(quiet)).biggest).toBeNull()
  })
})

describe('formatting', () => {
  it('formats signed amounts and percentages', () => {
    expect(formatSigned(212)).toBe('+$212')
    expect(formatSigned(-1500)).toBe('−$1,500')
    expect(formatSigned(0)).toBe('$0')
    expect(formatPct(0.279)).toBe('+28%')
    expect(formatPct(-0.41)).toBe('−41%')
  })

  it('writes headlines against the previous month', () => {
    expect(headline(analyse('G', 'G', [1, 1, 1, 1, 760, 972]), OCT)).toBe('up $212 on September ($760 → $972)')
    expect(headline(analyse('T', 'T', [0, 0, 0, 0, 0, 640]), OCT)).toBe('$640 spent, nothing in the last 5 months')
  })
})

describe('merchantKey', () => {
  it.each([
    ['WOOLWORTHS 1294 HORNSBY', 'WOOLWORTHS'],
    ['Woolworths', 'WOOLWORTHS'],
    ["O'LOUGHLINS  PHARMACY", 'OLOUGHLINS'],
    ['4812 EYEQ OPTOMETRISTS', 'EYEQ'],
    ['7-ELEVEN 2344 LITHGOW', 'ELEVEN'],
  ])('groups %j under %j', (description, expected) => {
    expect(merchantKey(description)).toBe(expected)
  })
})

describe('computeDrivers', () => {
  const transactions = [
    tx('2026-09-03', 'Groceries', -200, 'WOOLWORTHS 1294 HORNSBY'),
    tx('2026-10-03', 'Groceries', -150, 'WOOLWORTHS 1294 HORNSBY'),
    tx('2026-10-10', 'Groceries', -150, 'WOOLWORTHS 1045 CASTLE HILL'),
    tx('2026-10-12', 'Groceries', -186, 'COSTCO AUBURN'),
    tx('2026-09-12', 'Groceries', -80, 'COLES 0760 ASQUITH'),
    tx('2026-09-20', 'Groceries', -40, 'ALDI STORES'),
    tx('2026-10-20', 'Groceries', -40, 'ALDI STORES'),
    tx('2026-10-21', 'Dining', -500, 'WOOLWORTHS CAFE'),
  ]
  const insight = analyse('Groceries', 'Groceries', [0, 0, 0, 0, 320, 526])

  it('groups by merchant within the category and sorts by biggest change', () => {
    const drivers = computeDrivers(transactions, insight, OCT)

    expect(drivers.map((d) => [d.name, d.prev, d.cur])).toEqual([
      ['COSTCO', 0, 186],
      ['WOOLWORTHS', 200, 300],
      ['COLES', 80, 0],
      ['ALDI', 40, 40],
    ])
  })

  it('explains each change', () => {
    const meta = Object.fromEntries(computeDrivers(transactions, insight, OCT).map((d) => [d.name, d.meta]))

    expect(meta.COSTCO).toBe('Not seen in September')
    expect(meta.WOOLWORTHS).toBe('2 visits, was 1')
    expect(meta.COLES).toBe('Not seen in October')
    expect(meta.ALDI).toBe('')
  })
})
