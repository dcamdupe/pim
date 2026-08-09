# UBE-89: Add execution time to dynamodb logging

Linear: https://linear.app/uberconcept/issue/UBE-89/add-execution-time-to-dynamodb-logging
Status: In Progress · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/65

## Description (from Linear)

Use a time to measure the time taken to execute a query.

## Current state

- `Api/Repository/DynamoDbRepository.cs` is the single, generic `IRepository<T>` implementation for
  every DynamoDB-backed entity (`User`, `TransactionMonth`, `TransactionDescriptions`,
  `DescriptionMapping`) - confirmed via grep that it's the only place in `Api/` calling
  `IAmazonDynamoDB` methods directly, so this is the one file that needs to change.
- Each operation (`GetAsync`, `AddAsync`/`UpdateAsync` via a shared `PutAsync`, `DeleteAsync`) already
  logs a "request" line before the DynamoDB call and a "response" line after
  (`_logger.LogInformation(...)`, metadata only - table/id/operation, never entity content, per
  [[UBE-32]]'s deliberate `PasswordHash`-safety design). This ticket adds execution time to those
  existing response log lines, not a new logging path.
- Plain `_logger.LogInformation(...)` calls are fine here - `Api.csproj` suppresses `CA1848`/`CA1873`
  (added after UBE-32, per UBE-33's worklog), so no `[LoggerMessage]` source-generated delegates
  needed (UBE-32's original `RepositoryLog.cs` helper for that no longer exists).
- No existing test exercises `DynamoDbRepository<T>` in isolation (`Api.UnitTests` only has
  `RepositoryMockFactory`, which mocks `IRepository<T>` itself for *other* services' tests - it
  doesn't test the DynamoDB implementation). [[UBE-33]]'s `RequestResponseLoggingTests.cs` establishes
  the precedent for testing logging output here: a `WebApplicationFactory` layered with a custom
  in-memory `ILoggerProvider` (`CapturingLoggerProvider`/`CapturingLogger`, currently private/nested
  in that one file) that captures real formatted log lines from the real pipeline (real DynamoDB
  Local, not mocked) for assertions.

## Plan

**Api**

1. `Api/Repository/DynamoDbRepository.cs` - wrap each of the three `IAmazonDynamoDB` calls
   (`GetItemAsync`, `PutItemAsync`, `DeleteItemAsync`) with a `System.Diagnostics.Stopwatch`, and
   include the elapsed time (`stopwatch.ElapsedMilliseconds`) in that operation's existing "response"
   log line (e.g. appending `elapsedMs={ElapsedMs}`) - request-side lines are unchanged, since there's
   nothing to time before the call has happened.

**Tests**

2. Extract `RequestResponseLoggingTests.cs`'s private `CapturingLoggerProvider`/`CapturingLogger`
   into a shared `Api.IntegrationTests/Helpers/CapturingLoggerProvider.cs` (public), and update that
   file to use the extracted version - needed in two files now, so no longer a one-off.
3. New `Api.IntegrationTests/DynamoDbLoggingTests.cs`, using the shared capturing provider against
   real endpoints that exercise each repository operation (e.g. `GET /settings` for a read,
   `PUT /settings` for a write, `DELETE /settings/account` for a delete) over real DynamoDB Local -
   asserts the captured response log line contains a numeric `elapsedMs=` value.
4. `dotnet build`/`dotnet test` (unit + integration).

**Verification**

5. Real local run (`scripts/run_local.sh`) + a manual request, confirming console output shows a
   real elapsed-time value on the DynamoDB response log lines.

## Checklist

- [x] `DynamoDbRepository.cs` - `Stopwatch` around each DynamoDB call, elapsed time on response logs
      (`elapsedMs={ElapsedMs}`) - `GetAsync` (both found/not-found branches), `DeleteAsync`, and the
      shared `PutAsync` (covers `AddAsync`/`UpdateAsync`). `dotnet build` clean, 0 warnings.
- [x] Extract `CapturingLoggerProvider` into a shared `Api.IntegrationTests/Helpers/` file
      - New `Helpers/CapturingLoggerProvider.cs` (public); `RequestResponseLoggingTests.cs` updated
        to use it, private nested copy removed. `dotnet build` clean; existing 3 tests still passing.
- [x] `DynamoDbLoggingTests.cs` - new, asserts `elapsedMs=` on real DynamoDB Local calls
      - GetAsync/UpdateAsync tested via real `GET`/`PUT /settings` requests. DeleteAsync has no
        HTTP-triggered path at all (confirmed via grep - account/category "deletion" mutates the
        `User` record's lists rather than deleting a DynamoDB item; only test cleanup code ever
        calls `IRepository<T>.DeleteAsync`), so that case resolves the repository directly via DI
        instead, same pattern other integration tests' own `DisposeAsync` already uses.
- [x] `dotnet build`/`dotnet test` clean - 85 unit + 58 integration (55 previous + 3 new)
- [x] ~~Manual local verification via `scripts/run_local.sh`~~ - skipped at user's request; covered
      by `DynamoDbLoggingTests.cs` running against real DynamoDB Local instead

## Prompt log

- "start a worktree for UBE-89" → created a git worktree (`.claude/worktrees/UBE-89+add-execution-time-to-dynamodb-logging`) via `EnterWorktree`
- "start a worklog for UBE-89" → this worklog (no separate branch created - the worktree's own branch already covers that; corrected earlier for over-stepping by renaming it unprompted)
- "go" → step 1: added `Stopwatch` timing + `elapsedMs=` on `DynamoDbRepository.cs`'s response log lines - `dotnet build` clean
- "go" → step 2: extracted `CapturingLoggerProvider` into a shared `Api.IntegrationTests/Helpers/` file - `dotnet build` clean, existing 3 `RequestResponseLoggingTests` still passing
- "go" → step 3: new `DynamoDbLoggingTests.cs` (Get/Put via real requests, Delete via direct DI since no endpoint triggers it) - 85 unit + 58 integration all passing
- "skip manual verification, commit and raise the PR" → skipped step 4, committing and opening the PR
