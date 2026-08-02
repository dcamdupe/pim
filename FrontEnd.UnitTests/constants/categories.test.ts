import { describe, it, expect } from 'vitest'
import { CATEGORIES, CATEGORY_COLORS, categoryColor } from '../../FrontEnd/src/constants/categories'

describe('CATEGORY_COLORS', () => {
  it('has a colour for every category', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('gives every category a unique colour', () => {
    const colors = CATEGORIES.map((category) => CATEGORY_COLORS[category])
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('categoryColor', () => {
  it('looks up a known category', () => {
    expect(categoryColor('Medical')).toBe('#0891b2')
    expect(categoryColor('Subscriptions')).toBe('#c026d3')
  })

  it('returns undefined for an unknown category', () => {
    expect(categoryColor('Not a real category')).toBeUndefined()
  })
})
