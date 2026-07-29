# UBE-43 — Fix log request id prefix

Linear: https://linear.app/uberconcept/issue/UBE-43/fix-logging-to-prefix-all-logs-with-lambda-request-id-not-the-current

## Description

Fix logging to prefix all logs with the Lambda request id, not the current prefix.

Current state (from [[UBE-32]] "Add Logging"): `Api/nlog.config` prefixes every console log
line with `${aspnet-TraceIdentifier}` (NLog.Web's renderer for ASP.NET Core's own
`HttpContext.TraceIdentifier`). This is a value ASP.NET Core generates itself per request - it is
**not** the actual AWS Lambda request id (`ILambdaContext.AwsRequestId`) that CloudWatch uses to
correlate a log line back to a specific Lambda invocation. When running in Lambda, logs should be
prefixed with the real Lambda request id instead, so they can be cross-referenced with
CloudWatch/API Gateway/X-Ray by that id.

## My calls (low-stakes, flagging rather than asking)

- **How the Lambda request id is reached:** the app hosts via
  `Amazon.Lambda.AspNetCoreServer.Hosting`'s minimal API
  (`builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi)` in `Program.cs`), not a
  hand-written `LambdaEntryPoint`. That package stashes the `ILambdaContext` for the current
  invocation in `HttpContext.Items[AbstractAspNetCoreFunction.LAMBDA_CONTEXT]`, so
  `ILambdaContext.AwsRequestId` is reachable from a middleware without adding any new package.
- **Approach: overwrite `HttpContext.TraceIdentifier`, not a new NLog renderer.** Adding an early
  middleware that sets `context.TraceIdentifier = lambdaContext.AwsRequestId` when a Lambda context
  is present means the existing `${aspnet-TraceIdentifier}` layout in `nlog.config` keeps working
  unchanged - no custom NLog layout renderer needed. Locally (no Lambda context in `HttpContext.Items`)
  the middleware is a no-op, so the existing ASP.NET-generated trace id keeps prefixing local logs
  exactly as today.
- **Middleware placement:** first in the pipeline in `Program.cs` (before `UseCors`), so the
  overwrite happens before anything else in the request pipeline can log.

## Plan

1. `Api/Program.cs` — add a small inline middleware (`app.Use(...)`), first in the pipeline, that
   reads `context.Items[AbstractAspNetCoreFunction.LAMBDA_CONTEXT]` and, if present, sets
   `context.TraceIdentifier` to its `AwsRequestId`.
2. Verify `Api.UnitTests`/`Api.IntegrationTests` don't assert on the old trace-id format anywhere.
3. `dotnet build`/`dotnet test` (unit + integration).
4. Real local run via `scripts/run_local.sh` — confirm local logs are unaffected (still prefixed
   with the ASP.NET Core trace id, since there's no Lambda context locally). Lambda's actual
   request-id prefixing can't be verified locally (no Lambda runtime); note that in the worklog as
   a known verification gap, to be confirmed after the next deploy.

## Checklist

- [ ] `Api/Program.cs` — middleware to overwrite `TraceIdentifier` with the Lambda `AwsRequestId`
      when running in Lambda
- [ ] Check existing tests for any dependency on the old trace-id-only behaviour
- [ ] `dotnet build`/`dotnet test` (unit + integration) pass
- [ ] Verify via `scripts/run_local.sh` that local logging is unaffected
- [ ] Note in worklog that Lambda-specific behaviour needs confirming post-deploy (can't be
      verified locally)

## Prompt Log

1. "start worklog on UBE-43"
