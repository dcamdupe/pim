const STORAGE_KEY = 'pim.dashboardFilters'

const MONTH_KEY = /^\d{4}-\d{2}$/

export interface DashboardFiltersState {
  month: string
}

function isDashboardFiltersState(value: unknown): value is DashboardFiltersState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const v = value as Record<string, unknown>
  return typeof v.month === 'string' && MONTH_KEY.test(v.month)
}

export function loadStoredDashboardFilters(): DashboardFiltersState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    return isDashboardFiltersState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveDashboardFilters(filters: DashboardFiltersState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
}
