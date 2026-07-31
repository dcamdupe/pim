import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  getCachedTransactionDescriptions,
  refreshTransactionDescriptions,
  TransactionDescriptionsRequestFailedError,
  type TransactionDescriptionStat,
} from '../../FrontEnd/src/services/transactionDescriptionsService'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

const STORAGE_KEY = 'pim.transactionDescriptions'

const stats: TransactionDescriptionStat[] = [
  { description: 'Coffee Shop', transactionCount: 2, unclassifiedCount: 1 },
  { description: 'Salary', transactionCount: 1, unclassifiedCount: 0 },
]

describe('transactionDescriptionsService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'a-jwt'
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getCachedTransactionDescriptions', () => {
    it('returns an empty array when nothing is cached', () => {
      expect(getCachedTransactionDescriptions()).toEqual([])
    })

    it('returns the cached description stats', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))

      expect(getCachedTransactionDescriptions()).toEqual(stats)
    })

    it('returns an empty array when the cached value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')

      expect(getCachedTransactionDescriptions()).toEqual([])
    })

    it('returns an empty array when the cache holds the old pre-stats shape (plain string[])', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Coffee Shop', 'Salary']))

      expect(getCachedTransactionDescriptions()).toEqual([])
    })
  })

  describe('refreshTransactionDescriptions', () => {
    it('fetches /transactions/descriptions with the bearer token and caches the result', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ descriptions: stats }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await refreshTransactionDescriptions()

      expect(result).toEqual(stats)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/transactions\/descriptions$/),
        expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
      )
      expect(getCachedTransactionDescriptions()).toEqual(stats)
    })

    it('throws TransactionDescriptionsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(refreshTransactionDescriptions()).rejects.toBeInstanceOf(TransactionDescriptionsRequestFailedError)
    })
  })
})
