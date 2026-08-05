# UBE-78: Expand the date filters in transaction

Linear: https://linear.app/uberconcept/issue/UBE-78/expand-the-date-filters-in-transaction
Status: In Progress · Priority: No priority

## Description (from Linear)

* Add each month for the past 6 months, eg June 2026.
* Add last year
* Add last financial year

## Current state

`FrontEnd/src/views/TransactionsView.vue`'s date-range `<select>` (`aria-label="Date range"`) offers 4
fixed options - `week` / `month` / `threeMonths` / `allTime` - backed by `RangeOption`, a closed string
union in `FrontEnd/src/utils/transactionFilterStorage.ts` (also used to validate the persisted filter
from `localStorage`). `computeRange()` in `TransactionsView.vue` maps each `RangeOption` to a
`{ startDate, endDate }` pair the API query uses; `allTime` sends no `startDate` (API resolves it to
the real earliest transaction date).

There's no existing "month" or "financial year" concept on this filter - that pattern instead lives in
`DashboardView.vue`'s separate month-select (`computeAvailableMonths`/`monthKey`/`parseMonthKey` in
`FrontEnd/src/utils/dashboardMetrics.ts`), which lists every calendar month from the user's
`minTransactionDate` through today. The transactions filter and the dashboard filter are otherwise
unrelated - no code in the repo currently has a concept of "financial year" at all (grepped, no hits).

## Open questions - resolved

1. **"Last year" = trailing 12 months** (rolling from today), consistent with how `week`/`month`/
   `threeMonths` already work - not the previous calendar Jan-Dec year.
2. **"Last financial year" = Australian FY, 1 Jul - 30 Jun.** Unlike "last year", this is a fixed,
   calendar-bound range: the most recently *completed* FY, not a rolling window. E.g. on 5 Aug 2026
   (inside FY Jul 2026 - Jun 2027), "last financial year" = 1 Jul 2025 - 30 Jun 2026.
3. **The 6 individual months sit alongside the existing options**, not replacing `Last month`/
   `Last 3 months`.
4. **Which 6 months, and "past 6 months" meaning**: mirrors the dashboard's existing convention
   (`getPreviousSixMonthsRange` in `dashboardMetrics.ts`) - the 6 full calendar months immediately
   before the current one (excludes the current month). On 5 Aug 2026 that's Feb-Jul 2026, matching
   the ticket's own "June 2026" example. Listed newest-first.

## Plan

**FrontEnd**

1. `FrontEnd/src/utils/dashboardMetrics.ts` - export the currently-private `monthKey()` helper so it
   can be reused outside dashboard code (`parseMonthKey`/`MONTH_NAMES` are already exported).
