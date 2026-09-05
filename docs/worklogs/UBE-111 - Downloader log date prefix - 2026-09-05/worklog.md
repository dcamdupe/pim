# UBE-111 - Downloader log date prefix - 2026-09-05

Linear: https://linear.app/uberconcept/issue/UBE-111/add-a-date-prefix-for-the-logging-in-the-downloader
Branch: `UBE-111/downloader-log-date-prefix`

## Description

`FileDownloader` logs plain, unprefixed lines (`console.log`/`console.error`), across 11
call sites in `download.ts` and the three `downloaders/*.ts` files. It runs unattended
(`download.sh`), so when something fails it's hard to tell when each line happened. Add a
timestamp prefix to every log line.

## Plan

Rather than editing all 11 call sites individually, wrap `console.log`/`console.error` once
at the process entry point (`download.ts`, before `main()` runs) so every existing and future
call site gets the prefix automatically:

```ts
const originalLog = console.log;
const originalError = console.error;
const prefix = () => `[${new Date().toISOString()}]`;
console.log = (...args) => originalLog(prefix(), ...args);
console.error = (...args) => originalError(prefix(), ...args);
```

ISO 8601 UTC timestamp (`2026-09-05T10:50:35.842Z`) - unambiguous, sorts lexically, matches
what `download.sh`'s output would be piped/redirected into.

## Checklist

- [x] Confirm plan with David
- [x] ~~Wrap `console.log`/`console.error` in `download.ts` with a timestamp prefix~~ -
      David didn't like the monkey-patch: implemented a `logger.ts` module (`log`/`logError`
      wrapping `console.log`/`console.error` with the timestamp) and updated all 11 call
      sites across `download.ts` + the 3 `downloaders/*.ts` files to use it instead
- [x] Sanity-check output format by eye (no test suite for this script)
- [x] PR raised

## Prompt / response log

### 2026-09-05

**Prompt:** start a worklog for UBE-111

**Response:** Fetched UBE-111 from Linear. Found all 11 `console.log`/`console.error` call
sites (`download.ts` + the 3 `downloaders/*.ts` files). Created branch
`UBE-111/downloader-log-date-prefix` and this worklog. Plan: wrap `console.log`/`console.error`
once at the entry point in `download.ts` rather than touching every call site. Awaiting
confirmation before implementing.

**Prompt:** go / I don't like this solution, implement a specific logging method that in
turn calls console.log with a prefix. Then update all the instances to use this

**Response:** Implemented the monkey-patch first; David preferred an explicit logging
function instead. Replaced it with `FileDownloader/logger.ts` exporting `log(...)` /
`logError(...)` (each prefixes an ISO timestamp then calls `console.log`/`console.error`),
and updated all 11 call sites in `download.ts`, `westpac.ts`, `tmbank.ts`, `amex.ts` to use
them. Verified no raw `console.log`/`console.error` calls remain outside `logger.ts`.

**Prompt:** commit and raise PR

**Response:** Committed and opened the PR.
