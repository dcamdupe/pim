# UBE-44 — Implement transaction listing

Linear: https://linear.app/uberconcept/issue/UBE-44/implement-transaction-listing

## Description

From the Linear issue:
- Implement the transaction listing, as per the design (`docs/design/dashboard-mockup-calm.html`).
  - Do not implement the "3 entries need a category before they'll show up in your reports"
    subheading.
  - Do not implement the ability to edit categories of transactions.
  - Add a date-range filter, defaulting to "last month" — other options: last week, last 3
    months, all time.
- API: `GET /transactions?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd`
  - Look up transactions by date range.
  - Handle not all date ranges being populated in DynamoDB.
  - Filter out transactions outside the requested date range.

## Current state

- Storage (from UBE-36): one `TransactionMonth` item per user-per-month, keyed by composite string
  id (`Email|yyyy-MM`). `IRepository<T>`/`DynamoDbRepository<T>` support only single-item Get/Add/
  Update/Delete by exact id — no Query/list-by-partial-key capability, and none was added.
- `TransactionsView.vue` is currently just an "Upload" button (per UBE-36's scope, no listing yet).
- `docs/design/dashboard-mockup-calm.html`'s `#view-transactions` section: a `.filter-bar` (search
  input, account `<select>`, category `<select>`, a "N need a category" chip-toggle) above a
  `.table-card` containing `table.tx` (Date, Description, Account badge, Amount, editable Category
  `<select>`). The mockup has **no date-range filter** — that's new UI this ticket adds. The
  mockup's `--surface`/`--ink`/`--radius`/`--shadow`/card-based visual system is a richer design
  language than the app's current CSS vars (`--bg`/`--border`/`--text`/`--text-h`/`--accent`/
  `--field-bg` in `FrontEnd/src/style.css`) — the rest of the app hasn't adopted it yet.

## My calls

- **Query by enumerating months, not real DynamoDB Query.** `[startDate, endDate]` maps to a small,
  bounded set of `(year, month)` pairs; `GetTransactionsAsync` does one `GetAsync` per month via the
  *existing* `IRepository<TransactionMonth>` (missing months naturally return `null` → skipped,
  which **is** "handle not all date ranges being populated"), then filters the combined transactions
  to the exact `[startDate, endDate]` range (handles partial-month ranges) and sorts. Zero changes
  to the repository abstraction or Terraform — same reasoning as UBE-36's storage design: this
  ticket doesn't need real cross-partition querying, just bounded month lookups.
- **New `Api/Services/TransactionQueryService.cs`/`ITransactionQueryService`**, not inline
  controller logic — matches the CsvProcessor precedent from UBE-36 (thin controller, business
  logic in a dedicated service, easy to unit test in isolation).
- **`startDate`/`endDate` are required query params on the backend** (`400` if either is missing or
  `startDate > endDate`); the "defaults to last month" behaviour lives entirely in the FrontEnd
  (computes the actual date values before calling the API on page load) - matches the endpoint
  signature as literally specified (`GET /transactions?startDate=...&endDate=...`), keeps the
  backend stateless/simple.
- **Sort order: descending by date** (newest first) — not specified in the ticket, but the standard
  convention for a transaction list and matches the mockup's own sample data (also newest-first).
  Flagging as an assumption.
- **FrontEnd scope — only what's asked, not everything in the mockup.** The mockup's filter bar
  also has a search box, an account filter, a category filter, and a "N need a category" chip
  toggle — none of which this ticket requests, and the backend API doesn't support search/account/
  category filtering anyway (only date range). Implementing them would be scope creep guessing at
  unrequested functionality. Building **only**: the date-range filter (required) + the table
  (Date/Description/Account/Amount/Category columns, matching the mockup's `table.tx` structure and
  styling). Category is rendered **read-only** as a chip (reusing the mockup's `.chip`/
  `.chip-muted` treatment from its "recent transactions" list, not the editable `.cat-select`
  dropdown from its transactions table) — editing categories is explicitly out of scope, so an
  editable-looking control would be misleading.
