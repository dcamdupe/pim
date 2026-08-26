# UBE-101 - Transaction list - hide inactice

Linear: https://linear.app/uberconcept/issue/UBE-101/transaction-list-hide-inactice

## Description

Add a filter option to hide ignored transactions on the transaction list.

Transactions already have an `ignore` flag (set via the existing "Ignore"/"Unignore" row action in
`TransactionsView.vue`), and ignored rows are currently always shown (styled muted, with an
"Ignore" chip). There is no way to filter them out of the list.

## Plan

1. `FrontEnd/src/utils/transactionFilters.ts` - add a `hideIgnored: boolean` field to
   `TransactionFilters`, and exclude `t.ignore` rows from the result when it's set.
2. `FrontEnd/src/utils/transactionFilterStorage.ts` - add `hideIgnored` to `TransactionFiltersState`
   and its validator so the setting persists across sessions like the other filters.
3. `FrontEnd/src/views/TransactionsView.vue` - add a toggle button next to the existing
   "needs category" toggle, wire it into the `filteredTransactions` computed, the filter-persistence
   watcher, and initial load from stored filters.
4. `FrontEnd.UnitTests` - extend `transactionFilters.test.ts` and `transactionFilterStorage.test.ts`
   for the new field.
5. Add a `FunctionalTests` scenario covering the new toggle if one doesn't already fit into an
   existing transactions spec.
6. Manually verify via `scripts/run_local.sh`: toggle hides/shows ignored transactions, and the
   choice persists on reload.

## Checklist

- [x] Add `hideIgnored` to `TransactionFilters` + filter logic
- [x] Add `hideIgnored` to `TransactionFiltersState` + storage validation
- [x] Add toggle UI in `TransactionsView.vue`, wired to filtering/persistence
- [x] Unit tests for `transactionFilters.ts`
- [x] Unit tests for `transactionFilterStorage.ts`
- [x] Functional test scenario for the toggle
- [x] Manual verification via `run_local.sh` (verified via the Playwright run against the live stack below)

## Session log

### Prompt

> start a worklog for UBE-101

### Response

Fetched UBE-101 from Linear ("Transaction list - hide inactice" / "Add a filter option to hide
ignored transactions"), inspected the existing transaction filter code
(`transactionFilters.ts`, `transactionFilterStorage.ts`, `TransactionsView.vue`) to find the
existing `ignore` flag and the `needsCategoryOnly` toggle as a pattern to follow, then created this
worklog folder/file and the `UBE-101/hide-inactive-transactions` branch off `main`.

### Prompt

> yes, go ahead

### Response

Implemented the plan:
- Added `hideIgnored: boolean` to `TransactionFilters` (`transactionFilters.ts`) and excluded
  `t.ignore` rows from the filter result when set.
- Added `hideIgnored` to `TransactionFiltersState` and its storage validator
  (`transactionFilterStorage.ts`).
- Added a "Hide ignored" chip-toggle button in `TransactionsView.vue`, wired into
  `filteredTransactions`, the filter-persistence watcher, and initial load from stored/query
  filters.
- Extended `transactionFilters.test.ts` and `transactionFilterStorage.test.ts` for the new field.
- Extended `transactionIgnore.spec.ts` with a scenario toggling "Hide ignored" on an ignored row
  and verifying it hides/reappears, while an unrelated row stays visible throughout.
- Fixed `transactionListing.spec.ts`'s `.chip-toggle` locator, which had become ambiguous now that
  there are two chip-toggle buttons, by scoping it to the "need a category" one.

Verified: `FrontEnd.UnitTests` (206 tests), `FrontEnd` build + lint, and (after starting the local
stack via `run_local.sh`) the `transactionIgnore.spec.ts` and `transactionListing.spec.ts`
Playwright specs - all green. Did not run the full Playwright suite (small, well-unit-tested
change; only these two specs touch the affected UI).

Per updated global instructions, changes are not committed yet - awaiting explicit approval to
commit.
