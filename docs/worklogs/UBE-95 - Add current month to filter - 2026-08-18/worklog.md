# UBE-95: Add Current month into transaction filter

## Linear issue

[UBE-95](https://linear.app/uberconcept/issue/UBE-95/add-current-month-into-transaction-filter) — Add Current month into transaction filter

> If the current month is JUne 2025, this should also be shown in the transaction listing

## Description

The Transactions view's "Date range" filter offers a per-month option for each of the 6 full
calendar months before the current one (`pastSixMonthOptions` in
`FrontEnd/src/utils/transactionDateRange.ts`), deliberately excluding the current, still-in-progress
month. UBE-95 asks for the current month to be selectable too, so the in-progress month's
transactions can be filtered to on their own.

(There's already a narrow workaround for this today: `TransactionsView.vue` splices the current
month in as an option, but *only* when the page is loaded via a dashboard doughnut-chart link
carrying `?range=month:<current>` in the URL. There's no way to reach it from the filter dropdown
directly.)

## Plan

- `FrontEnd/src/utils/transactionDateRange.ts`
  - Change `pastSixMonthOptions` to also include the current calendar month (as the newest/first
    entry), since it's the only place this list is built. Rename to `recentMonthOptions` and
    update its doc comment, since "past six months" no longer accurately describes 7 entries
    including the current one.
- `FrontEnd/src/views/TransactionsView.vue`
  - Update the import/call site for the renamed function.
  - The existing query-param splice-in-current-month workaround becomes redundant for the current
    month specifically (it's now always present) but stays in place as a general safety net for
    an arbitrary out-of-range month value arriving via URL.
- `FrontEnd.UnitTests/utils/transactionDateRange.test.ts`
  - Rename/update the `pastSixMonthOptions` describe block and update its two existing cases
    (plain + year-boundary-crossing) to expect the current month as the first entry.

## Checklist

- [x] Rename `pastSixMonthOptions` → `recentMonthOptions`, include the current month
- [x] Update `TransactionsView.vue` import/call site
- [x] Update `FrontEnd.UnitTests/utils/transactionDateRange.test.ts`
- [x] Run `npm run lint`, `npm run build`, and `FrontEnd.UnitTests` (`npm run test`)
- [x] Manually verify the current month appears and filters correctly in the running app
- [x] Review diff and open PR

## Session log

### 2026-08-18

- Retrieved UBE-95 from Linear.
- Read `transactionDateRange.ts` (`pastSixMonthOptions`) and `TransactionsView.vue`'s existing
  query-param current-month splice workaround to scope the fix.
- Created this worklog and branch `UBE-95/add-current-month-to-transaction-filter` off `main`.
- Renamed `pastSixMonthOptions` → `recentMonthOptions` in `transactionDateRange.ts`, adding the
  current calendar month as the newest entry; updated `TransactionsView.vue`'s call site and a
  stale doc comment in `transactionFilterStorage.ts`.
- Updated `FrontEnd.UnitTests/utils/transactionDateRange.test.ts` for the rename and the new
  current-month entry - full `npm run test` suite (182 tests) passes; `npm run lint` and
  `npm run build` (incl. `vue-tsc`) both pass clean.
- Extended `FunctionalTests/tests/transactionListing.spec.ts`'s "Expanded date filters (UBE-78)"
  test with a case selecting the new current-month dropdown option; ran it against the real local
  stack (DynamoDB Local + Api + FrontEnd already running) - all 4 tests in the file pass.
- Committed and pushed; opened PR #74: https://github.com/dcamdupe/pim/pull/74
