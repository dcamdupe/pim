import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStoredDashboardFilters,
  saveDashboardFilters,
  type DashboardFiltersState,
} from '../../FrontEnd/src/utils/dashboardFilterStorage'

const STORAGE_KEY = 'pim.dashboardFilters'

const filters: DashboardFiltersState = {
  month: '2026-06',
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
  })

  describe('saveDashboardFilters', () => {
    it('persists the filters so they can be loaded back', () => {
      saveDashboardFilters(filters)

      expect(loadStoredDashboardFilters()).toEqual(filters)
    })
  })
})
