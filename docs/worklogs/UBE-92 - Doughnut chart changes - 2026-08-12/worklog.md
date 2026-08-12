# UBE-92: Doughnut chart changes

Linear: https://linear.app/uberconcept/issue/UBE-92/doughnut-chart-changes
Status: In Progress · Priority: No priority

## Description (from Linear)

- Change to a standard doughnut chart, with straight line between segments
- When you click on a section (eg Kids), take them to the transactions page with this filter
  prefilled in - ie filtered to this month & category, clear other filters
- Change the text inside from "this month" to the month + year

## Current state

- `FrontEnd/src/components/SpendingByCategoryChart.vue` draws each category as a *stroked* arc
  (`stroke-width`, `stroke-linecap="round"`) with a small angular `GAP` between segments - this
  gives rounded-cap gaps between segments rather than a standard doughnut's straight radial
  dividing lines with segments touching.
- `centerLabel` defaults to the literal string `'this month'` and is never overridden by the
  caller (`FrontEnd/src/views/DashboardView.vue:126`) - so the chart always shows "this month"
  regardless of the selected month.
- `DashboardView.vue` already has everything needed to fix that: `selectedMonthKey` (`YYYY-MM`)
  and `selectedMonthLabel` (via `formatMonthYear`, e.g. "August 2026").
- Segments have no click handler today - `<title>` tooltip only.
- `FrontEnd/src/views/TransactionsView.vue` filters are seeded from `localStorage`
  (`loadStoredTransactionFilters()`/`saveTransactionFilters()` in
  `FrontEnd/src/utils/transactionFilterStorage.ts`), not from route query params - there's no
  existing mechanism for another view to hand it a filter.
- `transactionFilterStorage.ts`'s `RangeOption` already supports a `` `month:${string}` ``
  variant (e.g. `month:2026-08`) consumed by `transactionDateRange.ts`'s `filterByDateRange` - this
  is exactly "this month" in the format the transactions page understands, and its value matches
  `selectedMonthKey`'s format directly.

## Plan

**Chart shape**

1. `SpendingByCategoryChart.vue` - rework `arcPath`/segment rendering from stroked rounded arcs to
   filled wedges (outer arc + straight radial line to inner arc + inner arc back), touching at 0°
   gap, so segment boundaries render as a straight line rather than a rounded-cap gap. Keep the
   inner-radius cutout so it still reads as a doughnut, not a pie.

**Center label**

2. `SpendingByCategoryChart.vue` - drop the `'this month'` default for `centerLabel` (make it
   required, not defaulted).
3. `DashboardView.vue` - pass `:center-label="selectedMonthLabel"` so the center text tracks the
   selected month + year (e.g. "August 2026").

**Segment click → transactions page**

4. `SpendingByCategoryChart.vue` - add a `click` handler on each segment path, emitting the
   segment's `category`.
5. `DashboardView.vue` - on that emit, `router.push` to `/transactions` with a query carrying
   `range: month:${selectedMonthKey}` and `category`.
6. `TransactionsView.vue` - on mount, if `route.query.range`/`route.query.category` are present,
   use them instead of `loadStoredTransactionFilters()` for `selectedRange`/`selectedCategory`
   (clearing `searchQuery`/`selectedAccount`/`needsCategoryOnly` to their defaults per "clear other
   filters"), and persist that as the new stored filter state via `saveTransactionFilters` so it
   sticks if the user navigates away and back.

**Tests**

7. `FrontEnd.UnitTests` - update/add coverage for: wedge path shape (or at least that segments
   render without the old gap/round-cap styling), `centerLabel` no longer defaulting, the click →
   emit → router.push wiring, and `TransactionsView`'s query-param filter seeding + clear-others
   behaviour.
8. `npm run test` (`FrontEnd.UnitTests`), `npm run build` (`FrontEnd`) clean.

**Verification**

9. `scripts/run_local.sh` - visually confirm the doughnut now has straight segment boundaries,
   center text shows "<Month> <Year>", and clicking a segment lands on Transactions pre-filtered
   to that month + category with search/account/needs-category cleared.

## Checklist

- [x] Rework `SpendingByCategoryChart.vue` segments to filled wedges with straight boundaries
      (no more `GAP`/rounded stroke caps)
- [x] `centerLabel` no longer defaults to `'this month'`; `DashboardView.vue` passes
      `selectedMonthLabel`
- [x] Segment click emits `category`; `DashboardView.vue` routes to `/transactions` with
      `range=month:<selectedMonthKey>&category=<category>`
- [x] `TransactionsView.vue` seeds filters from route query when present, clears
      search/account/needs-category, and persists the result
- [x] `FrontEnd.UnitTests` unaffected (this repo tests view/component behaviour via
      `FunctionalTests`, not Vitest component tests - no existing precedent for
      `SpendingByCategoryChart`/`DashboardView`/`TransactionsView`); new
      `FunctionalTests/tests/dashboard.spec.ts` "Category chart" scenario added instead, covering
      the center label and the click → filtered-Transactions flow (including a real bug this
      surfaced: `TransactionsView`'s Date range `<select>` had no `<option>` for the *current*
      month, since `pastSixMonthOptions` deliberately excludes it - fixed by splicing it in when a
      route-query month isn't already covered). `npm run test` (`FrontEnd.UnitTests`) clean, 175
      passing (unaffected, run for regression-safety).
- [x] `npm run build` clean
- [x] Manual verification via `scripts/run_local.sh` + the new Playwright scenario (real browser,
      real local stack) + a screenshot confirming straight segment boundaries and the "August 2026"
      center label. Also found/fixed a second real bug along the way: a single category at 100%
      produces a 360° wedge, which SVG renders as a degenerate/invisible arc (coincident start/end
      point) - capped the max sweep at 359.99° in `SpendingByCategoryChart.vue`.

## Prompt log

- "switch to main" → already on `main`, clean, up to date with `origin/main` (unrelated tmbank
  downloader work from earlier in the session was already committed)
- "start a worklog for UBE-92" → fetched issue from Linear, read
  `SpendingByCategoryChart.vue`/`DashboardView.vue`/`TransactionsView.vue`/
  `transactionFilterStorage.ts`/`transactionDateRange.ts`/`dashboardMetrics.ts` to scope the three
  Linear requirements, wrote this worklog
- "yes, go ahead" → implemented all 6 code steps (wedge shape, center label, click → route →
  filtered Transactions, including the `pastSixMonthOptions`/current-month `<option>` fix); added
  the `FunctionalTests` "Category chart" scenario, hit and fixed the 360°/degenerate-arc bug it
  surfaced, then a click-target/seam-position issue in the test itself; `npm run build`,
  `npm run test` (`FrontEnd.UnitTests`, unaffected), and the full `dashboard.spec.ts` +
  `transactionListing.spec.ts`/`transactionCategorization.spec.ts` (blast-radius check) all green
  except two pre-existing shared-dataset-growth failures unrelated to this change (see
  `project_functionaltests_dataset_growth_risk` memory); screenshot-verified the chart visually
