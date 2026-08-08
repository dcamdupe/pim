# UBE-82: Bug: Updating transaction classifications only applies to currently loaded transactions

Linear: https://linear.app/uberconcept/issue/UBE-82/bug-updating-transaction-classifications-only-applies-to-currently
Status: In Progress · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/62

## Description (from Linear)

We want to change the way that data is loaded, in order to improve the performance of displaying
transactions and categorising them.

When the user logs in, load all the transactions in the account into local storage. When a
transaction is updated, updated it in local storage and call the API to update it server side.

Implement a refresh on transactions in local storage every 5 minutes.

Set an expiry on the local storage data for transactions of 10 minutes.

## Current state

- **No shared/global transaction state exists today.** `TransactionsView.vue` and `DashboardView.vue`
  each independently call `getTransactions(startDate, endDate)` (`services/transactionsService.ts`)
  into their own local `ref<Transaction[]>`. Editing a category or toggling ignore in one view only
  mutates that view's own array - this is the literal bug: there's nothing propagating the change to
  any other already-loaded copy of the same data.
- `applySingleCategory` (`TransactionsView.vue`) mutates the edited object in place after a successful
  `updateTransactions()` call; `toggleIgnore` instead does a full `fetchTransactions()` re-fetch after
  updating - already an inconsistency between the two paths in the same file.
- **No Api changes needed.** `updateTransactions()` (`PUT /transactions`) already exists and is reused
  as-is. `GET /transactions` already resolves an omitted `startDate` to "all of this user's
  transactions" - `computeRange('allTime', ...)` (`utils/transactionDateRange.ts`) already relies on
  this today - so "load everything on login" needs no server-side work either.
- **`Transaction` has no unique ID field** (`account`/`date`/`description`/`category`/`amount`/
  `ignore`/`type` only). The only way to reliably mutate "the same transaction" everywhere is object
  identity - every consumer reading from (and filtering over, not cloning) the same shared array.
  `Array.prototype.filter`/`.slice` preserve object references, so this works as long as views bind
  directly to the store's array rather than copying out of it.
- **Existing local-cache precedent**: `transactionDescriptionsService.ts` already caches into
  `localStorage` (key `pim.transactionDescriptions`) as a plain synchronous getter, but with no
  expiry/refresh semantics. The new transactions cache follows the same storage-key convention but
  needs to be reactive (Pinia state, not a plain function) since multiple views must share and react
  to the same live array, plus the 5-minute refresh / 10-minute expiry the ticket asks for.
- Only one Pinia store exists today (`stores/auth.ts`) - this will be the second.

## Plan

**FrontEnd**

1. New `FrontEnd/src/stores/transactions.ts` (Pinia store):
   - `transactions: ref<Transaction[]>([])`, hydrated from `localStorage` (key `pim.transactions`,
     storing `{ transactions, loadedAt }`) when the store is created.
   - `load()`: if the cached `loadedAt` is under 10 minutes old, keep the cached data as-is (no
     fetch). Otherwise (missing, expired, or unparseable) calls `getTransactions(undefined, today)`
     for the full set and writes through to `localStorage` with a fresh `loadedAt`.
   - `refresh()`: unconditional re-fetch + cache write, used by the 5-minute interval below.
   - `updateTransaction(transaction: Transaction, changes: Partial<Transaction>)`: calls
     `updateTransactions([{ ...transaction, ...changes }])`, then on success `Object.assign`s
     `changes` onto the passed-in `transaction` object (the same object instance already living in
     `transactions.value`, since callers always pass one they got from the store) and rewrites the
     `localStorage` cache. No key-matching needed given the object-identity approach above.
2. `App.vue` - call the store's `load()` once on mount (alongside the existing `useTokenRefresh()`
   wiring from UBE-80) and start a 5-minute `setInterval` calling `refresh()`, so it runs for the
   whole authenticated session rather than per-view.
3. `TransactionsView.vue` / `DashboardView.vue` - drop their own `getTransactions()` calls and local
   `transactions` ref in favour of `storeToRefs(useTransactionsStore())`. Date-range filtering
   (`selectedRange`/`computeRange` in `TransactionsView`, the month picker in `DashboardView`) becomes
   a client-side `computed` filter over the store's full array instead of a parameterised API call.
   `applySingleCategory`/`toggleIgnore` call the store's `updateTransaction()` instead of
   `updateTransactions()` directly.
4. `stores/auth.ts` logout path - clear the `pim.transactions` localStorage entry and the transactions
   store's in-memory state, so a different login on the same browser doesn't see stale data.

**Tests**

