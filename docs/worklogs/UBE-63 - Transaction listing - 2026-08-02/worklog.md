# UBE-63: Add Transaction listing to the dashboard

Linear: https://linear.app/uberconcept/issue/UBE-63/add-transaction-listing-to-the-dashboard
Status: In Progress · Priority: No priority

## Description (from Linear)

See design: dashboard-mockup-calm.html

Display the last 20 transactions.

This should be a readonly list of transactions, you should not be able to change the category of
the transactions.

## Plan

Follow the same pattern established by UBE-61/UBE-62's dashboard cards: a small, focused
`dashboardMetrics.ts` helper + a presentational component + wiring into `DashboardView.vue`,
reusing transactions already fetched for the dashboard (no new API call).

1. Add `computeRecentTransactions(transactions, limit = 20)` to `FrontEnd/src/utils/dashboardMetrics.ts`
   — sorts by date descending (stable sort, so same-day order is preserved) and returns the top
   `limit`. Reuses the same 6-month window the dashboard already fetches; not a new API call.
2. Unit tests for `computeRecentTransactions` (ordering, limit, tie-breaking, empty input).
3. New `FrontEnd/src/components/RecentTransactionsList.vue` — readonly row list ported from the
   mockup's `.recent-row` styling (avatar initial, description, date · account, category chip or
   "Uncategorized", amount in green when positive). No category `<select>` — explicitly read-only
   per the ticket.
4. Wire into `DashboardView.vue` as a new full-width "Recent transactions" card below `charts-row`,
   with a "View all →" link to `/transactions` (mirrors the mockup's `recent-card`).
5. Add a Playwright scenario confirming an uploaded/categorised transaction shows up in the
   dashboard's recent list and that there's no way to change its category from there.
6. Run FrontEnd unit tests, lint, and build; verify visually in the browser (light + dark).

## Checklist

- [x] Add `computeRecentTransactions` to `dashboardMetrics.ts`
- [x] Unit tests for `computeRecentTransactions`
- [x] `RecentTransactionsList.vue` component
- [x] Wire into `DashboardView.vue`
- [x] Functional test for the recent-transactions flow
- [x] `npm run lint` / `vue-tsc -b` build clean
- [x] `FrontEnd.UnitTests` pass (86/86)
- [x] Manual browser check (light + dark mode) - exactly 20 rows, readonly, correct chips/amounts

## Prompt log

- "start worklog for UBE-63"
- "start work"
