# UBE-123: Add Budget recommendation

## Linear issue

https://linear.app/uberconcept/issue/UBE-123/add-budget-recommendation

> In addition to budgets added in UBE-119, add the option to recommend a budget. The
> recommendation should be an average of the past 6 months. This should appear as a column to the
> right of the current fields, with a button to copy in all the items or a single item.

## Description

Builds on UBE-119 (merged in #104): the Budgets tab on web (`FrontEnd/src/views/BudgetsView.vue`)
and iOS (`iosApp/iosApp/Views/Budgets/`) lists each Expense category with an amount field.

This adds a **Recommended** column to the right of each amount field, showing the category's
average monthly spend over the past 6 months. Each row gets a button to copy its recommendation
into the field, and a button by the column header copies all of them. Copying only fills the
fields; the user still presses Save.

## Plan

**Calculation (confirmed 2026-11-01):**
- **Months:** the 6 **full** months before the current month (e.g. on 1 Nov 2026: May–Oct 2026).
  The current partial month is excluded.
- **Spend:** per Expense category, the net spend for each month. That's the negated sum of
  amounts, so refunds reduce it. Ignored transactions are skipped. These are the same rules the
  dashboard uses (`dashboardMetrics.ts`).
- **Average:** total ÷ 6, so a month with no spend counts as $0. If the account has less than 6
  months of history (`MinTransactionDate`), divide by the number of months available instead.
- **Rounding:** up to the next whole dollar.
- **No recommendation:** when the average is 0 or negative, show "—" with no copy button.

1. **Api** (one implementation shared by web and iOS):
   - `BudgetRecommendationService.Recommend(transactions, categories, currentMonth, minTransactionDate)`
     → `[{ category, amount }]`, a pure function with xUnit unit tests.
   - `GET /budgets/recommendations?month=YYYY-MM` (`month` is the client's current month, so
     time zones don't matter). It loads the 6 month buckets with the batched `GetManyAsync`
     (UBE-122).
   - Integration tests and an `AuthorizationTests` entry.
2. **Web:**
   - `budgetsService.getBudgetRecommendations(month)`.
   - `BudgetsView.vue`:
     - A "Recommended" column showing the amount, plus a small "Use" button on each row.
     - "Use all recommendations" in the column header. It overwrites every field that has a
       recommendation and leaves the rest alone.
     - The page still loads if the recommendations call fails; the column just shows "—".
   - Unit tests for the service. Add to `budgets.spec.ts`: seed transactions, check the column,
     then check that both the single and the all copy buttons fill the fields.
3. **iOS:**
   - `PimApiClient.getBudgetRecommendations`.
   - `BudgetsViewModel`: load the recommendations and add copy-one / copy-all.
   - `BudgetsView`: a recommendation column (amount + copy button) and a "Use all" button. Keep
     the compact padding from UBE-119.
   - Check with an `xcodebuild` simulator build.
4. **Checks:** Release `dotnet build` + `dotnet test`, FrontEnd build/lint, unit tests,
   `budgets.spec.ts`, and the iOS build.

## Checklist

- [x] Api: `BudgetRecommendationService` + unit tests
- [x] Api: `GET /budgets/recommendations` + integration tests + `AuthorizationTests` entry
- [x] Web: service method + unit tests
- [x] Web: Recommended column, per-row copy, copy all
- [x] Web: Playwright scenario
- [x] iOS: client method + view model
- [x] iOS: recommendation column, per-row copy, copy all
- [x] Checks: Release build/tests, FrontEnd build/lint/unit, Playwright spec, iOS build

## Results

- **Api:**
  - `BudgetRecommendationService` (pure: `Window` + `Recommend`).
  - `GET /budgets/recommendations?month=yyyy-MM` on `BudgetsController` (400 for a missing or
    invalid month). It uses `ITransactionQueryService` (batched month fetch).
- **Web:**
  - `getBudgetRecommendations`.
  - `BudgetsView.vue`: a third "6-month average" column with a per-row "Use" button and a
    "Use all" button in the header. The page max-width is now 860px to fit the column. A failed
    recommendations call leaves the column showing "—".
- **iOS:**
  - `PimApiClient.getBudgetRecommendations`.
  - `BudgetsViewModel` (recommendations, use one/all).
  - `BudgetsView`: a "6-month average · Use all" header above the list, and a tappable
    "← $612" recommendation on each row (the amount field is narrowed to 84pt to fit).
- **Checks:**
  - `dotnet build -c Release` clean; tests 114 unit + 88 integration passing.
  - FrontEnd build/lint clean; FrontEnd.UnitTests 241 passing.
  - `budgets.spec.ts` 2/2 passing. The new scenario stubs the recommendations response, since
    the shared test user's data varies; the averages are covered by the Api tests.
  - iOS simulator build succeeds (not run manually).

## Log

### Prompt
create worklog for UBE-123

### Response
Fetched UBE-123 (no comments; related to UBE-119, now merged). Pulled `main` (includes #104),
created branch `UBE-123/add-budget-recommendation` and this worklog. Asked to confirm the plan
and the calculation rules.

### Prompt
plan is correct. Start

### Response
Plan and calculation rules confirmed; starting implementation.
Implemented the Api, web and iOS changes per the plan. All checks pass. Not committed.

### Prompt
commit and raise PR

### Response
Committed, pushed and opened a PR against main.
