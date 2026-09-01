# UBE-104: Add OTel into the API Lambda

## Linear issue

https://linear.app/uberconcept/issue/UBE-104/add-otel-into-the-api-lambda

> Wire this in to collect metrics. Avoid Xray if it costs money.

## Decision

After reviewing options (see Prompt log), the outcome is **Lambda X-Ray active
tracing only** - a pure Terraform change, no code, no packages, no Lambda layer,
$0.

Path to that decision:

1. The issue **title** says "OTel" but the **body** ("collect metrics, avoid
   X-Ray if it costs money") is what to optimise for. X-Ray is **free** at this
   app's volume (free tier: 100k traces/month; this is a single-user app), so
   "avoid X-Ray if it costs money" doesn't bite - David chose native X-Ray over
   an OTel pipeline for the simplicity.
2. The planned in-process step (`AWSSDKHandler.RegisterXRayForAllServices()` for
   DynamoDB subsegments) turned out to be **impossible**: the AWS X-Ray SDK for
   .NET doesn't support AWS SDK for .NET **v4**, which this project uses
   (`AWSSDK.DynamoDBv2` 4.0.102). The X-Ray SDK is also entering maintenance
   mode; AWS's guidance is "use ADOT/OpenTelemetry".
3. Given the DynamoDB-subsegment option required the ADOT layer (cost/cold-start
   David wanted to avoid), David chose **Lambda active tracing only**: one
   `tracing_config { mode = "Active" }` block + the `AWSXRayDaemonWriteAccess`
   managed policy.

So despite the branch/issue name, this ships **X-Ray active tracing**, not
OpenTelemetry, and with no application-code changes.

## Description

### Current state

- `Pim.Api` runs as one Lambda (`dotnet10`, **128 MB**, 30 s timeout, not
  VPC-attached) behind API Gateway **HTTP API v2**, via
  `Amazon.Lambda.AspNetCoreServer.Hosting`.
- Logging: NLog -> stdout -> CloudWatch Logs
  (`/aws/lambda/pim-production-api`, 180-day retention).
- `DynamoDbRepository` already `Stopwatch`-times every op and logs `elapsedMs`
  (UBE-89) - but as log lines, not a trace/metric.
- **No** OpenTelemetry, X-Ray, or ADOT today.
- IAM role: `AWSLambdaBasicExecutionRole` + a DynamoDB policy.
- Deploy: `dotnet publish -r linux-x64 --self-contained false` +
  `aws lambda update-function-code` (`deploy.yml`); infra via `terraform.yml`
  apply. The Lambda's `filename`/`source_code_hash` are `ignore_changes`, but
  `tracing_config` / IAM are not, so a Terraform apply picks them up.

### What we get

- A **trace per Lambda invocation** (Lambda creates the segment when active
  tracing is on) - request duration over time, cold starts, error / fault /
  throttle status, and a trace-map node for the function. Visible in the X-Ray
  console / CloudWatch -> Application Signals -> Traces.

### What we don't get, and why

- **No DynamoDB (or other downstream) subsegments** - that needs an in-process
  tracer, and the AWS X-Ray SDK for .NET doesn't support AWS SDK for .NET v4
  (this project's `AWSSDK.DynamoDBv2` 4.0.102). Downstream spans would require
  the ADOT/OpenTelemetry Lambda layer, ruled out on cost/cold-start grounds.
  Per-op DynamoDB latency stays in `DynamoDbRepository`'s `elapsedMs` log lines
  (Logs Insights).
- **No API Gateway segment** - HTTP APIs (`apigatewayv2`) don't support X-Ray,
  so the trace starts at the Lambda. The gateway hop is covered by API Gateway's
  free CloudWatch metrics.
- No OpenTelemetry, no ADOT layer, no custom CloudWatch metrics, no custom
  sampling rule (Lambda's default applies).

## Plan (final - Terraform only, no code)

1. **`Terraform/modules/api/main.tf`**:
   - `aws_lambda_function.api` -> add `tracing_config { mode = "Active" }`
     (with a comment explaining the no-SDK / no-subsegments situation).
   - New `aws_iam_role_policy_attachment "lambda_xray"` ->
     `arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess`
     (`xray:PutTraceSegments` / `PutTelemetryRecords` / `GetSampling*`).
   - `terraform fmt -recursive` + `terraform validate`.
2. **Docs** - an "Observability (UBE-104)" section in `Terraform/README.md`:
   what's traced, where to look, the two "not shown" caveats, $0 cost.
3. **Worklog** tidy-up.

No `Pim.Api` changes, no new packages, no tests (there is no code to test; the
existing `dotnet build` / `dotnet test` are untouched). Verification is a
Terraform apply + a request + the X-Ray console.

## Checklist

- [x] 0. Confirm approach with David - X-Ray **active tracing only** (no SDK:
  incompatible with AWS SDK v4)
- [x] 1. Terraform: `tracing_config { mode = "Active" }` + `lambda_xray` policy
  attachment; `terraform fmt` clean, `terraform validate` passes
- [x] 2. `Terraform/README.md` "Observability" section
- [x] 3. Worklog tidy-up
- [ ] 4. Hand off - Terraform apply (no code deploy needed); verify in the
  X-Ray console

## Prompt log

### Prompt 1

> start a worklog for UBE-104

Reviewed the API Lambda setup (`Program.cs`, `ServiceMapping`, `nlog.config`,
`RequestResponseLoggingMiddleware`, `DynamoDbRepository` timing),
`Terraform/modules/api`, and both deploy workflows. No OTel / X-Ray / ADOT
present. Wrote up a cost analysis and three OTel exporter options (ADOT layer /
EMF-to-stdout / CloudWatch OTLP endpoint), recommending the EMF-to-stdout one.
Created branch `UBE-104/otel-api-lambda` off `main` and this worklog.

### Prompt 2

> [AskUserQuestion] would xRay be free and a simpler option?

Confirmed: yes to both. X-Ray free tier is 100k traces/month recorded - this
app would need ~3,300 requests **every day** to reach it; realistic usage is a
few thousand/month, sampled further by the SDK. And native X-Ray on .NET Lambda
is ~1 Terraform line + ~3 SDK lines + one managed IAM policy, vs. an OTel SDK +
exporter + (maybe) a Lambda layer. Laid out four options (X-Ray only / OTel
Option B only / both / OTel-via-ADOT-to-X-Ray).

### Prompt 3

> [AskUserQuestion] X-Ray native only

Reworked the plan around native X-Ray: `AWSXRayRecorder.Handlers.AwsSdk` +
`RegisterXRayForAllServices()` gated on running-in-Lambda,
`tracing_config { mode = "Active" }`, `AWS_XRAY_CONTEXT_MISSING=LOG_ERROR`, and
the `AWSXRayDaemonWriteAccess` managed policy. ASP.NET Core X-Ray middleware and
`HttpClient` tracing left as follow-ups.

### Prompt 4

> implement the plan

**Blocker found while implementing:** the **AWS X-Ray SDK for .NET does not
support AWS SDK for .NET v4**, and this project is on v4 (`AWSSDK.DynamoDBv2`
4.0.102). Specifics:

- `AWSXRayRecorder.Handlers.AwsSdk` is stuck at **2.14.0** (a "no changes"
  re-tag; last real handler work was 2.12.0 in 2023) and its `AWSXRayRecorder.Core`
  dependency pins `AWSSDK.Core` to the **3.x** line.
- The X-Ray SDKs enter **maintenance mode (Feb 2026)**; AWS's own guidance is
  now "migrate to ADOT / OpenTelemetry for tracing".
- `AWSSDKHandler.RegisterXRayForAllServices()` hooks the AWS SDK v3 runtime
  pipeline; wiring it against v4 assemblies is unsupported and likely breaks at
  runtime.

So **the `RegisterXRayForAllServices()` step of the plan is off the table.**
What's still viable:

| Option | DynamoDB subsegments? | Code / packages | Layer / cold start / mem | Cost |
|---|---|---|---|---|
| **1a. Lambda active tracing only** - `tracing_config { mode = "Active" }` + the X-Ray IAM policy, nothing else | No (invocation segment only) | none | none | $0 |
| **2. ADOT auto-instrumentation layer** -> X-Ray (`AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-instrument`) | Yes (ASP.NET Core + AWS SDK spans) | none (layer does it) | layer + ~128->512 MB + ~1 s cold start | $0 to X-Ray |
| **3. OTel SDK manual instrumentation** -> OTLP -> ADOT *collector* layer -> X-Ray | Yes, hand-picked | OTel packages + code | collector layer | $0 to X-Ray |

**Recommendation: Option 1a.** It keeps the "simple + free" intent that drove
the X-Ray choice - one Terraform block, no packages, no layer - and still gives
per-invocation latency / error-rate / cold-start visibility in the X-Ray
console over time. The DynamoDB-level breakdown it lacks is *partly* already
covered by `DynamoDbRepository`'s `elapsedMs` log lines (queryable in Logs
Insights). If the per-dependency trace detail turns out to matter, Option 2
(ADOT layer) is the add-on later.

**Awaiting David's pick: 1a (ship now) or 2 (ADOT layer).**

### Prompt 5

> [AskUserQuestion] Lambda active tracing only

Implemented (Terraform only):

- `Terraform/modules/api/main.tf` - `tracing_config { mode = "Active" }` on
  `aws_lambda_function.api` (with a comment on the no-SDK / no-subsegments
  situation) + `aws_iam_role_policy_attachment.lambda_xray` ->
  `AWSXRayDaemonWriteAccess`.
- `terraform fmt -recursive` clean; `terraform init -backend=false` +
  `terraform validate` -> **"Success! The configuration is valid."**
- `Terraform/README.md` - new "Observability (UBE-104)" section.

No `Pim.Api` code, no packages, no test changes. Ready for a Terraform apply.

## Handoff

1. Merge the PR, then run **`terraform.yml` with `action: apply`** (production).
   The diff is: `aws_lambda_function.api` gains `tracing_config`, and one new
   `aws_iam_role_policy_attachment`. `filename`/`source_code_hash` are
   `ignore_changes`, so the plan won't try to redeploy the function code - it
   just updates the tracing config + attaches the policy in place.
2. **No `deploy.yml` run needed** - there's no application-code change.
3. Verify: hit any authenticated endpoint (e.g. load the web app), then open
   **CloudWatch -> Application Signals -> Traces** (or the X-Ray console) in
   `ap-southeast-2` and confirm a segment for `pim-production-api` appears with
   the request duration. Cold-start invocations show an `Initialization`
   subsegment.
4. Nothing to watch on cost - single-user volume is orders of magnitude below
   the 100k-traces/month free tier. A billing alarm is the safety net if usage
   ever grows.

### If the DynamoDB-level breakdown is wanted later

That needs an in-process tracer. Options, in rough order of preference:
- **ADOT .NET auto-instrumentation Lambda layer** + `AWS_LAMBDA_EXEC_WRAPPER=/opt/otel-instrument`
  - captures ASP.NET Core + AWS SDK spans, exports to X-Ray ($0). Cost is the
  layer + a memory bump (128 -> ~512 MB) + ~1 s cold start.
- OpenTelemetry .NET SDK with manual spans -> OTLP -> ADOT collector layer.
