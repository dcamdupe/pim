# UBE-124: Add budget tiles on the dashboard

## Linear issue

https://linear.app/uberconcept/issue/UBE-124/add-budget-tiles-on-the-dashboard

> 2 New tiles below **Spending by category and Income vs. expenses**
>
> * Current month projection
>   * Show a bar chart of budget vs actuals for the current month, projected forward based on the
>     current spend this month
> * performance over the past 6 months
>   * Show a bar chart, month by month for budget vs actual for the past 6 months.
>   * Add a dropdown filter to show either all categories or to select a single category
>
> Add into iOS as well as web application

## Description

Adds two budget cards to the dashboard, in a new row under "Spending by category" and
"Income vs. expenses", on web (`FrontEnd/src/views/DashboardView.vue`) and iOS
(`iosApp/iosApp/Views/Dashboard/`). Budgets come from `GET /budgets` (UBE-119). Actuals are
worked out on the client from the transactions the dashboard has already loaded, using the same
expense rules as the existing metrics in `dashboardMetrics.ts`: net spend, and ignored
transactions are skipped.

## Plan

**Behaviour (confirmed 2026-11-01):**
1. **Selected month:** both cards follow the dashboard's month picker, like the existing cards.
2. **Projection card:** one row per **budgeted** category.
   - **Bars:** each row shows the budget, the actual spend so far, and a projection for the month.
   - **Projection formula:** actual so far ÷ days elapsed × days in month.
   - **Over budget:** bars where the projection goes over budget are highlighted in red.
   - **Total:** the card shows "Projected $X of $Y budget".
   - **Past month selected:** there's no projection; the card shows the final actual vs budget.
3. **6-month card:** grouped bars (budget vs actual) for the 6 months **ending with the
   selected month**, matching the Income vs. expenses chart.
   - **Current month:** shown as actual so far, not projected.
   - **Filter:** a dropdown with "All budgeted categories" or a single budgeted category. "All"
     compares the sum of budgets with the actual spend in budgeted categories only.
4. **No budget history:** budgets aren't versioned, so today's budget amounts are used for every
   past month.
5. **No budgets set:** both cards show "No budgets set" with a link to the Budgets tab.

**Steps**
1. **Web**
   - **Metrics:** `utils/budgetMetrics.ts`, pure functions with unit tests:
     - `computeBudgetProjection(transactions, budgets, selectedMonth, today)`
     - `computeMonthlyBudgetVsActual(transactions, budgets, selectedMonth, category)`
   - **Charts:** `BudgetProjectionChart.vue` (horizontal bars with a budget marker) and
     `BudgetVsActualChart.vue` (grouped bars, styled like `IncomeVsExpensesChart.vue`), both SVG
     with no new library.
   - **Dashboard:** fetch the budgets in `DashboardView.vue`, add a new card row and the
     category dropdown, and store the filter with the other dashboard filters.
   - **Tests:** FrontEnd.UnitTests for the metrics, plus `dashboard.spec.ts` checks that seed
     budgets and check both cards render (and that the filter changes the chart).
2. **iOS**
   - **Metrics:** `Utils/BudgetMetrics.swift`, a port of the web metrics.
   - **View model:** `DashboardViewModel` loads the budgets.
   - **Charts:** `BudgetProjectionChart.swift` and `BudgetVsActualChart.swift`, styled like the
     existing chart views.
   - **Dashboard:** add the cards and a category menu to `DashboardView`, and register the new
     files in `project.pbxproj`.
   - **Check:** an `xcodebuild` simulator build.
3. **Checks:** FrontEnd build/lint, unit tests, the dashboard Playwright spec, and the iOS build.
   There are no Api changes.

## Checklist

- [x] Web: `budgetMetrics.ts` + unit tests
- [x] Web: projection chart component
- [x] Web: 6-month budget vs actual chart component
- [x] Web: dashboard cards, budgets fetch, category filter
- [x] Web: Playwright checks (new `dashboardBudgets.spec.ts`)
- [x] iOS: `BudgetMetrics.swift` + view model budgets load
- [x] iOS: projection + 6-month charts, dashboard cards, category menu
- [x] Checks: FrontEnd build/lint/unit, Playwright, iOS build

## Results

