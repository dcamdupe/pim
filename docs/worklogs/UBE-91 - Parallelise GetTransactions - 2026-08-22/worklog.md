# UBE-91: parallelise GetTransactionsAsync

## Linear issue

[UBE-91](https://linear.app/uberconcept/issue/UBE-91/parallelise-gettransactionsasync) — parallelise GetTransactionsAsync

> Convert the loop to task.parallel, with 5 parallelisation

## Description

`TransactionQueryService.GetTransactionsAsync` (`Api/Services/TransactionQueryService.cs:17-41`)
stores transactions bucketed one DynamoDB item per user-month (`TransactionMonth`). To answer a
query it currently `foreach`-loops every month in the requested range and `await`s
`_transactionMonths.GetAsync(id)` **sequentially** - for a wide range (e.g. "All time" back to
`MinTransactionDate`, or the null-startDate fallback other callers use for "every transaction"),
that's one DynamoDB round-trip after another. UBE-91 asks to parallelise that loop, capped at 5
concurrent requests, rather than firing every month's request at once (which could overload/
throttle DynamoDB) or leaving it fully sequential.

`Parallel.ForEachAsync` (.NET's built-in bounded-concurrency async loop, `MaxDegreeOfParallelism`)
is the direct fit for "task.parallel...with 5 parallelisation" here.

## Plan

- `Api/Services/TransactionQueryService.cs`
  - Replace the `foreach` loop with `await Parallel.ForEachAsync(EnumerateMonths(...), new
    ParallelOptions { MaxDegreeOfParallelism = 5 }, async (month, ct) => { ... })`, collecting
    fetched transactions into a `ConcurrentBag<Transaction>` (thread-safe target for the parallel
    body) instead of a plain `List<Transaction>`.
  - The final `.Where(...).OrderByDescending(...).ToList()` stays unchanged - ordering only
    matters after all buckets are fetched, so parallel fetch order doesn't affect the result.
  - `EnumerateMonths` itself is unchanged - it already returns `IEnumerable<(int Year, int
    Month)>`, which `Parallel.ForEachAsync` consumes directly.
- `Api.UnitTests/Services/TransactionQueryServiceTests.cs`
  - Existing tests should keep passing unchanged (behaviour is identical, just concurrent).
  - Add one new test spanning more months than the parallelism cap (e.g. 8 months) to confirm
    correctness isn't affected once `Parallel.ForEachAsync` has to batch/queue beyond 5 concurrent
    bodies.
- No controller/repository/other-caller changes expected - `ITransactionQueryService`'s signature
  is unchanged, so `TransactionUpdateService`'s three call sites are unaffected.

## Checklist

- [x] Convert `GetTransactionsAsync`'s loop to `Parallel.ForEachAsync` with `MaxDegreeOfParallelism = 5`
- [x] Add a unit test spanning more months than the parallelism cap
- [x] Run `dotnet build` and `dotnet test Api.UnitTests`
- [x] Run `dotnet test Api.IntegrationTests` (covers `TransactionsEndpointTests`, real DynamoDB Local)
- [x] Review diff and open PR

## Session log

### 2026-08-22

- Retrieved UBE-91 from Linear.
- Read `TransactionQueryService.cs`, its unit tests, and `RepositoryMockFactory` to confirm the
  current sequential loop shape and how the mocked repository behaves under concurrent reads.
- Created this worklog and branch `UBE-91/parallelise-gettransactionsasync` off `main`.
- Replaced the sequential `foreach` in `GetTransactionsAsync` with `Parallel.ForEachAsync` (cap
  `MaxDegreeOfParallelism = 5`), collecting fetched transactions into a `ConcurrentBag<Transaction>`
  before the unchanged final filter/sort. `dotnet build Api` succeeds clean.
- Added `GetTransactionsAsync_CombinesTransactionsAcrossMoreMonthsThanTheParallelismLimit` (8
  months, exceeding the 5-way cap) to `TransactionQueryServiceTests`.
- `dotnet test Api.UnitTests` - 86 passed (85 existing + the new test).
- `dotnet test Api.IntegrationTests` against real DynamoDB Local - 59 passed (22 of them
  `TransactionsEndpointTests`, exercising `GetTransactionsAsync` end-to-end through the real Api).
- Committed and pushed; opened PR #78: https://github.com/dcamdupe/pim/pull/78
