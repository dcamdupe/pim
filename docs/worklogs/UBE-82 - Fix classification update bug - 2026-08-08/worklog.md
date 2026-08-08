# UBE-82: Bug: Updating transaction classifications only applies to currently loaded transactions

Linear: https://linear.app/uberconcept/issue/UBE-82/bug-updating-transaction-classifications-only-applies-to-currently
Status: In Progress · Priority: No priority

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

- [ ] `stores/transactions.ts` - new Pinia store (load/refresh/updateTransaction, localStorage cache)
- [ ] `App.vue` - wire initial `load()` + 5-minute `refresh()` interval
- [ ] `TransactionsView.vue` - switch to the shared store, client-side range filtering
- [ ] `DashboardView.vue` - switch to the shared store, client-side month filtering
- [ ] `stores/auth.ts` - clear transactions cache/state on logout
- [ ] `FrontEnd.UnitTests/stores/transactions.test.ts` - new
- [ ] Update `TransactionsView`/`DashboardView` unit tests for the store-based mocks
- [ ] `FunctionalTests` - cross-page classification-update scenario
- [ ] `npm run build`/`lint`, `FrontEnd.UnitTests`, relevant Playwright specs all clean

## Prompt log

- "start a worklog for UBE-82"