- **Web:**
  - `utils/budgetMetrics.ts` (`computeBudgetProjection`, `computeMonthlyBudgetVsActual`).
  - `BudgetProjectionChart.vue`: HTML bars, with spent solid, projected light and a budget marker.
  - `BudgetVsActualChart.vue`: an SVG grouped bar chart. Axis labels only switch to "k" from
    $1k, since budgets are often smaller.
  - `DashboardView.vue`: a new card row, a non-fatal `getBudgets()` fetch, and a "Budget
    performance category" dropdown stored in `dashboardFilterStorage` (`budgetCategory`, optional
    so older stored filters still load).
- **iOS:**
  - `Utils/BudgetMetrics.swift` (port).
  - `BudgetProjectionChart.swift`, `BudgetVsActualChart.swift`.
  - `DashboardViewModel` loads the budgets (non-fatal) and keeps the category filter in
    UserDefaults.
  - `DashboardView` cards + a category menu.
  - `AppTabView` passes a `PimApiClient`, and the new files are registered in `project.pbxproj`.
- **Playwright:** added a new `dashboardBudgets.spec.ts` instead of extending `dashboard.spec.ts`.
  - My first dropdown label ("Budget category filter") collided with the existing
    `getByLabel('Category filter')` in `dashboard.spec.ts`, so I renamed it to
    "Budget performance category".
  - Fixed a load race in the `budgets.spec.ts` clear helper: it now waits for the inputs before
    clearing.
- **Checks:**
  - FrontEnd build/lint clean; FrontEnd.UnitTests 251 passing.
  - Playwright `dashboardBudgets` + `budgets` + `dashboard` specs 7/7 passing.
  - iOS simulator build succeeds (not run manually). No Api changes.

## Log

### Prompt
start a worklog for UBE-124

### Response
Fetched UBE-124 (no comments), reviewed the web and iOS dashboards, chart components and metrics.
Created branch `UBE-124/add-budget-tiles-on-dashboard` off `main` and this worklog. Asked to
confirm the plan and the behaviour choices.

### Prompt
start work

### Response
Plan and behaviour choices confirmed; starting implementation.
Implemented web + iOS per the plan. Fixed a label collision and a test-helper race found while
running specs. All checks pass. Not committed.

### Prompt
merge main into this branch

### Response
Stashed the uncommitted UBE-124 changes, fast-forwarded to `origin/main` (#105, budget
recommendations), and re-applied the stash cleanly. Made the merged UBE-123 test's "Budgets" link
selector exact, since the dashboard's new "Set budgets" links also match it. A first Playwright run
failed every login with "Invalid login or password" (cause not identified; the Api login worked
via curl). A re-run passed 8/8. FrontEnd build/lint, 253 unit tests, Release `dotnet build` and the
iOS build pass. Not committed.

### Prompt
remove the over budget option in the Budget Performance chart

### Response
Removed the "Over budget" legend item and red over-budget bar colour from the 6-month chart on web
(`BudgetVsActualChart.vue`) and iOS (`BudgetVsActualChart.swift`). Actual bars are always blue
now. The month projection card's red over-budget rows are unchanged. FrontEnd build/lint,
`dashboardBudgets.spec.ts` and the iOS build pass. Not committed.

### Prompt
Adjust the title from Budget vs actual to "Month Budget"

### Response
Renamed the projection card's past-month title from "Budget vs actual" to "Month Budget" on web
and iOS ("Month projection" for the current month is unchanged). FrontEnd build/lint and iOS
build pass. Not committed.

### Prompt
re-run the tests

### Response
All passing: .NET 114 unit + 88 integration (Release); FrontEnd.UnitTests 253; Playwright
`dashboardBudgets`, `budgets` and `dashboard` specs 8/8.

### Prompt
Run the playwright suite

### Response
39/40 passed. `transactionListing.spec.ts` "shows uploaded transactions and filters by date range"
failed. A re-run on its own failed at the Settings save with "Account names must be unique": the
first run's failure left a stale "Playwright Listing Account" on the shared test user (its
cleanup never ran). This is test-data state, not a change from this branch. The first run's own
failure (a `toBeVisible` assertion) wasn't investigated further.

### Prompt
commit and raise PR as draft

### Response
Committed, pushed and opened a draft PR against main.
