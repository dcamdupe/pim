# UBE-47 — Update user object to store min date

Linear: https://linear.app/uberconcept/issue/UBE-47/update-user-object-to-store-min-date

## Description

Store the earliest transaction date on record for a user on the `User` object. Use it as the
`GET /transactions` `startDate` whenever the caller doesn't provide one.

This directly closes a gap flagged in UBE-44's worklog: the FrontEnd's "All time" date-range filter
currently sends a hardcoded 10-years-back `startDate` ("no real 'since the beginning' concept on
the API... a pragmatic bound"). This ticket replaces that guess with the real earliest date.

## Current state

- `Api/Data/User.cs`: `Email`, `PasswordHash`, `Accounts` — no date tracking.
- `Api/Controllers/TransactionsController.cs`'s `GetTransactions`: `startDate`/`endDate` are both
  `DateOnly?` query params, `400` if either is missing or `startDate > endDate`.
- `Api/Services/TransactionQueryService.cs`: takes non-nullable `startDate`/`endDate`, enumerates
  the spanned months via `IRepository<TransactionMonth>` only (no `IRepository<User>` dependency).
- `Api/Services/CsvProcessor.cs`: saves parsed transactions into `TransactionMonth` buckets
  (`IRepository<TransactionMonth>` only); never touches `User`.
- `FrontEnd/src/views/TransactionsView.vue`'s "All time" option: `start.setFullYear(... - 10)`.

## My calls

- **`User.MinTransactionDate`** (nullable `DateOnly?`, not `required`) — nullable so existing users
  (serialized before this field existed) deserialize cleanly with `null` rather than needing a
  migration; `System.Text.Json` already defaults a missing JSON property to `null` for a nullable
  field with no extra handling needed.
- **Updated from `CsvProcessor`, using the *whole* parsed batch, not just newly-added rows.** Even
  a row that gets skipped as a duplicate (UBE-45) still represents a genuine transaction date
  already on record; comparing against the full batch is simplest and correct either way, since
  it's a monotonic `min` against the stored value.
- **`TransactionQueryService.GetTransactionsAsync`'s `startDate` becomes `DateOnly?`.** When
  omitted, resolves via `IRepository<User>` → `MinTransactionDate`; if that's also `null` (user has
  no transactions at all yet), returns an empty list rather than erroring - there's nothing to look
  up, not a client mistake.
- **Controller: `400` only for genuine caller errors** — `endDate` missing, or an *explicitly
  provided* `startDate` after `endDate`. Omitted `startDate` resolving (via `MinTransactionDate`) to
  something after `endDate` isn't a caller error, just "no data in range" - handled naturally by
  `EnumerateMonths` already returning zero months when `start > end`, no special-casing needed.
- **FrontEnd "All time" now omits `startDate` entirely**, letting the backend resolve it - since
  the real capability now exists, leaving the old 10-year guess in place would mean this ticket's
  backend work is never actually exercised by the app.

## Plan

### Backend
1. `Api/Data/User.cs` — add `DateOnly? MinTransactionDate`.
2. `Api/Services/CsvProcessor.cs` — inject `IRepository<User>`; after saving, if the batch is
   non-empty, update the user's `MinTransactionDate` down if the batch's earliest date beats it (or
   none is set yet).
3. `Api/Services/ITransactionQueryService.cs` / `TransactionQueryService.cs` — inject
   `IRepository<User>`; `startDate` becomes `DateOnly?`, resolved via `MinTransactionDate` when
   omitted; empty list if still unresolved.
4. `Api/Controllers/TransactionsController.cs` — `startDate` becomes truly optional; `400` only for
   missing `endDate` or an explicit `startDate > endDate`.
5. Update `Api.UnitTests/Services/CsvProcessorTests.cs`, `TransactionQueryServiceTests.cs`,
   `Api.UnitTests/Controllers/TransactionsControllerTests.cs` for the new constructor
   dependencies/signatures, plus new test cases for the min-date behaviour itself.
6. `Api.IntegrationTests/TransactionsEndpointTests.cs` — add tests: omitted `startDate` uses the
   real stored `MinTransactionDate` after an upload; a user with zero transactions ever gets an
   empty `200`, not an error, when `startDate` is omitted.

### FrontEnd
7. `FrontEnd/src/services/transactionsService.ts` — `getTransactions`'s `startDate` param becomes
   optional.
8. `FrontEnd/src/views/TransactionsView.vue` — "All time" omits `startDate` instead of computing a
   10-year-back date.
9. `FrontEnd.UnitTests/services/transactionsService.test.ts` — update/add tests for the optional
   `startDate`.
10. `FunctionalTests/tests/transactionListing.spec.ts` — extend to cover "All time" specifically,
    proving the real min-date lookup (not just week/month/3-months, which it already covers).

