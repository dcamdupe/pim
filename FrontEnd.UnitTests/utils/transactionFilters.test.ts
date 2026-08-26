import { describe, it, expect } from 'vitest'
import { filterTransactions, type TransactionFilters } from '../../FrontEnd/src/utils/transactionFilters'
import type { Transaction } from '../../FrontEnd/src/services/transactionsService'

const noFilters: TransactionFilters = { search: '', account: '', category: '', needsCategoryOnly: false, amountSign: '', hideIgnored: false }

const transactions: Transaction[] = [
  { account: 'Everyday', date: '2026-07-01', description: 'Coffee Shop', category: 'Dining', amount: -4.5, ignore: null },
  { account: 'Everyday', date: '2026-07-02', description: 'Salary', category: 'Income', amount: 2500, ignore: null },
  { account: 'Credit Card', date: '2026-07-03', description: 'Whole Foods Market', category: '', amount: -86.42, ignore: null },
  { account: 'Credit Card', date: '2026-07-04', description: 'Coffee Beans Direct', category: '', amount: -12, ignore: null },
  { account: 'Credit Card', date: '2026-07-05', description: 'Old Gym Membership', category: '', amount: -9.99, ignore: true },
]

describe('filterTransactions', () => {
  it('returns everything when no filters are set', () => {
    expect(filterTransactions(transactions, noFilters)).toEqual(transactions)
  })

  it('filters by description search, case-insensitively', () => {
    const result = filterTransactions(transactions, { ...noFilters, search: 'coffee' })

    expect(result).toEqual([transactions[0], transactions[3]])
  })

  it('trims whitespace from the search term', () => {
    const result = filterTransactions(transactions, { ...noFilters, search: '  salary  ' })

    expect(result).toEqual([transactions[1]])
  })

  it('filters by account', () => {
    const result = filterTransactions(transactions, { ...noFilters, account: 'Credit Card' })

    expect(result).toEqual([transactions[2], transactions[3], transactions[4]])
  })

  it('filters by category', () => {
    const result = filterTransactions(transactions, { ...noFilters, category: 'Dining' })

    expect(result).toEqual([transactions[0]])
  })

  it('filters to only transactions needing a category', () => {
    const result = filterTransactions(transactions, { ...noFilters, needsCategoryOnly: true })

    expect(result).toEqual([transactions[2], transactions[3]])
  })

  it('excludes ignored transactions from needsCategoryOnly even without a category', () => {
    const result = filterTransactions(transactions, { ...noFilters, needsCategoryOnly: true })

    expect(result).not.toContainEqual(transactions[4])
  })

  it('filters to only positive amounts', () => {
    const result = filterTransactions(transactions, { ...noFilters, amountSign: 'positive' })

    expect(result).toEqual([transactions[1]])
  })

  it('filters to only negative amounts', () => {
    const result = filterTransactions(transactions, { ...noFilters, amountSign: 'negative' })

    expect(result).toEqual([transactions[0], transactions[2], transactions[3], transactions[4]])
  })

  it('combines search, account, category, and needsCategoryOnly together', () => {
    const result = filterTransactions(transactions, {
      search: 'coffee',
      account: 'Credit Card',
      category: '',
      needsCategoryOnly: true,
      amountSign: '',
      hideIgnored: false,
    })

    expect(result).toEqual([transactions[3]])
  })

  it('filters out ignored transactions when hideIgnored is set', () => {
    const result = filterTransactions(transactions, { ...noFilters, hideIgnored: true })

    expect(result).toEqual([transactions[0], transactions[1], transactions[2], transactions[3]])
  })

  it('returns an empty array when nothing matches', () => {
    const result = filterTransactions(transactions, { ...noFilters, search: 'nonexistent' })

    expect(result).toEqual([])
  })
})
