# UBE-40 — Dashboard page - first 4 tiles

Linear: https://linear.app/uberconcept/issue/UBE-40/dashboard-page-first-4-tiles

## Description

Implement the first 4 KPI tiles on the (currently placeholder) Dashboard page, per the ticket's
own definitions - not the literal tiles shown in `docs/design/dashboard-mockup-calm.html` (that
mockup's KPI row shows Net worth/Income/Expenses/Savings rate; this ticket redefines the tiles as
Profit/Expenses-focused). The mockup is the source for visual/structural shape only (the `.kpi`
card grid, the delta-pill up/down styling), same as how UBE-55 used it for the transactions
filter bar - not for literal content.

Definitions (from the ticket):
- **Income** = all transactions with category `Income`, where `Inactive` is `false` or `null`.
- **Expenses** = all transactions with any category other than `Income` (uncategorized included -
  see "My calls"), where `Inactive` is `false` or `null`.
- **Profit** = Income − Expenses.

Tiles:
1. **"`<Month>` profit"** - current calendar month's profit, with a delta-pill (▲ green / ▼ red)
   comparing it to a previous-6-months baseline.
2. **"Previous 6 month profit"** - aggregate profit over the 6 full calendar months before the
   current month (e.g. on 3 Jul 2026: 1 Jan–30 Jun 2026). No icon.
3. **"`<Month>` Expenses"** - same as tile 1, for expenses.
4. **"Previous 6 month expenses"** - same as tile 2, for expenses. No icon.

## Current state

- `FrontEnd/src/views/DashboardView.vue` is a placeholder (`<h1>Dashboard</h1>` + one line of
  text) - route already wired at `/dashboard` in `FrontEnd/src/router/index.ts`.
- No backend aggregation endpoint exists. `GET /transactions` (already used by
  `TransactionsView.vue`) accepts an arbitrary `startDate`/`endDate` and has no upper-bound check
  against "today" - a single call spanning the full previous-6-months + current-month window (7
  calendar months) covers everything these tiles need.
- `Transaction.inactive: boolean | null` (`FrontEnd/src/services/transactionsService.ts`, from
  UBE-51) and `CATEGORIES` (`FrontEnd/src/constants/categories.ts`, includes the exact string
  `'Income'`) already exist and are exactly what these definitions need.
- `TransactionsView.vue` has a local, unexported `formatDateForApi(date): string` (→
  `YYYY-MM-DD`) - needed here too, so it's worth lifting to a shared location rather than
  duplicating it.
- This codebase's established pattern (UBE-55's `transactionFilters.ts`) is: pure, testable logic
  lives in `utils/`, gets real Vitest coverage; views stay thin and are covered by Playwright.

## My calls

- **Confirmed with David:**
  - The delta-pill's "% increase/decrease compared to the previous 6 months" baseline is the
    **average of the previous 6 months** (their total ÷ 6), not the raw 6-month total - the only
    reading that produces a meaningful "better/worse than a typical recent month" signal.
  - **Uncategorized transactions count as Expenses** - matches the ticket's literal wording ("any
    category other than income") and avoids under-counting real spending just because it hasn't
    been categorised yet.
- **No new backend endpoint.** Reuses `GET /transactions` for the whole 7-month window and does
  the bucketing/summing client-side, consistent with UBE-55's precedent of client-side
  computation over already-fetched data rather than growing the API surface for what's simple
  arithmetic.
- **No account-type filtering.** The ticket's definitions say "all transactions" with no mention
  of account type (e.g. excluding Savings accounts) - not adding a restriction it doesn't ask for.
