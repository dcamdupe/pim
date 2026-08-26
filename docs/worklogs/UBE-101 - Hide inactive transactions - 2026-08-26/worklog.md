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

- [ ] Add `hideIgnored` to `TransactionFilters` + filter logic
- [ ] Add `hideIgnored` to `TransactionFiltersState` + storage validation
- [ ] Add toggle UI in `TransactionsView.vue`, wired to filtering/persistence
- [ ] Unit tests for `transactionFilters.ts`
- [ ] Unit tests for `transactionFilterStorage.ts`
- [ ] Functional test scenario for the toggle
- [ ] Manual verification via `run_local.sh`

## Session log

### Prompt

> start a worklog for UBE-101

### Response

Fetched UBE-101 from Linear ("Transaction list - hide inactice" / "Add a filter option to hide
ignored transactions"), inspected the existing transaction filter code
(`transactionFilters.ts`, `transactionFilterStorage.ts`, `TransactionsView.vue`) to find the
existing `ignore` flag and the `needsCategoryOnly` toggle as a pattern to follow, then created this
worklog folder/file and the `UBE-101/hide-inactive-transactions` branch off `main`.