5. New `FrontEnd.UnitTests/stores/transactions.test.ts` - cache-hit-within-10-min skips the fetch;
   expired/missing/corrupt cache fetches; `updateTransaction` mutates in place and writes through to
   both the API mock and `localStorage`; failure paths (API error on update, fetch failure on load).
6. Update the existing `TransactionsView`/`DashboardView` FrontEnd.UnitTests specs to mock the new
   store instead of `getTransactions`/`updateTransactions` directly.
7. `FunctionalTests` - new/updated Playwright scenario: change a transaction's category on the
   Transactions page, navigate to the Dashboard, and confirm the updated category/recomputed tiles
   reflect it without a full page reload - this is the actual regression the ticket describes.

**Verification**

8. `npm run build`/`lint`, `FrontEnd.UnitTests` (full run - a new shared store touches both pages'
   tests), and the Transactions + Dashboard Playwright specs specifically (cross-page blast radius,
   so not scoping down to a single spec file per usual). No `dotnet` changes, so no Api-side
   verification needed.

## Checklist

- [x] `stores/transactions.ts` - new Pinia store (load/refresh/updateTransaction, localStorage cache)
      - `vue-tsc -b` clean (caught and fixed a real null-vs-number type mismatch in `persist()` -
        it now no-ops if `loadedAt` is still null rather than writing an invalid cache shape)
- [x] `App.vue` - wire initial `load()` + 5-minute `refresh()` interval
      - Extracted into `composables/useTransactionsRefresh.ts` (mirroring `useTokenRefresh.ts`'s
        pattern/testability rationale from UBE-80) rather than inlined in `App.vue`. Also added an
        `isAuthenticated` guard on each tick, same as `useTokenRefresh` - not in the original plan,
        but without it the interval would fetch transactions before login (401, swallowed but
        wasteful) and keep polling after logout. `vue-tsc -b` clean.
- [x] `TransactionsView.vue` - switch to the shared store, client-side range filtering
      - New `filterByDateRange()` in `transactionDateRange.ts` (ISO string comparison, same trick
        `computeRecentTransactions` already uses) replaces the server-side `startDate`/`endDate`
        query - the `watch(selectedRange, fetchTransactions)` refetch-on-range-change is gone
        entirely, range switching is now a synchronous computed.
      - `applySingleCategory`/`toggleIgnore`/`confirmBulkApply` now go through the store's
        `updateTransaction()` (or a forced `refresh()` for the bulk-mapping case, since that one
        changes transactions server-side that we hold no direct references to). This also fixes a
        real pre-existing inconsistency: `toggleIgnore` previously did a full network refetch after
        updating while `applySingleCategory` just mutated locally - both now behave the same way.
- [x] `DashboardView.vue` - switch to the shared store, client-side month filtering
      - `computeDashboardTiles`/`computeExpensesByCategory`/`computeMonthlyIncomeExpenses` already
        filtered by date internally, so passing the full store array instead of a server-fetched
        6-month window needed no new filtering logic - just removed the per-month fetch entirely
        (`chartsLoading`/`chartsError`/`appliedMonthKey` all became unnecessary, since switching
        months is now instant with no async gap to guard against).
      - **Behavior change worth flagging**: "Recent transactions" (`computeRecentTransactions`) now
        always reflects the true most-recent 20 transactions overall, not the most recent within
        whatever 6-month window happened to be fetched for the selected month. Previously, picking
        an old month in the filter would make "recent" mean recent-within-that-old-window; now it's
        always genuinely recent, matching the label. Reads as a fix, not a regression, but calling
        it out since it's an observable change beyond what the ticket asked for.
      - Deleted `components/LoadingSpinner.vue` - it was only ever used for the now-removed
        `chartsLoading` state and had no other callers (confirmed via grep) or tests.
      - Found and fixed a real correctness bug while wiring this up, in `stores/transactions.ts`
        itself: Vue fires a child component's `onMounted` before its parent's, so a view's own
        `load()` call (to know when its own data is ready) races `App.vue`'s `useTransactionsRefresh`
        `load()` call on first page load, firing two concurrent fetches. Added in-flight-promise
        dedup to `refresh()` so both callers await the same request.
- [x] `stores/auth.ts` - clear transactions cache/state on logout
      - Landed in `NavBar.vue`'s `onLogout()` instead of inside `stores/auth.ts` itself - the only
        logout call site (confirmed via grep, `clearToken()` has exactly one caller). Calling
        `transactionsStore.clear()` from inside `auth.ts` would create a module import cycle
        (`auth.ts` → `stores/transactions.ts` → `services/transactionsService.ts` → `auth.ts`, the
        last hop for the auth header); Pinia stores generally tolerate this since the actual store
        bodies only run lazily on first `use*Store()` call, but keeping each store responsible only
        for its own domain state and letting the caller orchestrate both is simpler and avoids
        relying on that. `vue-tsc -b`/`npm run lint` both clean.
