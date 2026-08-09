# UBE-88 — Fix the log prefixes - based on logs see in AWS

## Description

Linear issue: https://linear.app/uberconcept/issue/UBE-88/fix-the-log-prefixes-based-on-logs-see-in-aws
PR: https://github.com/dcamdupe/pim/pull/64

Log lines seen in real AWS (CloudWatch) output look like:

```
00-84081c3cd86b533af6544f6e79417298-8b36b642528396d8-00|2026-08-08 20:37:10.2145|INFO|Pim.Api.Middleware.RequestResponseLoggingMiddleware|HTTP request: OPTIONS /login body=
```

They should instead look like:

```
d48da107-fb2c-4ef2-a819-af9a6dd8778b|INFO|Pim.Api.Middleware.RequestResponseLoggingMiddleware|HTTP request: OPTIONS /login body=
```

i.e. the prefix should be the actual Lambda `AwsRequestId` (matching the `START RequestId: ...` line
CloudWatch already prints for the invocation), not a W3C trace-parent-shaped id — and, per the
example, the redundant `${longdate}` timestamp segment is dropped too, since CloudWatch already
timestamps every line on ingest.

## Investigation so far

- `Api/nlog.config` layout was:
  `${aspnet-TraceIdentifier}|${longdate}|${level:uppercase=true}|${logger}|${message}...`
- `Api/Program.cs` already has an `app.Use(...)` middleware (added by [[UBE-43]], ahead of
  `RequestResponseLoggingMiddleware`) that sets `context.TraceIdentifier = lambdaContext.AwsRequestId`
  when running in Lambda — so the intent to use the Lambda request id already existed, but the AWS
  example log shows the W3C trace-parent format instead. UBE-43's own worklog flagged this as an
  unverified gap ("Lambda's actual request-id prefixing can't be verified locally").

**Root cause found (via web search, not local inspection):** since ASP.NET Core 3, NLog.Web's
`${aspnet-TraceIdentifier}` layout renderer defaults to reading `System.Diagnostics.Activity.Current.Id`
(a W3C trace-parent-format id) instead of `HttpContext.TraceIdentifier`, unless the renderer's
`ignoreActivityId` option is explicitly set to `true`. This silently defeated UBE-43's middleware —
`HttpContext.TraceIdentifier` was being set correctly to `AwsRequestId`, but the renderer was never
reading it. Confirmed via NLog's own docs/wiki (see
https://github.com/NLog/NLog/wiki/AspNetTraceIdentifier-Layout-Renderer and
https://github.com/NLog/NLog.Web/pull/524/files).

## Plan

1. ~~Reproduce/confirm the root cause~~ — done, see above.
2. Fix: set `ignoreActivityId=true` on the `${aspnet-TraceIdentifier}` renderer in `Api/nlog.config`
   so it reads `HttpContext.TraceIdentifier` (already correctly set to the Lambda `AwsRequestId` by
   UBE-43's middleware) instead of `Activity.Current.Id`.
3. Drop `${longdate}` from the log layout (CloudWatch timestamps each line already).
4. Add/update a test covering the trace-id behaviour if practically feasible.
5. Verify with `dotnet build` / `dotnet test`.

## Checklist

- [x] Investigate root cause of incorrect prefix in AWS logs
- [x] Fix `TraceIdentifier` propagation so `AwsRequestId` reliably appears in the log prefix —
      `${aspnet-TraceIdentifier:ignoreActivityId=true}` in `Api/nlog.config`
- [x] Update `Api/nlog.config` layout to drop `${longdate}`
- [x] Add/update tests covering the fix (if feasible) — not feasible: this is an NLog
      layout-renderer/config behaviour, not app logic; `Api.IntegrationTests`'s in-process
      `WebApplicationFactory` doesn't capture NLog console output, and there's no Lambda context to
      exercise locally either. Same known gap as [[UBE-43]] — confirm via real CloudWatch logs
      post-deploy.
- [x] `dotnet build` / `dotnet test` pass — 85 unit + 55 integration, 0 failures
- [x] Update this worklog with results

## Session log

### Prompt: "start a worklog for UBE-88"

Retrieved issue UBE-88 from Linear, read `Api/Middleware/RequestResponseLoggingMiddleware.cs`,
`Api/nlog.config`, and `Api/Program.cs` to understand current logging setup, drafted the plan and
checklist above, and created this worklog file.

### Prompt: "yes, go ahead"

Investigated root cause locally first (git history, NLog package DLLs) without success, then
switched to a web search on user prompt and found NLog.Web's `ignoreActivityId` behaviour (see
Investigation section above).

### Prompt: "yes" (apply the fix)

Updated `Api/nlog.config`: added `ignoreActivityId=true` to `${aspnet-TraceIdentifier}` and dropped
`${longdate}`, with a comment explaining why `ignoreActivityId` is needed. Confirmed no existing
tests depend on the old log layout. Ran `dotnet build` (success) and `dotnet test` (85 unit + 55
integration, 0 failures) with the local DynamoDB emulator already running.
