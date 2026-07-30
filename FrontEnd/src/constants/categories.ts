// Ported from docs/design/dashboard-mockup-calm.html's `catColor` map - the single standard
// location for the category list and their display colours (per UBE-48).
export const CATEGORIES = [
  'Housing',
  'Groceries',
  'Transport',
  'Dining',
  'Shopping',
  'Utilities',
  'Entertainment',
  'Income',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_COLORS: Record<Category, string> = {
  Housing: '#2a78d6',
  Groceries: '#eb6834',
  Transport: '#1baf7a',
  Dining: '#eda100',
  Shopping: '#e87ba4',
  Utilities: '#008300',
  Entertainment: '#4a3aa7',
  Other: '#e34948',
  Income: '#0f766e',
}

export function categoryColor(category: string): string | undefined {
  return CATEGORY_COLORS[category as Category]
}
