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
- [ ] `Api.IntegrationTests/TransactionsEndpointTests.cs` — GET tests
- [ ] `FrontEnd/src/services/transactionsService.ts` — `getTransactions`
- [ ] `FrontEnd/src/views/TransactionsView.vue` — listing + date filter
- [ ] `FrontEnd.UnitTests/services/transactionsService.test.ts` — `getTransactions` tests
- [ ] `FunctionalTests/tests/transactionListing.spec.ts`
- [ ] Verify: `dotnet build`/`dotnet test` pass
- [ ] Verify: FrontEnd lint/type-check + `FrontEnd.UnitTests` pass
- [ ] Verify: real local run — upload, listing, all 4 date-range filters, empty-range state

## Prompt Log

1. "start a worklog UBE-44"
2. (design reference clarification) "dashboard-mockup-calm.html"
3. "note the claude.md where the design is"
