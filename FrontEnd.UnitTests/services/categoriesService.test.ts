import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { categoryNames, categoryColor } from '../../FrontEnd/src/services/categoriesService'
import { useSettingsStore } from '../../FrontEnd/src/stores/settings'

const categories = [
  { name: 'Groceries', colour: '#00ff00', type: 'Expense' as const },
  { name: 'Dining', colour: '#eda100', type: 'Expense' as const },
]

// categoryNames()/categoryColor() just read the shared settings store now (UBE-87) - its own
// load/refresh/persist/cache behavior is covered by stores/settings.test.ts, so these tests only
// need to check the lookup logic against a pre-populated store.
describe('categoriesService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('categoryNames', () => {
    it("returns the settings store's category names, sorted alphabetically", () => {
      useSettingsStore().categories = categories

      expect(categoryNames()).toEqual(['Dining', 'Groceries'])
    })

    it('returns an empty array when nothing is loaded', () => {
      expect(categoryNames()).toEqual([])
    })
  })

  describe('categoryColor', () => {
    it('looks up a known category', () => {
      useSettingsStore().categories = categories

      expect(categoryColor('Dining')).toBe('#eda100')
    })

    it('returns undefined for an unknown category', () => {
      useSettingsStore().categories = categories

      expect(categoryColor('Not a real category')).toBeUndefined()
    })
  })
})
