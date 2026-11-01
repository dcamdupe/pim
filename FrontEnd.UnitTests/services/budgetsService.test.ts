import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getBudgets, saveBudgets, BudgetsRequestFailedError } from '../../FrontEnd/src/services/budgetsService'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

describe('budgetsService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'a-jwt'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getBudgets fetches /budgets with the bearer token and returns the list', async () => {
    const budgets = [{ category: 'Groceries', amount: 800 }]
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(budgets) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await getBudgets()

    expect(result).toEqual(budgets)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/budgets$/),
      expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
    )
  })

  it('getBudgets throws BudgetsRequestFailedError on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(getBudgets()).rejects.toBeInstanceOf(BudgetsRequestFailedError)
  })

  it('saveBudgets PUTs the full list as JSON', async () => {
    const budgets = [{ category: 'Dining', amount: 150.5 }]
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await saveBudgets(budgets)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/budgets$/),
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-jwt' },
        body: JSON.stringify(budgets),
      }),
    )
  })

  it('saveBudgets throws BudgetsRequestFailedError on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await expect(saveBudgets([])).rejects.toBeInstanceOf(BudgetsRequestFailedError)
  })
})
