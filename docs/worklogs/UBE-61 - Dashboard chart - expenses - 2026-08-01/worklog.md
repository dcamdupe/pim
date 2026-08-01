# UBE-61: Dashboard chart - expenses by category

Linear: https://linear.app/uberconcept/issue/UBE-61/dashboard-chart-expenses-by-category

## Description

Add the "expenses by category" doughnut chart to the dashboard (labeled
"Spending by category" in `docs/design/dashboard-mockup-calm.html`). It should
display the real expense categories in both the chart and its legend, and
must exclude internal transfers and transactions tagged as inactive.

## Current state (from investigation)

- `FrontEnd/src/views/DashboardView.vue` — currently renders only the KPI
  tile row (`kpi-row`) built in UBE-40. The mockup's `charts-row` (doughnut +
  bar chart cards) hasn't been built yet; this worklog covers the doughnut
  card only.
- `FrontEnd/src/utils/dashboardMetrics.ts` — already has the filtering
  precedent to follow: `isCounted()` excludes `transaction.inactive`, and
  `sumExpenses()` excludes `category === 'Income'` and
  `category === 'Internal Transfer'`. Also has `getCurrentMonthRange()` and
  the `DateRange` type to reuse for scoping the chart to the current month.
- `FrontEnd/src/constants/categories.ts` — single source of truth for
  `CATEGORIES` and `CATEGORY_COLORS` (ported from the mockup's `catColor`
  map), including `Internal Transfer`. Use this for chart segment colors
  rather than inventing new ones.
- No charting library is installed (`FrontEnd/package.json` has no
  chart/d3/apex/recharts dependency). The mockup builds the doughnut by hand
  as raw SVG arcs (`docs/design/dashboard-mockup-calm.html` lines ~458-513,
  `buildDoughnut()`), with a separate legend built from the same data. Plan
  is to follow that approach in a Vue component rather than adding a new
  dependency.
- `FrontEnd/src/views/DashboardView.vue` renders inside a `.dashboard-page`
  wrapper; the mockup's `.charts-row`/`.card`/`.doughnut-wrap`/`.legend`
  classes give the layout/styling to port over (scoped to the new component).
  The actual app's design tokens are `--text`/`--text-h`/`--bg`/`--border`
  (see `FrontEnd/src/style.css`), not the mockup's `--ink`/`--surface`/etc,
  so styling is ported using the app's real tokens (following the precedent
  already set in `DashboardTile.vue`).

## Plan

1. Add a category-aggregation function (e.g. `computeExpensesByCategory`) to
   `FrontEnd/src/utils/dashboardMetrics.ts`, scoped to the current month,
   reusing `isCounted`/`getCurrentMonthRange` and excluding `Internal
   Transfer` the same way `sumExpenses` does. Returns per-category totals,
   percentages of the total, and is sorted descending by value (matching the
   mockup's `spendData` shape: `label`, `value`, `pct`, `hex` via
   `categoryColor()`).
2. Add unit tests for the new function in `FrontEnd.UnitTests` (extending
   `dashboardMetrics.test.ts`) — covers exclusion of inactive transactions,
   exclusion of Internal Transfer/Income, current-month scoping, and
   percentage/sort correctness.
3. Build a new component (e.g. `SpendingByCategoryChart.vue`) that takes the
   aggregated data and renders the SVG doughnut + legend, following the
   mockup's `buildDoughnut()` arc math and `.doughnut-wrap`/`.legend`
   styling, with per-segment tooltips/hover per the mockup if practical.
4. Wire the new component into `DashboardView.vue` inside a `.charts-row` /
   `.card` matching the mockup, with the card subtitle showing the current
   month + total (e.g. "July 2026 · $4,300 total").
5. Handle the empty-state (no expense transactions this month) reasonably
   (e.g. don't render a broken/empty ring).
6. Manually verify in the browser: correct categories/amounts/percentages,
   Internal Transfer and inactive transactions excluded, legend matches
   chart colors.
7. Run `npm run lint` and `npm run build` in `FrontEnd/`, and `npm run test`
   in `FrontEnd.UnitTests/`.
8. Consider whether a `FunctionalTests` (Playwright) scenario is warranted.

## Checklist

- [x] Add `computeExpensesByCategory` (or similar) to `dashboardMetrics.ts`
- [x] Add unit tests covering exclusions, scoping, percentages, sort order
- [x] Build `SpendingByCategoryChart.vue` (SVG doughnut + legend, no new
      dependency) — uses native SVG `<title>` elements for hover tooltips
      rather than the mockup's custom JS tooltip, to keep it simple
- [x] Wire chart into `DashboardView.vue`'s new `.charts-row` card
- [x] Handle empty-state (no expenses this month) — shows "No expenses this
      month." in place of the ring/legend
- [ ] Manually verify in browser (categories, amounts, exclusions, legend
      colors)
- [x] Run FrontEnd lint/build and FrontEnd.UnitTests — all pass (73/73 unit
      tests, lint clean, build succeeds)
- [ ] Add/confirm FunctionalTests scenario (if warranted)

## Notes

- Origin/main picked up UBE-52 (internal transfers, PR #38) mid-worklog;
  fast-forward merged into this branch with no conflicts.
- Hit a tooling mistake partway through: a batch of edits (the first pass at
  `dashboardMetrics.ts`/`dashboardMetrics.test.ts`/this worklog file) used
  file paths without the worktree prefix and landed in the main checkout
  instead of this worktree. Caught it when the build failed with missing
  exports. Re-applied all the changes correctly in this worktree; the stray
  edits in the main checkout were left for David to clean up rather than
  touched further.

## Prompt log

1. "start a worktree for UBE-61"
2. "yes, start the worklog"
3. "go"
4. "yes, continue"
5. [tool rejected: attempted to inspect the main checkout directory]
6. "get the latest from main and merge the changes in here"
