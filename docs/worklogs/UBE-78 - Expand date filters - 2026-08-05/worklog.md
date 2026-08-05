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

## Open questions

1. **"Last year" - trailing 12 months, or the previous calendar year (Jan-Dec)?**
2. **"Last financial year" - which convention?** No FY concept exists in the codebase yet. Given the
   app's Australian context (BPAY references elsewhere), assuming Jul-Jun unless told otherwise -
   confirming before building it in.
3. **Do the 6 individual months replace `Last month`/`Last 3 months`, or sit alongside them?**

## Plan

_Pending answers to the open questions above._

## Checklist

_Pending plan above._

## Prompt log

- "start a worklog for UBE-78"
