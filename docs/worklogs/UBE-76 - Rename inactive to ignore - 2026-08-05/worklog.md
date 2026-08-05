# UBE-76: Rename inactive to ignore

Linear: https://linear.app/uberconcept/issue/UBE-76/rename-inactive-to-ignore
Status: Done · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/54

## Description (from Linear)

rename all instances (Front end, api, data storage) of inactive to ignore for transactions.

of the transaction is already ignored, to reverse label the menu item as unignore.

## Current state

`Transaction.Inactive` (`bool?`) is an existing, independent manual per-transaction feature - a
row-menu toggle ("Set active" / "Set inactive") that excludes a transaction from listings/dashboard
totals. It's unrelated to `Category.CategoryType.Inactive` (added in UBE-75), a third `Income`/
`Expense`/`Inactive` category classification that, when a transaction's category is set/changed,
*stamps* `Transaction.Inactive` from the category's own type - but the two are stored as (and always
have been) the same single `Transaction.Inactive` field either way.

A fresh survey of every "Inactive"/"inactive" reference in a transaction context (the rename scope):

- **Api**: `Transaction.Inactive` property (`Api/Data/Transaction.cs`); `Category.StampTransaction`'s
  assignment to it; `TransactionUpdateService`'s clear-on-category-removal assignment;
  `Api.IntegrationTests/TransactionsEndpointTests.cs` and `Api.UnitTests/Services/
  TransactionUpdateServiceTests.cs`/`InternalTransferMatcherTests.cs`/`FileProcessorTests.cs` - test
  names and fixtures (several are compound, e.g. `..._StampsTypeAndInactive_...`, where "Type" is the
  Category-driven part that stays, only the "Inactive" part renames).
- **FrontEnd**: `transactionsService.ts`'s `Transaction.inactive` field; `dashboardMetrics.ts`'s
  `isCounted()`/comments; `TransactionsView.vue` - `togglingInactive`/`toggleInactiveError` refs, the
  `toggleInactive()` function, the `row-inactive` CSS class, the "Inactive" chip text, and the "Set
  active"/"Set inactive" menu item labels (**this last pair is the ticket's specific "unignore"
  ask**); `FrontEnd.UnitTests` fixtures in `transactionFilters.test.ts`, `dashboardMetrics.test.ts`,
  `transactionsService.test.ts`.
- **FunctionalTests**: `transactionIgnore.spec.ts` (the whole file exercises this feature) and
  `dashboard.spec.ts` (a variable name, a comment, and menu-item/chip text assertions).
- `Category.CategoryType.Inactive` itself (the enum member, its Api/FrontEnd type unions,
  `SettingsView.vue`'s Type dropdown option, `setup_local.sh`'s Internal Transfer seed, and every test
  asserting on `Category.CategoryType.Inactive` specifically) - the ticket says "for transactions" and
  never mentions categories, but per the resolved Q1 below this is now in scope too, for consistency.

## Open questions - resolved

1. **Category is in scope too, renamed for consistency.** `Category.CategoryType.Inactive` (added in
   UBE-75) also becomes `Category.CategoryType.Ignore`, so the category-level classification and the
   transaction-level field/UI it drives use the same word throughout.
2. **Terminology: "Ignore" used everywhere**, not a state/action split. The property/field/JSON
   key/CSS-class/chip-text all become `Ignore`/`ignore` (not `Ignored`), matching the row-menu action
   labels exactly. So: `Transaction.Ignore` (bool?), FrontEnd `ignore: boolean | null`, CSS class
   `.row-ignore`, the chip reads "Ignore", and the row-menu labels are "Ignore" (not yet ignored) /
   "Unignore" (already ignored) per the ticket's explicit ask.
3. **No automated migration - manual.** No re-key/migration code for existing stored transactions;
   any old `"Inactive"`-keyed data gets handled manually (e.g. the `clean_local.sh` + reseed reset
   already used throughout this session) rather than written as part of this change.

## Scope addition: `Category.CategoryType.Inactive` -> `Ignore`

Per the resolved Q1 above, this also touches everywhere `Category.CategoryType.Inactive` appears
(from the same survey, "out of scope" list from before now flips to in-scope):
`Api/Data/Category.cs`'s enum member and `StampTransaction`'s comparison; every
`Category.CategoryType.Inactive` reference across `Api.IntegrationTests`/`Api.UnitTests`;
`FrontEnd/src/services/settingsService.ts`'s `CategoryType` union; `SettingsView.vue`'s
`categoryTypes` array; `scripts/setup_local.sh`'s Internal Transfer seed (`"Type": "Inactive"` ->
`"Type": "Ignore"`); `SettingsEndpointTests.cs`'s `AddCategory_RoundTripsTheInactiveTypeOption` test.

## Plan

**Api**