- **Styling: adapt the mockup's Transactions-section visual language into this one page's
  `<style scoped>` block, not an app-wide reskin.** Reusing the app's existing CSS custom properties
  (`--bg`/`--border`/`--text`/`--text-h`/`--accent`/`--field-bg`) wherever they map cleanly, and
  only introducing new page-local values (box-shadow, `border-radius`, mono font for amounts, a
  green "positive amount" color, muted-chip styling) for things the existing token set doesn't
  cover. Restyling the rest of the app (nav, Settings, Dashboard) to the mockup's fuller design
  system is a much bigger, separate decision this ticket doesn't ask for.
- **Account column**: the mockup shows a masked-account-number badge (e.g. "Checking ·4821"). Our
  `Transaction.Account` is just the plain bank-account-name string chosen at upload time (no masked
  number in the data model) - showing the account name as a badge (reusing the mockup's
  `.acct-badge` styling minus the number) rather than inventing a lookup into Settings accounts for
  a masked number, which isn't requested.
- **"All time" date bound**: the API has no "since the beginning" concept - it needs a concrete
  `startDate`. The FrontEnd sends 10 years back from today for "All time", a pragmatic bound that
  safely covers any real usage of this brand-new app without needing a real "earliest data" lookup.
- **No per-category color palette for the chip**: the mockup colors each category chip from a
  9-entry hex map (Housing, Groceries, etc.). Since CSV upload always saves an *empty* `Category`
  (category editing is explicitly out of scope, and nothing else sets it yet), every transaction
  currently in the system would hit the same "Uncategorized" muted-chip state - building a color
  palette for category values that can never actually occur yet would be speculative. Category
  renders as a plain chip (single color) when non-empty, muted "Uncategorized" when empty - matches
  the mockup's `.chip`/`.chip-muted` treatment (from its "recent transactions" list, not the
  editable table `.cat-select`) without inventing an unused taxonomy.

## Plan

### Backend
1. `Api/Services/ITransactionQueryService.cs` / `TransactionQueryService.cs` (new) —
   `GetTransactionsAsync(email, startDate, endDate)`: enumerates the spanned `(year, month)` pairs,
   `GetAsync`s each `TransactionMonth` (skipping nulls), filters to the exact date range, sorts
   descending by date.
2. `Api/Controllers/TransactionsController.cs` — add `GET("transactions")` action:
   `[FromQuery] DateOnly? startDate/endDate`, `400` if either missing or `startDate > endDate`,
   otherwise calls the service and returns `200` with a `TransactionsResponse(List<Transaction>)`.
3. `Api/IoC/ServiceMapping.cs` — register `ITransactionQueryService`.
4. `Api.UnitTests/Services/TransactionQueryServiceTests.cs` (new) — missing months skipped
   gracefully, partial-month range filtering, multi-month enumeration, descending sort.
5. `Api.UnitTests/Controllers/TransactionsControllerTests.cs` — add GET action tests (mocking
   `ITransactionQueryService`): bad request on missing/invalid params, OK + correct payload.
