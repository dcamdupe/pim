# UBE-36 — Implement transaction upload

Linear: https://linear.app/uberconcept/issue/UBE-36/implement-transaction-upload

## Description

From the Linear issue:
- Create a new `Transaction` object: Account (string), Date, Description (string), Category
  (string), Amount.
- Create a new table to store these in DynamoDB, keyed by year (int), month (int), Email — a
  collection of transaction objects per key.
- `POST /transactions/file`: bank account name (string) + CSV file. Parse (ignore header row;
  Col1=Date, Col2=ignore, Col3=Description, Col4=Amount, Col5=ignore); save with empty Category.
- FrontEnd: Dashboard/Transactions switch in the top nav; a Transactions page (empty except an
  Upload button); an Upload page (select account, drag/upload CSV, Save → triggers the API).

CSV date format (confirmed by David): `dd MMM yyyy`, e.g. `01 JUN 2026`.

## Current state (from repo survey)

- `IRepository<T>`/`DynamoDbRepository<T>` support **only** single-item CRUD by one exact string
  `id` (partition key) — no query/list-by-partial-key, no composite/sort-key support. The whole
  entity is stored as one JSON blob under a `data` attribute.
- `Terraform/modules/data/main.tf` — the DynamoDB table module supports only a single hash-key
  table (`id`, type `S`); no range-key parameter exists. One table (`User`) currently exists.
  `Terraform/modules/api/main.tf`'s IAM policy is scoped to exactly one table ARN
  (`var.dynamodb_table_arn`, a plain `string`).
- No CSV library exists in the repo (`CsvHelper` or otherwise). No `IFormFile`/multipart handling
  exists anywhere in `Api/`. No file input/drag-drop exists anywhere in `FrontEnd/`.
- `/dashboard` route + `DashboardView.vue` already exist (trivial placeholder). No
  Dashboard/Transactions switcher exists in `NavBar.vue` today — just logo-as-home, a Settings
  icon, and a profile/logout menu.
- `SettingsController.cs`/`SettingsView.vue`/`settingsService.ts` are the closest existing
  precedent for: `[Authorize]` + `ClaimsPrincipal` email extraction, `IRepository<T>` DI, the
  loading/saving/error/success `ref` pattern, and the manual-`fetch` + bespoke-`Error`-subclass
  service convention (no axios, no shared HTTP wrapper).

## My calls

