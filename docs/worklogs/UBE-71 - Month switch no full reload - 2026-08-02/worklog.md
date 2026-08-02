# UBE-71: Switching the dashboard month should not reload the page

Linear: https://linear.app/uberconcept/issue/UBE-71/switching-the-dashboard-month-should-not-reload-the-page
Status: In Progress · Priority: No priority

## Description (from Linear)

This should just reload the individual tiles and charts. While these are loading display an in
progress spinner for the charts.

## Current behaviour (the bug)

`DashboardView.vue` gates its *entire* content (KPI tiles, both charts, and the recent-transactions
card) behind a single `v-if="loading"`. `fetchTransactionsForSelectedMonth()` sets `loading = true`
on every call, including the one triggered by `watch(selectedMonthKey, ...)` when the month filter
changes - so picking a new month currently blanks the whole page back to a "Loading dashboard…"
message, not just a page navigation, but effectively the same jarring experience.

## Plan

1. Split the single `loading` flag into two:
   - `initialLoading` - true only until the very first fetch (on mount) resolves. While true, keep
     today's full-page "Loading dashboard…" / error behaviour (there's nothing to show yet).
   - `chartsLoading` - true while a *subsequent* fetch (triggered by a month change) is in flight.
2. Add an `appliedMonthKey` ref that only updates to match `selectedMonthKey` once the fetch for
   that month has resolved. All the data `computed()`s (`tiles`, `expensesByCategory`,
   `monthlyIncomeExpenses`, the tile/chart labels) key off `appliedMonth`, not the live
   `selectedMonth` - this keeps every number/label on screen internally consistent (never a
   half-updated mix of the new month's label with the old month's figures) while the new data
   loads, and means a failed fetch just leaves everything at its last-good state with no extra
   handling needed.
3. Template: KPI tiles and the recent-transactions card stay mounted and visible at all times past
   the initial load (no more page-wide blanking). While `chartsLoading`, dim the KPI row slightly
   as a light "refreshing" cue.
4. Add a small reusable `LoadingSpinner.vue` and show it *in place of* each chart component
   (`SpendingByCategoryChart` / `IncomeVsExpensesChart`) while `chartsLoading` is true, per the
   ticket's explicit ask - swapping back to the real chart once the new month's data has loaded.
5. Disable the month `<select>` while a fetch is in flight (initial or subsequent), so rapid
   switching can't queue overlapping requests.
6. Verify manually in the browser - throttle the network (or add a brief artificial delay locally)
   to actually observe the spinner, since a real request against local DynamoDB is normally too
   fast to see.
7. `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests`; re-run the existing "Month filter"
   Playwright scenario (`dashboard.spec.ts`) to confirm it still passes end-to-end.

## Checklist

- [x] Split `loading` into `initialLoading` / `chartsLoading`; add `appliedMonthKey`/`appliedMonth`
- [x] Keep KPI tiles + recent-transactions visible past initial load; dim tiles while reloading
- [x] `LoadingSpinner.vue` shown in place of each chart while `chartsLoading` (also added a
      chart-specific error state so a failed month-switch fetch doesn't hide the rest of the page)
- [x] Disable month `<select>` while a fetch is in flight
- [x] Manual browser check (with an artificial delay to actually see the spinner), light + dark -
      confirmed via a throwaway Playwright route-interception script: mid-flight, both charts show
      spinners, KPI row dims to 0.6 opacity while still showing the *previous* month's values, the
      month `<select>` is disabled, and everything (labels + tiles + charts) flips together to the
      new month once the fetch resolves - no full-page blanking at any point
- [x] `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests` pass (98/98)
- [x] Existing "Month filter" + "Dashboard tiles" Playwright scenarios still pass (the unrelated
      "Recent transactions" spec failure is the already-documented pre-existing dataset-size issue)

## Prompt log

- "star worklog for UBE-71"
