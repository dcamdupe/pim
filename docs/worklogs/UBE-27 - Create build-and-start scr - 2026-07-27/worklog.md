# UBE-27 — Create script to build and start platform

Linear: https://linear.app/uberconcept/issue/UBE-27/create-script-to-build-and-start-platform

## Description

- update claude.md to reference this to start the app
- script should kill if already running

## My calls (low-stakes, flagging rather than asking)

This ticket is fairly open on specifics, so I'm making these calls rather than blocking on questions:

- **Scope:** `Api` (dotnet) + `FrontEnd` (Vite dev server) only - not MongoDB (already assumed running
  as a system service, matching `scripts/setup_local.sh`'s existing assumption) and not the one-time
  `scripts/setup_local.sh` setup (seeding/`.env` copy) - this script is for repeat "start the app"
  use, not first-time setup.
- **"Build":** `dotnet build Api/Pim.Api.csproj` (matches `.vscode/tasks.json`'s existing build task).
  FrontEnd's dev server (`npm run dev`) compiles on the fly - no separate build step needed there,
  just `npm install` to make sure dependencies are present.
- **"Kill if already running":** kill by **port** (7010 for Api, 5173 for FrontEnd), not by tracking
  this script's own PIDs - catches stale processes regardless of how they were started (this script,
  a previous unclean shutdown, an IDE launch config, etc.).
- **HTTPS-only Api (per feedback):** the Api never binds its HTTP port (5037) at all -
  `dotnet run --project Api --urls https://localhost:7010` explicitly overrides launchSettings.json's
  default profile (which otherwise binds HTTP only) to bind HTTPS only. `FrontEnd/.env.local`
  updated to match (`VITE_API_BASE_URL=https://localhost:7010`), since otherwise the FrontEnd would
  have nothing to talk to locally.
- **Foreground, blocking:** starts both as background processes, then `wait`s with a trap on
  SIGINT/SIGTERM to kill both cleanly on Ctrl+C - single terminal, one script, `Ctrl+C` stops
  everything (matches the existing "Api + FrontEnd" VS Code compound launch UX).

## Plan

1. **`scripts/run_local.sh`** (new):
   - Kill anything already bound to ports 7010, 5173.
   - Switch to Node 22 via `nvm` if available (this machine's default is too old for Vite).
   - `dotnet build Api/Pim.Api.csproj`; `npm install` in `FrontEnd/` (only if `node_modules` is missing, to keep restarts fast).
   - Start `dotnet run --project Api --urls https://localhost:7010` (HTTPS only) and `npm run dev` (from `FrontEnd/`) in the background, print the URLs.
   - Trap `EXIT` to kill both child processes (by port) on Ctrl+C; `wait` in the foreground.
2. **`README.md`** — add this as the recommended one-shot way to start the app locally, alongside (not replacing) the existing per-project instructions.
3. **`CLAUDE.md`** — reference `scripts/run_local.sh` as the way to start the app for local testing/dev.
4. Verify: run the script, confirm both Api and FrontEnd come up, confirm re-running it kills the previous instances and starts cleanly, confirm Ctrl+C stops both.

## Checklist

- [x] `scripts/run_local.sh`
- [x] `README.md` — document the new script
- [x] `CLAUDE.md` — reference the new script
- [x] Verify: run, re-run (kill+restart), Ctrl+C cleanup — all confirmed: fresh start works (Api HTTPS-only on 7010, FrontEnd on 5173, 5037 never bound), re-running kills the prior instance and starts clean, and SIGTERM (Ctrl+C-equivalent) frees both ports

## Prompt Log

1. "start worklog for UBE-27"
2. "go"
3. "remove the API_HTTP_PORT stuff"
4. "why does this reference 5037?"
5. "don't ever start the HTTP version, run the HTTPS only version. This is what I meant by remove the HTTP stuff"
