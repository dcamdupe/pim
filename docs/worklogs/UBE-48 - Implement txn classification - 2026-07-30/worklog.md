# UBE-48 — Implement Transaction classification for credit transactions

Linear: https://linear.app/uberconcept/issue/UBE-48/implement-transaction-classification-for-credit-transactions
PR: https://github.com/dcamdupe/pim/pull/30

## Description

Adds the ability to set/edit the `Category` on transactions, with a "smart" bulk-apply flow:
when the user assigns a category to one transaction, the app looks for other unique
descriptions that share the same approximate merchant prefix (e.g. `COLES 0717 TURRAMURRA AUS`
vs `COLES 0760 ASQUITH AUS` both start with `COLES`) and offers to apply the category to all of
them, remembering the mapping for future CSV uploads.

This requires:
- A `UniqueDescriptions` table (per-user list of every distinct transaction description seen).
- A `CreditDescriptionMapping` table (per-user list of `DescriptionStart` → `Category` rules).
- `GET /transaction_descriptions`, `PUT /transactions`, `POST /credit_description_mapping`.
- `CsvProcessor` updates: populate `UniqueDescriptions` on upload, and auto-apply existing
  `CreditDescriptionMapping` rules to newly-parsed transactions.
- FrontEnd: a category column/dropdown on the transactions table (per
  `docs/design/dashboard-mockup-calm.html`), an approximate-match modal, and a shared
  categories+colours definition.

## Current state

- `Api/Data/Transaction.cs` already has a `required string Category` field — no schema change
  needed there, just something to populate it after the fact.
- `Api/Data/TransactionMonth.cs` — one row per `(email, year, month)`, holding all of that
  month's transactions. No secondary index; the only lookup is by exact `Id`.
- `Api/Services/CsvProcessor.cs` — parses the upload, groups by month, skips duplicates
  (UBE-45), and (as of UBE-47) updates `User.MinTransactionDate`. Nothing sets `Category` today
  — every parser (`TmBankCsvParser`) leaves it as `""`/whatever the source CSV has, presumably.
- `Api/Data/User.cs` — as of UBE-47, has `DateOnly? MinTransactionDate`, kept up to date by
  `CsvProcessor` on every upload.
- `Api/Services/TransactionQueryService.cs` — as of UBE-47, `GetTransactionsAsync` accepts an
  optional `startDate` and falls back to `User.MinTransactionDate` (or empty result) — this is
  the tool available for "all of this user's transactions", reused below instead of adding a new
  month-index.
- `FrontEnd/src/views/TransactionsView.vue` — read-only listing today: a plain `<span class="chip">`
  for category, no edit affordance.
- `docs/design/dashboard-mockup-calm.html` — has the target category-column UX (editable
  `<select>`, coloured dot/chip) and a `catColor` map (`Housing`, `Groceries`, `Transport`,
  `Dining`, `Shopping`, `Utilities`, `Entertainment`, `Income`, `Other`) to port over.
- `Terraform/modules/data/` — generic single-table module (`hash_key = "id"`), already used
  twice (`User`, `TransactionMonth`); the two new tables reuse this module as-is.
- `Terraform/modules/api/main.tf` — the Lambda's DynamoDB IAM policy takes a fixed
  `resources = [var.dynamodb_table_arn, var.transaction_dynamodb_table_arn]` — needs two more
  ARNs threaded through (module output → root `main.tf` → `api` module variables → policy).

## My calls

