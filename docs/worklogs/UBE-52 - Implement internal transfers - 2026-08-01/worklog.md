# UBE-52 — Implement internal transfers

Linear: https://linear.app/uberconcept/issue/UBE-52/implement-internal-transfers

## Description

Ticket text (verbatim):
- On import, flag matching transactions as "Internal Transfer".
- A transaction should be flagged as "Internal transfer" if: you can find a transaction with the
  same amount (with the +/- inverted) within a 5 day period. If a matching transaction is found,
  both should be marked as "Internal Transfer". This should override the existing category for
  the transaction.
- Transactions can also be manually categorised as Internal Transfer from the dashboard.
- Any transaction with a category of Internal Transfer should not be included in any dashboard
  calculations (income, expense etc).

## Current state

- `Api/Data/Transaction.cs` - `Category` is a free-form `string`, no server-side whitelist/enum;
  `MatchesIdentity` (Date+Description+Amount+Account) deliberately excludes `Category`.
- `Api/Services/FileProcessor.cs` (`ProcessAsync`, backs `POST /transactions/file`): parse → apply
  saved `DescriptionMapping` rules → dedup per month → save month buckets → update
  `User.MinTransactionDate` → update `TransactionDescriptions` stats (`TransactionCount`/
  `UnclassifiedCount`, off the real post-dedup/post-mapping added set).
- `Api/Data/TransactionMonth.cs` - one blob per `(email, year, month)`, `Id = "{email}|{yyyy-MM}"`.
  No cross-month/cross-account query except `ITransactionQueryService.GetTransactionsAsync`
  (date-range only, resolves `MinTransactionDate` when `startDate` is omitted).
