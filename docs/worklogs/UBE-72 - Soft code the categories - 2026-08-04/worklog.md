# UBE-72: Soft code the categories

Linear: https://linear.app/uberconcept/issue/UBE-72/soft-code-the-categories
Status: Done · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/51

## Description (from Linear)

Store the categories in the settings table. Store colour and category name. When creating a
category provide a good UX for selecting the colour.

Load the values into local storage at login and update them whenever the settings are saved.

Update the front end to use these values rather than hard coding them.

Populate defaults for local accounts, in setup_local.sh.

Categories cannot be updated, only added and deleted. API for this:

* POST /settings/category - add
* DELETE /settings/category - delete

Removing a category should confirm first with a modal pop up, warning that this category will be
deleted from all transactions. The API method should remove all instances of the category from the
transactions.

## Current state

- `FrontEnd/src/constants/categories.ts` is the single hardcoded source of truth: a `CATEGORIES`
  const array (12 names incl. `Income` and `Internal Transfer`) + a `CATEGORY_COLORS` hex map,
  consumed by `TransactionsView.vue`, `RecentTransactionsList.vue`, `SpendingByCategoryChart.vue`,
  and `dashboardMetrics.ts`.
- Api-side, `Category` is just a plain `string` on `Transaction`/`DescriptionMapping` - no
  enum/type, no validation. The only hardcoded category value on the Api is
  `InternalTransferMatcher.CategoryName = "Internal Transfer"`.
- There is no separate "Settings" table - `SettingsController` (`GET/PUT /settings`,
  `DELETE /settings/account`) reads/writes fields directly on the `User` entity (`Accounts`,
  `MinTransactionDate`), via the generic `IRepository<User>` / `DynamoDbRepository<User>`.
- UBE-57 already built the exact pattern this ticket needs for categories: `Account` add/edit goes
  through `PUT /settings`, remove goes through a dedicated `DELETE /settings/account` that cascades
  (deletes every transaction on that account) and is gated behind a confirm modal in
  `SettingsView.vue`. `TransactionUpdateService` already has two bulk cross-month mutation methods
  built on this shape: `DeleteTransactionsForAccountAsync` and `ApplyDescriptionMappingAsync` (scan
  all `TransactionMonth` buckets for a user, mutate matches, `UpdateAsync` per changed bucket).
- `refreshTransactionDescriptions()` / `getCachedTransactionDescriptions()` in
  `transactionDescriptionsService.ts` is the existing local-storage-cache-warmed-at-login pattern
  (`pim.transactionDescriptions` key, synchronous cached read + async refresh, warmed in
  `LoginView.vue` right after `authStore.setToken(token)`).
- `scripts/setup_local.sh` seeds one `User` row (email/password/empty `Accounts`) via `jq` +
  `aws dynamodb put-item`; no category seeding today.

## My interpretation of the ticket (flagging for confirmation before I start)

1. **"the settings table"**: there is no separate Settings table in this codebase - Accounts
   already live directly on `User` and are exposed through `SettingsController`. I'll add
   `Categories` the same way (a `List<Category>` field on `User`), not a new DynamoDB table/entity.
2. **Category shape**: `{ Name: string, Colour: string }` (hex colour), mirroring `Account`'s
   shape/conventions. Categories "cannot be updated" per the ticket, so no PUT/edit path - only
   `POST /settings/category` (add) and `DELETE /settings/category` (remove), matching by `Name`.
3. **What "remove all instances ... from the transactions" means**: clear the `Category` field on
   every matching transaction (set to `""`) rather than deleting the transactions themselves
   (deleting the *account* cascades to delete transactions; deleting a *category* should not delete
   financial data, just declassify it) - implemented as a new
   `TransactionUpdateService.RemoveCategoryFromTransactionsAsync`, same scan-all-months-and-mutate
   shape as the two existing bulk methods.
4. **`Internal Transfer` protection**: `InternalTransferMatcher.CategoryName` hardcodes the exact
   string `"Internal Transfer"` and the automated matcher depends on it. I'll block
   `DELETE /settings/category` for that specific name (400) so a user can't silently break
   auto-matching. It stays addable/removable like any other category otherwise (i.e. still seeded
   as a default, just not user-deletable).
