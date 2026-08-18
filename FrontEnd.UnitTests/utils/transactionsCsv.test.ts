import { describe, it, expect } from 'vitest'
import { buildTransactionsCsv } from '../../FrontEnd/src/utils/transactionsCsv'
import type { Transaction } from '../../FrontEnd/src/services/transactionsService'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    account: 'Everyday',
    date: '2026-07-01',
    description: 'Coffee Shop',
    category: 'Dining',
    amount: -4.5,
    ignore: null,
    type: null,
    ...overrides,
  }
}

describe('buildTransactionsCsv', () => {
  it('returns just the header row for an empty list', () => {
    expect(buildTransactionsCsv([])).toBe('Date,Description,Account,Category,Amount')
  })

  it('renders one row per transaction, with amount fixed to 2 decimal places', () => {
    const transactions = [
      makeTransaction({ date: '2026-07-01', description: 'Coffee Shop', account: 'Everyday', category: 'Dining', amount: -4.5 }),
      makeTransaction({ date: '2026-07-02', description: 'Salary', account: 'Everyday', category: 'Income', amount: 2500 }),
    ]

    expect(buildTransactionsCsv(transactions)).toBe(
      ['Date,Description,Account,Category,Amount', '2026-07-01,Coffee Shop,Everyday,Dining,-4.50', '2026-07-02,Salary,Everyday,Income,2500.00'].join(
        '\n',
      ),
    )
  })

  it('renders an empty category for an uncategorised transaction', () => {
    const transactions = [makeTransaction({ category: '' })]

    expect(buildTransactionsCsv(transactions)).toContain(',,-4.50')
  })

  it('quotes a description containing a comma', () => {
    const transactions = [makeTransaction({ description: 'Whole Foods, Market St' })]

    expect(buildTransactionsCsv(transactions)).toContain('"Whole Foods, Market St"')
  })

  it('quotes and doubles embedded quotes in a description', () => {
    const transactions = [makeTransaction({ description: 'Bob"s Diner' })]

    expect(buildTransactionsCsv(transactions)).toContain('"Bob""s Diner"')
  })

  it('quotes a description containing a newline', () => {
    const transactions = [makeTransaction({ description: 'Line one\nLine two' })]

    expect(buildTransactionsCsv(transactions)).toContain('"Line one\nLine two"')
  })
})