### Verify
11. `dotnet build`/`dotnet test` (unit + integration, against DynamoDB Local).
12. `npm run lint`/`vue-tsc -b` in `FrontEnd/`; `npm run test` in `FrontEnd.UnitTests/`.
13. Real local run via `scripts/run_local.sh` — upload an old-dated CSV, select "All time", confirm
    it shows up without relying on the old 10-year guess.

## Checklist

- [x] `Api/Data/User.cs` — `MinTransactionDate` (nullable `DateOnly?`, build clean)
- [x] `Api/Services/CsvProcessor.cs` — injects `IRepository<User>`, updates `MinTransactionDate`
      downward using the batch's earliest date when non-empty (build clean)
- [x] `Api/Services/TransactionQueryService.cs`/`ITransactionQueryService.cs` — `startDate` is
      `DateOnly?`, resolves via `IRepository<User>` → `MinTransactionDate` when omitted, empty list
      if still unresolved (build clean; David asked me to drop a comment on `User.MinTransactionDate`
      that restated the obvious)
- [x] `Api/Controllers/TransactionsController.cs` — `startDate` optional, `400` only for missing
      `endDate` or an explicit `startDate > endDate` (build clean)
- [x] Update `CsvProcessorTests.cs`/`TransactionQueryServiceTests.cs`/`TransactionsControllerTests.cs`
      — 4 new CsvProcessor tests (set/lower/don't-raise min date, no-rows guard), 4 new
      TransactionQueryService tests (resolve from min date, empty when no min date/no user, explicit
      startDate wins over stored min), replaced the now-invalid "missing startDate → BadRequest"
      controller test with one proving omitted startDate succeeds and passes `null` through. All
      46 unit tests pass.
- [x] `Api.IntegrationTests/TransactionsEndpointTests.cs` — added real `User` seed/cleanup
      (`InitializeAsync`/`DisposeAsync`, previously a no-op — now realistic, since a real upload
      requires an existing user); 2 new tests: omitted `startDate` resolves the real persisted
      `MinTransactionDate` after an upload, and a never-uploaded user gets an empty `200`. All 8
      integration tests in this file pass; full backend suite 64/64 (46 unit + 18 integration)
- [x] `FrontEnd/src/services/transactionsService.ts` — `startDate` is `string | undefined`, omitted
      from the query string entirely when not provided (`vue-tsc -b` clean)
- [x] `FrontEnd/src/views/TransactionsView.vue` — "All time" returns `startDate: undefined` instead
      of computing a 10-year-back date (`vue-tsc -b && vite build` and `npm run lint` both clean)
- [x] `FrontEnd.UnitTests/services/transactionsService.test.ts` — added a test for the omitted-
      `startDate` case; caught and fixed a real param-order regression it exposed (`endDate` was
      landing before `startDate` in the query string) by building the `URLSearchParams` in
      `startDate`-then-`endDate` order, matching the endpoint's own documented signature - all 21
      `FrontEnd.UnitTests` pass, `vue-tsc -b` clean
- [x] `FunctionalTests/tests/transactionListing.spec.ts` — added a 2010-dated transaction and an
      "All time" assertion; passes in 2.6s (the ~200-month enumeration back to 2010 causes no
      noticeable slowdown). This is only possible if "All time" genuinely resolved the omitted
      `startDate` from the real stored `MinTransactionDate`, not a fixed lookback window - the old
      10-year hardcoded bound would have missed it. Full suite 7/8 (same pre-existing unrelated
      `settings.spec.ts` race)
- [x] Verify: `dotnet build`/`dotnet test` pass — already confirmed at step 6 (64/64 tests: 46 unit
      + 18 integration)
- [x] Verify: FrontEnd lint/type-check + `FrontEnd.UnitTests` pass — already confirmed at steps 8-9
      (`vue-tsc -b && vite build`, `npm run lint`, 21/21 `FrontEnd.UnitTests`)
- [x] Verify: real local run — already confirmed at step 10 via `scripts/run_local.sh` +
      `transactionListing.spec.ts`'s "All time" assertion against a real 2010-dated upload

## Prompt Log

1. "start worklog for UBE-47"
2. "go ahead" (step 1 — User.cs MinTransactionDate)
3. "remove the stupid comment on MinTransactionDate in User.cs"
4. "go ahead" (step 2 — CsvProcessor.cs)
5. "s" / "go" (step 3 — TransactionQueryService.cs)
6. "go ahead" (step 4 — TransactionsController.cs)
7. "go ahead" (step 5 — unit test updates)
8. "go ahead" (step 6 — integration test updates)
9. "go" (step 7 — transactionsService.ts)
10. "go ahead" (step 8 — TransactionsView.vue)
11. "go ahead" (step 9 — transactionsService.test.ts, caught a real param-order regression)
12. "go" (step 10 — transactionListing.spec.ts "All time" coverage; final verification)
