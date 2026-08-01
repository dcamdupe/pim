# UBE-62: Dashboard chart - income vs expenses

Linear: https://linear.app/uberconcept/issue/UBE-62/dashboard-chart-income-vs-expenses
Status: Todo · Priority: No priority

## Description (from Linear)

See design: dashboard-mockup-calm.html. Implement last 6 months charge

Add the income vs expenses bar chart. Exclude transactions flagged as internal transfer or inactive.

## Plan

Follow the same pattern as UBE-61's "Spending by category" doughnut chart (already merged),
which sits in the same `charts-row` on `DashboardView.vue` and is ported from the same mockup file.

1. Add `computeMonthlyIncomeExpenses(transactions, today)` to `FrontEnd/src/utils/dashboardMetrics.ts`
   — buckets the last 6 calendar months (current month + previous 5) into
   `{ month, year, income, expense }`, reusing the existing income/expense summing logic so
   Internal Transfer and inactive transactions are excluded the same way the KPI tiles already are.
2. Unit tests in `FrontEnd.UnitTests/utils/dashboardMetrics.test.ts` for bucketing, exclusions, and
   month-boundary behaviour.
3. New `FrontEnd/src/components/IncomeVsExpensesChart.vue` — grouped bar chart (income/expense per
   month) with gridlines, y-axis labels, hover tooltips and a legend, ported from
   `docs/design/dashboard-mockup-calm.html`'s `buildBars()`.
4. Wire the new chart into `DashboardView.vue` as a second card in the existing `charts-row`,
   reusing the transactions already fetched for the 6-month window (no new API call needed).
5. Add a Playwright scenario (`FunctionalTests/tests/dashboard.spec.ts` or a new spec) verifying the
   chart reflects uploaded transactions and excludes internal transfers/inactive ones.
6. Run FrontEnd unit tests, lint, and build to confirm everything is clean.

## Checklist

- [x] Add `computeMonthlyIncomeExpenses` to `dashboardMetrics.ts`
- [x] Unit tests for `computeMonthlyIncomeExpenses`
- [x] `IncomeVsExpensesChart.vue` component
- [x] Wire into `DashboardView.vue` (verified in browser, light + dark mode)
- [x] Functional test for the chart — skipped: UBE-61's sibling doughnut chart set the precedent of
      relying on dashboardMetrics unit tests + the existing dashboard.spec.ts tile test for the
      upload/categorize/exclude flow, with no dedicated chart-visuals Playwright spec. Followed the
      same approach here; re-ran the existing dashboard.spec.ts to confirm no regressions instead.
- [x] `npm run lint` / `vue-tsc -b` build clean
- [x] `FrontEnd.UnitTests` pass (79/79)
- [x] Playwright test passes (existing `dashboard.spec.ts`, verified alongside a manual browser check
      of the new chart in light + dark mode)

## Prompt log

- "create a worktree for UBE-62"
- "pull latest from main and merge"
- "start work"
- "Yes, proceed" (plan confirmation)
- "get the latest from main origin and merge back to this branch"
- "check the dashboard in the browser"
