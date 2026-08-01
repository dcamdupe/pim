# UBE-70: Add month filter to dashboard

Linear: https://linear.app/uberconcept/issue/UBE-70/add-month-filter-to-dashboard
Status: In Progress · Priority: No priority

## Description (from Linear)

Add a month filter to dashboard, showing all the months since the `MinTransactionDate.`

Changes:

* changing the filter will change data and charts for the dashboard. Current month data (tile 1,
  tile 3, Spending chart) will show the selected month. 6 month data (tile 2, tile 4, income vs
  expense) will show the 6 months prior to the selected month.
* text changes:
  * Tile 1 & 3 → `<month> profit` becomes `<month> <year> profit`, eg August 2026
  * Tile 4 → "previous 6 month expenses" becomes the month range (eg February 2026 - July 2026)
  * Income vs expenses → "Last 6 months" becomes the month range (eg February 2026 - July 2026)

**Clarified with David:** Tile 2 ("previous 6 month profit") isn't listed in the ticket's text
changes, but covers the same period as Tile 4 - confirmed it should get the same month-range
treatment as Tile 4 for consistency.

## Plan

This is a bigger change than UBE-61/62/63 - it touches both `Api` and `FrontEnd`, since
`MinTransactionDate` (added in UBE-47, tracked on `User`) isn't currently exposed to the frontend
anywhere.

### Api

1. Add `MinTransactionDate` to `SettingsResponse` (`Api/Controllers/SettingsController.cs`) - the
   simplest existing per-user endpoint to piggyback on, rather than a new controller/route.
2. Extend `Api.IntegrationTests/SettingsEndpointTests.cs` to cover the new field.

### FrontEnd

3. Update `settingsService.ts`'s `getSettings()` to return `{ accounts, minTransactionDate }`
   instead of just `Account[]`; update its one call site in `SettingsView.vue`.
4. Add pure helpers to `dashboardMetrics.ts`:
   - `computeAvailableMonths(minTransactionDate, today)` - the selectable months, from
     `minTransactionDate`'s month through the real current month, newest first.
   - `formatMonthYear(date)` / a `MONTH_NAMES` (full names) fixed array - same reasoning as the
     existing `MONTH_ABBREVIATIONS` fix: avoid `Intl`/`toLocaleDateString` so this is deterministic
     across environments.
   - `formatSixMonthRangeLabel(selectedMonth)` - "February 2026 - July 2026" style label for Tiles
     2 & 4 and the Income vs. expenses card.
   - Existing `getCurrentMonthRange`/`getPreviousSixMonthsRange`/`computeMonthlyIncomeExpenses`/
     `computeDashboardTiles`/`computeExpensesByCategory` already take an arbitrary reference `Date`
     (not hardcoded "today"), so they need no signature changes - just call them with the
     *selected* month instead of `new Date()`.
5. `DashboardView.vue`:
   - Add a `selectedMonth` ref (defaults to the real current month) and a month `<select>` (styled
     like `TransactionsView.vue`'s "Date range" select), populated from `computeAvailableMonths`.
   - Re-fetch transactions (the previous-6-months-through-current-month window) whenever
     `selectedMonth` changes, not just on mount.
   - Swap tile/chart labels to the new text per the ticket + the Tile 2 clarification above.
6. Functional test: change the month filter and confirm the tiles/charts update, and that the
   month-range labels render correctly.
7. Run `dotnet test`, FrontEnd unit tests, lint, and build; verify visually in the browser.

## Checklist

- [x] Add `MinTransactionDate` to `SettingsResponse` + integration test coverage
- [x] Update `settingsService.ts` / `SettingsView.vue` for the new response shape (also found and
      fixed a second `getSettings()` call site in `TransactionUploadView.vue`)
- [x] `computeAvailableMonths`, `MONTH_NAMES`, `formatSixMonthRangeLabel` in `dashboardMetrics.ts`
      + unit tests (33/33 passing; also derived `MONTH_ABBREVIATIONS` from `MONTH_NAMES` instead
      of duplicating it)
- [x] Month filter `<select>` + `selectedMonth` state in `DashboardView.vue`
- [x] Re-fetch on month change; wire selected month through tiles/charts
- [x] Tile/chart label text changes (incl. Tile 2) - verified visually in browser, light + dark;
      also fixed the pre-existing `dashboard.spec.ts` test to use positional tile lookups since
      tiles 2 & 4 now render identical label text
- [x] Functional test for changing the month filter
- [x] `dotnet test`, `npm run lint` / `vue-tsc -b` build, `FrontEnd.UnitTests` all pass
      (108 Api tests, 88 FrontEnd unit tests)
- [x] Manual browser check (light + dark mode)

### Full Playwright suite

Ran the full suite to check for regressions from the tile label text change. Found and fixed a real
regression in `internalTransfer.spec.ts` (it looked up tiles by the old `"<Month> Expenses"` label
text, which no longer exists now that tile labels include the year and tiles 1/3 share a label).
Two other failures (`settings.spec.ts`, and both `transactionCategorization.spec.ts` bulk-apply
tests) were confirmed **pre-existing** by stashing all UBE-70 changes and re-running against clean
`main` - `settings.spec.ts` is already documented as flaky; the `transactionCategorization.spec.ts`
failures are a newly-confirmed pre-existing issue, unrelated to this change.

## Prompt log

- "start a worklog for UBE-70"
- "Yes, same as Tile 4" (Tile 2 label clarification)
