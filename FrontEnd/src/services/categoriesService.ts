import { useSettingsStore } from '../stores/settings'
import type { CategoryDefinition } from './settingsService'

export type { CategoryDefinition }

// Reads the shared settings store synchronously - safe outside component context too, since Pinia's
// active instance is set once at app bootstrap. stores/settings.ts keeps this current; no own cache/refresh.
export function categoryNames(): string[] {
  return useSettingsStore()
    .categories.map((c) => c.name)
    .sort((a, b) => a.localeCompare(b))
}

export function categoryColor(category: string): string | undefined {
  return useSettingsStore().categories.find((c) => c.name === category)?.colour
}
