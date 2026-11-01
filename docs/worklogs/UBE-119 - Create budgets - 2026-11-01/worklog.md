# UBE-119: Create budgets

## Linear issue

https://linear.app/uberconcept/issue/UBE-119/create-budgets

> Set the ability to set a budget for the month. This would be a new tab where budgets can be set.
> Future tickets will create the tracking against the budget.
>
> Ensure this is implemented in iOS and web

## Description

Add a **Budgets** tab (web and iOS) where a monthly budget amount can be set. This ticket covers
setting and saving budgets only. Tracking spend against them is left to future tickets.

Current state:
- User-level config (accounts, categories) lives on the `User` item (`Api/Data/User.cs`) and is
  served by `SettingsController` (`/settings`, `/settings/category`, …).
- Web nav is `FrontEnd/src/components/NavBar.vue` (Dashboard, Transactions tabs). Routes are in
  `FrontEnd/src/router/index.ts`.
- iOS tabs are in `iosApp/iosApp/Views/AppTabView.swift` (Dashboard, Transactions). Its Api calls
  are in `Services/PimApiClient.swift`. Categories come from `SettingsStore`.

## Plan

**Proposed model (to confirm):** a recurring monthly budget **per Expense category**. Each
category gets one amount that applies to every month, and an empty amount means no budget. A
**total** is shown as the sum. Month-specific budgets are out of scope.

1. **Api**
   - `Budget { Category, Amount }`, stored as `User.Budgets` (no new table, Terraform or IAM change).
   - `GET /budgets` → `[{ category, amount }]`.
   - `PUT /budgets` replaces the whole list. Validation: categories must exist, be Expense type
     and be unique, and amounts must be > 0 with 2 decimal places max. Returns 400 otherwise.
   - `DELETE /settings/category` also removes that category's budget.
   - Integration tests for both endpoints (happy path + validation), plus `AuthorizationTests`
     entries. Unit tests on a `BudgetValidator` / service if validation logic warrants it.
2. **Web**
   - `budgetsService.ts` (get/save), `/budgets` route, and a "Budgets" tab in `NavBar.vue`.
   - `BudgetsView.vue` lists Expense categories (colour dot + name) with an amount input each, a
     running total, and Save with a spinner/"Saved." state. Field-level errors for bad amounts.
   - FrontEnd.UnitTests for the service and any amount parsing/total util. Playwright scenario:
     set budgets, save, reload, values persist, then clear one.
3. **iOS**
   - `PimApiClient.getBudgets` / `saveBudgets`, a `Budget` model and a `BudgetsStore` (or extend
     `SettingsStore`).
   - "Budgets" tab in `AppTabView` (`chart.pie` icon) with a `BudgetsView` matching the web: a
     category list with a decimal-pad amount field each, a total, and Save. Styled with
     `DashboardTheme`.
   - Verify with an `xcodebuild` simulator build (no iOS test target).
4. **Checks:** Release `dotnet build` + `dotnet test`, FrontEnd build/lint, unit tests, the new
   Playwright spec, and the iOS build.

**Confirmed (2026-11-01):** per-category + total, recurring. Original questions:
- Per-category budgets (with a total), or a single overall monthly amount?
- The same amount every month (recurring), or set separately for each month?

## Checklist

- [x] Api: `Budget` model + `User.Budgets`
- [x] Api: `GET`/`PUT /budgets` with validation
- [x] Api: remove budget when its category is deleted
- [x] Api: integration tests + `AuthorizationTests` entries (+ unit tests if needed)
- [x] Web: `budgetsService.ts`, `/budgets` route, NavBar tab
- [x] Web: `BudgetsView.vue` (list, inputs, total, save)
- [x] Web: FrontEnd.UnitTests (239 passing) + Playwright scenario (`budgets.spec.ts` passing)
- [x] iOS: client methods, model (+ view model instead of a separate store)
- [x] iOS: Budgets tab + `BudgetsView`
- [x] Checks: Release build/tests, FrontEnd build/lint/unit, Playwright spec, iOS build

## Results

- **Api:** `Budget` + `User.Budgets`, `BudgetsController` (`GET`/`PUT /budgets`) and
  `BudgetValidator`. `DELETE /settings/category` removes the category's budget. API Gateway uses
  `$default`, so no Terraform change.
- **Web:** `budgetsService.ts`, `utils/budgetAmounts.ts`, `BudgetsView.vue`, `/budgets` route and
  NavBar "Budgets" tab.
- **iOS:** `Budget` model, `BudgetAmounts` util (port of the web one), `PimApiClient`
  get/saveBudgets, `BudgetsView` + `BudgetsViewModel`, and a "Budgets" tab (`chart.pie`). New files
  are registered in `project.pbxproj`. A view model calls the Api directly; no separate store,
  since only this tab uses budgets for now.
- **Checks:**
  - `dotnet build -c Release` clean; tests 104 unit + 82 integration passing.
  - FrontEnd build/lint clean; FrontEnd.UnitTests 239 passing.
  - Playwright `budgets.spec.ts` + `settings.spec.ts` 4/4 passing.
  - iOS simulator build succeeds (not run manually).
- During the Playwright run, DynamoDB Local had stopped; it was restarted via `setup_local.sh` by
  the user.

## Log

### Prompt
create worklog for UBE-119

### Response
Fetched UBE-119 (no comments or attachments), reviewed the settings Api, web nav and iOS tabs.
Created branch `UBE-119/create-budgets` off `main` and this worklog. Asked to confirm the plan
and the budget model (per-category vs overall, recurring vs per-month).

### Prompt
yes, start work

### Response
Plan confirmed: per-category (Expense) budgets with a total, recurring every month. Starting
implementation.

### Prompt
I've run this separately / (ran `docker ps` and `source scripts/setup_local.sh`)

### Response
Container was still stopped until `setup_local.sh` was re-run with the absolute path. Then
`budgets.spec.ts` + `settings.spec.ts` passed 4/4. Implemented iOS: model, util, client methods,
view + view model, Budgets tab, pbxproj registration. iOS build succeeds. Not committed.

### Prompt
The UI for the budgets screen is too spread out, compress the UI vertically

### Response
Tightened web and iOS, but also (unasked) moved the web list into two columns, merged
total + save into one row, and shrank iOS fonts/text.

### Prompt
undo this. I did not ask you to move this into multiple columns. I wanted less padding around the
current UI

### Response
Restored the original single-column layout and structure on web and iOS, keeping only reduced
padding, gaps and margins. Web build/lint, iOS build and `budgets.spec.ts` pass. Not committed.

### Prompt
commit and raise PR

### Response
Committed, pushed and opened a PR against main.
