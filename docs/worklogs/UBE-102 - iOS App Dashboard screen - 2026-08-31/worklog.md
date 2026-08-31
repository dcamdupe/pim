# UBE-102: iOS App Dashboard screen

## Linear issue

https://linear.app/uberconcept/issue/UBE-102/ios-app-dashboard-screen

> Implement the dashboard screen in the IOS App.
>
> * Design: dashboard-mockup-ios.html
> * Use the existing APIs to load the data
> * Implement the iOS app in swift

## Description

Replace the placeholder `DashboardView` (from UBE-97's shell) with the real
dashboard screen, matching `docs/design/dashboard-mockup-ios.html`:

- Nav bar (Pim brand + avatar), large "Dashboard" title with a month picker pill.
- 4 KPI tiles: current-month Profit / Expenses (with delta pill vs. the 6-month
  average) and the previous-6-months Profit / Expenses averages.
- "Spending by category" doughnut + legend for the selected month.
- "Income vs. expenses" grouped bar chart for the last 6 months.
- "Recent transactions" list (most recent, capped).

There is **no dedicated dashboard API** - the web app computes all of this
client-side from `GET /transactions` + `GET /settings`. The iOS app will do the
same: fetch once, compute in Swift ports of `FrontEnd/src/utils/dashboardMetrics.ts`,
recompute locally when the month picker changes (no refetch).

### APIs used (both already exist, both `[Authorize]` - Bearer id token)

- `GET /transactions?endDate=<today>` - all transactions up to today
  (`startDate` omitted, exactly like `stores/transactions.ts`). Response:
  `{ transactions: [{ account, date, description, category, amount, ignore, type }] }`.
- `GET /settings` - for `minTransactionDate` (drives the month picker range) and
  `categories` (`{ name, colour, type }`, drives category colours in the doughnut,
  legend and recent-transactions chips).

The `CognitoSession.idToken` from the existing auth flow is the Bearer token.
Token refresh / expiry handling (web's UBE-80/81) is **out of scope** here - a
failed call just shows an error state.

### Environment constraint (same as UBE-97)

This environment has Xcode Command Line Tools only - no `xcodebuild`, no iOS
SDK, no simulator, no `xcodegen`. Swift source and the `project.pbxproj` edits
are hand-authored and written to be correct by inspection; **David must open the
project in Xcode to verify it builds and run it in the simulator.** Pure-logic
Swift (the metrics ports) can be sanity-checked here with the `swift` CLI where
Foundation-only.

## Plan

1. **Config** - add `apiBaseUrl` to `Config/AuthConfig.swift`
   (`https://pim-api.uberconcept.com`, matching `FrontEnd/.env.production`).
   UBE-97 deliberately left this out; the dashboard needs it.
2. **Models** - `Models/Transaction.swift`, `Models/Settings.swift`
   (`Account`, `CategoryDefinition`) as `Decodable` structs matching the JSON.
3. **API client** - `Services/PimApiClient.swift`: `getTransactions(endDate:)`
   and `getSettings()`, `Authorization: Bearer <idToken>`, throwing a typed
   error on non-2xx.
4. **Metrics port** - `Utils/DashboardMetrics.swift`, a direct port of
   `dashboardMetrics.ts`: `computeDashboardTiles`, `computeExpensesByCategory`,
   `computeMonthlyIncomeExpenses`, `computeRecentTransactions`,
   `computeAvailableMonths`, month-key helpers, `formatMonthYear` /
   `formatSixMonthRangeLabel`, and the counted/range/income/expense predicates.
   Keep the fixed English `MONTH_NAMES` (no locale-dependent formatting), and
   keep the uncategorized-expense handling.
5. **View model** - `Views/Dashboard/DashboardViewModel.swift` (`@MainActor`,
   `ObservableObject`): loads transactions + settings, holds `selectedMonthKey`,
   exposes computed tiles / category expenses / monthly flow / recent list, plus
   `loading` and `error` state.
6. **Dashboard UI** (SwiftUI, in `Views/Dashboard/`):
   - `DashboardView.swift` - `ScrollView` shell: nav bar, large title + month
     `Menu` picker, then the sections. Keeps the `session` init param.
   - `DashboardTile.swift` - kicker, reserved-space delta pill, label, value
     (ported from `DashboardTile.vue`, incl. `▲/▼ x.x%` / `— flat` formatting).
   - `SpendingByCategoryChart.swift` - doughnut via `Path` wedges using the exact
     geometry from the mockup's `wedgePath()` (cx/cy 84, r 64, thickness 24),
     centre value/label, + a two-column legend. Tap a slice/legend row to show
     the `$amount · pct%` tip.
   - `IncomeVsExpensesChart.swift` - grouped bars via `Path`/`GeometryReader`,
     gridlines + `k` axis labels, month labels, tap-a-bar tip (geometry from the
     mockup's `buildBars()`).
   - `RecentTransactionsList.swift` - avatar initial + tinted bg, description,
     `date · account`, category chip (or dashed "Uncategorized"), signed
     monospace amount (green when positive). Ported from `RecentTransactionsList.vue`.
   - Shared palette/measurements in `Views/Dashboard/DashboardTheme.swift`
     (colours from the mockup `:root`).
7. **Category colour fallback** - `categoryColor(name)` -> settings lookup,
   `#9093a3` fallback (matches `RecentTransactionsList.vue`'s `FALLBACK_COLOR`).
8. **Wire-up** - `LoginView`'s `fullScreenCover` already presents
   `DashboardView(session:)`; no change there. Add a sign-out affordance on the
   avatar button (dismiss back to login) - small, keeps the screen usable.
9. **project.pbxproj** - register every new `.swift` file (PBXFileReference,
   group membership, Sources build phase). Validate with `plutil -lint` and
   cross-check object-ID references, as in UBE-97.
10. **Verify** - `swift` CLI check of `DashboardMetrics.swift` against a few
    fixtures mirroring `dashboardMetrics.test.ts` cases; `plutil -lint` the
    pbxproj; then hand off to David for the Xcode build/simulator run.

### Out of scope

- The mockup's bottom **tab bar** and its **Transactions tab** - that's a
  separate screen/ticket. This ticket is the Dashboard screen only. (Open
  question below on whether to include a non-functional tab bar for visual
  fidelity.)
- Doughnut/bar `@select` navigation into a filtered transactions list (no
  transactions screen to navigate to yet).
- Token refresh on expiry.

## Resolved questions

1. **Bottom tab bar**: omit it for now - no tab bar until the Transactions
   screen ticket.
2. **Charts**: full port with the tap-to-inspect tip.

## Checklist

- [x] Add `apiBaseUrl` to `AuthConfig.swift`
- [x] `Models/Transaction.swift`, `Models/Settings.swift`
- [x] `Services/PimApiClient.swift`
- [x] `Utils/DashboardMetrics.swift` (port of `dashboardMetrics.ts`)
- [x] `DashboardViewModel.swift`
- [x] `DashboardTheme.swift`
- [x] `DashboardView.swift` (real screen, replaces placeholder; moved to `Views/Dashboard/`)
- [x] `DashboardTile.swift`
- [x] `SpendingByCategoryChart.swift`
- [x] `IncomeVsExpensesChart.swift`
- [x] `RecentTransactionsList.swift`
- [x] Sign-out affordance on the avatar button (Menu → "Sign out")
- [x] Register all new files in `project.pbxproj` + `plutil -lint`
- [x] `swift` CLI sanity check of `DashboardMetrics.swift` (37 checks, mirrors `dashboardMetrics.test.ts`)
- [x] `swiftc -typecheck` all new sources against the macOS SDK (clean, bar the `#Preview` macro-plugin quirk)
- [x] Hand off to David for Xcode build / simulator run — tested and working

## Session log

### Prompt: "start a worklog for UBE-102"

Fetched the issue from Linear. Reviewed the design mockup
(`docs/design/dashboard-mockup-ios.html`), the web `DashboardView.vue` +
`dashboardMetrics.ts` + the three chart/list components, the `GET /transactions`
and `GET /settings` API endpoints, and the existing UBE-97 iOS shell
(`AuthConfig`, `CognitoAuthService`, `LoginView`, placeholder `DashboardView`).
Confirmed there's no dashboard API - the web app computes everything client-side
from transactions + settings, so the iOS app will port that logic. Confirmed the
same Xcode-tooling constraint as UBE-97 (Command Line Tools only). Drafted the
plan above, created branch `UBE-102/ios-app-dashboard-screen` off `main`, and
wrote this worklog. Awaiting confirmation of the plan (and the two open
questions) before implementing.

### Prompt: (plan confirmation)

David approved the plan. Decisions on the open questions: **omit the bottom tab
bar** for now (separate Transactions screen ticket), and do the **full chart
port with tap-to-inspect**. Starting implementation.

### Implementation

Built the full dashboard screen:

- `AuthConfig.apiBaseUrl` = `https://pim-api.uberconcept.com`.
- `Models/Transaction.swift` + `Models/Settings.swift` - `Decodable` structs
  matching the camelCase / string-enum / `yyyy-MM-dd` JSON.
- `Services/PimApiClient.swift` - `getTransactions(endDate:)` + `getSettings()`,
  Bearer id token, `PimApiError.unauthorized` on 401.
- `Utils/DashboardMetrics.swift` - line-by-line port of `dashboardMetrics.ts`.
  Uses a `CalDate` value type (Gregorian/UTC `Calendar` for month/day roll-over)
  so all bucketing is date-only, no timezone drift. Kept the fixed English
  month names, the uncategorized-expense rule, the refund-netting, and the
  null-delta-on-zero-baseline behaviour.
- `Views/Dashboard/DashboardViewModel.swift` - `@MainActor ObservableObject`,
  parallel `async let` load of transactions + settings, `selectedMonthKey`
  persisted to `UserDefaults`, all metrics as computed properties (month change
  = local recompute, no refetch), `state` enum incl. `.sessionExpired`.
- `Views/Dashboard/DashboardTheme.swift` - palette/measurements from the
  mockup's `:root` + a `Color(hex:)` init.
- `DashboardView.swift` (moved into `Views/Dashboard/`) - nav bar (Pim brand +
  "DC" avatar `Menu` with **Sign out**, which clears the session back in
  `LoginView`), large title + month `Menu` pill, then loading / error /
  session-expired / loaded states.
- `DashboardTile.swift`, `SpendingByCategoryChart.swift` (doughnut built from
  explicit arc points using the mockup's `polar()` math, tap slice/legend to
  inspect), `IncomeVsExpensesChart.swift` (grouped bars, `niceMax` gridlines,
  tap a bar), `RecentTransactionsList.swift` - all ported from the matching
  `.vue` components.
- `project.pbxproj` - added 10 `PBXFileReference` / `PBXBuildFile` / Sources
  entries + `Models`, `Utils`, `Views/Dashboard` groups; moved the
  `DashboardView.swift` ref into the new group. `plutil -lint` OK, object-ID
  reference counts cross-checked.

**Verification (this environment, no Xcode):**

- Concatenated `Transaction.swift` + `DashboardMetrics.swift` with a 37-check
  harness mirroring `dashboardMetrics.test.ts` (ranges, bucketing, deltas,
  refund netting, per-category, monthly flow, labels, available months, recent,
  JSON decode) - all pass under the `swift` CLI.
- `swiftc -typecheck` of every new source (+ `AuthConfig`, a `CognitoSession`
  stub) against the macOS SDK - clean, except the `#Preview` macro plugin isn't
  available to the CLI toolchain (same as the existing `LoginView.swift`; builds
  fine in Xcode).

Still needs David to open `iosApp.xcodeproj` in Xcode for the real iOS build +
simulator run, and to eyeball the charts/layout against the mockup.

### Prompt: "tested and working"

David built and ran it in Xcode - dashboard screen works. All checklist items
complete. Ready to commit + raise the PR.