- **Expenses displayed as a positive magnitude.** Expense-category transactions are naturally
  negative amounts (money out); summing them and negating gives a positive dollar figure to
  display (matching the mockup's "$4,300", not "-$4,300"), and makes `Profit = Income − Expenses`
  arithmetically correct as two positive-displayed numbers.
- **The green-up/red-down colour rule is applied literally and identically to both Profit and
  Expenses tiles**, exactly as the ticket states twice - even though "expenses increased" might
  intuitively read as bad news deserving red, the ticket doesn't say to invert it for the Expenses
  tile, so this isn't inverted.
- **Zero-baseline fallback:** when the previous-6-months average is exactly 0 (e.g. a brand new
  user with no historical data), percentage change is mathematically undefined - shows a neutral/
  flat indicator (reusing the mockup's already-defined `.delta-pill.flat` "—" style) rather than
  `Infinity`/`NaN`/a `0%` claim, none of which the ticket addresses but all of which need *some*
  defined behaviour.
- **No icon-badge glyph** (the small currency/chart icon square the mockup pairs with each
  delta-pill) - the ticket only asks for "the percentage increase/decrease... as an icon in the
  top right", which is the delta-pill itself; skipping the separate badge keeps scope to what's
  asked.
- **`formatDateForApi` lifted out of `TransactionsView.vue`** into a shared
  `FrontEnd/src/utils/dateFormat.ts`, since the dashboard needs the exact same `YYYY-MM-DD`
  formatting for its date-range query.
- **Tiles 2 & 4 render label + value only** (no `kpi-top` row at all) - literal reading of "do not
  display an icon".

## Plan

### FrontEnd

1. `FrontEnd/src/utils/dateFormat.ts` - new module, `formatDateForApi(date: Date): string`
   (moved from `TransactionsView.vue`, which switches to importing it).
2. `FrontEnd/src/utils/dashboardMetrics.ts` - new pure module:
   - `getCurrentMonthRange(today: Date)` / `getPreviousSixMonthsRange(today: Date)` → `{ start:
     Date, end: Date }`, calendar-month-aligned per the ticket's worked example.
   - `computeDashboardTiles(transactions: Transaction[], today: Date)` → `{ currentMonthProfit,
     currentMonthProfitDeltaPct, previousSixMonthsProfit, currentMonthExpenses,
     currentMonthExpensesDeltaPct, previousSixMonthsExpenses }` (delta fields `number | null`,
     `null` meaning "no baseline, show flat"). Buckets the already-fetched 7-month transaction
     list into current-month vs. previous-6-months, applies the Income/Expenses/Profit
     definitions above.
3. `FrontEnd.UnitTests/utils/dashboardMetrics.test.ts` - date-range boundary cases (the ticket's
   own 3 Jul 2026 example), income/expenses/profit arithmetic, `Inactive` exclusion (`true` only),
   uncategorized-counts-as-expense, zero-baseline → `null` delta, sign handling for a mixed
   refund/expense month.
4. `FrontEnd/src/views/DashboardView.vue` - replace the placeholder: fetch the 7-month window via
   `getTransactions`, run `computeDashboardTiles`, render the 4-tile grid (adapted from the
   mockup's `.kpi-row`/`.kpi` styling using this app's own CSS variables, not its raw tokens - same
   approach as `TransactionsView.vue`'s filter bar).

### Playwright

5. New `FunctionalTests/tests/dashboard.spec.ts` - upload transactions dated in the current month
   and in the previous-6-months window (Income + Expense categories, one inactive transaction to
   prove exclusion), confirm all 4 tile labels/values and the delta-pill direction/colour.

### Verify

6. `FrontEnd.UnitTests`: `npm run test`.
7. `FrontEnd`: `npm run build` / `npm run lint`.
8. `FunctionalTests`: `npm test`.
9. Real local run via `scripts/run_local.sh`.

## Checklist

- [x] 1. `dateFormat.ts` extracted, `TransactionsView.vue` switched to import it - `npm run build`
      clean
- [x] 2. `dashboardMetrics.ts` (date ranges + tile computation)
- [x] 3. `dashboardMetrics.test.ts` (9 cases: range boundaries incl. year-crossing, income/expense
      split, uncategorized-as-expense, `Inactive` exclusion, month bucketing, delta-vs-average,
      zero-baseline null, refund netting) - 58/58 pass
- [x] 4. `DashboardView.vue` - real 4-tile implementation - tile labels use the ticket's exact
      quoted strings verbatim (including its inconsistent capitalisation: "profit" lowercase on
      tile 1, "Expenses" capitalised on tile 3, "6 month" singular on tiles 2/4) - `npm run
      build`/`npm run lint` both clean
- [x] 5. Playwright: `dashboard.spec.ts` - asserts the *delta* each upload+categorisation causes
      (before/after tile parsing), not an absolute total, since the shared test dataset is never
      cleaned up between specs; covers current-month profit/expenses, previous-6-months
      profit/expenses, `Inactive` exclusion (the -999 expense is excluded), and that tiles 2/4
      never render a `.delta-pill`
- [x] 6. Verify: `FrontEnd.UnitTests` `npm run test` - 58/58 pass
- [x] 7. Verify: `FrontEnd` `npm run build` / `npm run lint` - both clean
- [x] 8. Verify: `FunctionalTests` `npm test` - 12/13 pass; the 1 failure is `settings.spec.ts`'s
      pre-existing, already-documented stale-account flakiness, unrelated
- [x] 9. Verify: real local run - restarted the stack via `scripts/run_local.sh`, ran the full
      Playwright suite against it, and took a screenshot of the 4 tiles rendering with real data.
      Observation (not a defect): the local "Expenses" tiles render negative against this
      session's heavily-reused dataset, because several large positive-amount, never-categorised
      transactions from earlier QIF-upload verification (UBE-50) count as Expenses per the agreed
      definition and outweigh the genuine negative ones - `Profit = Income − Expenses` still holds
      algebraically; the Playwright test's exact before/after delta assertions confirm the
      arithmetic itself is correct
- [x] 10. Fix: tiles without a delta (2 & 4) had their label/value sitting higher than tiles 1 & 3
      - my first attempt (an empty `.kpi-top` div with a guessed `min-height`) didn't actually
      match the real pill's rendered height. Fixed properly by extracting a reusable
      `FrontEnd/src/components/DashboardTile.vue`: it always renders a same-sized `.delta-pill`
      element (real content when `show-delta` is set, an invisible placeholder otherwise), so all
      4 tiles are pixel-identical above the label/value regardless of whether a delta is shown -
      guaranteed by literally being the same element, not a guessed spacer. `DashboardView.vue` now
      just renders 4 `<DashboardTile>`s. Updated `dashboard.spec.ts`'s "no icon" assertion from
      `.delta-pill` count 0 to `not.toBeVisible()`, since every tile now has one (hidden for
      tiles 2/4). Re-verified: `npm run build`/`lint` clean, `FrontEnd.UnitTests` 58/58,
      `FunctionalTests` 12/13 (same pre-existing unrelated flake), confirmed visually by David.

## Prompt Log

1. "start worklog on UBE-40" (sent mid-turn while UBE-59 was being wrapped up) - fetched the
   Linear issue, re-read the design mockup's KPI row for structural precedent, read the current
   placeholder `DashboardView.vue`, router config, and confirmed `Transaction.inactive`/
   `CATEGORIES` already have what these definitions need.
2. Asked two definitional questions before planning: the delta-pill's comparison baseline
   (average vs. total of the previous 6 months), and whether uncategorized transactions count as
   Expenses - confirmed: average, and yes count them.
3. "go" - implemented the full plan end to end (steps 1-9).
4. "Tiles 2 & 4 with no icon show the title and amount in the wrong location compared to the
   other tiles with icons." - first attempt (empty `.kpi-top` spacer div) didn't fully fix it.
5. "They're still not right... Create a vue component for dashboard tiles, then use that for the
   4 tiles" - extracted `DashboardTile.vue` with an always-present, visibility-toggled delta-pill
   placeholder, guaranteeing identical height across all 4 tiles (step 10 above).
6. "I've verified manually" - confirmed the fix visually; worklog closed out.
