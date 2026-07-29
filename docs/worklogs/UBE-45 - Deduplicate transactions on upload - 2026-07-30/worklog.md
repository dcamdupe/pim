# UBE-45 — Deduplicate transactions during transaction upload

Linear: https://linear.app/uberconcept/issue/UBE-45/deduplicate-transactions-during-transaction-upload
PR: https://github.com/dcamdupe/pim/pull/27

## Description

Check that a transaction being uploaded doesn't overlap with existing transactions before saving.
A transaction overlaps (is a duplicate) if it matches on **date, description, amount, and account**.

This is a known limitation flagged during UBE-36: re-uploading the same CSV twice (or an
overlapping date range across two uploads) currently duplicates those transactions, since
`CsvProcessor.ProcessAsync` just appends every parsed row to the month bucket unconditionally.

## Current state

`Api/Services/CsvProcessor.cs`'s `ProcessAsync`: parses the file, groups rows by `(year, month)`,
gets-or-creates the `TransactionMonth` bucket for each group, and does
`month.Transactions.AddRange(group)` unconditionally — no existing-data check at all.

## My calls

- **Dedup check is against already-persisted data only, not within a single upload's own rows.**
  The ticket says "does not overlap with existing transactions" - a real bank CSV export wouldn't
  contain literal duplicate rows within itself, so this only guards the actual reported scenario
  (re-uploading the same file, or two uploads with overlapping date ranges) rather than adding
  self-dedup logic for a case that shouldn't occur in real data.
- **Match predicate as a private helper on `CsvProcessor`**, not `Transaction.Equals` override —
  "duplicate" is upload-specific business logic (four of five fields, `Category` excluded since
  it may get edited later), not general value equality; overriding `Equals` on the domain model
  would conflate the two and could surprise other code that expects full structural equality.
- **`O(n*m)` comparison** (each new row checked against the bucket's existing list) — no need for a
  `HashSet`-based optimisation at this app's realistic scale (dozens to low hundreds of monthly
  transactions for a single personal user).
- **Skipped-duplicate count is logged** (`LogInformation`) alongside the existing
  request/response logs — cheap observability for "did my re-upload actually skip anything."

## Plan

1. `Api/Services/CsvProcessor.cs` — before adding a parsed transaction to a (new-or-existing) month
   bucket, skip it if the bucket's `Transactions` already contains a match on Date+Description+
   Amount+Account; log the skipped count.
2. `Api.UnitTests/Services/CsvProcessorTests.cs` — add tests: re-uploading identical rows is
   skipped; a row differing in any one of the four matched fields is still added; a differing
   `Category` alone still counts as a duplicate (proves `Category` is excluded from the match).
3. `Api.IntegrationTests/TransactionsEndpointTests.cs` — add a test uploading the same CSV twice
   and asserting the resulting bucket still has the original transaction count, not double.
4. `FunctionalTests/tests/transactionUpload.spec.ts` — extend to upload the same file twice and
   confirm (via the listing page built in UBE-44) only one row shows up, not two.

### Verify
5. `dotnet build`/`dotnet test` (unit + integration, against DynamoDB Local).
6. Real local run via `scripts/run_local.sh` — upload the same CSV twice, confirm the listing
   doesn't show duplicates.

## Checklist

- [x] `Api/Services/CsvProcessor.cs` — dedup check before appending, skipped-count logged
      (build clean)
- [x] `Api.UnitTests/Services/CsvProcessorTests.cs` — 6 new tests (exact-duplicate skip, differing
      Category still counts as a duplicate, and a 4-case Theory proving date/description/amount/
      account each independently prevent a false-positive match); all 38 unit tests pass
- [x] `Api.IntegrationTests/TransactionsEndpointTests.cs` — re-upload-same-file test: uploads
      `ValidCsv` twice, asserts the resulting bucket still has 2 transactions, not 4. Full backend
      suite: 53/53 tests pass (38 unit + 15 integration)
- [x] `FunctionalTests/tests/transactionUpload.spec.ts` — extended to upload the same file twice
      and assert the description appears exactly once in the listing (also fixed a stale comment
      and switched to a today-dated dynamic description, since UBE-44's default "Last month" filter
      no longer showed the old fixed "01 JUN 2026" fixture). Passes; full suite 7/8 (same
      pre-existing `settings.spec.ts` concurrent-manual-editing race, unrelated). Also created
      `scripts/stop_website.sh` (David's request) to stop a background-started local dev stack
      instead of ad hoc `pkill`/`lsof`.
- [x] Verify: `dotnet build`/`dotnet test` pass — already confirmed at step 3 (53/53 tests)
- [x] Verify: real local run — already confirmed at step 4 via `scripts/run_local.sh` +
      `transactionUpload.spec.ts` (re-upload same CSV, listing shows the description exactly once)

## Prompt Log

1. "start a worklog in UBE-45"
2. "yes, go ahead" (step 1 — CsvProcessor dedup check)
3. "go" (step 2 — CsvProcessorTests dedup tests)
4. "go" (step 3 — TransactionsEndpointTests re-upload test)
5. "go" (step 4 — extend transactionUpload.spec.ts)
6. "why run this command?" (clarified stop_website.sh's purpose before stopping a shared stack)
7. "create a script stop_website.sh to perform this and use that script instead"
8. "yes" (commit and raise the PR)
