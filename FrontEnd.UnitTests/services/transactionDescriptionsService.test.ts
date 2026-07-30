import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  getCachedTransactionDescriptions,
  refreshTransactionDescriptions,
  TransactionDescriptionsRequestFailedError,
} from '../../FrontEnd/src/services/transactionDescriptionsService'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

const STORAGE_KEY = 'pim.transactionDescriptions'

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

    it('returns the cached descriptions', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Coffee Shop', 'Salary']))

      expect(getCachedTransactionDescriptions()).toEqual(['Coffee Shop', 'Salary'])
    })

    it('returns an empty array when the cached value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')

      expect(getCachedTransactionDescriptions()).toEqual([])
    })
  })

  describe('refreshTransactionDescriptions', () => {
    it('fetches /transactions/descriptions with the bearer token and caches the result', async () => {
      const descriptions = ['Coffee Shop', 'Salary']
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ descriptions }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await refreshTransactionDescriptions()

      expect(result).toEqual(descriptions)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/transactions\/descriptions$/),
        expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
      )
      expect(getCachedTransactionDescriptions()).toEqual(descriptions)
    })

    it('throws TransactionDescriptionsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(refreshTransactionDescriptions()).rejects.toBeInstanceOf(TransactionDescriptionsRequestFailedError)
    })
  })
})