- `Api/Services/TransactionUpdateService.cs` has a private `AdjustUnclassifiedCount(...)` helper
  (moves a description's stat between classified/unclassified) used by both its own
  `UpdateTransactionsAsync` (PUT /transactions) and `ApplyDescriptionMappingAsync` (POST
  /mapping/description) paths - this ticket's cross-import matching needs the same adjustment
  applied to an *already-stored* transaction from a past import, so it's worth lifting out to a
  shared place rather than a third copy.
- `PUT /transactions` has no server-side category validation at all - any string is accepted and
  stored. So "manually categorise as Internal Transfer" needs zero backend change; it's purely a
  frontend concern (add it to the pickable list).
- `FrontEnd/src/constants/categories.ts` - `CATEGORIES` (fixed list, drives the category `<select>`
  on `TransactionsView.vue`, the only manual-categorisation UI that exists) + `CATEGORY_COLORS`.
- `FrontEnd/src/utils/dashboardMetrics.ts` (UBE-40) - `sumIncome` filters `category === 'Income'`;
  `sumExpenses` filters `category !== 'Income'` (everything non-Income, including uncategorised,
  counts as an expense today) - this second filter is exactly what needs to also exclude
  `'Internal Transfer'`.

## My calls

- **Confirmed with David:**
  - The two matched transactions **must be in different accounts** - a same-account "match" would
    just be a coincidental purchase+refund pair, not a real transfer (money can't transfer to
    itself within one account).
  - "Manually categorised... from the dashboard" is satisfied by **adding "Internal Transfer" to
    the existing `CATEGORIES` list** used by `TransactionsView.vue`'s category `<select>` - the
    only place manual categorisation happens today. Not literal new UI on the `/dashboard` route,
    which has no per-transaction UI at all.
- **Auto-matching searches full transaction history, not just the current upload's own rows.**
  The most common real case is the two legs of a transfer arriving in *separate* uploads (e.g.
  today's Checking statement, next week's Savings statement) - scoping to "only match within this
  one file" would miss that entirely. Implemented efficiently: only the month buckets that could
  possibly contain a match (new-transaction dates ± 5 days) are fetched, not the user's whole
  history.
- **"Override the existing category" is applied literally, including to a previously-stored,
  already-categorised transaction** if a new import later completes a matching pair for it (e.g.
  a transaction the user had manually set to "Dining" gets silently flipped to "Internal Transfer"
  if a later upload's inverted-amount transaction in another account matches it within 5 days).
  The ticket doesn't qualify "override" as "only if currently uncategorised", so this isn't
  special-cased - flagging it here since it's a real, slightly aggressive behaviour worth knowing
  about.
- **Matching runs only on import** (`POST /transactions/file`), not on `PUT /transactions` - the
  ticket's own wording ("on import, flag...") scopes the automatic side to upload time; manual
  edits via the category `<select>` (including picking or un-picking "Internal Transfer" by hand)
  don't re-trigger the matcher.
- **New dedicated `IInternalTransferMatcher`/`InternalTransferMatcher` service**, not more private
  methods bolted onto `FileProcessor` - this logic (cross-bucket lookup, matching, persisting
  "external" buckets, adjusting stats) is substantial enough to deserve its own isolated unit
  tests, unlike the smaller, single-file-scoped private helpers `FileProcessor` already has.
- **`AdjustUnclassifiedCount` lifted out of `TransactionUpdateService`** into a shared static
  helper, reused by the new matcher (for the "already-stored transaction whose category just got
  overridden" case) instead of a third copy of the same logic.
- **Dashboard exclusion** implemented as: `sumExpenses` also excludes `category ===
  'Internal Transfer'` (in addition to `'Income'`). `sumIncome` needs no change - `'Internal
  Transfer'` was never `'Income'` to begin with, so it was already excluded from that side.
- **Category colour:** a neutral slate grey (`#6b7280`) for "Internal Transfer", distinct from
  the vivid spend-category palette - it's neither income nor an expense, so it shouldn't visually
  read as either.

## Plan

### Backend

1. `Api/Services/TransactionDescriptionStatsHelper.cs` (new, static) - `AdjustUnclassifiedCount`
   moved here from `TransactionUpdateService`; `TransactionUpdateService` updated to call it.
2. `Api/Services/IInternalTransferMatcher.cs` / `InternalTransferMatcher.cs` (new):
   - `Task MatchAsync(string email, List<Transaction> addedTransactions, IReadOnlyCollection<TransactionMonth> loadedBuckets)`.
   - Computes the `[minDate-5, maxDate+5]` window from `addedTransactions`, fetches any month
     buckets in that window not already in `loadedBuckets` (the buckets `FileProcessor` just
     built for this import), builds the candidate transaction list (every transaction, from both
     loaded and freshly-fetched buckets, within the window).
   - For each unmatched added transaction, finds the first unmatched candidate with inverted
     amount, a different account, and `|dateDiff| <= 5` (via `DateOnly.DayNumber` subtraction) -
     sets both `Category = "Internal Transfer"`.
   - For a match against a freshly-fetched ("external") bucket: adjusts that description's
     `UnclassifiedCount` via the shared helper and persists the external bucket directly
     (`IRepository<TransactionMonth>.UpdateAsync`) - `FileProcessor` never sees these buckets, so
     it can't save them itself.
   - Matches against `addedTransactions`/`loadedBuckets` are left for `FileProcessor` to persist
     as it already does (same object references, mutated in place).
3. `Api/Services/FileProcessor.cs` - reorder `ProcessAsync`: build month buckets + `addedTransactions`
   (without saving yet) → `UpdateMinTransactionDateAsync` → `InternalTransferMatcher.MatchAsync`
   (mutates categories in place) → save this import's own month buckets → 
   `UpdateTransactionDescriptionStatsAsync` (now sees final, possibly-overridden categories).
4. `Api/IoC/ServiceMapping.cs` - register `IInternalTransferMatcher`.
5. Backend unit tests:
   - `TransactionDescriptionStatsHelperTests.cs` (moved/adapted from the existing
     `AdjustUnclassifiedCount` coverage implicit in `TransactionUpdateServiceTests`).
   - `InternalTransferMatcherTests.cs` - matches across accounts within 5 days; does not match
     same account; does not match beyond 5 days; does not match non-inverted/unequal amounts;
     overrides an existing category; matches two new transactions within the same import batch;
     matches a new transaction against an already-stored one from a past import (mocked
     repository) and persists that external bucket; adjusts `UnclassifiedCount` for the external
     match; never double-matches one transaction to two partners.
   - `FileProcessorTests.cs` - a couple of cases confirming the reordering didn't break existing
     behaviour, plus one confirming a matched transaction's category is "Internal Transfer" in
     the saved bucket.
6. `Api.IntegrationTests` - new end-to-end case: upload to account A, upload an inverted-amount
   transaction within 5 days to account B, `GET /transactions` confirms both show `category:
   "Internal Transfer"`.

### FrontEnd

7. `FrontEnd/src/constants/categories.ts` - add `'Internal Transfer'` to `CATEGORIES` and
   `CATEGORY_COLORS`.
8. `FrontEnd/src/utils/dashboardMetrics.ts` - `sumExpenses` also excludes `'Internal Transfer'`.
9. `FrontEnd.UnitTests/utils/dashboardMetrics.test.ts` - new cases: an Internal-Transfer-category
   transaction is excluded from both Income and Expenses (and therefore Profit).

### Playwright

10. Extend/add a scenario: upload matching inverted-amount transactions to two different accounts
    within 5 days, confirm both auto-show "Internal Transfer" after upload; confirm a Dashboard
    tile total is unaffected by them (upload a third, unrelated same-account "control" pair that
    should *not* match, to prove the account constraint).

### Verify

11. `dotnet build` / `dotnet test`.
12. `FrontEnd.UnitTests`: `npm run test`.
13. `FrontEnd`: `npm run build` / `npm run lint`.
14. `FunctionalTests`: `npm test`.
15. Real local run via `scripts/run_local.sh`.

## Checklist

- [ ] 1. `TransactionDescriptionStatsHelper` extracted
- [ ] 2. `InternalTransferMatcher` implemented
- [ ] 3. `FileProcessor.ProcessAsync` reordered to call it
- [ ] 4. DI registration
- [ ] 5. Backend unit tests
- [ ] 6. Backend integration test
- [ ] 7. `CATEGORIES`/`CATEGORY_COLORS` - "Internal Transfer"
- [ ] 8. `dashboardMetrics.ts` - exclude Internal Transfer from Expenses
- [ ] 9. `dashboardMetrics.test.ts` - new cases
- [ ] 10. Playwright scenario
- [ ] 11. Verify: `dotnet build` / `dotnet test`
- [ ] 12. Verify: `FrontEnd.UnitTests` `npm run test`
- [ ] 13. Verify: `FrontEnd` `npm run build` / `npm run lint`
- [ ] 14. Verify: `FunctionalTests` `npm test`
- [ ] 15. Verify: real local run via `scripts/run_local.sh`

## Prompt Log

1. "start a worklog for UBE-52" - fetched the Linear issue, read `Transaction.cs`,
   `FileProcessor.cs`, `TransactionMonth.cs`, `ITransactionQueryService`, `TransactionUpdateService`'s
   `AdjustUnclassifiedCount`, `categories.ts`, and `dashboardMetrics.ts` to ground the plan in the
   real storage model (per-month-per-user blobs, no cross-account query) before designing the
   cross-import matching approach.
2. Asked two questions before planning: whether matched transactions must be in different
   accounts, and what "manually categorised... from the dashboard" concretely means given the
   Dashboard route has no per-transaction UI - confirmed: different accounts required, and it
   means the existing Transactions page category-select.