5. **Colour-picker UX**: initially used a native `<input type="color">` swatch picker on the "add
   category" form; superseded per follow-up request - now a clickable grid of 40 standard colours
   (`FrontEnd/src/constants/colourPalette.ts`, 8 hues x 5 shades) with a selection ring, so users
   pick from a curated, always-legible set instead of freehand RGB.
6. **Default categories**: seed the same 12 names/colours currently hardcoded in
   `constants/categories.ts` onto the `setup_local.sh` test user's `Categories` field, so local dev
   behaviour doesn't regress once the frontend stops hardcoding them.

## Plan

**Api**

1. `Api/Data/Category.cs` - new `sealed class Category { required string Name; required string Colour; }`.
2. `Api/Data/User.cs` - add `List<Category> Categories { get; set; } = [];`.
3. `Api/Controllers/SettingsController.cs`:
   - include `Categories` in `SettingsResponse`.
   - `[HttpPost("settings/category")]` - validate non-empty name + case-insensitive uniqueness
     against `user.Categories`, append, `UpdateAsync`, `NoContent()`.
   - `[HttpDelete("settings/category")]` - 400 if `Name == InternalTransferMatcher.CategoryName`;
     404 if no match; else `RemoveAll` by `Name`, `UpdateAsync`, then call
     `_transactionUpdateService.RemoveCategoryFromTransactionsAsync(user.Email, name)`, `NoContent()`.
4. `Api/Services/ITransactionUpdateService.cs` + `TransactionUpdateService.cs` - add
   `RemoveCategoryFromTransactionsAsync(email, categoryName)` following the
   `DeleteTransactionsForAccountAsync` shape (scan all months via `ITransactionQueryService`, clear
   `Category` to `""` on matches, `UpdateAsync` per changed bucket).
5. `Api.IntegrationTests/AuthorizationTests.cs` - add `POST /settings/category` and
   `DELETE /settings/category` to `ProtectedEndpoints()`.
6. `Api.IntegrationTests/SettingsEndpointTests.cs` - add coverage: add category, duplicate name
   rejected, delete category clears it from transactions across multiple months, delete unknown
   category 404s, delete `Internal Transfer` 400s.
7. `Api.UnitTests` - unit test `RemoveCategoryFromTransactionsAsync` on
   `TransactionUpdateServiceTests.cs` (mirrors existing account-deletion coverage there).

**FrontEnd**

8. `FrontEnd/src/services/settingsService.ts` - extend `Settings`/`getSettings` with
   `categories: Category[]`; add `addCategory(category)` (POST) and `deleteCategory(name)` (DELETE).
9. New `FrontEnd/src/services/categoriesService.ts` - local-storage cache (`pim.categories` key)
   mirroring `transactionDescriptionsService.ts`: `getCachedCategories()` (sync),
   `refreshCategories()` (async fetch + `localStorage.setItem`). `categoryColor()` moves here,
   reading from the cache instead of the static map. Delete `constants/categories.ts`.
10. `LoginView.vue` - warm the categories cache alongside the existing
    `refreshTransactionDescriptions()` best-effort call.