- **Table shape — one item per user per month, not a query-capable composite key.** This ticket's
  actual scope (an empty Transactions page with just an Upload button — no listing/read endpoint
  at all) never needs to query *across* a user's months. So rather than extending
  `IRepository<T>`/`DynamoDbRepository<T>`/the Terraform `data` module to support a real hash+range
  composite key (a bigger, invasive change touching the existing `User` entity's code path too), I'm
  storing one `TransactionMonth` entity (`Email`, `Year`, `Month`, `List<Transaction>`) per
  user-per-month, keyed by a single composite string id (`"{Email}|{yyyy}-{MM}"`) built by one
  static `TransactionMonth.BuildId(email, year, month)` method (used by both the entity's own `Id`
  property and the controller's lookup). This fits the *existing* repository and Terraform module
  completely unchanged — just a new entity + a second `module "data"` block + IAM policy extended
  to a second table ARN. When a future ticket needs "list all my transactions," that's the point to
  add real Query support — not now, ahead of any endpoint actually needing it.
- **`TransactionMonth.Id` is a computed get-only property** (`Email|yyyy-MM`), `[JsonIgnore]`d so it
  isn't redundantly duplicated inside the `data` JSON blob. This is a new shape for `[Id]` (`User`'s
  `[Id]` is on a real stored field, `Email`) — reflection-based `GetValue` works fine on a get-only
  property, and `DynamoDbRepository<T>` never tries to set it back on deserialize.
- **CsvHelper** (new dependency) for parsing, rather than hand-rolled `Split(',')` — bank CSV
  exports commonly quote the Description field, which would break naive comma-splitting on any
  description containing a comma.
- **Amount parsing**: `decimal.Parse` with `NumberStyles.Number | AllowCurrencySymbol |
  AllowParentheses` (handles a plain minus sign, an optional `$`, thousands separators, and
  parenthesised negatives) — the issue doesn't specify the exact format, so this is a defensive
  default rather than a confirmed spec; flagging as a known assumption.
- **Malformed rows reject the whole file** (`BadRequest`) rather than best-effort partial import —
  simpler and avoids silently saving a half-imported statement.
- **No de-duplication**: re-uploading the same CSV twice will duplicate those transactions (each
  upload just appends parsed rows to the month's list). Out of scope for this ticket — flagging as
  a known limitation, not silently ignoring it.
- **Response**: `204 No Content` on success, matching the existing `PUT /settings` convention (no
  explicit "N transactions saved" count in the response body).
- **Nav switcher**: no design file/reference was provided beyond the issue text, so I'm implementing
  it as two plain tab-style `RouterLink`s ("Dashboard" / "Transactions") next to the logo, using
  vue-router's automatic `router-link-active` class for the active-tab style — a reasonable default
  I'm calling out explicitly since "from the design" implies there may be a specific visual spec I
  don't have access to.
- **Terraform IAM**: adding a second explicit variable (`transaction_dynamodb_table_arn`) to the
  `api` module rather than converting the existing `dynamodb_table_arn` to a list — smaller diff,
  consistent with the existing single-value-per-table convention.

## Plan

### Backend
1. `Api/Data/Transaction.cs` (new) — `Account`, `Date` (`DateOnly`), `Description`, `Category`,
   `Amount` (`decimal`).
2. `Api/Data/TransactionMonth.cs` (new) — `Email`, `Year`, `Month`, `List<Transaction> Transactions`,
   computed `[Id, JsonIgnore] Id` property, static `BuildId(email, year, month)`.
3. `Api/Pim.Api.csproj` — add `CsvHelper` package reference.
4. `Api/Controllers/TransactionsController.cs` (new) — `[Authorize]`, `POST("transactions/file")`,
   `[FromForm]` request DTO (`Account` string + `IFormFile File`); parses CSV via CsvHelper
   (`HasHeaderRecord = false`, manual `csv.Read()` to skip the header row), builds `Transaction`s
   (empty `Category`), groups by `(Date.Year, Date.Month)`, gets-or-creates + updates each month's
   `TransactionMonth` via `IRepository<TransactionMonth>`; `BadRequest` on parse failure or missing
   account/file; `204 NoContent` on success.
5. `Api.UnitTests/Controllers/TransactionsControllerTests.cs` (new) — mirror
   `SettingsControllerTests.cs`'s pattern (`RepositoryMockFactory`).
6. `Api.IntegrationTests/TransactionsEndpointTests.cs` (new) — `MultipartFormDataContent` POST with
   an in-memory CSV, asserting via `IRepository<TransactionMonth>` (DI scope) that the parsed rows
   were saved correctly (account, date, description, amount, empty category).

### Terraform
7. `Terraform/main.tf` — add `module "transactions_data"` (reusing `./modules/data`,
   `table_name = "TransactionMonth"`); pass its `table_arn` into `module "api"`.
8. `Terraform/modules/api/variables.tf` — add `transaction_dynamodb_table_arn` variable.
9. `Terraform/modules/api/main.tf` — extend the `dynamodb_access` IAM policy document with a second
   statement (`TransactionTableAccess`) scoped to the new table ARN.

### Local dev
10. `scripts/setup_local.sh` — also create the `TransactionMonth` table on DynamoDB Local
    (idempotent, same pattern as the existing `User` table creation).

### FrontEnd
11. `FrontEnd/src/services/transactionsService.ts` (new) — `uploadTransactions(account, file)`
    posting `FormData` (no explicit `Content-Type`, browser sets the multipart boundary), bespoke
    `TransactionsUploadFailedError`, matching `settingsService.ts`'s conventions.
12. `FrontEnd/src/router/index.ts` — add `/transactions` (`TransactionsView`) and
    `/transactions/upload` (`TransactionUploadView`) routes.
13. `FrontEnd/src/components/NavBar.vue` — add the Dashboard/Transactions tab switcher.
14. `FrontEnd/src/views/TransactionsView.vue` (new) — trivial page (mirrors `DashboardView.vue`)
    with an Upload button linking to `/transactions/upload`.
15. `FrontEnd/src/views/TransactionUploadView.vue` (new) — account `<select>` (populated via
    `getSettings()`), a drag-and-drop zone + hidden file input (first of its kind in this
    codebase), Save button (disabled until both an account and a file are chosen) that calls
    `uploadTransactions` and navigates back to `/transactions` on success.
16. `FrontEnd.UnitTests/services/transactionsService.test.ts` (new) — mirror
    `settingsService.test.ts`.
17. `FunctionalTests/tests/transactionUpload.spec.ts` (new) — end-to-end drag/select + upload flow
    with a small fixture CSV.

### Verify
18. `dotnet build`/`dotnet test` (unit + integration, against DynamoDB Local).
19. `npm run lint`/`vue-tsc -b` in `FrontEnd/`; `npm run test` in `FrontEnd.UnitTests/`.
20. Real local run via `scripts/run_local.sh` — upload a real CSV end-to-end, confirm the nav
    switcher, and confirm the saved data shape in DynamoDB Local (`aws dynamodb get-item`).

## Checklist

- [x] `Api/Data/Transaction.cs`
- [x] `Api/Data/TransactionMonth.cs` (computed `[Id]` property builds fine, build clean)
- [x] `Api/Pim.Api.csproj` — add `CsvHelper` (33.1.0, build clean)
- [x] `Api/Controllers/TransactionsController.cs` (build clean)
- [x] `Api.UnitTests/Controllers/TransactionsControllerTests.cs` — 6 tests covering validation
      (missing account/empty file/unparseable CSV), correct field mapping + empty Category,
      appending to an existing month bucket, and grouping rows across months into separate buckets;
      all 13 unit tests pass (7 existing + 6 new)
- [x] `Api.IntegrationTests/TransactionsEndpointTests.cs` (3 tests — unauthenticated, successful
      upload verified via `IRepository<TransactionMonth>`, malformed-file BadRequest — now run for
      real against DynamoDB Local: all 10 integration tests pass, 7 existing + 3 new)
- [x] `Terraform/main.tf` — `module "transactions_data"`, wired into `module "api"`
      (`terraform fmt` applied)
- [x] `Terraform/modules/api/variables.tf` — `transaction_dynamodb_table_arn`
- [x] `Terraform/modules/api/main.tf` — extend IAM policy; combined into a single `TableAccess`
      statement covering both table ARNs (per David's request, rather than a duplicated second
      statement) — `terraform fmt -check`/`terraform validate` both pass
- [x] `scripts/setup_local.sh` — extracted a `create_table_if_missing` helper (now used for both
      `User` and `TransactionMonth`, avoiding duplicating the create-table block); tested directly —
      creates the new table, leaves `User` alone, and re-running skips both
- [x] `FrontEnd/src/services/transactionsService.ts`
- [x] `FrontEnd/src/router/index.ts` — new routes (`transactions`, `transactionUpload`); references
      view files that don't exist until steps 14-15, so build/type-check won't pass until then
- [x] `FrontEnd/src/components/NavBar.vue` — Dashboard/Transactions switcher (two `RouterLink` tabs,
      active state via vue-router's `router-link-active` class + `--accent`)
- [x] `FrontEnd/src/views/TransactionsView.vue`
- [x] `FrontEnd/src/views/TransactionUploadView.vue` — account select + drag/drop zone + Save;
      caught and fixed a theming bug while writing it: hardcoded `color: #fff` on accent-background
      buttons (in this file and `NavBar.vue`'s active tab) instead of `var(--accent-ink)`, which
      would've been wrong in dark mode. `vue-tsc -b && vite build` and `npm run lint` both pass
      clean now that all referenced view files exist (confirms steps 12-14 too)
- [x] `FrontEnd.UnitTests/services/transactionsService.test.ts` — 2 tests (multipart FormData +
      bearer token, error on non-ok response); all 18 FrontEnd.UnitTests pass across 5 files
- [x] `FunctionalTests/tests/transactionUpload.spec.ts` — full end-to-end pass (login → add a
      Settings account → nav switcher to Transactions → Upload page → select account → drag/drop
      file input → Save → redirect back → cleanup) against the real stack via `scripts/run_local.sh`.
      Also fixed a second stale Mongo reference in `playwright.config.ts`'s comment, missed by
      UBE-28's doc sweep (only covered `.cs`/`.json`/`.csproj`/`.md`/`.sh`, not `.ts`) — confirmed via
      a fresh repo-wide sweep that no more remain. Known gap noted in the test: it can't assert the
      uploaded data was saved (no listing UI exists yet per this ticket's scope) - that's covered by
      `Api.IntegrationTests` instead.
- [x] Verify: `dotnet build`/`dotnet test` pass — final full-solution run after the post-implementation
      refactor below, 30/30 tests (20 unit + 10 integration)
- [x] Verify: FrontEnd lint/type-check + `FrontEnd.UnitTests` pass — `vue-tsc -b && vite build`
      clean, 18/18 `FrontEnd.UnitTests` pass
- [x] Verify: real local run — full Playwright suite (7 tests) green via `scripts/run_local.sh`;
      saved data shape confirmed directly in DynamoDB Local (`aws dynamodb get-item`)

## Post-implementation refactor (David's direction)

After the initial implementation above, David asked for a series of refactors to
`TransactionsController`'s CSV handling before running the full test suite:

1. **Extracted `CsvProcessor`/`ICsvProcessor`** (`Api/Services/`) out of the controller — owns
   parsing + the group-by-month get-or-create/update persistence logic. The controller is now a
   thin HTTP boundary: validates the request, calls the processor, catches `CsvParseException`
   (new, `Api/Services/CsvParseException.cs`) and turns it into `BadRequest` - parsing itself never
   returns an HTTP status, it throws.
2. **Moved `ICsvParser`/`CsvParser`** into a new `Api/Services/CSVParsers/` folder (namespace
   `Pim.Api.Services.CSVParsers`), mirrored in `Api.UnitTests/Services/CSVParsers/`.
3. **Added `ICSVParserFactory`/`CSVParserFactory`** — takes a `CsvReader`, returns an `ICsvParser`;
   returns the concrete parser below "for now" (an extension point for other bank formats later).
   Reshaped `ICsvParser`/`CsvParser` to take the `CsvReader` via constructor instead of building it
   from the `IFormFile` internally - `CsvProcessor` now owns building the `StreamReader`/`CsvReader`
   from the upload and asking the factory for a parser.
4. **Renamed `CsvParser` → `TmBankCsvParser`** (the `dd MMM yyyy` format is specific to one bank) -
   caught and fixed a bad `replace_all` mid-rename that collapsed `ICsvParser` into
   `ITmBankCsvParser` too (interface wasn't meant to be renamed).
5. DI: `ICSVParserFactory` registered as a singleton (stateless, no dependencies), `ICsvProcessor`
   stays scoped (depends on the scoped `IRepository<TransactionMonth>`).
6. Tests re-split to match the new layering: `TmBankCsvParserTests` (raw parsing, real `CsvReader`),
   `CSVParserFactoryTests` (factory returns a `TmBankCsvParser`), `CsvProcessorTests` (orchestration,
   `ICSVParserFactory`/`ICsvParser` mocked), `TransactionsControllerTests` (HTTP boundary,
   `ICsvProcessor` mocked). One naming gotcha along the way: `CsvHelper` itself has its own unrelated
   `CsvHelper.CsvParser` class, which collided by simple name in test files that imported both
   namespaces before the rename made the collision moot.

## Post-refactor verification issue (test isolation, not a code regression)

Running the full functional suite surfaced a real bug in the test suite itself, not in the
feature: `settings.spec.ts` and the new `transactionUpload.spec.ts` both mutate the *same* shared
seeded test user's account list via `PUT /settings` (a full-list replace, not an append), and
Playwright runs spec files in parallel by default (`fullyParallel: true`). Two fixes:
- `FunctionalTests/playwright.config.ts` — `workers: 1` always (was `undefined` locally, `1` only
  on CI), so spec files never run concurrently against the shared seeded user.
- The *pre-fix* racy run had already left stray data behind (a test's assertion failed mid-way, so
  its own cleanup code never ran) - "Playwright Test Account" (999999, Savings) was clear debris
  matching `settings.spec.ts`'s own naming; a second stray "test" (123, Transaction) didn't match any
  test's pattern, so I checked with David before removing it (also stray, both removed) rather than
  assuming.
- Full suite (7 tests) then passed cleanly, and DynamoDB Local was confirmed empty again afterward,
  confirming both specs' cleanup steps now run correctly end-to-end.

## Prompt Log

1. "start worklog on UBE-36"
2. "example: 01 JUN 2026," (CSV date format)
3. "yes, go ahead" (step 1 — Transaction.cs)
4. "yes" (step 2 — TransactionMonth.cs)
5. "yes" (step 3 — CsvHelper package)
6. "yes" (step 4 — TransactionsController.cs)
7. "go" (step 5 — TransactionsControllerTests.cs)
8. "go" (step 6 — TransactionsEndpointTests.cs)
9. "yes, go ahead" (step 7 — Terraform main.tf)
10. "go" (step 8 — Terraform api variables.tf)
11. "go" (step 9 — Terraform api main.tf IAM)
12. "adjust the dynamodb_access IAM policy to create one statement that covers both tables"
13. "next" (step 10 — setup_local.sh)
14. "yes, go ahead" (step 11 — transactionsService.ts)
15. "go" (step 12 — router)
16. "go" (step 13 — NavBar.vue)
17. "go" (step 14 — TransactionsView.vue)
18. "go" (step 15 — TransactionUploadView.vue)
19. "go" (step 16 — transactionsService.test.ts)
20. (step 17 — transactionUpload.spec.ts, discovered/fixed port mismatch; "just use run_website.sh"
    → used scripts/run_local.sh)
21. "yes, go ahead" (final verification began; interrupted before ad hoc DynamoDB inspection)
22. "Create a CsvProcessor service inside a Services folder in Api. This should handle parsing and
    saving the CSV File. It should not throw a BadRequest, but should throw an appropriate exception
    type."
23. "create a folder inside services called CSVParsers. Move ICsvParser and CSVParser into this
    folder"
24. "create a CSVParserFactory class, with an interface. This should take a CsvReader as a parameter
    and return an ICSVParser. The factory class should return CsvParser.cs for now"
25. "rename CSVParser to TmBankCsvParser"
26. "run all tests to complete the worklog"
