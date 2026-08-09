# UBE-86 — Remember the dashboard month filter

Linear issue: https://linear.app/uberconcept/issue/UBE-86/remember-the-dashboard-month-filter
PR: https://github.com/dcamdupe/pim/pull/66

## Description

The dashboard's month filter (`selectedMonthKey` in `DashboardView.vue`) always resets to the
current month on load. Per the ticket, it should be remembered across visits/reloads, the same way
the Transactions page's filters already are ([[UBE-70]] added the month filter itself;
`TransactionsView.vue`'s filters are persisted via `FrontEnd/src/utils/transactionFilterStorage.ts`).

## Investigation

- `FrontEnd/src/utils/transactionFilterStorage.ts` is the existing "remember filters" pattern:
  a small module with `loadStoredTransactionFilters()` / `saveTransactionFilters()` around a
  validated, typed shape in `localStorage` (key `pim.transactionFilters`), with a runtime type
  guard so a malformed/stale stored value is treated as absent rather than thrown.
- `TransactionsView.vue` wires this in by: reading `loadStoredTransactionFilters()` once at setup
  time, using it to seed each filter `ref`'s initial value (falling back to a default when absent),
  and a single `watch([...refs], () => saveTransactionFilters({...}))` that persists on every
  change.
- `DashboardView.vue`'s equivalent state is just `selectedMonthKey` (a `"YYYY-MM"` string, see
  `monthKey()`/`parseMonthKey()` in `FrontEnd/src/utils/dashboardMetrics.ts`), currently hardcoded
  to `computeAvailableMonths(null, realToday)[0].value` (the current month).
- No existing `FrontEnd.UnitTests/views/` directory — views aren't unit-tested directly in this
  repo, only the `utils`/`services`/`stores`/`composables`/`router` layers underneath them
  (`transactionFilterStorage.test.ts` is a `utils` test, not a `TransactionsView` test). The
  dashboard equivalent should follow the same shape.

## Plan

1. Add `FrontEnd/src/utils/dashboardFilterStorage.ts`, mirroring `transactionFilterStorage.ts`:
   `loadStoredDashboardFilters()` / `saveDashboardFilters()` around `{ month: string }`, stored
   under a new `pim.dashboardFilters` localStorage key, validating `month` against `/^\d{4}-\d{2}$/`.
2. Wire it into `DashboardView.vue`: seed `selectedMonthKey` from the stored value when present
   (falling back to today's month otherwise), and add a `watch(selectedMonthKey, ...)` that calls
   `saveDashboardFilters(...)` on change.
3. Add `FrontEnd.UnitTests/utils/dashboardFilterStorage.test.ts`, mirroring
   `transactionFilterStorage.test.ts`'s coverage (round-trip, missing key, malformed JSON, invalid
   shape/month format all falling back to `null`).
4. Run `FrontEnd.UnitTests` (`npm run test`) and `FrontEnd` (`npm run build`, `npm run lint`).
5. Check `FunctionalTests/tests/dashboard.spec.ts` and add a scenario for the remembered-month
   behaviour if it fits cleanly within existing setup.

## Checklist

- [x] `FrontEnd/src/utils/dashboardFilterStorage.ts` — load/save helpers
- [x] Wire persistence into `DashboardView.vue`
- [x] `FrontEnd.UnitTests/utils/dashboardFilterStorage.test.ts`
- [x] `FrontEnd.UnitTests` pass (`npm run test`) — 175 passed
- [x] `FrontEnd` build + lint pass
- [x] FunctionalTests scenario added/updated if it fits in scope — updated the existing "Month
      filter" test in `dashboard.spec.ts` (see below); no new spec file needed
- [x] Update this worklog with results

## Session log

### Prompt: "start a worklog for UBE-86"

Retrieved issue UBE-86 from Linear. Read `FrontEnd/src/utils/transactionFilterStorage.ts` and its
usage in `TransactionsView.vue` as the existing "remember filters" pattern, `DashboardView.vue`'s
current month-filter state, and `FrontEnd/src/utils/dashboardMetrics.ts`'s month-key helpers.
Confirmed views aren't unit-tested directly in this repo (checked `FrontEnd.UnitTests`'s directory
layout). Drafted the plan and checklist above and created this worklog file.

### Prompt: "yes, go ahead"

Implemented the plan:

- Added `FrontEnd/src/utils/dashboardFilterStorage.ts` (load/save around `{ month: string }`,
  `pim.dashboardFilters` key) and `FrontEnd.UnitTests/utils/dashboardFilterStorage.test.ts`.
- Wired it into `DashboardView.vue`: `selectedMonthKey` now seeds from the stored value, and a
  `watch(selectedMonthKey, ...)` persists on change.
- Noticed `FunctionalTests/tests/dashboard.spec.ts`'s existing "Month filter" test had a comment
  "The filter resets to the current month on navigation - re-select the target month" - exactly the
  behaviour this ticket fixes. Updated it to assert the `<select>` still shows the previously-chosen
  month after navigating away and back (via `toHaveValue`), instead of re-selecting it, so the test
  now actually exercises the persistence.
- `FrontEnd.UnitTests`: 175 passed. `FrontEnd`: `npm run build` and `npm run lint` both clean.
- Ran only the affected functional spec (`npx playwright test tests/dashboard.spec.ts`), not the
  full suite. Hit an unrelated local-environment snag first: started the Api with an explicit
  `--urls http://localhost:5037` (per `FunctionalTests/README.md`'s example), which overrode
  `launchSettings.json`'s `https` profile and only bound port 5037 - but `FrontEnd/.env.local` points
  at `https://localhost:7010`, so every test failed at login. Restarted with
  `dotnet run --project Api --launch-profile https` (binds both 7010 and 5037) and all 3 tests in
  the spec passed, including the updated persistence assertion.
