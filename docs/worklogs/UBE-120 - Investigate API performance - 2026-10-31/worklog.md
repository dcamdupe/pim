# UBE-120: Investigate the poor performance of this API request

## Linear issue

https://linear.app/uberconcept/issue/UBE-120/investigate-the-poor-performance-of-this-api-request

> See attached logs (`log-events-viewer-result.csv`)

## Description

The attached CloudWatch logs show a `POST /transactions/file` (89-row QIF
upload, 85 skipped as duplicates) on a **cold start** taking **12.2s** total
(Init 700ms, Lambda `memory_size = 128`, Max Memory Used 116MB).

Breakdown from the log timestamps:

| Phase | Time |
|---|---|
| `START` → first app log (request logging middleware) | ~2.4s |
| Middleware → `ApiKey` GetAsync request | ~2.1s |
| `ApiKey` GetAsync (first DynamoDB call) | **3.7s** |
| Gap before `User` GetAsync | ~1.1s |
| Remaining DynamoDB calls (each 40–200ms) + gaps | ~2.6s |

Likely contributors:
- **128MB memory** — Lambda CPU scales with memory; .NET JIT + AWS SDK
  initialisation is CPU-bound and starved at 128MB (also near the memory cap).
- **Cold-start first-call cost** — the 3.7s on the first DynamoDB call is
  typical of SDK client/credential/endpoint/TLS initialisation happening lazily
  on the request path.
- **Redundant reads** — `User` is fetched 3 times in one request.
- Large gaps between log lines with no I/O suggest JIT/CPU starvation.

## Plan

1. Review the request path for `POST /transactions/file` (auth/API-key
   handler, `FileProcessor`, `DynamoDbRepository`) and DynamoDB client
   registration (singleton vs per-request, lazy init).
2. Increase the API Lambda `memory_size` in `Terraform/modules/api/main.tf`
   (e.g. 128 → 1024; make it a variable if appropriate) — expected to be the
   biggest single win.
3. Reduce cold-start cost: ensure the DynamoDB client is a singleton and
   consider ReadyToRun / tiered compilation settings for the Lambda publish
   (and evaluate SnapStart for .NET if supported for `dotnet10`).
4. Remove redundant `User` lookups within a single request (load once, pass
   through / cache per request).
5. Add unit tests for any service-level changes; run `dotnet build` /
   `dotnet test`; `terraform fmt` / `terraform validate`.
6. Document findings and recommendations (incl. anything needing a manual
   `terraform apply` + re-measure in CloudWatch).

## Checklist

- [x] Review request path and DynamoDB client setup
- [x] Increase Lambda memory size in Terraform
- [x] Evaluate/apply cold-start reductions (ReadyToRun, tiered compilation, SnapStart)
- [x] Remove redundant `User` lookups per request
- [x] Unit tests for service changes
- [x] Remove redundant `User` lookups on other endpoints (settings account/category delete, description mapping)
- [x] `dotnet build` / `dotnet test` pass
- [x] `terraform fmt -recursive` / `terraform validate` pass
- [x] Record findings and follow-up (apply + re-measure)

## Findings

- **DynamoDB client** is already a singleton (`ServiceMapping`), so it isn't rebuilt per
  request. The 3.7s first call is lazy SDK/credential/TLS setup on a CPU-starved cold start.
- **Memory**: `memory_size` 128 → 512 (user choice, try first; raise to 1024 if still slow) (`Terraform/modules/api/main.tf`). Lambda gives CPU in
  proportion to memory, so .NET startup/JIT should get much faster. Because duration drops,
  the cost per request should be roughly the same.
- **ReadyToRun**: enabled in `Pim.Api.csproj` for RID-specific publishes only (the
  `dotnet publish -r linux-x64` used by `deploy.yml`/`terraform.yml`), so local builds and tests
  are unaffected. Precompiling reduces JIT work at cold start.
- **Tiered compilation**: left at the defaults (quick JIT is already on). No change needed.
- **SnapStart**: not done here. It needs published versions plus an alias, the API Gateway
  integration pointed at that alias, and `deploy.yml` changed to publish a version on each
  deploy. It also costs extra for .NET. Re-measure after the memory + R2R changes first; take it
  on as a follow-up issue only if cold starts are still too slow.
