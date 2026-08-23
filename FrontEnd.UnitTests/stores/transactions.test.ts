import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTransactionsStore } from '../../FrontEnd/src/stores/transactions'
import * as transactionsService from '../../FrontEnd/src/services/transactionsService'
import type { Transaction } from '../../FrontEnd/src/services/transactionsService'

const STORAGE_KEY = 'pim.transactions'

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    account: 'Everyday',
    date: '2026-08-01',
    description: 'Coffee',
    category: 'Dining',
    amount: -5,
    ignore: false,
    type: 'Expense',
    ...overrides,
  }
}

describe('useTransactionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts empty with no cached data', () => {
    const store = useTransactionsStore()

    expect(store.transactions).toEqual([])
    expect(store.loadedAt).toBeNull()
  })

  it('load() fetches all transactions when there is no cache', async () => {
    const fetched = [makeTransaction()]
    const getSpy = vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue(fetched)

    const store = useTransactionsStore()
    await store.load()

    expect(getSpy).toHaveBeenCalledWith(undefined, expect.any(String))
    expect(store.transactions).toEqual(fetched)
    expect(store.loadedAt).not.toBeNull()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(stored.transactions).toEqual(fetched)
  })

  it('load() skips the fetch when the cache is under 10 minutes old', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00Z'))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions: [makeTransaction()], loadedAt: Date.now() }))
    const getSpy = vi.spyOn(transactionsService, 'getTransactions')

    const store = useTransactionsStore()
    vi.setSystemTime(new Date('2026-08-08T12:05:00Z'))
    await store.load()

    expect(getSpy).not.toHaveBeenCalled()
  })

  it('load() re-fetches once the cache is past the 10-minute expiry', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00Z'))
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ transactions: [makeTransaction({ description: 'stale' })], loadedAt: Date.now() }),
    )
    const fresh = [makeTransaction({ description: 'fresh' })]
    const getSpy = vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue(fresh)

    const store = useTransactionsStore()
    vi.setSystemTime(new Date('2026-08-08T12:10:01Z'))
    await store.load()

    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(store.transactions).toEqual(fresh)
  })

  it('treats corrupt localStorage data as no cache', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    const getSpy = vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue([])

    const store = useTransactionsStore()
    expect(store.transactions).toEqual([])
    await store.load()

    expect(getSpy).toHaveBeenCalledTimes(1)
  })

  it('refresh() dedupes concurrent calls into a single fetch', async () => {
    let resolveFetch: (value: Transaction[]) => void = () => {}
    const getSpy = vi.spyOn(transactionsService, 'getTransactions').mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    const store = useTransactionsStore()
    const first = store.refresh()
    const second = store.refresh()
    resolveFetch([makeTransaction()])
    await Promise.all([first, second])

    expect(getSpy).toHaveBeenCalledTimes(1)
  })

  it('refresh() leaves existing state untouched when the fetch fails', async () => {
    vi.spyOn(transactionsService, 'getTransactions').mockRejectedValue(new Error('network blip'))

    const store = useTransactionsStore()
    await expect(store.refresh()).rejects.toThrow('network blip')

    expect(store.transactions).toEqual([])
    expect(store.loadedAt).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('updateTransaction() calls the API, mutates the object in place, and persists', async () => {
    const original = makeTransaction({ category: '' })
    vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue([original])
    const sent = { ...makeTransaction({ category: '' }), category: 'Dining' }
    const updateSpy = vi.spyOn(transactionsService, 'updateTransactions').mockResolvedValue([sent])

    const store = useTransactionsStore()
    await store.load()
    const stored = store.transactions[0]

    await store.updateTransaction(stored, { category: 'Dining' })

    expect(updateSpy).toHaveBeenCalledWith([sent])
    expect(stored.category).toBe('Dining')
    expect(store.transactions[0].category).toBe('Dining')
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(persisted.transactions[0].category).toBe('Dining')
  })

  // The Api can stamp fields (e.g. Type/Ignore, derived from the category definition) as a side
  // effect of a category change, beyond whatever the caller explicitly asked to change - the store
  // must reflect the server's response, not just echo the locally-requested changes back onto the
  // object (a real bug: Dashboard tiles once silently miscounted income until this was fixed,
  // since the cached store never refetched to pick up the server-derived Type otherwise).
  it('updateTransaction() merges the full server response, not just the requested changes', async () => {
    const original = makeTransaction({ category: '', type: null })
    vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue([original])
    const stamped = { ...makeTransaction({ category: '' }), category: 'Income', type: 'Income' as const }
    vi.spyOn(transactionsService, 'updateTransactions').mockResolvedValue([stamped])

    const store = useTransactionsStore()
    await store.load()
    const stored = store.transactions[0]

    await store.updateTransaction(stored, { category: 'Income' })

    expect(stored.type).toBe('Income')
  })

  it('updateTransaction() does not mutate the object when the API call fails', async () => {
    const original = makeTransaction({ category: '' })
    vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue([original])
    vi.spyOn(transactionsService, 'updateTransactions').mockRejectedValue(new Error('save failed'))

    const store = useTransactionsStore()
    await store.load()
    const stored = store.transactions[0]

    await expect(store.updateTransaction(stored, { category: 'Dining' })).rejects.toThrow('save failed')

    expect(stored.category).toBe('')
  })

  it('clear() resets state and removes the localStorage cache', async () => {
    vi.spyOn(transactionsService, 'getTransactions').mockResolvedValue([makeTransaction()])
    const store = useTransactionsStore()
    await store.load()

    store.clear()

    expect(store.transactions).toEqual([])
    expect(store.loadedAt).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
