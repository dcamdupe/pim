# UBE-32 — Add Logging

Linear: https://linear.app/uberconcept/issue/UBE-32/add-logging

## Description

- implement NLog, logging to the console
- Prefix all logs with the request id
- include logging for all db requests and responses

## My calls (low-stakes, flagging rather than asking)

- **Console-only, no file target:** matches "logging to the console" literally, and fits how this
  app actually runs - locally via Kestrel (console visible in the terminal) and in Lambda (stdout
  is what CloudWatch Logs captures; there's no persistent filesystem to write a log file to anyway).
- **Request ID via NLog's built-in renderer:** `NLog.Web.AspNetCore` ships an
  `${aspnet-TraceIdentifier}` layout renderer that reads `HttpContext.TraceIdentifier` automatically
  - no custom middleware needed to prefix every line with it.
- **DB logs won't include the full entity/document payload** - just the operation, collection/table
  name, and id/key. `User.PasswordHash` (and any future sensitive fields) would otherwise end up in
  plaintext console/CloudWatch logs, which is a real security anti-pattern regardless of how
  literally "responses" is read.
- **Log level:** `Information` for the db request/response logs, so they're visible without
  lowering the minimum log level - this was explicitly asked for as a standing requirement, not a
  debug-only aid.
- **Discovered during implementation:** `TreatWarningsAsErrors` + analyzer rule `CA1848` rejects
  direct `ILogger.LogInformation(...)` calls, requiring source-generated `[LoggerMessage]` delegates
  instead. Added a shared `Api/Data/RepositoryLog.cs` with two generic `DbRequest`/`DbResponse`
  extension methods (parameterized by store/operation/table/id/detail) reused by both repositories,
  rather than defining 16 near-identical one-off message templates.

## Plan

1. **`Api.csproj`** — add `NLog.Web.AspNetCore`.
2. **`Api/nlog.config`** (new) — Console target only; layout prefixed with
   `${aspnet-TraceIdentifier}`. Set to copy to the output directory (needed for both local runs and
   the Lambda deployment package).
3. **`Program.cs`** — `builder.Logging.ClearProviders()` + wire up NLog via
   `NLog.Web.AspNetCore` (`UseNLog()`/`AddNLogWeb()`), replacing the default console provider
   rather than running both side by side.
4. **`Api/Data/MongoRepository.cs`** — inject `ILogger<MongoRepository<T>>`; log
   request+response (operation, collection name, id - not the entity content) around
   `GetAsync`/`AddAsync`/`UpdateAsync`/`DeleteAsync`.
5. **`Api/Data/DynamoDbRepository.cs`** — same, injecting `ILogger<DynamoDbRepository<T>>`.
6. Verify: `dotnet build`/`test` (unit + integration), then a real local run (via
   `scripts/run_local.sh`) confirming console output shows request-id-prefixed lines and db
   operation logs for a login attempt.

## Checklist

- [x] `Api.csproj` — add `NLog.Web.AspNetCore`
- [x] `Api/nlog.config` — console target, request-id-prefixed layout
- [x] `Program.cs` — wire up NLog, clear default providers (implemented in `ServiceMapping.ConfigureLogging`, called from `MapServices`, matching the established pattern of keeping `Program.cs` minimal)
- [x] `MongoRepository<T>` — request/response logging
- [x] `DynamoDbRepository<T>` — request/response logging (both via a shared `RepositoryLog` `[LoggerMessage]` source-generated helper, required by `CA1848` under `TreatWarningsAsErrors`)
- [x] Verify: `dotnet build`/`test`, real local run showing prefixed + db logs — all pass; confirmed via `scripts/run_local.sh` + a real login request that request-scoped logs share one trace-id prefix and DB request/response lines log metadata only (no `PasswordHash`/entity content)

## Prompt Log

1. "start worklog for UBE-32"
2. "start"
3. "use run_local.sh" (during verification, after discovering it wasn't on this branch yet - merged/rebased from `main` to bring it in)
