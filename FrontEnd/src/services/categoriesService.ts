import { useSettingsStore } from '../stores/settings'
import type { CategoryDefinition } from './settingsService'

export type { CategoryDefinition }

// Reads the shared settings store synchronously - safe outside component context too (dashboardMetrics.ts
// is a plain utility module, not a component), since Pinia's active instance is set once at app
// bootstrap. stores/settings.ts (load on login, 1-minute refresh, refresh() after every Settings save)
// is what keeps this current - no separate cache/refresh of its own here anymore (UBE-87).
export function categoryNames(): string[] {
  return useSettingsStore()
    .categories.map((c) => c.name)
    .sort((a, b) => a.localeCompare(b))
}

export function categoryColor(category: string): string | undefined {
  return useSettingsStore().categories.find((c) => c.name === category)?.colour
}
