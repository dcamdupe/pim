# UBE-122: Investigate the poor performance of the API call

## Linear issue

https://linear.app/uberconcept/issue/UBE-122/investigate-the-poor-performance-of-the-api-call

> See logs (`log-events-viewer-result (1).csv`)

## Description

The attached CloudWatch logs show a **warm** (no Init) `GET /transactions?endDate=2026-10-31`
(no `startDate`, so the whole history is loaded) taking **5.9s**. The Lambda was still at
`memory_size = 128` (Max Memory Used **127MB**, right at the limit). The UBE-120 bump to 512MB
had not been applied yet.

Breakdown from the log timestamps:

| Phase | Time |
|---|---|
| `User` read (MinTransactionDate = 2020-12) | ~40ms |
| **71 `TransactionMonth` GetItem calls** (2020-12 → 2026-10), `MaxParallelMonthFetches = 5` | **~4.2s** (283ms → 4524ms; per call median 99ms, p90 400ms, max 620ms) |
| Last fetch → response logged (filter/sort/serialise + **logging the full 262KB response body**) | ~0.9s |
| Response logged → `END` (copy captured body to the real response stream) | ~0.46s |

Likely contributors:
- **One GetItem per month**: 71 round trips with only 5 in flight at a time. DynamoDB's
  `BatchGetItem` takes up to 100 keys per call, so this could be 1 call.
- **`RequestResponseLoggingMiddleware` logs the whole response body** for every request.
  For this endpoint that means 262KB written to CloudWatch, plus buffering the response in a
  `MemoryStream` and copying it again. That costs CPU and memory at 128MB and also costs
  CloudWatch ingestion.
- **128MB memory**: at the cap (127MB), so GC pressure and low CPU. Already addressed by UBE-120
  (512MB) once that's applied.
- Loading full history is by design: the FrontEnd's "All time" range omits `startDate` and
  filters client-side (`FrontEnd/src/utils/transactionDateRange.ts`), so that's left as is.

## Plan

1. Add a batch get to `IRepository<T>` / `DynamoDbRepository<T>` (`GetManyAsync(ids)`) using
   `BatchGetItem`. Chunk the ids into 100s and retry `UnprocessedKeys` with backoff. Log it the
   same way as the existing calls.
2. Change `TransactionQueryService.GetTransactionsAsync` to fetch all month buckets with one
   `GetManyAsync` call instead of `Parallel.ForEachAsync` + GetItem.
3. Truncate the logged response body in `RequestResponseLoggingMiddleware` (e.g. first N chars +
   total length) so large responses aren't written to CloudWatch in full.
4. Check the Lambda IAM policy allows `dynamodb:BatchGetItem` on the TransactionMonth table and
   add it in Terraform if not.
5. Tests: unit tests for the query service, plus a repository/integration test covering batch get
   (including more than 100 ids) and the truncated logging. Update existing logging tests that
   assert on the response body.
6. `dotnet build` / `dotnet test`; `terraform fmt` / `validate`.
7. Record findings and follow-up (deploy, then re-measure against the 5.9s baseline).

## Checklist

- [x] `GetManyAsync` (BatchGetItem, chunked, UnprocessedKeys retry) on the repository
- [x] `TransactionQueryService` uses one batch get
- [x] Truncate response body logging
- [x] IAM allows `dynamodb:BatchGetItem` (Terraform)
- [x] Unit + integration tests
- [x] `dotnet build` / `dotnet test` pass
- [x] `terraform fmt -recursive` / `terraform validate` pass
- [x] Record findings and follow-up (deploy + re-measure)

## Findings / follow-up

- `GET /transactions` now does 1 `BatchGetItem` (per 100 months) instead of 71 `GetItem` calls
  (5 in flight). Expected to remove most of the ~4.2s fetch phase.
- Response body log is capped at 2000 chars plus `bytes=<size>`, so the 262KB body is no longer
  written to CloudWatch.
- Other `IRepository<TransactionMonth>` callers (FileProcessor, TransactionUpdateService,
  InternalTransferMatcher) still use single `GetAsync` per month; left as is (small ranges).
- Follow-up: `terraform apply` (adds `dynamodb:BatchGetItem`, plus UBE-120's 512MB if not yet
  applied) **before** deploying the Api, otherwise `/transactions` will fail with AccessDenied.
  Then re-measure the same call against the 5.9s baseline.
- Results: `dotnet build` clean, `dotnet test` 91 unit + 69 integration passing,
  `terraform fmt`/`validate` clean.

## Log

### Prompt
start a worklog for UBE-122

### Response
Fetched UBE-122 and its attached log, analysed the timings, created branch
`UBE-122/investigate-api-call-perf` and this worklog. Asked for confirmation of the plan before
starting.

### Prompt
start on the worklog

### Response
Plan confirmed; starting implementation.
Implemented `GetManyAsync` (BatchGetItem, 100-key chunks, UnprocessedKeys retry with backoff),
switched `TransactionQueryService` to one batch call, truncated response-body logging (2000 chars
+ byte size), added `dynamodb:BatchGetItem` to the Lambda IAM policy, added unit/integration tests.
Build, tests and terraform checks pass. Not committed.

### Prompt
What happens when there is more than 100 matching documents in dynamoDB

### Response
Ids are chunked into 100s, one sequential BatchGetItem per chunk (tested with 120). The 16MB
per-call cap is handled by the UnprocessedKeys retry loop. Minor: chunks are sequential, and
size-cap retries get the throttling backoff; neither matters at current data size.

### Prompt
commit this

### Response
Committed all changes plus the worklog.
