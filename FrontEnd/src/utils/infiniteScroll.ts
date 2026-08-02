export const TRANSACTIONS_PAGE_SIZE = 100

// Capped at totalCount so a sentinel that stays in view (e.g. a short list, or repeated
// scroll-up-then-down crossings) can't grow the visible window past what actually exists.
export function nextVisibleCount(currentCount: number, totalCount: number, pageSize: number = TRANSACTIONS_PAGE_SIZE): number {
  return Math.min(currentCount + pageSize, totalCount)
}
