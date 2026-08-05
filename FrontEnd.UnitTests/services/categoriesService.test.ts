import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  getCachedCategories,
  refreshCategories,
  categoryNames,
  categoryColor,
} from '../../FrontEnd/src/services/categoriesService'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

const STORAGE_KEY = 'pim.categories'

const categories = [
  { name: 'Groceries', colour: '#00ff00', type: 'Expense' as const },
  { name: 'Dining', colour: '#eda100', type: 'Expense' as const },
]

describe('categoriesService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'a-jwt'
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getCachedCategories', () => {
    it('returns an empty array when nothing is cached', () => {
      expect(getCachedCategories()).toEqual([])
    })

    it('returns the cached categories', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))

      expect(getCachedCategories()).toEqual(categories)
    })

    it('returns an empty array when the cached value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')

      expect(getCachedCategories()).toEqual([])
    })

    it('returns an empty array when the cached value has an unexpected shape', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['Groceries', 'Dining']))

      expect(getCachedCategories()).toEqual([])
    })
  })

  describe('refreshCategories', () => {
    it('fetches /settings with the bearer token and caches the categories', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accounts: [], categories, minTransactionDate: null }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await refreshCategories()

      expect(result).toEqual(categories)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/settings$/),
        expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
      )
      expect(getCachedCategories()).toEqual(categories)
    })
  })

  describe('categoryNames', () => {
    it('returns the names of the cached categories, sorted alphabetically', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))

      expect(categoryNames()).toEqual(['Dining', 'Groceries'])
    })
  })

  describe('categoryColor', () => {
    it('looks up a known category', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))

      expect(categoryColor('Dining')).toBe('#eda100')
    })

    it('returns undefined for an unknown category', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))

      expect(categoryColor('Not a real category')).toBeUndefined()
    })
  })
})