2. New `FrontEnd/src/utils/transactionDateRange.ts` - extract the view's `computeRange()` logic here
   (currently private to `TransactionsView.vue`, untested) as a pure, directly-testable function taking
   `today` explicitly (matching `dashboardMetrics.ts`'s convention), plus a
   `pastSixMonthOptions(today): { value: string; label: string }[]` helper for the dropdown:
   - `'week'`/`'month'`/`'threeMonths'`/`'allTime'` - unchanged rolling logic, moved as-is.
   - `'year'` (new) - rolling 12 months back from today.
   - `'financialYear'` (new) - the most recently completed AU FY (1 Jul - 30 Jun), a fixed historical
     range, not relative to today beyond determining which FY has most recently closed.
   - `` `month:${monthKey}` `` (new, dynamic) - that calendar month's own start/end, reusing
     `parseMonthKey`/`monthKey` from `dashboardMetrics.ts`.
3. `FrontEnd/src/utils/transactionFilterStorage.ts` - widen `RangeOption` from the closed
   `'week' | 'month' | 'threeMonths' | 'allTime'` union to also include `'year'`, `'financialYear'`,
   and the `` `month:${string}` `` template-literal form; update `isTransactionFiltersState`'s
   validation to accept the new fixed values or a `month:YYYY-MM`-shaped string.
4. `FrontEnd/src/views/TransactionsView.vue` - import `computeRange`/`pastSixMonthOptions` from the new
   util instead of the local function; add a `pastSixMonths` const (`pastSixMonthOptions(new Date())`,
   called once at setup, matching the existing `CATEGORIES` pattern); add the new `<option>`s to the
   Date range `<select>`: the 6 months, then `Last year`, then `Last financial year`, ordered between
   the existing `Last 3 months` and `All time` options.

**Tests**

5. New `FrontEnd.UnitTests/utils/transactionDateRange.test.ts` - cover each `RangeOption` branch
   (including a financial-year boundary case around 30 Jun/1 Jul, and a specific `month:YYYY-MM` case),
   plus `pastSixMonthOptions()`'s output/ordering across a year boundary.
6. `FrontEnd.UnitTests/utils/transactionFilterStorage.test.ts` - add cases for the new fixed range
   values and a valid/invalid `month:YYYY-MM` value.
7. `FunctionalTests/tests/transactionListing.spec.ts` (or a new spec) - one scenario exercising a new
   option end-to-end (e.g. selecting a specific past month and confirming only that month's uploaded
   transaction shows).

**Verification**

8. `npm run build`/`lint`; `FrontEnd.UnitTests`; manual browser check of the new dropdown options
   (light + dark); full Playwright suite.

## Checklist

- [x] `dashboardMetrics.ts` - export `monthKey`
- [x] New `transactionDateRange.ts` - `computeRange()` (extracted + `year`/`financialYear`/`month:`
      branches) + `pastSixMonthOptions()`
- [x] `transactionFilterStorage.ts` - widen `RangeOption` + validation
- [x] `TransactionsView.vue` - use the extracted util, add the new `<option>`s (`npm run build` clean)
- [x] `transactionDateRange.test.ts` - new unit tests (incl. FY 30 Jun/1 Jul boundary cases)
- [x] `transactionFilterStorage.test.ts` - new cases for widened `RangeOption` (129/129 passing overall)
- [x] Functional test coverage for a new date-filter option - `transactionListing.spec.ts`'s new
      "Expanded date filters (UBE-78)" describe block covers a specific past month, `year`, and
      `financialYear` (incl. current-vs-last-FY boundary) - 24/25 Playwright passing (the 1 failure is
      the known pre-existing "Playwright Listing Account" duplicate-name dataset issue, unrelated)
- [x] Manual browser check (light + dark) - Date range dropdown lists (in order): Last week, Last
      month, Last 3 months, July-February 2026 (the 6 individual months, newest first), Last year,
      Last financial year, All time - identical in both themes (native `<select>` styling is
      OS/browser-controlled, unaffected by the app's own light/dark CSS)

## Verification

`npm run build`/`lint` clean throughout. `FrontEnd.UnitTests` 129/129 (`transactionDateRange.test.ts`
is new - 13 cases incl. the FY 30 Jun/1 Jul rollover boundary; `transactionFilterStorage.test.ts` gained
4 cases for the widened `RangeOption`). Full Playwright suite 24/25 (the 1 failure is the known
pre-existing "Playwright Listing Account" duplicate-name dataset issue in
`transactionListing.spec.ts`'s first test, unrelated to this change - confirmed by re-running after a
`clean_local.sh` reset, where it also fails on a clean dataset due to a leftover Account from an
earlier run that `clean_local.sh` doesn't clear). The new "Expanded date filters (UBE-78)" scenario
passes on its own and as part of the full suite. Manual browser check confirmed the dropdown's option
order/labels in both light and dark themes.

## Prompt log

- "start a worklog for UBE-78"
- "1. trailing 12 months. 2. Australian FY. 3. sit alongside"
- "go ahead" / "go" (x3, driving each implementation phase)
- "commit and raise PR"
