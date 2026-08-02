# UBE-65 - Endless scroll transactions

## Description

From Linear (UBE-65): Implement endless scroll in the transaction listing. By default display the
first 100 transactions. Load all of the transactions in a single API call, but start displaying
the first 100 only, then display more as the user scrolls.

Linear issue: https://linear.app/uberconcept/issue/UBE-65/implement-endless-scroll-in-the-transaction-listing

## Current state

`FrontEnd/src/views/TransactionsView.vue` already loads the whole date-range in a single
`getTransactions()` call (`fetchTransactions()`) and renders every row of `filteredTransactions`
in one `v-for` with no pagination/windowing at all - so the "single API call" half of the ticket
is already satisfied. This is purely a frontend rendering-window change: cap what's actually
rendered to the first 100 rows of `filteredTransactions`, then reveal more as the user scrolls
toward the bottom, with no extra network call.

## Plan

1. Add a `visibleCount` ref (starting at a `PAGE_SIZE = 100` constant) and a
   `visibleTransactions = computed(() => filteredTransactions.value.slice(0, visibleCount.value))`
   - render `visibleTransactions` in the table instead of `filteredTransactions`.
2. Reset `visibleCount` back to `PAGE_SIZE` whenever the underlying filtered set changes (date
   range/search/account/category/needs-category toggle, and after a fresh `fetchTransactions()`) -
   otherwise a narrower filter could leave `visibleCount` referencing rows that no longer exist,
   or a wider one could get stuck showing only the old page size.
3. Grow `visibleCount` by another `PAGE_SIZE` (capped at `filteredTransactions.length`) as the user
   nears the bottom of the list. Since `.table-card` has no fixed height (the whole page scrolls,
   not an inner scroll container - confirmed by reading the current CSS), this needs an
   `IntersectionObserver` on a sentinel element after the table, not an inner `scroll` listener.
   Clean up the observer `onUnmounted`.
4. Extract the pure "how many rows should be visible" growth/cap logic into a small util (matching
   the existing `utils/transactionFilters.ts` pattern) so it can be unit tested in
   `FrontEnd.UnitTests` without needing DOM/IntersectionObserver machinery - the view stays thin
   and just wires the observer to it.
5. FunctionalTests: add a scenario to `transactionListing.spec.ts` (or a new spec) that uploads
   more than 100 transactions, confirms only 100 rows render initially, then scrolls and confirms
   more appear.
6. Manually verify in the browser: initial 100-row cap, scroll-triggered growth, and that
   filtering/date-range changes correctly reset back to the first page.

Each step will be confirmed with the user before implementing.

## Checklist

- [x] Confirm plan/approach with user before implementing - user said "go ahead and implement it"
- [x] Add visible-window state + computed slice in `TransactionsView.vue`, render it in the table
      (`visibleCount` ref, `visibleTransactions` computed, table `v-for` switched to it)
- [x] Reset visible window on filter/range change and after refetch (added to the existing
      combined filters watcher; deliberately NOT reset on every `fetchTransactions()` refetch from
      a category/inactive edit, so editing a row doesn't collapse the user's scroll position)
- [x] Add IntersectionObserver-based scroll growth (with cleanup on unmount) - a `.scroll-sentinel`
      div renders after the table only while more rows remain, observed via a template-ref watcher
- [x] Extract pure page-growth logic into `utils/infiniteScroll.ts` (`nextVisibleCount`,
      `TRANSACTIONS_PAGE_SIZE`) + 4 `FrontEnd.UnitTests` cases
- [x] Add a FunctionalTests scenario (`transactionListing.spec.ts`, new "Endless scroll" describe)
      covering >100-rows: uploads 120 QIF transactions, asserts exactly 100 rows render, scrolls
      the sentinel into view, asserts all 120 then render
- [x] `npm run build` / `npm run lint` clean
- [x] Manually verify - covered by the new FunctionalTests scenario itself (drives the real app in
      a real Chromium browser); separate manual click-through not additionally done
- [x] Full test suite green (FrontEnd.UnitTests: 104 tests; FunctionalTests: 23/23). First full
      FunctionalTests run showed 14 failures - root-caused to pre-existing environmental test-data
      pollution (135 "today"-dated transactions and several stale fixed-name accounts already
      accumulated in the local DynamoDB instance from many earlier test sessions, tipping the
      default "month" range over the new 100-row cap for tests that don't scroll/search-scope) -
      not a regression in this feature. Cleaned via `scripts/clean_local.sh` plus removing the
      specific stale fixed-name accounts; full suite passed 23/23 afterward.
- [ ] Open PR

## Prompt log

- "start a worklog on UBE-65"
- "go ahead and implement it" (implemented visible-window slice + IntersectionObserver growth in
  `TransactionsView.vue`, extracted `utils/infiniteScroll.ts` + unit tests, added a FunctionalTests
  "Endless scroll" scenario, then diagnosed and cleaned up pre-existing environmental test-data
  pollution that was causing unrelated widespread FunctionalTests failures, before confirming the
  full suite green)