- **Redundant `User` reads**: the controller loads the user once and passes it to
  `FileProcessor.ProcessAsync` and `InternalTransferMatcher.MatchAsync`.
  `InternalTransferMatcher` no longer depends on `IRepository<User>`. This saves 2–3 reads
  per upload. A new unit test checks that `User` is never re-read during processing.

- **Other endpoints with duplicate `User` reads** (2 reads each, now 1): `DELETE settings/account`,
  `DELETE settings/category` and `POST mapping/description`. `TransactionUpdateService`'s
  `ApplyDescriptionMappingAsync`, `DeleteTransactionsForAccountAsync` and
  `RemoveCategoryFromTransactionsAsync` now take the loaded `User`. They pass
  `user.MinTransactionDate` to `GetTransactionsAsync` explicitly, and skip the query when it's
  null, which is the same result as before. `MappingController` now loads the user and returns
  404 if it's missing, matching `SettingsController`. `PUT transactions` keeps its single
  lazy categories read.

## Follow-up (manual)

1. `terraform apply` the memory change. It isn't covered by `deploy.yml`, which only updates
   function code.
2. Deploy the code (ReadyToRun build) and re-run the same QIF upload on a cold start, then
   compare the CloudWatch `REPORT` duration against the 12.2s baseline.

## Log

### Prompt
start a worklog for UBE-120

### Response
Fetched UBE-120 and its attached log, analysed the timings, created branch
`UBE-120/investigate-api-performance` and this worklog. Asked for
confirmation of the plan before starting.

### Prompt
What is the cause of the extra user reads?

### Response
Each service loads `User` itself instead of receiving it: `TransactionsController.cs:49`
(account check), `FileProcessor.cs:143` (description-mapping categories), `FileProcessor.cs:105`
(MinTransactionDate), plus `InternalTransferMatcher.cs:79` when a transfer matches. Each read was
only 40–180ms, so the saving is small; most of the time comes from the cold start at 128MB.

### Prompt
start work

### Response
Passed the loaded `User` down from the controller, removed `IRepository<User>` from
`InternalTransferMatcher`, added a no-reload unit test, raised Lambda memory to 1024MB, enabled
ReadyToRun on RID publishes, and recorded SnapStart as a possible follow-up. Build, unit tests
(92) and terraform validate pass. Integration tests failed because the DynamoDB Local container
had restarted with no tables (in-memory). The user needs to re-run `source scripts/setup_local.sh`
(uses the aws CLI) before the integration tests are re-run.

### Prompt
Are there are similar uses of User in the codebase?

### Response
Yes: `DELETE settings/account` and `DELETE settings/category` read the user in the controller and
again in `GetTransactionsAsync` (for MinTransactionDate). `POST mapping/description` reads it in
`GetTransactionsAsync` and again in `LoadCategoriesAsync`. `PUT`/`GET transactions` read it once.

### Prompt
Implement the same fix for others

### Response
`TransactionUpdateService`'s three bulk methods now take `User`. They pass MinTransactionDate
explicitly through a new `GetAllTransactionsAsync` helper. `MappingController` loads the user
(404 if missing). Tests were updated, and two were added: one checks there's no user reload and
the query starts from MinTransactionDate, the other checks the query is skipped when
MinTransactionDate is null. Build passes with 0 warnings and all 93 unit tests pass. Integration
tests are still blocked on the DynamoDB Local tables (`source scripts/setup_local.sh` needed).

### Prompt
change the lambda to 512Mb of RAM, we'll try with that first

### Response
Set `memory_size = 512` in `Terraform/modules/api/main.tf`. fmt and validate pass.

### Prompt
commit and raise PR

### Response
Committed 081b665 and raised https://github.com/dcamdupe/pim/pull/100. The PR notes that the
integration tests haven't been run yet.

### Prompt
(user ran `source scripts/setup_local.sh`)

### Response
Integration tests: 66 passed. Updated the PR description to match.

### Prompt
yes, commit and push

### Response
Committed and pushed the worklog update to PR #100.