1. `Api/Data/Transaction.cs` - rename `Inactive` → `Ignore`; update the `MatchesIdentity` doc comment.
2. `Api/Data/Category.cs` - rename the `CategoryType.Inactive` enum member → `Ignore`;
   `StampTransaction`'s comparison/assignment/comment update to match (`transaction.Ignore = ... ==
   CategoryType.Ignore`).
3. `Api/Services/TransactionUpdateService.cs` - `RemoveCategoryFromTransactionsAsync`'s clear-on-
   removal assignment.
4. `Api.IntegrationTests/{SettingsEndpointTests,TransactionsEndpointTests}.cs`,
   `Api.UnitTests/Services/{TransactionUpdateServiceTests,InternalTransferMatcherTests,
   FileProcessorTests}.cs` - rename every `.Inactive`/`CategoryType.Inactive` reference and every
   test name's "Inactive" segment to "Ignore" (including `AddCategory_RoundTripsTheInactiveTypeOption`
   and every compound `...StampsTypeAndInactive...`/`...OnlyInactiveChanges...` name).

**FrontEnd**

5. `FrontEnd/src/services/transactionsService.ts` - `Transaction.inactive` → `ignore`.
6. `FrontEnd/src/services/settingsService.ts` - `CategoryType`'s `'Inactive'` → `'Ignore'`.
7. `FrontEnd/src/utils/dashboardMetrics.ts` - `isCounted()`'s `transaction.inactive` reference +
   comments.
8. `FrontEnd/src/views/SettingsView.vue` - `categoryTypes` array's `'Inactive'` → `'Ignore'`.
9. `FrontEnd/src/views/TransactionsView.vue` - `togglingInactive`/`toggleInactiveError` →
   `togglingIgnore`/`toggleIgnoreError`; `toggleInactive()` → `toggleIgnore()`; `row-inactive` →
   `row-ignore` (CSS class + binding); the "Inactive" chip → "Ignore"; the menu item label logic
   `t.inactive ? 'Set active' : 'Set inactive'` → `t.ignore ? 'Unignore' : 'Ignore'` (the ticket's
   specific ask).
10. `FrontEnd.UnitTests/utils/transactionFilters.test.ts`,
    `FrontEnd.UnitTests/utils/dashboardMetrics.test.ts`,
    `FrontEnd.UnitTests/services/{transactionsService,settingsService,categoriesService}.test.ts` -
    rename fixture fields/assertions (both the Transaction `inactive` field and any
    `Category`/`CategoryType` `'Inactive'` literals).

**Other**

11. `scripts/setup_local.sh` - Internal Transfer category's `"Type": "Inactive"` → `"Type": "Ignore"`.
12. `FunctionalTests/tests/transactionIgnore.spec.ts` - rename the whole file's assertions/locators to
    "Ignore"/"Unignore" (test name, menu item text, chip text). Keep the file name as-is - "Ignore" is
    still an accurate name post-rename.
13. `FunctionalTests/tests/dashboard.spec.ts` - rename `expensePriorInactive`/`inactiveRow` variables
    and update the menu-item/chip text assertions and comment.

**Verification**

14. `dotnet test`; `npm run build`/`lint`; `FrontEnd.UnitTests`; full Playwright suite; manual browser
    check (light + dark) - ignore a transaction, confirm the chip/menu text, unignore it, confirm the
    dashboard/listing filtering still works identically to before, confirm the Category Type dropdown
    now offers "Ignore" instead of "Inactive".

## Checklist

- [x] `Api/Data/Transaction.cs` - `Inactive` → `Ignore`
- [x] `Api/Data/Category.cs` - enum member + `StampTransaction`
- [x] `TransactionUpdateService.cs` - clear-on-removal assignment
- [x] `Api.IntegrationTests`/`Api.UnitTests` - renamed references + test names (both Transaction and
      Category) - 134/134 passing
- [x] `transactionsService.ts` - `inactive` → `ignore`
- [x] `settingsService.ts` - `CategoryType`'s `'Inactive'` → `'Ignore'`
- [x] `dashboardMetrics.ts` - `isCounted()` + comments
- [x] `SettingsView.vue` - `categoryTypes` array
- [x] `TransactionsView.vue` - vars, function, CSS class, chip text, menu item Ignore/Unignore labels
      (`npm run build`/`lint` clean)
- [x] `FrontEnd.UnitTests` - renamed fixtures/assertions (112/112 passing - `settingsService.test.ts`/
      `categoriesService.test.ts` never used the `Inactive` literal, nothing to change there)
- [x] `scripts/setup_local.sh` - Internal Transfer seed
- [x] `FunctionalTests/tests/transactionIgnore.spec.ts` - renamed assertions/locators (added
      `exact: true` on the "Ignore" menuitem lookups, since Playwright's role-name matching is
      substring-based by default and would otherwise also match "Unignore")
- [x] `FunctionalTests/tests/dashboard.spec.ts` - renamed variables/assertions
- [x] Repo-wide sweep confirms zero remaining `Inactive`/`inactive` references across
      `Api`/`Api.*Tests`/`FrontEnd`/`FrontEnd.UnitTests`/`FunctionalTests`/`scripts`
- [x] Build/test/lint verification + manual browser check (light + dark)

## Verification

`dotnet test` 134/134, `npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112, full Playwright
suite 24/24 (after a fresh local dataset reset, since the JSON key rename means old stored
transactions' `"Inactive"` value doesn't map onto the new `Ignore` field - per the resolved Q3).

One real bug found and fixed during Playwright verification: `transactionIgnore.spec.ts` and
`dashboard.spec.ts` both used `row.getByText('Ignore')` to check for the chip - but their own test
description fixtures (`"Ignore Test ..."`, `"DashExpensePriorIgnore..."`) now contain the literal
word "Ignore" too, so the substring-matching locator matched the description cell as well as (or
instead of) the chip. Fixed by scoping the check to the chip's own element (`row.locator('.chip')`)
rather than a plain text search - more robust in general, not just for this collision. Also added
`exact: true` to the "Ignore" menuitem locators, since Playwright's role-name matching is
substring-based by default and would otherwise also match "Unignore".

Manual verification via Playwright screenshots (light + dark): the Ignore chip renders correctly
(dashed "Ignore" badge, greyed-out row), the row-menu shows "Ignore"/"Unignore" correctly, and the
Category Type dropdown/list correctly show "Ignore" for Internal Transfer instead of "Inactive".

## Prompt log

- "start a worklog for UBE-76"
- "1. rename for consistency. 2. use ignore everywhere. 3. manual migration"
- "Read the output of the background manual-check Playwright run... report back concisely" (final
  verification instructions)
- "commit and raise PR"