- **Bulk-apply enumeration reuses `ITransactionQueryService`, not a new month-index.** UBE-47
  landed `User.MinTransactionDate` specifically so "all of a user's transactions" is answerable
  without scanning arbitrary date ranges — `POST /credit_description_mapping`'s "update all
  existing transactions that match" reuses `GetTransactionsAsync(email, startDate: null, endDate:
  today)` to find affected months, rather than inventing a second mechanism.
- **Categories + colours live in the FrontEnd only**, not shared with the Api. `Category` is
  already a free-text string on `Transaction` server-side (no enum/validation) and colouring is a
  pure display concern — the "standard location" the ticket asks for is a single FrontEnd
  constants module (e.g. `FrontEnd/src/constants/categories.ts`), ported from
  `dashboard-mockup-calm.html`'s `catColor`.
- **`PUT /transactions` matches by (Date, Description, Amount, Account)**, the same tuple
  `CsvProcessor`'s duplicate check already uses — those four fields are the natural stable
  identity for a transaction (there's no surrogate id today), and it keeps the "what counts as
  the same transaction" rule consistent across the codebase instead of introducing a second
  definition.
- **`CreditDescriptionMapping` is keyed by exact `DescriptionStart` string** (add-or-replace on
  that key) — simplest storage shape matching the ticket's "list of `DescriptionStart`/`Category`
  objects" wording; no attempt to merge/dedupe overlapping prefixes (e.g. a future `COLES` rule
  and an existing `COLES 0717` rule both existing) since the ticket doesn't ask for that and it's
  a real design question (which should win?) rather than an obvious default.

## Open questions (to confirm before the relevant step)

1. **Exact approximate-match algorithm.** The ticket's rule ("starts with the same string as this
   description, ending in a space... prefer the most precise match") is ambiguous on one point:
   its own "(DAVID JONES)" example lists `DAVID CAMERON Name` alongside two real `DAVID JONES...`
   matches — which only shares the single word `DAVID` with them. My reading is that's a
   **negative** example (proving a naive "first-word-plus-space" match is wrong, since `DAVID
   CAMERON` must **not** be offered as a match when categorising a `DAVID JONES...` row), not a
   third match. I'll implement it as: compute the longest word-boundary-terminated prefix of the
   description being categorised that is also a prefix of each candidate, take the longest prefix
   shared by more than one description, and only offer the bulk-apply modal if that shared prefix
   has more than one "word" of precision (so `DAVID` alone doesn't qualify, `DAVID JONES` does) —
   **confirm this before step 10 (frontend matching UI)**, since it's the one part of the ticket
   I'm inferring rather than reading directly.
2. **`DescriptionStart` normalisation.** Assuming stored/compared trimmed and case-sensitive
   (matching the bank CSV's own casing, which looks all-caps already) — flag if case-insensitive
   matching is wanted instead.

## Plan

### Backend

1. `Terraform/modules/data` — add two more `module "data"` instances in the root `main.tf`:
   `UniqueDescriptions` and `CreditDescriptionMapping` (same generic single-table module as
   `User`/`TransactionMonth`). Thread both new table ARNs through
   `Terraform/modules/api/variables.tf` → `main.tf`'s `dynamodb_access` policy `resources` list →
   root `main.tf`'s `module "api"` call. `terraform fmt`/`validate`.
2. `Api/Data/UniqueDescriptions.cs` — `Email` (`[Id]`), `List<string> Descriptions`.
   `Api/Data/CreditDescriptionMapping.cs` — `Email` (`[Id]`), `List<CreditDescriptionMappingEntry>`
   where the entry is `DescriptionStart` + `Category`. Register both via the existing generic
   `IRepository<>` → `DynamoDbRepository<>` mapping (no new DI registration needed beyond the
   existing open-generic one).
3. `Api/Services/CsvProcessor.cs`:
   - After parsing (before/alongside the duplicate check), look up any `CreditDescriptionMapping`
     rules for the user and set `Category` on newly-parsed transactions whose `Description`
     starts with a rule's `DescriptionStart`.
   - After dedup, add any genuinely-new `Description` values to the user's `UniqueDescriptions`
     row (get-or-create, same pattern as `TransactionMonth`).
4. `Api/Controllers/TransactionsController.cs` — add:
   - `[HttpGet("transaction_descriptions")]` → returns the caller's `UniqueDescriptions.Descriptions`
     (empty list if none yet).
   - `[HttpPut("transactions")]` — body: `List<Transaction>`. Group by `(Date.Year, Date.Month)`,
     load each `TransactionMonth`, replace matching entries (match tuple from "My calls" above),
     `UpdateAsync` the changed months.
   - `[HttpPost("credit_description_mapping")]` — body: `DescriptionStart` + `Category`. Upsert
     into `CreditDescriptionMapping` (replace existing entry with same `DescriptionStart`, else
     append). Then use `ITransactionQueryService` to pull all of the user's transactions, find
     ones whose `Description` starts with `DescriptionStart`, set `Category`, and `UpdateAsync`
     each affected month once.
5. Unit tests: `Api.UnitTests/Services/CsvProcessorTests.cs` (mapping auto-applied on upload,
   unique descriptions accumulated, no duplicate description entries across repeated uploads).
6. Integration tests in `Api.IntegrationTests/` covering all three new endpoints end-to-end
   against real DynamoDB Local, plus the CSV-upload side effects (unique descriptions populated,
   mapping auto-applied).

### FrontEnd

7. `FrontEnd/src/constants/categories.ts` — the category list + `catColor` map ported from
   `dashboard-mockup-calm.html`.
8. `FrontEnd/src/services/transactionDescriptionsService.ts` — `getTransactionDescriptions()`
   wrapping `GET /transaction_descriptions`; called on login (alongside the existing auth flow)
   and cached in `localStorage`; invalidated/refetched after a successful CSV upload.
9. `FrontEnd/src/services/transactionsService.ts` — add `updateTransactions` (`PUT /transactions`)
   and `saveCreditDescriptionMapping` (`POST /credit_description_mapping`).
10. `FrontEnd/src/views/TransactionsView.vue` — replace the read-only category `<span>` with an
    editable `<select>` (styled per the mockup). On change: compute approximate matches against
    the cached unique-descriptions list (open question #1 above); if any exist, show a
    confirm/cancel modal ("Apply to N similar transactions?"); Yes → `saveCreditDescriptionMapping`
    + reload transactions, No → `updateTransactions` with just the one edited transaction.
11. FrontEnd unit tests (`FrontEnd.UnitTests/`) for the approximate-match function and the two new
    service calls. Playwright scenario in `FunctionalTests/tests/` covering: categorise a
    transaction with no similar matches (single update), then one with similar matches (bulk
    modal, Yes path), then re-upload a CSV and confirm the remembered mapping auto-categorises.

### Verify

12. `dotnet build` / `dotnet test` (unit + integration, DynamoDB Local running).
13. `FrontEnd.UnitTests`: `npm run test`.
14. `FunctionalTests`: `npm test`.
15. Real local run via `scripts/run_local.sh` — upload a CSV, categorise a transaction, confirm
    the bulk-apply modal and re-upload behaviour manually.

## Checklist

- [x] 1. Terraform: two new tables + IAM policy wiring (`terraform fmt`/`validate` clean)
- [x] 2. `UniqueDescriptions`/`CreditDescriptionMapping` data models (`dotnet build` clean)
- [x] 3. `CsvProcessor`: populate unique descriptions + auto-apply existing mapping
- [x] 4. Controller: `GET /transaction_descriptions`, `PUT /transactions`,
      `POST /credit_description_mapping` (new `ITransactionUpdateService` backs the two mutating
      endpoints; `Transaction.MatchesIdentity` extracted so `PUT /transactions` and `CsvProcessor`
      share one "same transaction" rule instead of two)
- [x] 5. Backend unit tests (4 new `CsvProcessorTests`, 6 new `TransactionsControllerTests`, new
      `TransactionUpdateServiceTests` (6 tests); 63/63 unit tests pass)
- [x] 6. Backend integration tests (7 new tests covering all 3 new endpoints + the auto-apply
      loop; also added `UniqueDescriptions`/`CreditDescriptionMapping` table creation to
      `scripts/setup_local.sh`; full backend suite 63/63 unit + 26/26 integration pass)
- [x] 7. FrontEnd shared categories/colours module (`FrontEnd/src/constants/categories.ts`)
- [x] 8. FrontEnd transaction-descriptions service + login/upload cache refresh (best-effort,
      failures don't block login or surface as an upload error)
- [x] 9. FrontEnd transactions service additions (`updateTransactions`,
      `saveCreditDescriptionMapping`); `FrontEnd.UnitTests` 30/30 pass
- [x] 10. FrontEnd category dropdown + approximate-match modal on `TransactionsView`
      (`FrontEnd/src/utils/descriptionMatching.ts` implements the match rule confirmed with
      David: longest word-boundary-terminated common prefix wins, e.g. two "DAVID JONES ..."
      rows match each other over a weaker "DAVID"-only match against an unrelated "DAVID
      CAMERON ..." row; `npm run build`/`npm run lint` clean)
- [x] 11. FrontEnd unit tests + Playwright scenario. Unit tests for `descriptionMatching.ts`
      (including all 3 of the ticket's own worked examples), `transactionsService.ts`,
      `transactionDescriptionsService.ts` - 37/37 `FrontEnd.UnitTests` pass. New
      `FunctionalTests/tests/transactionCategorization.spec.ts`: uploads 3 transactions (2
      COLES-prefixed, 1 unrelated), categorising the unrelated one saves with no modal,
      categorising the first COLES one offers + confirms a bulk-apply to the second, then a
      follow-up upload with a third COLES-prefixed description is auto-categorised via the
      remembered mapping. (Hit and fixed a test-data bug first: all 3 descriptions shared a
      literal `runId` as a leading word, so they spuriously matched each other regardless of
      merchant - fixed by embedding the runId into the merchant token instead.) Full suite 9/9
      Playwright specs pass (`settings.spec.ts`'s pre-existing stale-account flakiness, noted
      back in UBE-45, is unrelated - and I cleaned up the one leftover account my own earlier
      failed attempts left behind).
- [x] 12. Verify: `dotnet build`/`dotnet test` - 63/63 unit + 26/26 integration pass
- [x] 13. Verify: `FrontEnd.UnitTests` `npm run test` - 37/37 pass
- [x] 14. Verify: `FunctionalTests` `npm test` - all 9 specs pass (including the new
      `transactionCategorization.spec.ts`)
- [x] 15. Verify: real local run via `scripts/run_local.sh`. The Chrome extension isn't installed
      in this session, so I couldn't drive it interactively myself - verification here is the
      Playwright suite (a real Chromium browser, not mocked) run against the actual `run_local.sh`
      stack (real Api + real DynamoDB Local + the FrontEnd dev server), which is what caught and
      required fixing a genuine bug (test-data collision, see step 11). David may still want to
      click through it by hand.

## Prompt Log

1. "start a worklog for UBE-48"
2. "start work" (steps 1-9: Terraform, data models, `CsvProcessor`, the 3 new endpoints, and all
   supporting backend/frontend service-layer work, run through without further check-ins)
3. (tool-permission denial on an intermediate test-file edit, then) "continue" / "go" - resumed
   the same edit
4. Clarifying question asked back to David on the ambiguous approximate-match algorithm (the
   ticket's own "DAVID JONES" example was ambiguous - see "Open questions" above); David's
   answer: "Find all matches where the last matching character is a space and the start of the
   string matches. Choose the longest match." - implemented as `descriptionMatching.ts`'s
   boundary-search algorithm and verified against all 3 of the ticket's own worked examples

## Post-completion changes

- Renamed `UniqueDescriptions` (table, C# class, and all dependent code: `CsvProcessor`,
  `TransactionsController`, DI, Terraform module/variable names, `scripts/setup_local.sh`) to
  `TransactionDescriptions`, at David's request - the FrontEnd already used
  "TransactionDescriptions" terminology throughout (`transactionDescriptionsService.ts`,
  `GET /transaction_descriptions`), so this just brings the backend name in line with it.
  Verified: `terraform validate`, `dotnet build`/`dotnet test` (63/63 unit + 26/26 integration).
- Moved the `GET /transaction_descriptions` endpoint to `GET /transactions/descriptions`, at
  David's request - keeps it grouped under `/transactions/*` alongside the other transaction
  endpoints. Updated the controller route, `transactionDescriptionsService.ts`, and both test
  suites' references. Verified: `dotnet build`/`dotnet test` (63/63 + 26/26),
  `FrontEnd.UnitTests` (37/37), `FrontEnd` build, and the `transactionCategorization.spec.ts`
  Playwright scenario against a real `run_local.sh` stack.
- Moved `POST /credit_description_mapping` to `POST /mapping/credit` and into its own new
  `MappingController`, at David's request. `TransactionsController` keeps `ITransactionUpdateService`
  (still used by `PUT /transactions`) but no longer owns the mapping endpoint or
  `CreditDescriptionMappingRequest`. Split the tests to match the 1:1 controller/test-file
  convention already used elsewhere (`SettingsController`/`SettingsControllerTests`, etc.): new
  `MappingControllerTests.cs` and `MappingEndpointTests.cs`, moved out of
  `TransactionsControllerTests.cs`/`TransactionsEndpointTests.cs`. Also fixed a stale comment in
  `CsvProcessor.cs` referencing the old path. Verified: `dotnet build`/`dotnet test` (still 63/63 +
  26/26, just redistributed across files), `FrontEnd.UnitTests` (37/37), and the
  `transactionCategorization.spec.ts` Playwright scenario against a real `run_local.sh` stack.
- Added the 3 endpoints introduced by this ticket (`PUT /transactions`,
  `GET /transactions/descriptions`, `POST /mapping/credit`) to
  `Api.IntegrationTests/AuthorizationTests.cs`'s `ProtectedEndpoints()` list - they'd been covered
  by their own controller/integration tests but missed the UBE-46 cross-cutting "no token → 401"
  check. Also added a CLAUDE.md rule (next to the existing "new endpoints need a functional test"
  line) that every authenticated endpoint must have an entry there, so this doesn't get missed
  again for future endpoints. Verified: `dotnet test` - 63/63 unit + 29/29 integration (26 + 3
  new).
- Removed all `Api.UnitTests/Controllers/*` (`SettingsControllerTests.cs`,
  `TransactionsControllerTests.cs`, `MappingControllerTests.cs`), at David's request - controllers
  are already covered by `Api.IntegrationTests` hitting the real endpoints. Added a CLAUDE.md rule
  against writing controller unit tests going forward (unit tests belong on the services/logic
  underneath them instead). Verified: `dotnet test` - 44/44 unit (down from 63, as expected) +
  29/29 integration, unaffected.

## Notes for next session

- The Chrome extension isn't installed in this session, so step 15's local-stack check ran via
  Playwright's real Chromium browser rather than me clicking through it interactively - David may
  still want to do that by hand before merging.
- `docs/worklogs/UBE-47 - Store min transaction date - 2026-07-30/` landed on `main` after this
  branch's parent commit but before this worklog started - `git pull --ff-only origin main` was
  run before branching, so this branch already includes it (`User.MinTransactionDate`, reused for
  the "update all matching transactions" step).
