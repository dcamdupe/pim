# UBE-74 — Change dashboard initial load to load by component

Linear issue: https://linear.app/uberconcept/issue/UBE-74/change-dashboard-initial-load-to-load-by-component

## Description

"The dashboard structure should show immediately, with the charts and components appearing when
they become available." Today `DashboardView.vue` gates its *entire* content (page-head's month
selector aside) behind a single `initialLoading` flag: while `transactionsStore.load()` is in
flight, the whole page is replaced by a plain "Loading dashboard…" line - no title structure, no
card shells, nothing - then everything appears at once.

## Investigation

- `DashboardView.vue:86-138` — the whole KPI row / charts row / recent-transactions card is inside
  one `<template v-else>` gated by `initialLoading` (set in `onMounted`, cleared only after
  `transactionsStore.load()` resolves or fails).
- All four sections (tiles, spending-by-category chart, income-vs-expenses chart, recent
  transactions) derive from the *same* `transactions` ref from the shared store
  ([[UBE-82]] "Load transactions once into a shared store") - there's no independent per-section
  fetch to genuinely stagger. So "load by component" here means: stop blocking the whole page shell
  on that one fetch, and let each section render its own loading state and only its own data-bearing
  content swap in once the shared fetch resolves - not literally independent network calls per tile.
  `transactionsStore.load()` is already a no-op when the 10-minute cache is still fresh (most
  navigations), so the visible gap is mainly first-login / cold-cache / >10-min-stale visits.
- No skeleton/placeholder pattern exists anywhere in this codebase today - `SettingsView.vue` and
  `TransactionsView.vue` both use the same "replace the whole content area with a `<p class='status'>
  Loading X…</p>` line" pattern Dashboard uses now. So the fix here is introducing a new,
  Dashboard-specific pattern (per-section inline loading text), not reusing an existing one.
- `DashboardTile.vue` has no loading state today - it just renders whatever `value`/`deltaPct` it's
  given. Before the shared fetch resolves, `tiles` (a computed over `transactions.value`, which
  defaults to `[]`) would show real-looking-but-wrong `$0` tiles if rendered unconditionally, so
  `DashboardTile` needs a `loading` prop to show a placeholder instead of a misleading `$0`.
- `settingsStore.load()` (for `minTransactionDate`, used only by the month-select's `availableMonths`
  option list) is already effectively "component-level, appears when available": it's a separate,
  non-fatal `onMounted` call, and `availableMonths` already just falls back to "current month only"
  reactively until it resolves - no change needed there, it already matches the pattern being asked
  for elsewhere.

## Plan

1. `DashboardView.vue`: drop the top-level `v-if="initialLoading"` gate. Always render `page-head`,
   `kpi-row`, `charts-row`, and the recent-transactions card. Keep `loadError` as a banner (still
   under `page-head`) rather than replacing the whole page.
2. `DashboardTile.vue`: add a `loading?: boolean` prop; when true, render a muted placeholder (e.g.
   `···`) instead of `value` and suppress the delta pill, keeping `kicker`/`label` visible.
3. In `charts-row`'s two cards and the recent-transactions card: while loading, show a small
   `<p class="status">Loading…</p>` in place of the chart/list (same `.status` class the rest of the
   app already uses), swapping to the real component once data is ready.
4. No new unit tests - views/components aren't unit-tested in this repo (confirmed no existing
   `DashboardTile`/`DashboardView` test files); verify via the browser and the existing
   `FunctionalTests/tests/dashboard.spec.ts` (structural DOM changes here are exactly what that spec
   exercises).
5. `npm run build` / `npm run lint`, then visually verify (throttled/cold-cache load) in a browser.

## Checklist

- [x] `DashboardView.vue` — drop the full-page loading gate, keep structure always rendered
- [x] `DashboardTile.vue` — `loading` prop with placeholder rendering
- [x] Per-section loading text in the two chart cards + recent-transactions card
- [x] `npm run build` / `npm run lint` pass
- [x] `FunctionalTests/tests/dashboard.spec.ts` still passes (3 passed, unchanged)
- [x] Visually verify in a browser — verified manually by David
- [x] Update this worklog with results

## Session log

### Prompt: "start a worklog for UBE-74"

Retrieved issue UBE-74 from Linear. Read `DashboardView.vue`'s current loading gate, its four child
components (`DashboardTile`, `SpendingByCategoryChart`, `IncomeVsExpensesChart`,
`RecentTransactionsList`), the shared `transactionsStore`'s caching behaviour, and confirmed no
skeleton/loading pattern exists elsewhere in the app to reuse. Drafted the plan and checklist above
(interpreting "load by component" as per-section loading UI over the one shared data fetch, not
literally independent network calls, since UBE-82 deliberately consolidated transaction loading into
one shared store) and created this worklog file.

### Prompt: "yes"

Implemented the plan:

- `DashboardTile.vue`: added a `loading?: boolean` prop (default `false`). When true, the value
  shows `···` instead of the real (potentially misleading `$0`) figure, and the delta pill falls
  back to its existing hidden `placeholder` state.
- `DashboardView.vue`: removed the top-level `v-if="initialLoading"`/`v-else` gate. `page-head`,
  `kpi-row`, `charts-row`, and the recent-transactions card now always render. Each `DashboardTile`
  gets `:loading="initialLoading"`. The two chart cards and the recent-transactions card each show
  `<p class="status">Loading…</p>` in place of their chart/list (and, for the two chart cards, in
  place of the `card-sub` line too - that line embeds real numbers like "total spend", which would
  otherwise show a misleading `$0` while loading, same reasoning as the tiles).
- `npm run build` / `npm run lint`: clean.
- Ran only `FunctionalTests/tests/dashboard.spec.ts` (not the full suite) - 3 passed, unchanged from
  before this change, confirming the structural DOM changes didn't break existing assertions.
- Left the actual visual check (seeing the per-section loading states, which resolve near-instantly
  on a fast local network/warm cache) to David rather than trying to force it via an automated
  screenshot, per his preference on UBE-85.
