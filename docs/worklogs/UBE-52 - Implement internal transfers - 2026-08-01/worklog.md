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

- [x] 1. `TransactionDescriptionStatsHelper` extracted
- [x] 2. `InternalTransferMatcher` implemented
- [x] 3. `FileProcessor.ProcessAsync` reordered to call it
- [x] 4. DI registration
- [x] 5. Backend unit tests
- [x] 6. Backend integration test
- [x] 7. `CATEGORIES`/`CATEGORY_COLORS` - "Internal Transfer"
- [x] 8. `dashboardMetrics.ts` - exclude Internal Transfer from Expenses
- [x] 9. `dashboardMetrics.test.ts` - new cases
- [x] 10. Playwright scenario
- [x] 11. Verify: `dotnet build` / `dotnet test`
- [x] 12. Verify: `FrontEnd.UnitTests` `npm run test`
- [x] 13. Verify: `FrontEnd` `npm run build` / `npm run lint`
- [x] 14. Verify: `FunctionalTests` `npm test`
- [x] 15. Verify: real local run via `scripts/run_local.sh`

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
3. Interruption: "FE unit tests are failing... likely a bad merge" - unrelated to this ticket.
   Traced to the `UBE-60` merge into `main` (PR #37) dropping the import of
   `loadStoredTransactionFilters`/`saveTransactionFilters`/`RangeOption` from
   `transactionFilterStorage.ts` in `TransactionsView.vue` while leaving the code that calls them.
   Fixed directly on `main` (commit `e1c1be5`), verified with `npm run build` and
   `FrontEnd.UnitTests` (64/64 passing), and pushed.
4. "switch to UBE-52" / "pull from main" - merged the now-fixed `main` into this branch (clean,
   no conflicts - only touched frontend filter-storage files, nothing overlapping this ticket's
   plan).
5. "resume worklog for UBE-52" / "start" - confirmed the merge didn't touch any files in this
   ticket's plan, then implemented checklist item 1: moved `AdjustUnclassifiedCount` out of
   `TransactionUpdateService` into a new static `TransactionDescriptionStatsHelper`, added direct
   unit tests for it (`TransactionDescriptionStatsHelperTests.cs`), and confirmed the existing
   `TransactionUpdateServiceTests` still pass unchanged (16/16) plus a clean `dotnet build`.
6. "yes go ahead" - implemented checklist item 2: `IInternalTransferMatcher`/
   `InternalTransferMatcher` (cross-bucket window lookup, first-unmatched-candidate matching by
   inverted amount + different account + <=5 day gap, external-bucket persistence, stats
   adjustment for already-stored matches via the shared helper), registered it in
   `ServiceMapping` (item 4), and added `InternalTransferMatcherTests.cs` covering cross-account
   matching, same-account exclusion, >5-day exclusion, non-inverted-amount exclusion, category
   override, matching against an already-stored transaction from a past import (verifying the
   external bucket's `UpdateAsync` is called), stats adjustment for that external match, and
   no-double-matching. Full `Api.UnitTests` suite: 74/74 passing, clean `dotnet build`.
7. "yes go ahead" - implemented checklist item 3: reordered `FileProcessor.ProcessAsync` to build
   month buckets + `addedTransactions` without saving, update min transaction date, call
   `InternalTransferMatcher.MatchAsync` (mutates categories in place), then save the buckets, then
   update description stats (now sees final, possibly-overridden categories). Updated
   `FileProcessorTests`'s `CreateProcessor` helper to build a real `InternalTransferMatcher` from
   the same mocked repositories (matching production wiring) and added one new test confirming
   two inverted-amount, different-account transactions in the same upload both get flagged
   "Internal Transfer" in the saved bucket. Verified the existing test data has no accidental
   same-account/inverted-amount coincidences that would flip other tests' expected categories.
   Full `Api.UnitTests` suite: 75/75 passing, clean `dotnet build`.
8. "go" - implemented checklist item 6: added
   `Post_FlagsBothTransactions_AsInternalTransfer_WhenAnInvertedAmountArrivesInAnotherAccountWithinFiveDays_AcrossSeparateUploads`
   to `TransactionsEndpointTests.cs` - uploads to "Everyday" and "Savings" in two separate
   `POST /transactions/file` calls (proving the cross-import match, not just same-file), then
   `GET /transactions` confirms both rows show `category: "Internal Transfer"`. Full solution
   test run (real DynamoDB Local, already running): 75/75 unit + 33/33 integration passing.
9. "go" - implemented checklist item 7: added `'Internal Transfer'` to `CATEGORIES` and its
   colour (`#6b7280`, neutral slate grey) to `CATEGORY_COLORS` in `categories.ts`. Clean
   `npm run build`.
10. "go" - implemented checklist items 8-9: `sumExpenses` in `dashboardMetrics.ts` now also
    excludes `category === 'Internal Transfer'`; added two new `dashboardMetrics.test.ts` cases
    (excluded from expenses; excluded from profit on both sides). `FrontEnd.UnitTests`: 66/66
    passing; `FrontEnd`: clean `npm run build` and `npm run lint`.
11. "go ahead" - implemented checklist item 10: added `FunctionalTests/tests/internalTransfer.spec.ts`
    - uploads a transfer-out to one account then, in a separate later upload, the inverted-amount
      transfer-in to a second account; confirms both auto-show "Internal Transfer"; confirms a
      same-account inverted-amount "control" pair does NOT auto-match (proving the
      different-accounts constraint); confirms the current-month Expenses dashboard tile nets to
      zero once matched (it briefly counted the still-uncategorized out-transfer as an expense
      right after the first upload, then dropped back out once matched).
    - Hit real Api staleness first (the running `dotnet run --project Api` process predated these
      code changes) - restarted via `scripts/run_local.sh`.
    - Then hit self-inflicted test flakiness from re-running the same scenario repeatedly during
      debugging: the app has no delete-transaction UI, so every failed run's uploaded transactions
      stayed in the shared month bucket forever, and a narrow modulo range for the test's derived
      dollar amounts let a later run's pair collide with an earlier run's still-unmatched leftover
      (proving the matcher works correctly - it was matching across truly-separate "runs" it had
      no way to distinguish). Fixed by widening the two amount ranges to non-overlapping, near-
      collision-free bands, and cleaned up the ~8 leftover "IT Account" Settings entries my failed
      debug runs left behind via direct API calls (Settings has no bulk-delete UI either).
    - Full suite: 13/14 passing. The one failure (`settings.spec.ts`) is a pre-existing race
      condition unrelated to this change - it reads `.account-row`'s count synchronously before
      the page's async account-list fetch resolves, and passes in isolation; it only surfaces
      under full-suite timing pressure combined with this shared user's already-large (~18,
      predating this session) accumulated account list. Flagged to David rather than fixed, as
      out of scope for this ticket.
12. "run all of them in a final run" - ran checklist items 11-15 as a consolidated final pass:
    - `dotnet build`/`dotnet test`: clean, 75 unit + 33 integration passing.
    - `FrontEnd.UnitTests`: 72/73 passing. The 1 failure (`computeExpensesByCategory`'s pct math)
      is in an unrelated, concurrently-in-progress dashboard feature (not written by me this
      session - flagged by the harness as an external edit to `dashboardMetrics.ts`/its test file
      partway through this worklog) - out of scope for UBE-52, left untouched.
    - `FrontEnd`: clean `npm run build` and `npm run lint`.
    - `FunctionalTests`: 13/14 passing - the 1 failure is the pre-existing `settings.spec.ts`
      race condition noted above.
    - Real local stack (`scripts/run_local.sh`, already running): confirmed both Api (400 on a
      deliberately-bad login, proving it's alive and handling requests) and FrontEnd (200) are up
      and serving - and had already been exercised heavily all session via the Playwright runs.
    - All 15 checklist items now complete.
