# UBE-87: Load settings on login, similar to transactions

Linear: https://linear.app/uberconcept/issue/UBE-87/load-settings-on-login-similar-to-transactions
Status: In Progress · Priority: No priority

## Description (from Linear)

Similar to UBE-82. Refresh this every 1 minute or when settings are saved. Change the code to use
the local storage settings rather than calling the API.

## Current state

- **No shared settings cache exists.** `SettingsView.vue`, `DashboardView.vue`, and
  `TransactionUploadView.vue` each independently call `getSettings()` (`GET /settings`) on their own
  mount - `SettingsView` for `accounts`/`categories`, `DashboardView` for `minTransactionDate` (the
  month filter's lower bound), `TransactionUploadView` for `accounts` (the upload form's dropdown).
- **Categories already have an ad-hoc, incomplete cache**: `categoriesService.ts` caches just the
  `categories` slice of `Settings` into `localStorage` (`pim.categories`), read synchronously via
  `getCachedCategories()`/`categoryNames()`/`categoryColor()` (consumed by `TransactionsView.vue`,
  `RecentTransactionsList.vue`, `dashboardMetrics.ts`). It's populated once on login
  (`LoginView.vue` fires `refreshCategories()` fire-and-forget after a successful login) and
  refreshed again only when `SettingsView.vue` adds/removes a category - no periodic refresh, and
  `accounts`/`minTransactionDate` aren't cached at all.
- This is the same category of gap [[UBE-82]] fixed for transactions, but for settings: every page
  needing settings data fetches its own copy, and there's no single source of truth kept fresh in
  the background.
- No Api changes anticipated - `GET /settings` already returns the full `Settings` shape
  (`accounts`/`categories`/`minTransactionDate`) in one call; `PUT /settings`,
  `DELETE /settings/account`, `POST/DELETE /settings/category` already exist and are reused as-is.

## Plan

**FrontEnd**

1. New `FrontEnd/src/stores/settings.ts` (Pinia store, mirroring `stores/transactions.ts`'s shape):
   - `accounts`, `categories`, `minTransactionDate`, `loadedAt` state, hydrated from `localStorage`
     (single key `pim.settings`) on creation - replaces `categoriesService.ts`'s separate
     `pim.categories` key entirely.
   - `load()`: fetches only if never loaded before (`loadedAt === null`) - unlike the transactions
     store there's no expiry window in this ticket's spec, just "load on login" plus the interval/
     save-triggered refreshes below keeping it current thereafter.
   - `refresh()`: unconditional fetch + persist, with the same in-flight-promise dedup as
     `stores/transactions.ts` (two callers - the interval and a page mount - can race on load).
   - `clear()`: reset state + remove the `localStorage` entry, for logout.
2. New `FrontEnd/src/composables/useSettingsRefresh.ts`, mirroring `useTransactionsRefresh.ts`
   exactly (1-minute interval per the ticket, `isAuthenticated` guard, swallowed background-tick
   failures).
3. `App.vue` - wire `useSettingsRefresh()` alongside the existing two composables.
4. `SettingsView.vue` - seed its local editable `accounts`/`categories` refs from
   `settingsStore.load()` instead of its own `getSettings()` call (kept as local copies, not direct
   store bindings - this view actively edits rows before saving, same as today). Every successful
   mutation (`onSave`, `confirmRemoveAccount`, `onAddCategory`, `confirmRemoveCategory`) calls
   `settingsStore.refresh()` afterward - "when settings are saved" from the ticket - replacing the
   existing ad-hoc `refreshCategories()` calls.
5. `DashboardView.vue` / `TransactionUploadView.vue` - replace their own `getSettings()` calls with
   `settingsStore.load()` + reading `settingsStore.minTransactionDate` / `.accounts`.
6. `categoriesService.ts` - retire `getCachedCategories()`'s own `localStorage` caching;
   `categoryNames()`/`categoryColor()` keep their existing signatures (so `TransactionsView.vue`,
   `RecentTransactionsList.vue`, `dashboardMetrics.ts` need no changes at all) but read from
   `useSettingsStore().categories` instead. `refreshCategories()` and `pim.categories` are removed.
7. `LoginView.vue` - call the settings store's load instead of the retired `refreshCategories()`.
8. `NavBar.vue`'s `onLogout()` - also `settingsStore.clear()`, alongside the existing
   `transactionsStore.clear()`.

**Tests**

9. New `FrontEnd.UnitTests/stores/settings.test.ts` and `composables/useSettingsRefresh.test.ts`,
   mirroring the transactions store/composable test structure from UBE-82.
10. Update `FrontEnd.UnitTests/services/categoriesService.test.ts` for the store-backed
    implementation (mocking `useSettingsStore` state instead of `localStorage` directly).
11. `FunctionalTests` - new scenario proving cross-page settings consistency without a fetch/reload
    (e.g. add an account in Settings, confirm it's immediately available on the Upload page's
    account dropdown), mirroring UBE-82's `transactionsCaching.spec.ts` request-counting approach.
    Also re-run the existing `settings.spec.ts` - it's flagged pre-existing-flaky in memory (races
    ahead of the async accounts fetch), worth checking whether this change affects that timing.