- [x] `FrontEnd.UnitTests/stores/transactions.test.ts` - new (cache hit/expiry/corrupt-cache, dedup,
      `updateTransaction` success/failure mutation, `clear()`) - all mock `services/transactionsService`
      (`vi.spyOn`), matching this suite's existing convention rather than mocking the store itself.
      Also added `composables/useTransactionsRefresh.test.ts` (mirroring `useTokenRefresh.test.ts`'s
      fake-timer/mount pattern - not in the original plan, but the composable was new, untested code)
      and a couple of `filterByDateRange` cases in the existing `transactionDateRange.test.ts`.
      157/157 passing (`FrontEnd.UnitTests`, `npm run test`).
- [x] Update `TransactionsView`/`DashboardView` unit tests for the store-based mocks
      - **Turned out to be nothing to do**: neither view had any existing unit test file (confirmed
        via `find`) - this repo's convention is no direct unit tests for `.vue` View components at
        all (only services/stores/composables/utils get `FrontEnd.UnitTests` coverage, per
        `CLAUDE.md`'s directory-mirroring convention); view-level behavior is covered by Playwright
        instead. The original plan's assumption that these specs already existed was wrong - the
        actual regression coverage for this ticket is the `FunctionalTests` scenario (next step).
- [x] `FunctionalTests` - cross-page classification-update scenario
      - New `transactionsCaching.spec.ts`, not an addition to `dashboard.spec.ts`'s existing "Recent
        transactions" test - that existing test would have passed even under the *old*, pre-UBE-82
        code, since Vue Router remounts each view on navigation and the old code always refetched on
        mount anyway. The new spec instead counts `GET /transactions` calls via `page.route`
        (no prior precedent for request-counting in this suite, but it's the only way to actually
        prove "loaded once, reused across pages" rather than just "eventually shows the right data").
      - **Found and fixed a real bug while writing it**: uploading a QIF file could leave newly
        uploaded transactions invisible on `/transactions` if the shared store's cache was still
        "fresh" from an earlier page visit (e.g. the initial Dashboard load on login) - the upload
        changes server-side data the store has no way to know about locally. Fixed by having
        `TransactionUploadView.vue`'s `onSave()` call a forced `transactionsStore.refresh()`
        (alongside the existing best-effort `refreshTransactionDescriptions()`) after a successful
        upload, same pattern as the bulk-mapping case in `TransactionsView.vue`.
      - **Found and fixed a second, more serious real bug**: `Api/Services/TransactionUpdateService.cs`
        server-side stamps `Type`/`Ignore` from the category's configured type whenever `Category`
        changes (`Category.StampTransaction`), discarding whatever the client sent - but
        `PUT /transactions` returned `204 No Content`, so the client never saw the stamped values.
        Under the old per-view-fetch code this was invisible (every navigation re-fetched the
        authoritative server state); under the new cached store, `updateTransaction()`'s local
        `Object.assign(transaction, changes)` left the stale `type` in place, so Dashboard's
        profit/expense math (`t.type === 'Income'`) silently miscounted newly-categorised income.
        Caught by 2 of `dashboard.spec.ts`'s own pre-existing tests failing (real failures, not
        flakes - confirmed by first trying a full local-data reset, which did *not* fix them).
        Asked the user how to fix it (Api returns the updated transactions vs. replicating the
        category→type mapping client-side); went with the Api change:
        - `Api/Controllers/TransactionsController.cs`: `PUT /transactions` now returns
          `Ok(new TransactionsResponse(transactions))` instead of `NoContent()` - a small change,
          since `Category.StampTransaction` already mutates the same `Transaction` object instances
          the controller holds (confirmed by reading `TransactionUpdateService.cs` directly, not just
          trusting a research agent's summary).
        - `Api.IntegrationTests/TransactionsEndpointTests.cs`: updated 4 `NoContent` assertions to
          `OK`, and strengthened `Put_StampsTypeAndIgnore_FromTheCategoryDefinition_WhenCategoryChanges`
          to assert on the response body directly (what the FrontEnd now actually relies on), not just
          the persisted record. Needed a `JsonStringEnumConverter` added to the test file's
          `JsonSerializerOptions` to deserialize `Transaction.Type` (existing precedent in
          `SettingsEndpointTests.cs`). 85 unit + 55 integration passing.
        - `FrontEnd/src/services/transactionsService.ts`: `updateTransactions()` now returns
          `Promise<Transaction[]>` (the response body), not `Promise<void>`.
        - `FrontEnd/src/stores/transactions.ts`: `updateTransaction()` merges the full server
          response onto the local object (`Object.assign(transaction, updated)`), not just the
          locally-requested `changes` - authoritative by construction, no duplicated category→type
          logic client-side.
        - Updated `FrontEnd.UnitTests/services/transactionsService.test.ts` and
          `stores/transactions.test.ts` for the new return shape, and added a regression test
          (`updateTransaction() merges the full server response, not just the requested changes`)
          asserting the exact scenario above.
      - **Debugging detour worth recording**: after the Api fix, `dashboard.spec.ts` and several
        other specs *still* failed - chased this through two rounds of clearing local test data
        (`scripts/clean_local.sh` plus manually resetting the seeded test user's `Accounts` list in
        DynamoDB Local, since `clean_local.sh` doesn't touch the `User` table) before realising the
        actual cause: the long-running `dotnet run --project Api` process from earlier in the session
        was still serving the *pre-fix* build (`dotnet run` doesn't hot-reload controller changes) -
        confirmed via a direct `curl PUT /transactions` returning `204` instead of the expected `200`.
        Restarted via `scripts/run_local.sh`, re-verified with `curl` (`200` with the expected body),
        cleaned local data one final time, and all 14 tests in the affected specs passed in 17s (down
        from 1.6-2 minutes of 30s timeouts each). Two real, separate lessons here: don't assume a
        long-running dev server has picked up a controller change, and `clean_local.sh`'s known gap
        (leftover Settings `Account`s) can compound into confusing failures like a permanently-disabled
        Save button ("Account names must be unique") when a test with a hardcoded (non-`runId`) account
        name fails and is re-run - `transactionCategorization.spec.ts` and part of
        `transactionListing.spec.ts` have this pre-existing fragility, unrelated to this change.
- [x] `npm run build`/`lint`, `FrontEnd.UnitTests`, relevant Playwright specs all clean
      - `dotnet build`/`dotnet test`: 0 warnings, 85 unit + 55 integration passing.
      - `FrontEnd`: `vue-tsc -b`, `npm run lint`, `npm run build` all clean.
      - `FrontEnd.UnitTests`: 159/159 passing.
      - `FunctionalTests`: the 6 cross-page-impacted specs (`transactionsCaching`, `dashboard`,
        `transactionCategorization`, `transactionIgnore`, `transactionListing`, `transactionUpload`) -
        14/14 passing, run against a freshly-restarted Api and clean local data.

## Post-completion fix: account deletion

The user asked directly whether deleting an account (Settings) refreshes the transactions store -
it didn't. `SettingsController.DeleteAccount` cascades to delete all of that account's transactions
server-side (`DeleteTransactionsForAccountAsync`), the same "server changed data the store doesn't
know about" category as the upload/category-stamping bugs above, but `SettingsView.vue`'s
`confirmRemoveAccount()` only spliced its own local account list - never touched the transactions
store at all.

- [x] `SettingsView.vue` - force `transactionsStore.refresh()` after a successful account deletion
      - First attempt placed the forced refresh *before* clearing `pendingRemoval` (closing the
        confirmation modal), which still failed the existing
        `accountDeletion.spec.ts` test ("Yes deletes the account immediately and cascades to delete
        its transactions") - that test calls `page.reload()` right after deletion, which discards
        the in-flight `refresh()` before it can persist to `localStorage`, so the reloaded page
        falls back to the still-fresh (but now stale) cached data. Verified this wasn't a server-side
        timing/consistency issue first, via a direct `curl` PUT-settings/upload/DELETE-account/GET
        sequence confirming the Api cascades immediately, before concluding it was a FrontEnd race.
      - Fix: moved `pendingRemoval.value = null` to *after* `await transactionsStore.refresh()`
        instead of before - the confirmation modal's full-page backdrop stays up (blocking
        navigation) for that brief extra window, guaranteeing the refreshed data is persisted before
        the user can navigate away or reload. `accountDeletion.spec.ts` (all 4 tests) plus the
        earlier 14-test batch (18 total) all pass; `FrontEnd.UnitTests` 159/159; `vue-tsc -b`/
        `npm run lint` clean.

## Prompt log

- "start a worklog for UBE-82"
- "start"
- "go ahead"
- "go"
- "change the code temporarily to refresh the transactions every 5 seconds"
- "switch back"
- "what are the remaining steps?"
- "go ahead"
- "go"
- "go ahead" (Api-vs-client-side fix choice for the Type/Ignore stamping bug)
- "does this refresh the transactions when an account is deleted?"
- "yes"
