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

- [ ] `Api/Data/Transaction.cs`
- [ ] `Api/Data/TransactionMonth.cs`
- [ ] `Api/Pim.Api.csproj` — add `CsvHelper`
- [ ] `Api/Controllers/TransactionsController.cs`
- [ ] `Api.UnitTests/Controllers/TransactionsControllerTests.cs`
- [ ] `Api.IntegrationTests/TransactionsEndpointTests.cs`
- [ ] `Terraform/main.tf` — `module "transactions_data"`
- [ ] `Terraform/modules/api/variables.tf` — `transaction_dynamodb_table_arn`
- [ ] `Terraform/modules/api/main.tf` — extend IAM policy
- [ ] `scripts/setup_local.sh` — create `TransactionMonth` table
- [ ] `FrontEnd/src/services/transactionsService.ts`
- [ ] `FrontEnd/src/router/index.ts` — new routes
- [ ] `FrontEnd/src/components/NavBar.vue` — Dashboard/Transactions switcher
- [ ] `FrontEnd/src/views/TransactionsView.vue`
- [ ] `FrontEnd/src/views/TransactionUploadView.vue`
- [ ] `FrontEnd.UnitTests/services/transactionsService.test.ts`
- [ ] `FunctionalTests/tests/transactionUpload.spec.ts`
- [ ] Verify: `dotnet build`/`dotnet test` pass
- [ ] Verify: FrontEnd lint/type-check + `FrontEnd.UnitTests` pass
- [ ] Verify: real local run — upload end-to-end, nav switcher, saved data shape confirmed

## Prompt Log

1. "start worklog on UBE-36"
2. "example: 01 JUN 2026," (CSV date format)
