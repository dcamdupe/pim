import { getSettings, type CategoryDefinition } from './settingsService'

const STORAGE_KEY = 'pim.categories'

export type { CategoryDefinition }

function isCategoryDefinition(value: unknown): value is CategoryDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CategoryDefinition).name === 'string' &&
    typeof (value as CategoryDefinition).colour === 'string'
  )
}

// Cached synchronously so category pickers/colour lookups (TransactionsView, RecentTransactionsList,
// dashboardMetrics) can read it without an awaited round trip - refreshCategories() keeps it current.
export function getCachedCategories(): CategoryDefinition[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every(isCategoryDefinition) ? parsed : []
  } catch {
    return []
  }
}

export async function refreshCategories(): Promise<CategoryDefinition[]> {
  const { categories } = await getSettings()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
  return categories
}

export function categoryNames(): string[] {
  return getCachedCategories()
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b))
}

export function categoryColor(category: string): string | undefined {
  return getCachedCategories().find((c) => c.name === category)?.colour
}
