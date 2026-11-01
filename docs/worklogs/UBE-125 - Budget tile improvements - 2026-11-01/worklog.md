# UBE-125: Budget tile improvements

## Linear issue

https://linear.app/uberconcept/issue/UBE-125/budget-tile-improvements

> * **Budget performance**
>   * Change the colours to match **Income vs. expenses**
>   * Change "All Budgeted Categories" to "All Categories"
> * **Month Budget**
>   * Add a filter at the top right with options:
>     * Top 5 Spend - when selected, display the top 5 items by spend for that month
>       * This should be the default option
>     * Over Budget - when selected, display the items that are projected to be over budget
>     * Under Budget - when selected, display the items that are projected to be under budget

## Description

Follow-up to UBE-124's dashboard budget cards (merged in #106), on web
(`FrontEnd/src/views/DashboardView.vue`, `BudgetVsActualChart.vue`, `BudgetProjectionChart.vue`)
and iOS (`DashboardView.swift`, `BudgetVsActualChart.swift`, `BudgetProjectionChart.swift`).

## Plan

**Behaviour (confirmed 2026-11-01):**
1. **Budget performance colours:** Budget uses the Income vs. expenses chart's income blue
   (`#2a78d6`), and Actual uses its expenses orange (`#eb6834`). On iOS that's
   `DashboardTheme.incomeColor` / `expenseColor`.
2. **Filter label:** the first option becomes "All Categories" (web dropdown and iOS menu).
3. **Month Budget filter:** a dropdown at the top right of the card (iOS: a menu), like Budget
   performance.
   - **Top 5 Spend** (default): the 5 budgeted categories with the highest actual spend for the
     month, highest first.
   - **Over Budget:** categories whose projection (or final actual for a past month) is over
     budget, largest overspend first.
   - **Under Budget:** categories at or under budget, highest spend first.
   - **Empty filter:** if nothing matches, show "No categories over budget" / "No categories
     under budget".
   - **Remembered:** the choice is stored like the other dashboard filters (web localStorage,
     iOS UserDefaults).
   - **Totals:** the card's "Projected $X of $Y" line still covers **all** budgeted categories,
     not just the filtered rows.
4. **Platforms:** both web and iOS, since UBE-124 added the cards to both.

**Steps**
1. **Web**
   - **Filter logic:** `filterProjectionRows(rows, mode)` in `budgetMetrics.ts`, with unit tests.
   - **Month Budget card:** a `card-head` dropdown, wired up through `dashboardFilterStorage`
     (optional `budgetProjectionFilter`), plus storage tests.
   - **Budget performance:** colours in `BudgetVsActualChart.vue` and the option label.
   - **Playwright:** update `dashboardBudgets.spec.ts` for the new label, and check the Month
     Budget filter: the default, switching options, and that it persists.
2. **iOS**
   - **Filter logic:** `BudgetMetrics.filterProjectionRows`.
   - **View model:** `DashboardViewModel` keeps the filter (UserDefaults).
   - **Month Budget card:** a menu in its header.
   - **Budget performance:** colours in `BudgetVsActualChart.swift` and the menu label.
   - **Check:** `xcodebuild` simulator build.
3. **Checks:** FrontEnd build/lint, unit tests, the dashboard Playwright specs, and the iOS
   build.

## Checklist

- [x] Web: `filterProjectionRows` + unit tests
- [x] Web: Month Budget filter dropdown + persisted choice
- [x] Web: Budget performance colours + "All Categories"
- [x] Web: Playwright updates
- [x] iOS: filter logic, menu, persisted choice
- [x] iOS: Budget performance colours + "All Categories"
- [x] Checks: FrontEnd build/lint/unit, Playwright, iOS build

## Results

- **Web:**
  - `budgetMetrics.ts`: `ProjectionFilter`, `PROJECTION_FILTERS`, `filterProjectionRows` and
    `isProjectionFilter`.
  - `DashboardView.vue`: a Month Budget `card-head` dropdown ("Month budget filter"; Top 5
    Spend default, Over Budget, Under Budget) persisted via
    `dashboardFilterStorage.budgetProjectionFilter`. The totals line still covers all budgets,
    and an empty filter shows "No categories over/under budget."
  - `BudgetVsActualChart.vue`: budget is `#2a78d6`, actual `#eb6834`.
  - The option reads "All Categories".
- **iOS:**
  - `BudgetMetrics.swift`: `ProjectionFilter` + `filterProjectionRows`.
  - `DashboardViewModel`: `projectionFilter` (UserDefaults) + `filteredBudgetProjection`.
  - `DashboardView`: a Month Budget filter menu, with the shared `filterMenuLabel` reused by
    the Budget performance menu ("All Categories").
  - `BudgetVsActualChart.swift`: budget `incomeColor`, actual `expenseColor`.
- **Tests:**
  - 13 new unit tests (`filterProjectionRows`, `isProjectionFilter`, filter storage).
  - `dashboardBudgets.spec.ts`: label update + a new Month Budget filter scenario (Groceries
    $100,000 budget, so it's deterministically "under").
- **Merged `origin/main`** (#107, Insights tab) on request; no overlap with this change.
- **Checks:**
  - FrontEnd build/lint clean; FrontEnd.UnitTests 280 passing.
  - Playwright `dashboardBudgets` + `budgets` + `insights` + `dashboard` specs 10/10.
  - iOS simulator build succeeds (not run manually).
- **Pre-existing flaky test (not fixed):** `dashboard.spec.ts` "Dashboard tiles" failed once
  (expected 2800, got 5596). `tileValue()` reads the KPI value before the tiles finish loading,
  while they show `···`, which parses as 0. The delta then becomes the whole month's total from
  earlier runs. A fix would wait for the `.value` element to lose its `loading` class first.

## Log

### Prompt
start a worklog for UBE-125

### Response
Fetched UBE-125 (no comments). Pulled `main` (includes #106), created branch
`UBE-125/budget-tile-improvements` and this worklog. Asked to confirm the plan and behaviour
choices.

### Prompt
yes, start work

### Response
Plan and behaviour confirmed; starting implementation.

### Prompt
pull origin / get the latest from origin for main and merge into this branch

### Response
Stashed the uncommitted UBE-125 work, merged `origin/main` (#107 Insights tab, no overlapping
files) and re-applied the stash cleanly. Then finished the iOS part. All checks pass. Not
committed. Diagnosed the intermittent "Dashboard tiles" failure as a test race (see Results);
left unfixed pending a decision.

### Prompt
commit and raise PR

### Response
Committed, pushed and opened a PR against main. The `dashboard.spec.ts` race fix wasn't
included (no answer on whether to add it).
