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

## Open questions (flagging for confirmation before I start)

1. **Naming collision on `Transaction.Inactive`.** The ticket says setting a transaction's category
   should "also set inactive" on the transaction - but `Transaction.Inactive` already means something
   else today (a manual, independent "ignore this transaction" toggle the user sets directly, per
   the existing row-menu feature). If applying a category also overwrites `Inactive` from the
   category's own inactive flag, then **every time a category is picked (including re-picking the
   same category, or the automated Internal Transfer matcher running), it would silently clobber
   whatever the user had manually set via "Set active"/"Set inactive"** on that transaction. Is that
   the intended behaviour, or should the category-driven flag live in its own field (e.g. a separate
   `CategoryInactive` on `Transaction`) so it doesn't fight with the existing manual toggle?
2. **What does "inactive" mean for a *category*?** My working assumption: an inactive category is
   hidden from the category-picker dropdown when categorising a transaction going forward (so it
   can't be newly assigned), but stays visible (muted) in Settings, remains valid on transactions
   already carrying it, and can still be assigned by the automated Internal Transfer matcher
   regardless of its inactive flag. Confirm/correct?
3. **Default data mapping for `setup_local.sh`.** My proposed mapping "based on the original
   meaning": all spend categories (Housing, Groceries, Transport, Dining, Shopping, Utilities,
   Entertainment, Medical, Subscriptions, Other) → `Type: Expense`, `Inactive: false`; `Income` →
   `Type: Income`, `Inactive: false`; `Internal Transfer` → `Inactive: true` (so its transactions
   drop out of dashboard sums via the existing `!inactive` filter, replacing today's hardcoded
   `!== 'Internal Transfer'` string check) and `Type: Expense` (arbitrary, since it's excluded via
   `Inactive` either way). Confirm this mapping, especially Internal Transfer.
4. **Existing (pre-migration) transactions with no `Type`/no category-driven inactive stamp.** These
   would need to fall back to something for dashboard math - proposed: treat a transaction with no
   `Type` as `Expense` for calculation purposes only if it has a non-empty category (matches today's
   `!== 'Income'` behaviour defaulting everything else to expense), and exclude uncategorised (`""`)
   transactions from both Income and Expense sums exactly as today. Confirm?

## Plan (pending confirmation of the above)

**Api**

1. `Api/Data/Category.cs` - add `bool Inactive` and `required CategoryType Type` (nested
   `enum CategoryType { Income, Expense }`, matching the `Account`/`Account.AccountType` nesting
   convention).
2. `Api/Data/Transaction.cs` - add a nullable `Category.CategoryType? Type` field, and (pending Q1)
   either reuse `Inactive` or add a new field for the category-driven flag.
3. `Api/Controllers/SettingsController.cs` - `POST /settings/category` accepts `Inactive`/`Type` in
   the request body (still name-uniqueness-checked, still no edit/PUT path).
4. `Api/Services/TransactionUpdateService.cs` - when a transaction's `Category` is set/changed
   (`UpdateTransactionsAsync`), look up that category on `User.Categories` and stamp `Type` (and,
   per Q1, the inactive flag) onto the transaction before persisting - single source of truth,
   server-side, not trusted from the client payload.
5. `Api/Services/InternalTransferMatcher.cs` - route its auto-assignment through the same
   stamping logic so matched pairs get `Type`/inactive consistent with the `Internal Transfer`
   category definition.
6. `Api.IntegrationTests`/`Api.UnitTests` - coverage for the above (category Type/Inactive
   round-trip, stamping on categorisation, Internal Transfer matcher stamping).

**FrontEnd**

7. `settingsService.ts`/`categoriesService.ts` - extend `CategoryDefinition` with `inactive: boolean`
   and `type: 'Income' | 'Expense'`.
8. `SettingsView.vue` - add-category form gets an "Inactive" checkbox and a Type dropdown; category
   list rows show Type and a muted/"Inactive" indicator.
9. `TransactionsView.vue` - the per-row category `<select>` excludes inactive categories from the
   assignable options (a transaction already carrying an inactive category still displays it).
10. `dashboardMetrics.ts` - replace the hardcoded `'Income'`/`'Internal Transfer'` string checks with
    `transaction.type === 'Income'`/`'Expense'`, relying on the existing `isCounted()`/`!inactive`
    filter to keep excluding Internal Transfer (per Q1/Q3 resolution).
11. `FrontEnd.UnitTests` + `FunctionalTests` updated for all of the above.
12. `scripts/setup_local.sh` - seed `Inactive`/`Type` on each default category per the Q3 mapping.

**Verification**

13. `dotnet test`; `npm run build`/`lint`; `FrontEnd.UnitTests`; full Playwright suite; manual
    browser check (light + dark) - add an inactive category, confirm it drops out of the picker,
    confirm dashboard Income/Expense math still matches expectations.

## Checklist

- [ ] Confirm open questions above before starting implementation
- [ ] `Api/Data/Category.cs` - `Inactive` + `Type`
- [ ] `Api/Data/Transaction.cs` - `Type` (+ Q1 resolution)
- [ ] `SettingsController` - `POST /settings/category` accepts `Inactive`/`Type`
- [ ] `TransactionUpdateService` - stamp `Type`/inactive on categorisation
- [ ] `InternalTransferMatcher` - stamp `Type`/inactive on auto-match
- [ ] `Api.IntegrationTests`/`Api.UnitTests` - new coverage
- [ ] `settingsService.ts`/`categoriesService.ts` - `inactive`/`type` fields
- [ ] `SettingsView.vue` - Inactive checkbox + Type dropdown, list indicators
- [ ] `TransactionsView.vue` - exclude inactive categories from the picker
- [ ] `dashboardMetrics.ts` - use `type`/`inactive` instead of hardcoded category names
- [ ] `FrontEnd.UnitTests` + `FunctionalTests` updated
- [ ] `scripts/setup_local.sh` - seed `Inactive`/`Type` on defaults
- [ ] Build/test/lint verification + manual browser check (light + dark)

## Prompt log

- "start a worklog for UBE-75"