6. `Api.IntegrationTests/TransactionsEndpointTests.cs` — add GET tests seeding `TransactionMonth`
   buckets directly via `IRepository<TransactionMonth>` (including a requested month with no data at
   all, to prove the "not all date ranges populated" case doesn't error).

### FrontEnd
7. `FrontEnd/src/services/transactionsService.ts` — add `getTransactions(startDate, endDate)`.
8. `FrontEnd/src/views/TransactionsView.vue` — rewrite: date-range `<select>` (Last week/Last month
   [default]/Last 3 months/All time) computing actual date bounds client-side, fetch on mount and on
   filter change, `table.tx`-style table (Date/Description/Account/Amount/Category), read-only
   category chip, loading/error states matching the app's existing convention, Upload button
   retained.
9. `FrontEnd.UnitTests/services/transactionsService.test.ts` — add `getTransactions` tests.
10. `FunctionalTests/tests/transactionListing.spec.ts` (new) — upload a small CSV (reusing the
    existing upload flow), then verify the transactions show up in the listing, date-range filter
    switches correctly.

### Verify
11. `dotnet build`/`dotnet test` (unit + integration, against DynamoDB Local).
12. `npm run lint`/`vue-tsc -b` in `FrontEnd/`; `npm run test` in `FrontEnd.UnitTests/`.
13. Real local run via `scripts/run_local.sh` — upload a CSV, confirm it appears in the listing,
    confirm each date-range filter option works, confirm a range with no data shows an empty state
    (not an error).

## Checklist

- [x] `Api/Services/ITransactionQueryService.cs` / `TransactionQueryService.cs` (build clean)
- [x] `Api/Controllers/TransactionsController.cs` — `GET /transactions` (build clean; DI
      registration for `ITransactionQueryService` is next step, controller won't resolve until then)
- [x] `Api/IoC/ServiceMapping.cs` — register `ITransactionQueryService` (build clean)
- [x] `Api.UnitTests/Services/TransactionQueryServiceTests.cs` — 6 tests (empty when no data,
      partial-range filtering, multi-month combining, missing month mid-range, year-boundary
      enumeration, descending sort)
- [x] `Api.UnitTests/Controllers/TransactionsControllerTests.cs` — GET action tests (4 new: missing
      start/end date, start>end, success); also had to fix the constructor call broken by step 2's
      controller signature change. All 32 unit tests pass.
- [x] `Api.IntegrationTests/TransactionsEndpointTests.cs` — GET tests (4 new: unauthenticated, bad
      request on missing/invalid params, range-filtering + a real missing-month gap in the middle of
      the range) — all 7 integration tests pass against real DynamoDB Local
- [x] `FrontEnd/src/services/transactionsService.ts` — `getTransactions` + `Transaction` interface +
      `TransactionsRequestFailedError` (`vue-tsc -b` clean)
- [x] `FrontEnd/src/views/TransactionsView.vue` — listing + date filter (`vue-tsc -b && vite build`
      and `npm run lint` both clean; date range computed client-side per option, table styled per
      the mockup's `table.tx`, read-only category chips, Upload button retained)
- [x] `FrontEnd.UnitTests/services/transactionsService.test.ts` — `getTransactions` tests (2 new:
      query params + bearer token + returns transactions, error on non-ok); all 20 tests pass
- [x] `FunctionalTests/tests/transactionListing.spec.ts` — uploads a today-dated + a 6-weeks-ago
      transaction, verifies the default "Last month" filter shows only today's, switching to "Last
      3 months" shows both, switching to "Last week" hides the old one again - real date-range
      filtering coverage, not just presence-check. Passes; full suite run shows the same pre-existing
      `settings.spec.ts` concurrent-manual-editing race diagnosed earlier this session (unrelated to
      this change) - 7/8 pass, all transaction-related tests green.
- [x] Verify: `dotnet build`/`dotnet test` pass — final full-solution run, 46/46 tests (32 unit +
      14 integration)
- [x] Verify: FrontEnd lint/type-check + `FrontEnd.UnitTests` pass — already confirmed clean at
      steps 8-9 (`vue-tsc -b && vite build`, `npm run lint`, 20/20 `FrontEnd.UnitTests`)
- [x] Verify: real local run — upload/listing/3 of 4 filters covered end-to-end by the Playwright
      spec; "All time" (10y range) and empty-range state verified directly against the live Api
      (`GET /transactions`): empty range → `{"transactions":[]}` in 200ms, no error; 10-year range
      (~120 months enumerated) → 200 OK in 144ms

## Prompt Log

1. "start a worklog UBE-44"
2. (design reference clarification) "dashboard-mockup-calm.html"
3. "note the claude.md where the design is"
4. "yes, go ahead" (step 1 — ITransactionQueryService/TransactionQueryService)
5. "`" / "go" (step 2 — TransactionsController GET action)
6. "go ahead" (step 3 — ServiceMapping DI registration)
7. "go ahead" (step 4 — TransactionQueryServiceTests.cs)
8. "go" (step 5 — TransactionsControllerTests.cs GET tests)
9. "go" (step 6 — TransactionsEndpointTests.cs GET tests)
10. "go" (step 7 — transactionsService.ts getTransactions)
11. "go" (step 8 — TransactionsView.vue listing rewrite)
12. "go ahead" (step 9 — transactionsService.test.ts)
13. "go" (step 10 — transactionListing.spec.ts)
14. "go" (final verification, steps 11-13)
