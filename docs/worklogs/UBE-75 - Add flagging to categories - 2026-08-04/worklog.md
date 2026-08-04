# UBE-75: Add flagging to categories

Linear: https://linear.app/uberconcept/issue/UBE-75/add-flagging-to-categories
Status: Done · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/52

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
- [x] `SettingsView.vue` - Type dropdown (Income/Expense/Inactive), list indicators (superseded by
      the follow-up below - the separate Inactive checkbox was removed)
- [x] `dashboardMetrics.ts` - use `type`/`inactive` instead of hardcoded category names
- [x] `FrontEnd.UnitTests` updated (112/112 passing - `dashboardMetrics.test.ts` fixtures switched
      from category-name-based to Type/Inactive-based, matching the new dashboard logic)
- [x] `scripts/setup_local.sh` - seed `Inactive`/`Type` on defaults (verified: reseeded test user's
      Groceries/Income/Internal Transfer categories carry the expected values)
- [x] Build/test/lint verification + manual browser check (light + dark)

## Bug found during end-to-end verification

`Api/Repository/DynamoDbRepository.cs` serialized/deserialized entities with the **default**
`JsonSerializerOptions` (int-encoded enums), while every HTTP controller uses
`JsonStringEnumConverter` (`Program.cs`). This was latent - never previously exposed, since no enum
field had ever been seeded with a string value directly into DynamoDB (the seed script always wrote
`Accounts: []`). Seeding `Category.Type` as `"Expense"`/`"Income"` strings (matching the ticket's Q3
mapping) crashed every `GetAsync<User>` with a `JsonException`, which took down login entirely (500
on `POST /login`, since `AuthenticationLocal.ValidateAsync` loads the `User` record) - all 22
Playwright specs that log in failed.

**Fix**: `DynamoDbRepository<T>` now uses a shared `JsonSerializerOptions` with
`JsonStringEnumConverter`, matching the HTTP layer, in both `Serialize`/`Deserialize` calls.
`JsonStringEnumConverter`'s reader accepts both the old int encoding and the new string encoding, so
this is backward-compatible with any enum values (e.g. existing `Account.Type`) written before this
fix existed. Also found and fixed a related test bug: `internalTransfer.spec.ts` asserted
uncategorised transactions still count as a dashboard expense (accurate before UBE-75, no longer
true now that only `Type: Expense` transactions count) - updated the expectation and comment.

Final verification: `dotnet test` 133/133, `npm run build`/`lint` clean, `FrontEnd.UnitTests`
112/112, full Playwright suite 24/24 (one `Month filter` failure on an earlier run was the same
pre-existing shared-dataset flakiness noted in UBE-72 - passed alone and on a clean re-run).
Confirmed visually in light + dark: Type/Inactive render correctly on all seeded categories
(Internal Transfer shows "Expense" + "Inactive"), and a newly-added category with Type=Income,
Inactive=true round-trips correctly through the add form.

## Follow-up: Inactive folded into the Type enum

Per feedback after the above was done: `Inactive` moved from a standalone `bool` field on `Category`
into a third `CategoryType` enum member (`Income`, `Expense`, `Inactive`), rather than an orthogonal
flag alongside Type.

- `Api/Data/Category.cs` - `Inactive` property removed; `enum CategoryType` gained `Inactive`.
  `StampTransaction` now derives `Transaction.Inactive` from `category.Type == CategoryType.Inactive`
  (`null` when no category matches, same as before) instead of reading a separate field - "the enum
  value of Inactive should have the same effect" the old flag did.
- `SettingsController` - unaffected (still binds the full `Category` object).
- All Api/Api.UnitTests/Api.IntegrationTests call sites constructing `Category { ..., Inactive = ... }`
  updated to use `Type = Category.CategoryType.Inactive` instead where that was the intent.
- `settingsService.ts`'s `CategoryType` gained `'Inactive'`; `CategoryDefinition.inactive` removed.
  `transactionsService.ts`'s `Transaction.type` union gained `'Inactive'` too (it mirrors
  `Category.Type` 1:1 now).
- `SettingsView.vue` - removed the "Inactive" checkbox and its dedicated chip/CSS; the Type dropdown
  now offers Income/Expense/Inactive, and the existing `category.type` text display is sufficient
  (an Inactive-typed category just reads "Inactive" there, no separate indicator needed).
- `scripts/setup_local.sh` - dropped the `Inactive` field from every seeded category; Internal
  Transfer is now seeded with `"Type": "Inactive"` directly.
- Verified: `dotnet test` 133/133, `npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112.

### Second bug found during re-verification: `DateTime.UtcNow` undercounts "today"

Re-running the full Playwright suite after the enum refactor kept failing on bulk-apply-category,
account-deletion-cascade, and category-deletion-cascade, but only some of the time - and a full
local dataset reset made it fail consistently. Root cause turned out to be unrelated to the enum
refactor entirely (confirmed: `Api.IntegrationTests`/`Api.UnitTests` use fixed explicit dates like
`new DateOnly(2026, 6, 10)`, so they never exercised this).

`TransactionUpdateService.ApplyDescriptionMappingAsync`, `DeleteTransactionsForAccountAsync`, and
`RemoveCategoryFromTransactionsAsync` (`DeleteTransactionsForAccountAsync`/
`RemoveCategoryFromTransactionsAsync` predate UBE-75, from UBE-72) all computed
`DateOnly.FromDateTime(DateTime.UtcNow)` as an `endDate` cutoff for "give me every transaction" -
but local time can run up to ~14 hours ahead of UTC. Testing at 08:11 AEST (22:11 UTC the *previous*
day), a transaction dated "today" locally was excluded by `GetTransactionsAsync`'s
`t.Date <= endDate` filter, since UTC hadn't rolled over to that calendar day yet - silently
no-opping all three bulk operations for anything dated today. Reproduced directly via curl (upload a
transaction dated today, `POST /mapping/description`, confirm the category never actually applies)
before touching any test code.

**Fix**: since these three callers never wanted a precise "as of today" cutoff (they want *every*
transaction, unbounded - `today` was only ever a stand-in for "no upper limit" because
`GetTransactionsAsync` requires a concrete `endDate`), extracted a shared
`UnboundedEndDate() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3)` helper and pointed all
three at it. Correct regardless of server/caller timezone (3 days of slack comfortably covers any
real-world UTC offset), no client changes, no infra changes. Considered and rejected: `DateTime.Now`
(only fixes local dev - Lambda's TZ isn't set to match the user's real timezone in production) and
passing an explicit date from the client (bigger footprint for the same result).

Reproduced-then-confirmed-fixed via curl on a fully clean dataset (delete user -> `clean_local.sh` ->
reseed -> upload -> bulk-apply -> category came back `"Groceries"` correctly). Final verification:
`dotnet test` 133/133, full Playwright suite 24/24 clean.

## Prompt log

- "start a worklog for UBE-75"
- "1. re-use. 2. inactive means nothing for the category, it meansthat when the transaction is flagged with this category the transaction should be set to inactive. 3. correct. 4. I will manually remove"
- "I want to change inactive to be an option in the dropdown with Expense and Income. This should be added as another option to the enum. The Inactive attribute should be removed from the data object and the enum value of Inactive should have the same effect."
- "Read the run_local.sh background output file to confirm the Api and FrontEnd are ready. Test that login now works..." (re-verification instructions, x2)
- "change the code that deletes transactions to extend the end date to UTC now + 3 days and add a comment why"
- "commit and raise PR"
