import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  uploadTransactions,
  TransactionsUploadFailedError,
  getTransactions,
  TransactionsRequestFailedError,
  updateTransactions,
  TransactionsUpdateFailedError,
  saveDescriptionMapping,
  DescriptionMappingRequestFailedError,
  type Transaction,
} from '../../FrontEnd/src/services/transactionsService'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

describe('transactionsService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'a-jwt'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('uploadTransactions', () => {
    it('POSTs the account and file as multipart form data with the bearer token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)
      const file = new File(['qif content'], 'transactions.qif', { type: 'text/plain' })

      await uploadTransactions('Everyday', file)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/transactions\/file$/),
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer a-jwt' },
        }),
      )
      const [, options] = fetchMock.mock.calls[0]
      const body = options.body as FormData
      expect(body).toBeInstanceOf(FormData)
      expect(body.get('account')).toBe('Everyday')
      expect(body.get('file')).toBe(file)
    })

    it('throws TransactionsUploadFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(uploadTransactions('Everyday', new File([''], 'transactions.qif'))).rejects.toBeInstanceOf(
        TransactionsUploadFailedError,
      )
    })
  })

  describe('getTransactions', () => {
    it('fetches /transactions with the date range, bearer token, and returns the transactions', async () => {
      const transactions = [{ account: 'Everyday', date: '2026-06-01', description: 'Coffee', category: '', amount: -4.5 }]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ transactions }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await getTransactions('2026-06-01', '2026-06-30')

      expect(result).toEqual(transactions)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/transactions\?startDate=2026-06-01&endDate=2026-06-30$/),
        expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
      )
    })

    it('omits startDate from the query string when not provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ transactions: [] }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await getTransactions(undefined, '2026-06-30')

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/transactions\?endDate=2026-06-30$/),
        expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
      )
    })

    it('throws TransactionsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(getTransactions('2026-06-01', '2026-06-30')).rejects.toBeInstanceOf(TransactionsRequestFailedError)
    })
  })

  describe('updateTransactions', () => {
    it('PUTs the transactions as JSON with the bearer token', async () => {
      const transactions: Transaction[] = [
        { account: 'Everyday', date: '2026-06-01', description: 'Coffee', category: 'Dining', amount: -4.5, ignore: null },
      ]
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await updateTransactions(transactions)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/transactions$/),
        expect.objectContaining({
          method: 'PUT',
          headers: { Authorization: 'Bearer a-jwt', 'Content-Type': 'application/json' },
          body: JSON.stringify(transactions),
        }),
      )
    })

    it('throws TransactionsUpdateFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(updateTransactions([])).rejects.toBeInstanceOf(TransactionsUpdateFailedError)
    })
  })

  describe('saveDescriptionMapping', () => {
    it('POSTs the descriptionStart and category as JSON with the bearer token', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await saveDescriptionMapping('COLES', 'Groceries')

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/mapping\/description$/),
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer a-jwt', 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptionStart: 'COLES', category: 'Groceries' }),
        }),
      )
    })

    it('throws DescriptionMappingRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(saveDescriptionMapping('COLES', 'Groceries')).rejects.toBeInstanceOf(
        DescriptionMappingRequestFailedError,
      )
    })
  })
})
