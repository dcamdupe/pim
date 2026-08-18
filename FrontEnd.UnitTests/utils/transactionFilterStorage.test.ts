import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStoredTransactionFilters,
  saveTransactionFilters,
  type TransactionFiltersState,
} from '../../FrontEnd/src/utils/transactionFilterStorage'

const STORAGE_KEY = 'pim.transactionFilters'

const filters: TransactionFiltersState = {
  range: 'threeMonths',
  search: 'coffee',
  account: 'Everyday',
  category: 'Dining',
  needsCategoryOnly: true,
  amountSign: 'negative',
}

describe('transactionFilterStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadStoredTransactionFilters', () => {
    it('returns null when nothing is stored', () => {
      expect(loadStoredTransactionFilters()).toBeNull()
    })

    it('returns the stored filters', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))

      expect(loadStoredTransactionFilters()).toEqual(filters)
    })

    it('returns null when the stored value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')

      expect(loadStoredTransactionFilters()).toBeNull()
    })

    it('returns null when the range is not a recognised option', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, range: 'decade' }))

      expect(loadStoredTransactionFilters()).toBeNull()
    })

    it.each(['year', 'financialYear'])('accepts the new fixed range option "%s"', (range) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, range }))

      expect(loadStoredTransactionFilters()).toEqual({ ...filters, range })
    })

    it('accepts a valid "month:YYYY-MM" range', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, range: 'month:2026-06' }))

      expect(loadStoredTransactionFilters()).toEqual({ ...filters, range: 'month:2026-06' })
    })

    it('returns null when a "month:" range is malformed', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, range: 'month:June-2026' }))

      expect(loadStoredTransactionFilters()).toBeNull()
    })

    it('returns null when a required field is missing', () => {
      const { search: _search, ...rest } = filters
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))

      expect(loadStoredTransactionFilters()).toBeNull()
    })

    it.each(['', 'positive', 'negative'])('accepts amountSign "%s"', (amountSign) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, amountSign }))

      expect(loadStoredTransactionFilters()).toEqual({ ...filters, amountSign })
    })

    it('returns null when amountSign is not a recognised option', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, amountSign: 'zero' }))

      expect(loadStoredTransactionFilters()).toBeNull()
    })
  })

  describe('saveTransactionFilters', () => {
    it('persists the filters so they can be loaded back', () => {
      saveTransactionFilters(filters)

      expect(loadStoredTransactionFilters()).toEqual(filters)
    })
  })
})
