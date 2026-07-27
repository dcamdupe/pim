# UBE-19 — Adjust the CORS policy when not running on local

Linear: https://linear.app/uberconcept/issue/UBE-19/adjust-the-cors-policy-when-not-running-on-local

## Description

adjust the CORS policy to allow requests from pim.uberconcept.com for Production, http://localhost:5173" for local

## Current state

`Api/IoC/ServiceMapping.cs` registers one CORS policy (`FrontEndDevCorsPolicy`) allowing only
`http://localhost:5173`, and `Program.cs` only calls `app.UseCors(...)` inside the
`IsEnvironment("Local")` branch. In Production, `UseCors` is never called at all - so right now,
cross-origin requests from the FrontEnd's real domain (`pim.uberconcept.com`, since UBE-31) to the
API (`pim-api.uberconcept.com`) would be blocked by the browser entirely.

## Plan

1. **`Api/IoC/ServiceMapping.cs`** — rename `FrontEndDevCorsPolicy` → `FrontEndCorsPolicy` (no longer
   dev-only); pick the allowed origin based on `builder.Environment.IsEnvironment("Local")`:
   `http://localhost:5173` for Local, `https://pim.uberconcept.com` otherwise.
2. **`Program.cs`** — move `app.UseCors(...)` out of the `IsEnvironment("Local")`-only branch so it
   runs unconditionally in both Local and Production; `MapOpenApi()` stays Local-only.
3. Verify: `dotnet build`/`dotnet test` (unit + integration).

## Checklist

- [x] `Api/IoC/ServiceMapping.cs` — environment-based CORS origin, renamed policy constant, extracted into its own `AddCors` function
- [x] `Program.cs` — `UseCors` runs unconditionally
- [ ] Verify: `dotnet build`/`test`

## Prompt Log

1. "start worklog for UBE-19"
