# UBE-60: Remember the selected filter categories on the transactions page

Linear: https://linear.app/uberconcept/issue/UBE-60/remember-the-selected-filter-categories-on-the-transactions-page

## Description

Currently `TransactionsView.vue` holds all filter state (date range, search query,
account, category, "needs a category" toggle) in local component `ref`s only.
Nothing is persisted, so refreshing the page or navigating away and back resets
every filter to its default. This worklog stores the selected filters in
`localStorage` so they survive a refresh or a navigate-away-and-back, following
the existing `pim.*` localStorage convention already used by `stores/auth.ts`
and `services/transactionDescriptionsService.ts`.

## Current state (from investigation)

- `FrontEnd/src/views/TransactionsView.vue` — filter bar template (lines
  ~195-220), filter state as local refs: `selectedRange` (21), `searchQuery`
  (26), `selectedAccount` (27), `selectedCategory` (28), `needsCategoryOnly`
  (29). Fed into `filterTransactions()` (`utils/transactionFilters.ts`) via
  computed properties (lines 40-51).
- No Pinia store or route query params involved — purely local component state.
- Existing localStorage precedent: namespaced `pim.*` key, plain
  `localStorage.getItem`/`setItem`, defensive `JSON.parse` in a `try/catch`
  returning a safe default on failure, read on init / write on change. No
  wrapper library.

## Plan

1. Add a `STORAGE_KEY` (e.g. `pim.transactionFilters`) in `TransactionsView.vue`,
   following the same pattern as `stores/auth.ts` / `transactionDescriptionsService.ts`.
2. On component init, read and `JSON.parse` any stored filters (guarded against
   malformed/missing data, falling back to current defaults) and seed the refs.
3. Watch the filter refs and write the current selection to `localStorage` on
   every change.
4. Decide whether `needsCategoryOnly` and the date range are in scope for
   persistence, or just "filter categories" (account/category/search) per the
   issue title — confirm with David before implementing broader scope than the
   category filter.
5. Add/extend `FrontEnd.UnitTests` coverage for the new persistence logic.
6. Manually verify in the browser: set filters, refresh the page, filters are
   restored; navigate to another page and back, filters are restored.
7. Run `npm run lint` and `npm run build` in `FrontEnd/`, and `npm run test` in
   `FrontEnd.UnitTests/`.
8. Consider whether a `FunctionalTests` (Playwright) scenario is warranted for
   this user-facing flow.

## Checklist

- [x] Confirm scope of "filter categories" with David (all filters vs. category only) — confirmed: persist all filters (date range, search, account, category, needs-category toggle)
- [x] Add localStorage persistence (read-on-init, write-on-change) to `TransactionsView.vue` — via new `utils/transactionFilterStorage.ts` (`loadStoredTransactionFilters`/`saveTransactionFilters`), wired in on init and via a `watch` over the five filter refs
- [x] Guard against malformed/missing localStorage data with safe defaults — `isTransactionFiltersState` shape/enum validation, `try/catch` around `JSON.parse`, falls back to `null` (existing defaults) on any mismatch
- [x] Add unit tests in `FrontEnd.UnitTests` — `utils/transactionFilterStorage.test.ts`
- [ ] Manually verify: refresh persists filters
- [ ] Manually verify: navigate away and back persists filters
- [x] Run FrontEnd lint/build and FrontEnd.UnitTests — all pass (55/55 unit tests, lint clean, build succeeds)
- [ ] Add/confirm FunctionalTests scenario (if warranted)

## Prompt log

1. "switch to main"
2. "start a worktree labelled UBE-60"
3. "switch to main"
4. "start a worklog for UBE-60"
