import { describe, it, expect } from 'vitest'
import { nextVisibleCount, TRANSACTIONS_PAGE_SIZE } from '../../FrontEnd/src/utils/infiniteScroll'

describe('nextVisibleCount', () => {
  it('grows by a page size', () => {
    expect(nextVisibleCount(100, 350, 100)).toBe(200)
  })

  it('caps at the total count when a full page would overshoot it', () => {
    expect(nextVisibleCount(100, 150, 100)).toBe(150)
  })

  it('stays at the total count once everything is already visible', () => {
    expect(nextVisibleCount(150, 150, 100)).toBe(150)
  })

  it('defaults to the transactions page size', () => {
    expect(nextVisibleCount(0, 1000)).toBe(TRANSACTIONS_PAGE_SIZE)
  })
})
