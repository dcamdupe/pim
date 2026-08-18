# UBE-96: Add ability to export transactions

## Linear issue

[UBE-96](https://linear.app/uberconcept/issue/UBE-96/add-ability-to-export-transactions) — Add ability to export transactions

> Add an export button left of the upload button. This should generate a CSV export of all the currently displaued transactions.

## Description

Add an "Export" button to the Transactions view's filter bar, immediately left of the existing
"Upload" button, that downloads a CSV of the currently filtered transaction list - client-side,
no new Api endpoint. There's no existing CSV/file-download utility or dependency in `FrontEnd/`
today, so this introduces the pattern fresh, following the repo's existing convention of a pure,
tested function in `utils/` plus thin untested DOM-touching glue in the view.

**Scope assumption**: "currently displayed transactions" means everything matching the active
filters (date range, search, account, category, needs-a-category, +/-) - i.e. `filteredTransactions`
- not just the currently-rendered/scrolled-into-view page (`visibleTransactions`), since pagination
there is a rendering optimisation, not a user-chosen filter.

## Plan

- `FrontEnd/src/utils/transactionsCsv.ts` (new)
  - `buildTransactionsCsv(transactions: Transaction[]): string` - pure function, header row
    `Date,Description,Account,Category,Amount` + one row per transaction, with RFC4180-style
    quoting/escaping for any field containing a comma, quote, or newline. Amount as a plain
    fixed-2dp numeric string (not the `formatAmount` +/− display string).
- `FrontEnd.UnitTests/utils/transactionsCsv.test.ts` (new)
  - Empty list → header only; basic row rendering; escaping a description containing a comma and
    a double-quote; an uncategorised transaction's empty category field.
- `FrontEnd/src/views/TransactionsView.vue`
  - Add an `exportCsv()` handler: build the CSV from `filteredTransactions`, wrap in a `Blob`,
    trigger a download via a temporary `<a download>` click, filename `transactions-YYYY-MM-DD.csv`
    (today's date, via the existing `formatDateForApi`).
  - Add an "Export" `<button>` in the filter bar, left of the `Upload` `RouterLink`, disabled when
    `filteredTransactions.length === 0`. Wrap both buttons in a small flex group so the
    right-alignment (`margin-left: auto`) moves from `.upload-button` onto that group instead of
    the individual button.
- `FunctionalTests/tests/transactionExport.spec.ts` (new)
  - Upload a small known set of transactions, apply a filter (e.g. search or category), click
    Export, capture the Playwright `download` event, read the saved file, and assert its CSV rows
    match exactly the filtered set (and exclude filtered-out rows).

## Checklist

- [x] Add `transactionsCsv.ts` with `buildTransactionsCsv`
- [x] Add unit tests for `buildTransactionsCsv`
- [x] Add Export button + `exportCsv()` handler to `TransactionsView.vue`, wired to `filteredTransactions`
- [x] Add Playwright `transactionExport.spec.ts`
- [x] Run `npm run lint`, `npm run build`, and `FrontEnd.UnitTests` (`npm run test`)
- [x] Run the new/affected Playwright spec(s) against the local stack
- [ ] Review diff and open PR

## Session log

### 2026-08-18

- Retrieved UBE-96 from Linear.
- Explored the `Transaction` type, filter-bar/upload-button styling, and existing formatting utils
  (`formatDateForApi`, `formatAmount`/`formatDisplayDate`) - confirmed there's no existing
  CSV/download utility or dependency to reuse, and no `.vue` unit-test convention in this repo (view
  glue code stays untested; logic goes in a tested `utils/` function).
- Created this worklog and branch `UBE-96/add-ability-to-export-transactions` off `main`.
- Added `FrontEnd/src/utils/transactionsCsv.ts` (`buildTransactionsCsv`) with RFC4180-style
  quoting, plus unit tests in `FrontEnd.UnitTests/utils/transactionsCsv.test.ts` (empty list,
  basic rows, uncategorised row, comma/quote/newline escaping).
- Added the `exportCsv()` handler and an "Export" button (disabled when `filteredTransactions` is
  empty) to `TransactionsView.vue`, in a new `.filter-bar-actions` flex group to its left of
  "Upload" - moved the `margin-left: auto` right-alignment from `.upload-button` onto that group.
- Full `npm run test` suite (188 tests) passes; `npm run lint` and `npm run build` (incl.
  `vue-tsc`) both pass clean.
- Added `FunctionalTests/tests/transactionExport.spec.ts`: exports only the filtered rows (via a
  real Playwright `download` event, reading the saved CSV file's contents) and the button disables
  with no filter matches. Ran it plus `transactionListing`, `transactionUpload`,
  `transactionIgnore`, and `transactionCategorization` specs (13 tests total) against the real
  local stack - all pass, confirming no regressions from the filter-bar/CSS changes.
- Remaining: review the diff and open the PR.
