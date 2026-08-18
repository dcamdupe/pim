# UBE-94: Add a transaction filter to filter by +/-

## Linear issue

[UBE-94](https://linear.app/uberconcept/issue/UBE-94/add-a-transaction-filter-to-filter-by) — Add a transaction filter to filter by +/-

> Add an additional filter option
>
> * +/- filters all transactions to negative & positive amounts
>
> Change needs category to also filter out ignored transactions

## Description

Two changes to the Transactions view filter bar, both purely client-side (all
transaction filtering already happens in-browser against the full cached
transaction set — the Api only supports `startDate`/`endDate`):

1. A new "+/-" filter (all / positive / negative) alongside the existing
   account/category filters, so transactions can be narrowed to only
   income-shaped (positive) or expense-shaped (negative) amounts.
2. The "need a category" chip currently only checks `t.category` — an ignored
   transaction with no category still counts as "needs a category" even
   though it never will. It should also exclude `t.ignore` transactions.

## Plan

- `FrontEnd/src/utils/transactionFilters.ts`
  - Add `amountSign: '' | 'positive' | 'negative'` to `TransactionFilters`
    and filter on `t.amount` accordingly (`''` = no filtering).
  - Fix `needsCategoryOnly` branch to also exclude `t.ignore` transactions.
- `FrontEnd/src/utils/transactionFilterStorage.ts`
  - Add `amountSign` to `TransactionFiltersState` + its validator, so the new
    filter persists like the others.
- `FrontEnd/src/views/TransactionsView.vue`
  - Add `selectedAmountSign` ref + `<select>` in the filter bar (All /
    Positive / Negative).
  - Wire it into the `rangeFilteredTransactions` → `filteredTransactions`
    computed chain, the storage `watch`, and initial load from
    `loadStoredTransactionFilters()`.
  - Fix `needsCategoryCount` and the `needsCategoryOnly` branch of
    `filteredTransactions` to also exclude `t.ignore` (mirrors the util fix,
    since this view computes that branch inline rather than delegating to
    `filterTransactions`'s own `needsCategoryOnly` handling).
- `FrontEnd.UnitTests/utils/transactionFilters.test.ts`
  - Cases for `amountSign: 'positive'` / `'negative'` / `''`.
  - Case: `needsCategoryOnly` excludes an ignored, uncategorised transaction.
- `FrontEnd.UnitTests/utils/transactionFilterStorage.test.ts`
  - Round-trip/validation coverage for the new `amountSign` field.
- `FunctionalTests/`
  - Extend the existing transactions filter Playwright scenario to cover the
    new +/- filter (only if a suitable scenario file already exists to
    extend).

## Checklist

- [x] Add `amountSign` filter to `transactionFilters.ts` (+ needsCategoryOnly/ignore fix)
- [x] Add `amountSign` to `transactionFilterStorage.ts`
- [x] Add +/- `<select>` to `TransactionsView.vue` and wire it up
- [x] Fix `needsCategoryCount`/`filteredTransactions` in `TransactionsView.vue` to exclude ignored transactions
- [x] Update/add unit tests in `FrontEnd.UnitTests`
- [x] Extend Playwright functional test coverage
- [x] Run `npm run lint`, `FrontEnd.UnitTests` (`npm run test`), and Playwright suite for the affected spec
- [ ] Review diff and open PR

## Session log

### 2026-08-18

- Retrieved UBE-94 from Linear.
- Explored existing filter code (`transactionFilters.ts`, `transactionFilterStorage.ts`,
  `TransactionsView.vue`, `dashboardMetrics.ts`'s `isCounted`/`ignore` pattern) to confirm current
  behaviour and scope the plan above.
- Created this worklog and branch `UBE-94/filter-transactions-by-plus-minus` off `main`.
- Implemented the `amountSign` filter (`transactionFilters.ts`, `transactionFilterStorage.ts`,
  `TransactionsView.vue`) and the needs-a-category/ignore fix in the same three files.
- Extended `FrontEnd.UnitTests/utils/transactionFilters.test.ts` and
  `transactionFilterStorage.test.ts` with cases for the new filter and the ignore fix - full
  `npm run test` suite (182 tests) passes.
- `npm run lint` and `npm run build` (incl. `vue-tsc` typecheck) both pass clean.
- Extended `FunctionalTests/tests/transactionListing.spec.ts`'s combined filter test to cover the
  +/- filter and the ignore/needs-a-category fix; ran it plus `transactionIgnore.spec.ts` against
  the real local stack (DynamoDB Local + Api + FrontEnd already running) - all pass.
- Remaining: review the diff and open the PR.
