# UBE-33: Add logging of HTTP requests and responses

Linear: https://linear.app/uberconcept/issue/UBE-33/add-logging-of-http-requests-and-responses
Status: In Progress · Priority: No priority

## Description (from Linear)

Log

* HTTP verb, URL including querystring, body on request
* HTTP response code, body on response

Hide the following parameters in the log requests:

* Password from /login
* File from /transactions/file

## Current state

No HTTP-level request/response logging exists today. What's there (from UBE-32/UBE-43):

- NLog to console only, layout prefixed with `${aspnet-TraceIdentifier}` (`Api/nlog.config`), so every
  log line within a request already shares one correlation id for free - a new logging step doesn't
  need to invent its own.
- `Program.cs` has one existing raw `app.Use(...)` middleware (before `UseCors`/auth) that overwrites
  `context.TraceIdentifier` with the real Lambda request id when running in Lambda - a new
  request/response logging middleware needs to run *after* this one, so its log lines carry the same
  id CloudWatch/API Gateway/X-Ray would show.
- UBE-32 deliberately logged DB request/response *metadata only* (operation/table/id), explicitly
  avoiding entity content, to keep `User.PasswordHash` etc. out of plaintext logs. This ticket is a
  deliberate departure from that conservative default - it explicitly asks for full body content on
  both request and response, with only two named exceptions redacted. I'm following that instruction
  literally rather than re-applying UBE-32's more cautious philosophy everywhere.
- `Api.csproj` already has `<NoWarn>...CA1848;CA1873</NoWarn>` (added sometime after UBE-32), so plain
  `_logger.LogInformation(...)` calls are fine now - no `[LoggerMessage]` source-generator boilerplate
  needed (UBE-32 had to work around not having this yet).

The two routes named in the ticket:

- `POST /login` (`LoginController.Post`) - `LoginRequest(string Email, string Password)`, plain JSON
  body.
- `POST /transactions/file` (`TransactionsController.UploadFile`) - `[FromForm]
  UploadTransactionsRequest { Account, File }`, `multipart/form-data` - the "body" here isn't
  meaningful JSON/text; it's the QIF file's raw bytes plus the `Account` field. "Hide File" reads as
  "keep logging the rest of the form (`Account`), just not the file content."

## My calls (low-stakes, flagging rather than asking - matching UBE-32's worklog style)

- **Middleware, not an MVC filter.** A filter only wraps controller actions; middleware placed early
  in the pipeline also covers 401s/404s/CORS rejections, which "log every request" should include.
- **Redaction is request-only, matching the ticket's literal wording** ("Hide the following parameters
  in the log **requests**") - `LoginResponse.Token` (a JWT) is logged as-is on the response side, not
  redacted. Flagging this: a bearer token in CloudWatch is lower-sensitivity than a password (the
  client needs to use it anyway, and it already expires), but it's still worth knowing this wasn't
  hidden by default.
- **No size cap/truncation** on logged bodies - matches the ticket literally, and this is a low-volume
  single-user app. `GET /transactions` responses could get large over time; not solving that unless it
  becomes a real problem.
- **JSON body redaction is done generically** (any `"password"` key, case-insensitive, across any
  JSON request body) rather than hardcoded to `/login` specifically - simpler and safer if a password
  field ever shows up elsewhere, without changing behavior for the one route that has it today.
- **Multipart body redaction uses `Request.ReadFormAsync()` field-by-field**, not raw-body text
  manipulation - a multipart body is binary-boundary-delimited, not text a regex could safely target.
  `ReadFormAsync()` caches the parsed form on `HttpContext.Request.Form`, so the controller's own
  `[FromForm]` binding afterward reads the same cached parse rather than re-reading the stream - no
  double-read problem, and no manual `Request.EnableBuffering()` needed for this path specifically
  (that's only needed for the plain-JSON-body routes, so the controller can still read the body after
  the logging middleware already consumed it once).

## Plan

**Api**

1. New `Api/Middleware/RequestResponseLoggingMiddleware.cs` - standard `RequestDelegate`-based
   middleware (constructor `RequestDelegate next`; `InvokeAsync(HttpContext, ILogger<...>)`):
   - Request side: log `{Method} {Path}{QueryString}` plus a body string -
     `Request.ReadFormAsync()`-derived (file field redacted, replaced with something like
     `[file: <filename>, <n> bytes]`) when `Request.HasFormContentType`, otherwise
     `Request.EnableBuffering()` + read-and-reset the raw body text, with any `"password"` JSON key's
     value regex-redacted.
   - Call `await next(...)`, with `context.Response.Body` swapped for a `MemoryStream` first so the
     real response body can still be read back afterward for logging, then copied to the original
     stream so the client still receives it unchanged.
   - Response side: log status code + the captured body text.
2. `Program.cs` - `app.UseMiddleware<RequestResponseLoggingMiddleware>()`, placed after the existing
   Lambda-request-id `app.Use(...)` block, before `UseCors`.

**Tests**

3. New `Api.IntegrationTests/RequestResponseLoggingTests.cs` - a dedicated `WebApplicationFactory`
   subclass (or `ConfigureWebHost` override) registering a simple in-memory `ILoggerProvider` that
   captures formatted log lines, so tests can assert on real logging middleware output against the
   real pipeline:
   - `POST /login` with a real password logs a line containing the email but *not* the literal
     password string.
   - `POST /transactions/file` with a real QIF file logs a line containing the account name but *not*
     the file's raw content.
   - A plain JSON endpoint (e.g. `PUT /transactions`) logs verb, path, and the response status code.
4. `dotnet test` (unit + integration).

**Verification**

5. `scripts/run_local.sh` - a real login + a real file upload, confirming console output shows the
   request/response lines with the password/file redacted and everything else present.

## Checklist

- [ ] `RequestResponseLoggingMiddleware.cs` - request+response logging, redaction for
      password/multipart-file
- [ ] `Program.cs` - wire up the middleware
- [ ] `RequestResponseLoggingTests.cs` - log-capture integration tests
- [ ] `dotnet test` passing
- [ ] Manual local verification via `run_local.sh`

## Prompt log

- "start a worklog for UBE-33"