**Verification**

12. `npm run build`/`lint`, `FrontEnd.UnitTests`, and the Settings/Dashboard/Upload-touching
    Playwright specs (cross-page blast radius, same as UBE-82's approach). No `dotnet` changes
    anticipated, so no Api-side verification needed unless something during implementation says
    otherwise.

## Checklist

- [x] `stores/settings.ts` - new Pinia store (load/refresh/clear, localStorage cache) - `vue-tsc -b` clean
- [x] `composables/useSettingsRefresh.ts` - new, 1-minute interval, mirrors `useTransactionsRefresh.ts`
- [x] `App.vue` - wired in - `vue-tsc -b`/`npm run lint` clean
- [x] `SettingsView.vue` - load from the store, refresh() after every save/add/delete
      - Found and fixed a real bug while seeding the local edit buffer: `accounts.value =
        settingsStore.accounts` (direct assignment) would have made the view's local editable copy
        share array/object identity with the shared store, so an unsaved "+ Add account" row or
        edit would mutate shared state other pages read before Save was ever clicked. Fixed by
        copying (`.map((a) => ({ ...a }))`) instead of assigning by reference - same for `categories`.
      - `confirmRemoveAccount` now force-refreshes both `transactionsStore` (transactions cascade-
        deleted) and `settingsStore` (the account itself is gone) in parallel, still closing the
        modal only after both resolve (same ordering fix as UBE-82's account-deletion bug).
      - `onSave`/`onAddCategory`/`confirmRemoveCategory` now call `settingsStore.refresh()` instead
        of the old `categoriesService.refreshCategories()` (retired in a later step).
      - `vue-tsc -b`, `npm run lint`, `npm run build` all clean.
- [x] `DashboardView.vue` - use the store for `minTransactionDate`
      - `minTransactionDate` is now a `computed` over `settingsStore.minTransactionDate` instead of a
        one-time-populated local ref, so it stays live if the store refreshes later - same non-fatal
        best-effort `settingsStore.load().catch(() => {})` as the old `getSettings()` call.
- [x] `TransactionUploadView.vue` - use the store for `accounts`
      - Bound directly via `storeToRefs` (read-only here, no local edit buffer needed, unlike
        `SettingsView.vue`). Added a `watch(accounts, ...)` not in the original plan: since `accounts`
        is now live (can change under this view via the 1-minute background refresh, e.g. if the
        selected account was deleted in another tab), a stale `selectedAccount` pointing at a
        no-longer-existing account would silently upload under a ghost account name - falls back to
        the first remaining account if the current selection disappears.
      - `vue-tsc -b`, `npm run lint`, `npm run build` all clean.
- [x] `categoriesService.ts` - delegate to the store, retire its own cache
      - `categoryNames()`/`categoryColor()` kept their exact signatures, so `TransactionsView.vue`,
        `RecentTransactionsList.vue`, `dashboardMetrics.ts` needed zero changes. `getCachedCategories()`/
        `refreshCategories()`/`pim.categories` all removed.
- [x] `LoginView.vue` - load the settings store instead of `refreshCategories()`
      - Used a forced `settingsStore.refresh()`, not `load()` - `pim.settings`/`pim.transactions`
        aren't scoped per-user in `localStorage`, so a stale cache left by a *previous* session in
        the same browser must not be trusted just because `loadedAt` is already set. This mirrors
        what the old `refreshCategories()` call already did unconditionally on every login - `load()`
        would have been a silent regression here specifically (fine everywhere else it's used).
      - `vue-tsc -b`, `npm run lint`, `npm run build` all clean.
- [x] `NavBar.vue` - clear the settings store on logout - `vue-tsc -b`/`npm run lint` clean
- [x] `FrontEnd.UnitTests/stores/settings.test.ts` + `composables/useSettingsRefresh.test.ts` - new
      - Mirror `stores/transactions.test.ts`/`composables/useTransactionsRefresh.test.ts`'s structure,
        adapted for no-expiry `load()` semantics (fetches only if never loaded at all, regardless of
        age - explicitly tested, since that's a real behavioral difference from the transactions store).
- [x] `FrontEnd.UnitTests/services/categoriesService.test.ts` - updated
      - Rewritten, not just tweaked: the old tests exercised `getCachedCategories()`/
        `refreshCategories()` directly against `localStorage` (`pim.categories`), both now removed.
        New tests just check `categoryNames()`/`categoryColor()`'s lookup logic against a
        directly-populated `useSettingsStore()`.
      - **Found two more dependent test breakages while running the full suite** (not in the
        original plan): `utils/dashboardMetrics.test.ts`'s `computeExpensesByCategory` tests seeded
        the old `pim.categories` localStorage key directly - `categoryColor()` (called internally to
        build each `CategoryExpense.color`) now needs an active Pinia instance, which none of these
        pure-function tests had set up at all (`getActivePinia()` threw). Fixed by seeding
        `useSettingsStore().categories` directly in that describe block's `beforeEach` instead.
        169/169 passing (`FrontEnd.UnitTests`, `npm run test`).
- [x] `FunctionalTests` - cross-page settings scenario, `settings.spec.ts` re-checked
      - New `settingsCaching.spec.ts`, mirroring UBE-82's `transactionsCaching.spec.ts` GET-counting
        approach exactly (same reasoning: a naive "does it eventually show up" test would pass even
        under the old per-view-fetch design, since Vue Router remounts on navigation).
      - **Required restarting the local dev stack first** - Api/FrontEnd (`scripts/run_local.sh`)
        had been stopped since the UBE-82 session; `settings.spec.ts` initially failed at the very
        first login step for this reason, not a real regression.
      - **Debugging detour, this time a bug in my own test, not the product**: the new spec's cleanup
        step hung for the full 30s timeout trying to click a "Remove account" button that
        provably existed (confirmed via an accessibility-tree dump). Root cause:
        `page.locator('.account-row', { hasText: accountName })` can never match, because the
        account name lives inside an `<input>` (`v-model`) - an input's `value` is a DOM property,
        never part of `textContent`, so Playwright's `hasText` (which matches rendered text content)
        can never see it. `accountDeletion.spec.ts` already hit and documented this exact gotcha
        with its own `findAccountRow()` helper (checks each row's live `.inputValue()` instead) -
        adopted the same helper here rather than re-discovering a different workaround. First tried
        clearing accumulated leftover test accounts (from my own repeated failed runs) before
        realizing it wasn't a data problem at all, since the failure reproduced identically on a
        freshly-reset account list too.
      - Re-ran `settings.spec.ts` (flagged pre-existing-flaky in memory) plus the broader
        settings/account-touching batch (`accountDeletion`, `dashboard`, `transactionUpload`) on
        clean local data - 11/11 passing, no flake observed this run.
- [x] `npm run build`/`lint`, `FrontEnd.UnitTests`, relevant Playwright specs all clean
      - `vue-tsc -b`, `npm run lint`, `npm run build` (FrontEnd) - all clean.
      - `FrontEnd.UnitTests` - 169/169 passing.
      - `FunctionalTests` - ran the **full suite** (not just the settings-touching subset), given
        how broadly settings underpins the app (accounts feed Transactions/Upload, categories feed
        categorization, `minTransactionDate` feeds Dashboard) - 28/28 passing, on clean local data.
      - No `dotnet`/Api changes this ticket, so no Api-side verification needed.

## Prompt log

- "start a worklog for UBE-87" → created this worklog + branch `UBE-87/load-settings-on-login` off `main`
- "start work" → step 1: added `stores/settings.ts`
- "go" → steps 2-3: added `composables/useSettingsRefresh.ts` (1-minute interval) and wired it into `App.vue`
- "go ahead" → step 4: `SettingsView.vue` reads/writes through the store; found and fixed a real reference-sharing bug in the local edit-buffer seeding along the way
- "go" → step 5: `DashboardView.vue`/`TransactionUploadView.vue` read `minTransactionDate`/`accounts` from the store; added a stale-selection guard on the upload page's account dropdown
- "go" → steps 6-7: `categoriesService.ts` delegates to the store (own cache retired); `LoginView.vue` force-refreshes the settings store on login instead of the old unconditional `refreshCategories()`
- "yes" → step 8: `NavBar.vue` clears the settings store on logout alongside the transactions store
- "go ahead" → step 9: new `stores/settings.test.ts` + `composables/useSettingsRefresh.test.ts`; rewrote `categoriesService.test.ts` and fixed a fallout breakage in `dashboardMetrics.test.ts` (needed an active Pinia instance now that `categoryColor()` reads the store) - 169/169 passing
- "go ahead" → step 10: new `settingsCaching.spec.ts`; restarted the stopped local dev stack; found and fixed a `hasText`-vs-input-value bug in my own new test (not a product bug) using the existing `findAccountRow()` precedent from `accountDeletion.spec.ts`; 11/11 passing across the settings/account-touching Playwright batch
- "go" → step 11 (final verification): `vue-tsc -b`/`npm run lint`/`npm run build` clean, `FrontEnd.UnitTests` 169/169, full `FunctionalTests` suite 28/28 - worklog complete
