# UBE-75: Add flagging to categories

Linear: https://linear.app/uberconcept/issue/UBE-75/add-flagging-to-categories
Status: In Progress · Priority: No priority

## Description (from Linear)

When categories are displayed and created, add a checkbox for inactive and a dropdown to select
Type which is whether it is income or expense. Save these to the database through the API.

Update the transactions so that when the category is set, it also sets inactive and set Type.

Update the dashboard calculations to use the new inactive & Type fields on transactions for Income,
Expense etc.

Update the started data loaded into the local db to include these fields, setting Type and inactive
based on the original meaning.

## Current state

- `Category` (`Api/Data/Category.cs`, added in UBE-72) currently has just `Name` + `Colour`, stored
  as `User.Categories`. `SettingsController` exposes `POST`/`DELETE /settings/category`; there's no
  PUT/edit path (categories "cannot be updated" per UBE-72).
- `Transaction` (`Api/Data/Transaction.cs`) already has a `Category` string **and** a separate
  `bool? Inactive` - but that `Inactive` is an existing, unrelated, user-facing feature: a manual
  per-transaction "Set active / Set inactive" toggle (`TransactionsView.vue`'s row menu), used to
  exclude a transaction from listings/dashboard totals. There is no `Type` field on `Transaction`.
- `dashboardMetrics.ts` currently classifies Income vs. Expense by hardcoded category-name string
  checks (`t.category === 'Income'`, `t.category !== 'Internal Transfer'`) alongside an existing
  `isCounted()` filter (`!t.inactive`) that already excludes manually-inactive transactions from
  every sum/chart.
- `InternalTransferMatcher` auto-assigns the `"Internal Transfer"` category to matched pairs; that
  category is seeded by default and protected from deletion (UBE-72) but otherwise behaves like any
  other category today.
- `scripts/setup_local.sh` seeds 12 default categories (Housing, Groceries, Transport, Dining,
  Shopping, Utilities, Entertainment, Medical, Subscriptions, Income, Other, Internal Transfer) with
  just `Name`/`Colour`.

## Open questions - resolved

1. **Naming collision on `Transaction.Inactive`.** Resolved: re-use the existing field - setting a
   transaction's category does overwrite `Inactive` from the category's own inactive flag.
   Implementation note worked out below: to avoid this fighting the existing manual "Set
   active"/"Set inactive" toggle (which PUTs the *same* category with just `inactive` flipped), the
   server only re-stamps `Type`/`Inactive` from the category when the category **actually changes**
   on that PUT - not on every save. That's also exactly the existing `previousCategory !=
   updated.Category` condition `TransactionUpdateService.UpdateTransactionsAsync` already uses for
   its unclassified-stats bookkeeping, so the two naturally share a guard.
2. **What "inactive" means for a category.** Resolved: nothing about the category itself (it stays
   fully selectable/visible everywhere, no picker filtering) - it's purely a directive: *"transactions
   flagged with this category should be set inactive."* Dropped the "filter the category picker"
   line item from the plan below - it doesn't apply.
3. **Default data mapping for `setup_local.sh`.** Confirmed as proposed: all spend categories →
   `Type: Expense, Inactive: false`; `Income` → `Type: Income, Inactive: false`; `Internal Transfer`
   → `Inactive: true` (so its transactions drop out of dashboard sums via the existing `!inactive`
   filter - once stamped, this fully replaces today's hardcoded `!== 'Internal Transfer'` string
   check), `Type: Expense` (arbitrary, excluded via `Inactive` regardless).
4. **Pre-existing local transactions with no `Type`.** User will manually clear old local data - no
   migration/backfill needed. Dashboard math simply won't count a transaction with no `Type` towards
   either Income or Expense (clean `t.type === 'Income'`/`'Expense'` checks, no fallback rule).

## Additional scope found during investigation

Category gets *set* (and so needs this stamping applied) in four places, not just the one PUT
endpoint originally scoped - all four now stamp `Type`/`Inactive` from `User.Categories` via a
shared `Category.StampTransaction(transaction, categories)` helper, only when the category is
actually changing:
- `TransactionUpdateService.UpdateTransactionsAsync` (`PUT /transactions` - manual single/bulk edit)
- `TransactionUpdateService.ApplyDescriptionMappingAsync` (`POST /mapping/description` bulk-apply to
  existing matching transactions) - already guarded by `if (transaction.Category == category)
  continue;`, so always a real change when reached
- `FileProcessor.ApplyDescriptionMappingAsync` (upload-time auto-categorisation from a saved
  mapping) - always a real change (freshly parsed transactions start uncategorised)
- `InternalTransferMatcher.MatchAsync` (auto-assigns `"Internal Transfer"`) - always a real change

`InternalTransferMatcher` needs `IRepository<User>` added to its constructor to look the category
up; `TransactionUpdateService` needs the same.

## Plan

**Api**

1. `Api/Data/Category.cs` - add `bool Inactive` and `required CategoryType Type` (nested
   `enum CategoryType { Income, Expense }`, matching the `Account`/`Account.AccountType` nesting
   convention). Add a static `StampTransaction(Transaction, IEnumerable<Category>)` helper: looks up
   `transaction.Category` in the list and sets `transaction.Type`/`transaction.Inactive` from the
   match (both cleared to `null` if the category isn't found, e.g. cleared to `""`).
2. `Api/Data/Transaction.cs` - add nullable `Category.CategoryType? Type`; update the
   `MatchesIdentity` doc comment to also mention `Type` alongside `Category`/`Inactive` as
   deliberately excluded/edited-after-import fields.
3. `Api/Controllers/SettingsController.cs` - `POST /settings/category` accepts `Inactive`/`Type` in
   the request body (still name-uniqueness-checked, still no edit/PUT path).
4. `Api/Services/TransactionUpdateService.cs` - inject `IRepository<User>`. In
   `UpdateTransactionsAsync`, call `Category.StampTransaction` right where it already checks
   `previousCategory != updated.Category`. In `ApplyDescriptionMappingAsync`, call it right after
   `transaction.Category = category;`.
5. `Api/Services/FileProcessor.cs` - in `ApplyDescriptionMappingAsync`, call
   `Category.StampTransaction` right after `transaction.Category = match.Category;` (it already has
   `IRepository<User>` injected for `UpdateMinTransactionDateAsync`).
6. `Api/Services/InternalTransferMatcher.cs` - inject `IRepository<User>`; call
   `Category.StampTransaction` on both `added`/`match` right after assigning `CategoryName`.
7. `Api.IntegrationTests`/`Api.UnitTests` - coverage: category Type/Inactive round-trip through
   Settings; stamping via PUT /transactions category change; stamping *not* re-applied when only
   `inactive` changes (category unchanged - the manual toggle keeps working); stamping via
   description-mapping bulk apply and file-upload auto-categorisation; Internal Transfer matcher
   stamping.

**FrontEnd**

8. `transactionsService.ts` - add `type: 'Income' | 'Expense' | null` to the `Transaction` interface.
9. `settingsService.ts`/`categoriesService.ts` - extend `CategoryDefinition` with `inactive: boolean`
   and `type: 'Income' | 'Expense'`.
10. `SettingsView.vue` - add-category form gets an "Inactive" checkbox and a Type dropdown
    (default `Expense`); category list rows show Type and an "Inactive" tag when set. (No picker
    filtering - Q2 resolution.)
11. `dashboardMetrics.ts` - replace the hardcoded `'Income'`/`'Internal Transfer'` string checks in
    `sumIncome`/`sumExpenses`/`computeExpensesByCategory` with `transaction.type === 'Income'`/
    `'Expense'`, relying on the existing `isCounted()`/`!inactive` filter to keep excluding Internal
    Transfer once it's stamped.
12. `FrontEnd.UnitTests` + `FunctionalTests` updated for all of the above.
13. `scripts/setup_local.sh` - seed `Inactive`/`Type` on each default category per the Q3 mapping.

**Verification**

14. `dotnet test`; `npm run build`/`lint`; `FrontEnd.UnitTests`; full Playwright suite; manual
    browser check (light + dark) - add a category with Type/Inactive set, categorise a transaction
    with it, confirm the transaction picks up `Inactive`/`Type`, confirm the manual "Set
    active/inactive" toggle still works independently, confirm dashboard Income/Expense math.

## Checklist

- [x] `Api/Data/Category.cs` - `Inactive` + `Type` + `StampTransaction` helper
- [x] `Api/Data/Transaction.cs` - `Type` field + updated doc comment
- [x] `SettingsController` - `POST /settings/category` accepts `Inactive`/`Type` (already bound the
      full `Category` object, no controller changes needed)
- [x] `TransactionUpdateService` - stamp on category change in both mutation methods (also clears
      `Type`/`Inactive` in `RemoveCategoryFromTransactionsAsync` when a category is deleted)
- [x] `FileProcessor` - stamp on upload-time auto-categorisation
- [x] `InternalTransferMatcher` - stamp on auto-match
- [x] `Api.IntegrationTests`/`Api.UnitTests` - new coverage (133/133 passing: category Type/Inactive
      round-trip; stamping on PUT category change across all 4 mutation sites; manual toggle
      preserved when category unchanged; Type/Inactive cleared on category deletion)
- [x] `transactionsService.ts` - `type` field on `Transaction`
- [x] `settingsService.ts`/`categoriesService.ts` - `inactive`/`type` fields
- [x] `SettingsView.vue` - Inactive checkbox + Type dropdown, list indicators
- [x] `dashboardMetrics.ts` - use `type`/`inactive` instead of hardcoded category names
- [x] `FrontEnd.UnitTests` updated (112/112 passing - `dashboardMetrics.test.ts` fixtures switched
      from category-name-based to Type/Inactive-based, matching the new dashboard logic)
- [x] `scripts/setup_local.sh` - seed `Inactive`/`Type` on defaults (verified: reseeded test user's
      Groceries/Income/Internal Transfer categories carry the expected values)
- [ ] Build/test/lint verification + manual browser check (light + dark)

## Prompt log

- "start a worklog for UBE-75"
- "1. re-use. 2. inactive means nothing for the category, it meansthat when the transaction is flagged with this category the transaction should be set to inactive. 3. correct. 4. I will manually remove"
