import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStoredDashboardFilters,
  saveDashboardFilters,
  type DashboardFiltersState,
} from '../../FrontEnd/src/utils/dashboardFilterStorage'

const STORAGE_KEY = 'pim.dashboardFilters'

const filters: DashboardFiltersState = {
  month: '2026-06',
  category: 'Groceries',
}

describe('dashboardFilterStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadStoredDashboardFilters', () => {
    it('returns null when nothing is stored', () => {
      expect(loadStoredDashboardFilters()).toBeNull()
    })

    it('returns the stored filters', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))

      expect(loadStoredDashboardFilters()).toEqual(filters)
    })

    it('returns null when the stored value is not valid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')

      expect(loadStoredDashboardFilters()).toBeNull()
    })

    it('returns null when the month is malformed', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ month: 'June-2026' }))

      expect(loadStoredDashboardFilters()).toBeNull()
    })

    it('returns null when the month field is missing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({}))

      expect(loadStoredDashboardFilters()).toBeNull()
    })

    it('loads a stored filter without the removed category field', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ month: '2026-06' }))

      expect(loadStoredDashboardFilters()).toEqual({ month: '2026-06' })
    })
  })

  describe('budgetCategory (UBE-124)', () => {
    it('round-trips the budget category filter', () => {
      saveDashboardFilters({ month: '2026-11', category: '', budgetCategory: 'Groceries' })

      expect(loadStoredDashboardFilters()).toEqual({ month: '2026-11', category: '', budgetCategory: 'Groceries' })
    })

    it('still loads filters stored before budgetCategory existed', () => {
      localStorage.setItem('pim.dashboardFilters', JSON.stringify({ month: '2026-11', category: 'Dining' }))

      expect(loadStoredDashboardFilters()).toEqual({ month: '2026-11', category: 'Dining' })
    })

    it('returns null when budgetCategory is not a string', () => {
      localStorage.setItem('pim.dashboardFilters', JSON.stringify({ month: '2026-11', category: '', budgetCategory: 5 }))

      expect(loadStoredDashboardFilters()).toBeNull()
    })
  })

  describe('budgetProjectionFilter (UBE-125)', () => {
    it('round-trips the Month Budget filter', () => {
      saveDashboardFilters({ month: '2026-11', category: '', budgetProjectionFilter: 'over' })

      expect(loadStoredDashboardFilters()).toEqual({ month: '2026-11', category: '', budgetProjectionFilter: 'over' })
    })

    it('returns null when budgetProjectionFilter is not a string', () => {
      localStorage.setItem('pim.dashboardFilters', JSON.stringify({ month: '2026-11', category: '', budgetProjectionFilter: 1 }))

      expect(loadStoredDashboardFilters()).toBeNull()
    })
  })

  describe('saveDashboardFilters', () => {
    it('persists the filters so they can be loaded back', () => {
      saveDashboardFilters(filters)

      expect(loadStoredDashboardFilters()).toEqual(filters)
    })
  })
})