11. `SettingsView.vue` save/add/delete handlers - call `refreshCategories()` after each successful
    settings/category mutation so localStorage stays in sync ("update them whenever the settings
    are saved").
12. Update all current static-import consumers to the new cache-backed source:
    `TransactionsView.vue`, `RecentTransactionsList.vue`, `SpendingByCategoryChart.vue`,
    `dashboardMetrics.ts` (its `'Income'`/`'Internal Transfer'` string comparisons stay as-is - out
    of scope, not a hardcoded list).
13. `SettingsView.vue` - add a Categories section: list with name + colour swatch, an "add category"
    form (name input + `<input type="color">`), and a delete button per category reusing the
    existing confirm-modal pattern (from UBE-57's account removal) with copy warning the category
    will be removed from all transactions. Hide/disable delete for `Internal Transfer`.
14. `FrontEnd.UnitTests` - tests for `categoriesService.ts` (cache read/write/refresh) and updates
    to any existing tests/mocks that imported the old static `constants/categories.ts`.
15. `scripts/setup_local.sh` - seed the test user's `Categories` field with the current 12
    name/colour defaults in the `user_data` jq blob.
16. `FunctionalTests` - extend/add a Playwright scenario: add a category via Settings, confirm it
    appears in the transaction category dropdown; delete a category, confirm the modal, confirm it's
    cleared from a transaction that had it.

**Verification**

17. `dotnet build` / `dotnet test`; `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests`;
    relevant Playwright specs; manual browser check (add/delete category, colour picker, confirm
    modal, dropdown updates, light + dark).

## Checklist

- [x] `Api/Data/Category.cs` + `User.Categories`
- [x] `SettingsController` - `Categories` in response, `POST`/`DELETE /settings/category`
- [x] `TransactionUpdateService.RemoveCategoryFromTransactionsAsync`
- [x] `AuthorizationTests.cs` - new protected endpoints
- [x] `SettingsEndpointTests.cs` - new coverage
- [x] `TransactionUpdateServiceTests.cs` - new coverage
- [x] `settingsService.ts` - categories add/delete
- [x] `categoriesService.ts` - local storage cache + `categoryColor()`; remove `constants/categories.ts`
- [x] `LoginView.vue` - warm categories cache
- [x] `SettingsView.vue` - refresh cache on save/add/delete (account save doesn't touch categories, so
      only add/delete category call `refreshCategories()`)
- [x] Update category consumers (`TransactionsView.vue`, `RecentTransactionsList.vue`, `dashboardMetrics.ts`) -
      `SpendingByCategoryChart.vue` turned out not to import the constant directly, nothing to change there
- [x] `SettingsView.vue` - Categories UI (list, add form + colour picker, delete + confirm modal)
- [x] `FrontEnd.UnitTests` - `categoriesService.ts` + updated existing tests (112/112 passing)
- [x] `scripts/setup_local.sh` - seed default categories (verified: reseeded test user has 12 categories)
- [x] `FunctionalTests` - add/delete category scenario
- [x] Build/test/lint verification + manual browser check (light + dark) - `dotnet test` 125/125,
      `npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112, full Playwright suite 24/24 (one
      `Month filter` failure on the first full-suite run was pre-existing shared-dataset flakiness -
      passed alone and on a clean re-run of the full suite); Settings page checked visually in light
      + dark (screenshots), 12 seeded default categories render with colour swatches, Internal
      Transfer's Remove button correctly disabled
- [x] Follow-up: replaced the native `<input type="color">` with a 40-swatch palette picker
      (`FrontEnd/src/constants/colourPalette.ts`) in `SettingsView.vue`'s add-category form -
      `npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112, full Playwright suite 24/24,
      verified visually via screenshot (10x4 grid, selection ring on click)
- [x] Follow-up: categories list changed to a 2-column grid with tighter row padding, and the
      40-colour palette moved from an always-visible grid into a dropdown (a coloured trigger
      button to the right of the "Name" field that opens the swatch grid as an absolutely-positioned
      panel, closing on selection or on focus/click leaving the widget) - `npm run build`/`lint`
      clean, `FrontEnd.UnitTests` 112/112, full Playwright suite 24/24, verified visually via
      screenshot (2-column list, dropdown closed and open states)
- [x] Follow-up: added a second Save button (same `onSave` handler/state) below the Categories
      section, so accounts can be saved without scrolling back up past a long category list -
      required updating every Playwright spec that clicks the Settings "Save" button or asserts on
      the "Saved."/"Account names must be unique." text, since both now render twice
      (`.first()` added throughout) - `npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112,
      full Playwright suite 24/24, verified visually via screenshot

## Prompt log

- "start a worklog for UBE-72"
- "these are correct" (confirming the interpretation questions above)
- "adjust the colour picker to select from a pallet of 40 standard colours"
- "adjust the categories to a 2 column display that is less spaced out vertically. Dioplay the pallet as a dropdown to the right of the new category name"
- "Add another save button below the categories, triggering the same action"
- "commit and raise the PR"
