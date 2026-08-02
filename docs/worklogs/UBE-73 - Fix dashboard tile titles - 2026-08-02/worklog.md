# UBE-73: Fix dashboard tile titles

Linear: https://linear.app/uberconcept/issue/UBE-73/fix-dashboard-tile-titles
Status: In Progress · Priority: No priority

## Description (from Linear)

* Add a new top left (eg Profit/Expenses)
* Change the 6 month calculation to average and add that into the label
* Remove expenses or profile ["profit"] from the Label above the amount

## Current state

The 4 KPI tiles (`DashboardTile.vue`, wired up in `DashboardView.vue`):

1. `<Month> <Year> profit` - current month profit
2. `<six-month range>` (e.g. "February 2026 - July 2026") - previous 6 months profit, shown as a
   **total**, not an average
3. `<Month> <Year> Expenses` - current month expenses
4. `<six-month range>` - previous 6 months expenses, also a **total**

`DashboardTile.vue`'s `.kpi-top` row currently only holds the right-aligned delta pill - there's no
"what metric is this" indicator on the tile at all beyond the label text itself.

## My interpretation of the 3 bullets (flagging for confirmation before I start)

1. **"Add a new top left"**: a small top-left kicker/eyebrow on every tile reading "Profit" (tiles
   1 & 2) or "Expenses" (tiles 3 & 4), sitting opposite the existing delta pill in `.kpi-top`.
2. **"Change the 6 month calculation to average"**: tiles 2 & 4 switch from a 6-month *total* to a
   6-month *average* (÷6), and their label gets an "Average" prefix - e.g.
   `Average · February 2026 - July 2026`.
3. **"Remove expenses/profit from the label above the amount"**: tiles 1 & 3's label drops the
   trailing "profit"/"Expenses" word, becoming just `<Month> <Year>` - the new top-left kicker
   (bullet 1) now carries that information instead, so tiles 1 & 3 (and 2 & 4) end up with
   identical label text, differentiated only by the kicker - same pattern already used for tiles 2
   vs 4 today.

## Plan

1. `DashboardTile.vue`: add a `kicker` prop, rendered top-left in `.kpi-top` (which becomes
   `justify-content: space-between` instead of `flex-end`).
2. `dashboardMetrics.ts`: `computeDashboardTiles` - divide `previousSixMonthsProfit`/
   `previousSixMonthsExpenses` by 6 before returning (rename the interface fields to
   `previousSixMonthsProfitAverage`/`previousSixMonthsExpensesAverage` for clarity). Simplify
   `percentChangeVsAverage` to take the already-computed average directly (drop the `months` param
   and the internal `/months` division) - the current-month-vs-previous-6-months delta on tiles 1 &
   3 was already comparing against an average internally, so this is a refactor, not a numeric
   behaviour change for the delta.
3. `DashboardView.vue`: wire up the new `kicker` prop and updated labels for all 4 tiles; use the
   renamed `*Average` fields for tiles 2 & 4's value.
4. Update `dashboardMetrics.test.ts` for the renamed fields/averaging behaviour.
5. Update `FunctionalTests/tests/dashboard.spec.ts` - the "Dashboard tiles" test's prior-
   profit/expenses delta assertions need dividing by 6 (average, not total) to still pass; the
   "Month filter" test's `page.getByText(...)` label assertions (`` `${monthYearLabel} profit` ``)
   need updating since that exact text no longer exists.
6. `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests`; re-run the affected Playwright specs;
   manual browser check, light + dark.

## Checklist

- [x] `DashboardTile.vue` `kicker` prop + layout
- [x] `computeDashboardTiles` averaging + `percentChangeVsAverage` refactor
- [x] Wire up `DashboardView.vue` (kickers, updated labels, renamed average fields)
- [x] Update `dashboardMetrics.test.ts` (39/39 passing; full suite 98/98)
- [x] Update `dashboard.spec.ts` (both the tiles-delta test and the month-filter label assertions) -
      had to widen the profit/expenses delta assertions to a ±$1 tolerance, since the tile now
      displays a rounded-to-whole-dollars *average* and before/after are each independently
      rounded before the delta is taken
- [x] Manual browser check, light + dark - all 4 tiles render as designed: "PROFIT"/"EXPENSES"
      kickers top-left, "August 2026" labels on tiles 1 & 3, "Average · February 2026 - July 2026"
      on tiles 2 & 4 with the correctly-divided average value
- [x] `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests` pass (98/98); "Dashboard tiles" and
      "Month filter" Playwright specs pass (the unrelated "Recent transactions" spec failure is the
      already-documented pre-existing dataset-size issue)

## Prompt log

- "start a worklog on UBE-73"
