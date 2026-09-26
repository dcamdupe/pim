# UBE-114: Implement a category filter to Income vs. expenses

Linear: https://linear.app/uberconcept/issue/UBE-114/implement-a-category-filter-to-income-vs-expenses

## Description

> Add a dropdown filter that changes what what is displayed in this chart

The dashboard's "Income vs. expenses" chart (`FrontEnd/src/components/IncomeVsExpensesChart.vue`,
rendered from `FrontEnd/src/views/DashboardView.vue`) currently shows income/expense totals per
month across all transactions. This adds a category filter dropdown so the chart can be narrowed
to a single category (or "All categories").

## Plan

1. **Data layer**: extend `computeMonthlyIncomeExpenses` (`FrontEnd/src/utils/dashboardMetrics.ts`)
   to accept an optional category filter, restricting the transactions bucketed into each month's
   income/expense totals to that category before summing.
2. **UI**: add a native `<select v-model="selectedCategory" aria-label="Category filter">` to
   `DashboardView.vue` next to the existing month filter, populated via `categoryNames()` from
   `FrontEnd/src/services/categoriesService.ts` (same pattern already used in
   `TransactionsView.vue`), with an "All categories" default option.
3. **State**: track `selectedCategory` as a ref in `DashboardView.vue`, pass it into
   `computeMonthlyIncomeExpenses`, and persist the selection the same way the month filter is
   persisted (`utils/dashboardFilterStorage.ts`).
4. **Tests**:
   - `FrontEnd.UnitTests`: cover the new filter parameter on `computeMonthlyIncomeExpenses`
     (mirrors existing tests in `FrontEnd.UnitTests/utils/dashboardMetrics.test.ts`).
   - `FunctionalTests`: add/extend a Playwright scenario on the dashboard spec to select a category
     and assert the chart updates.
5. Update the checklist below as each step completes.

## Checklist

- [x] Extend `computeMonthlyIncomeExpenses` with an optional category filter
- [x] Add category filter dropdown to `DashboardView.vue`
- [x] Wire up `selectedCategory` state + persistence
- [x] Add/extend unit tests in `FrontEnd.UnitTests`
- [x] Add/extend Playwright scenario in `FunctionalTests`
- [x] `npm run lint` clean in `FrontEnd/`
- [x] `npm run test` clean in `FrontEnd.UnitTests/`

## Session log

**Prompt:** start a worklog for UBE-114

- Authenticated to Linear MCP, retrieved UBE-114 details.
- Explored `FrontEnd/` to find the existing "Income vs. expenses" chart, its data source, and the
  existing category-filter pattern used on `TransactionsView.vue`.
- Created this worklog with plan + checklist, created branch
  `UBE-114/category-filter-income-vs-expenses` off `main` (via `gh api` + fetch/checkout), and
  presented the plan for confirmation.

**Prompt:** start work

- Extended `computeMonthlyIncomeExpenses` (`dashboardMetrics.ts`) with an optional `category` param.
- Extended `DashboardFiltersState` (`dashboardFilterStorage.ts`) to persist `category` alongside
  `month`.
- Added the category filter `<select>` to `DashboardView.vue`'s "Income vs. expenses" card, wired
  to a new `selectedCategory` ref, persisted the same way as the month filter.
- Added/extended unit tests in `FrontEnd.UnitTests` (`dashboardMetrics.test.ts`,
  `dashboardFilterStorage.test.ts`) - all 213 pass.
- `npm run lint` and `npm run build` clean in `FrontEnd/`.
- Added a new Playwright scenario in `FunctionalTests/tests/dashboard.spec.ts` ("Income vs.
  expenses category filter"), asserting the chart's expense total for the current month changes
  by exactly the amount of a newly-uploaded, category-tagged transaction (delta-based, per the
  suite's convention for its shared, never-cleaned-up test dataset).
- Found and fixed a real bug while writing that test: `categories` in `DashboardView.vue` was a
  plain `categoryNames()` call captured once at setup time, before `settingsStore.load()` (fired
  in the same component's `onMounted`) resolves - so the dropdown had no options on first load.
  Changed it to `computed(() => categoryNames())` so it reacts once settings load.
- Started the local stack manually to run the functional test (DynamoDB Local via
  `scripts/setup_local.sh`, `Api` via `dotnet run --project Api --launch-profile https` - the
  `http`-only profile doesn't match `FrontEnd/.env`'s `https://localhost:7010`). All 5 specs in
  `dashboard.spec.ts` pass. Stopped the manually-started `Api` process afterward.

All checklist items complete.
