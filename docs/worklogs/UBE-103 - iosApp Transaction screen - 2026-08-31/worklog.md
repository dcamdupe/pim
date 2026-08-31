# UBE-103: iosApp Transaction screen

## Linear issue

https://linear.app/uberconcept/issue/UBE-103/iosapp-transaction-screen

> Implement the transaction screen in the IOS App.
>
> * Design: dashboard-mockup-ios.html
> * Use the existing APIs to load the data
> * Implement the iOS app in swift

## Description

Add the **Transactions** screen to the iOS app, the second tab in
`docs/design/dashboard-mockup-ios.html` (the dashboard tab shipped in UBE-102).

From the mockup, the Transactions tab is:

- Large "Transactions" title with a sub-line ("N entries need a category").
- A search field ("Search description").
- A horizontally-scrolling filter-chip row - in the mockup just the dashed
  warning chip "N need a category".
- A card-styled list of transaction rows: merchant/description, `date · account`
  meta, a category chip (coloured dot + name) or a dashed "+ Add category" chip,
  and the amount (mono, green when positive).

Tapping a row's category chip assigns / changes the category. This is the one
write action on the screen and mirrors the web `TransactionsView.vue` flow:

- Pick a category from the settings-defined list.
- If other transactions share a description prefix, prompt "Apply to similar
  transactions?" (port of `descriptionMatching.ts`), offering "Just this one" vs.
  "Apply to N similar".
- "Just this one" -> `PUT /transactions`; "Apply to N" -> `POST /mapping/description`
  then re-fetch.

There is **no transactions-list API beyond `GET /transactions`** - the web app
does all filtering/searching client-side, and so will iOS.

### Shared cached data (new)

The web app does **not** re-fetch per view - `stores/transactions.ts` and
`stores/settings.ts` are shared Pinia stores (in-memory + `localStorage`, a
10-minute expiry for transactions / load-once for settings, in-flight-promise
dedup), and both `DashboardView.vue` and `TransactionsView.vue` read the same
store. A category edit mutates the shared array in place, so the other view sees
it without its own fetch.

The current iOS `DashboardViewModel` fetches directly via `PimApiClient` and
holds its own copy. This worklog introduces the equivalent shared stores and
**refactors the dashboard onto them** so the Transactions tab reuses the data
the dashboard already loaded (and vice-versa), and a category edit on one tab is
reflected on the other.

### APIs used (all already exist, all `[Authorize]` - Bearer id token)

- `GET /transactions?endDate=<today>` - full history up to today (same call the
  dashboard already makes).
- `GET /settings` - `categories` (`{ name, colour, type }`) for the category
  picker + chip colours.
- `GET /transactions/descriptions` - per-description stats
  (`{ description, transactionCount }`) for the approximate-match prompt.
- `PUT /transactions` - body is a `[Transaction]` list; returns the server's
  authoritative updated transactions (it can stamp `type`/`ignore`).
- `POST /mapping/description` - `{ descriptionStart, category }` for "apply to
  similar".

Token refresh / expiry is out of scope (same as UBE-102) - a 401 surfaces as a
"session expired" state that sends the user back to sign-in.

### Scope

**In scope**
- Shared `TransactionsStore` + `SettingsStore` (ports of the Pinia stores), and
  refactoring `DashboardViewModel` onto them so both tabs share one cached copy.
- A `TabView` shell (Dashboard + Transactions), replacing the current
  `fullScreenCover { DashboardView(...) }` in `LoginView`.
- The Transactions screen matching the mockup: title + needs-category sub-line,
  search field, "N need a category" filter chip, transaction rows.
- Assign / change a transaction's category, incl. the "apply to similar" prompt;
  the edit mutates the shared store so the dashboard reflects it too.
- Loading / error / session-expired / empty states.

**Out of scope** (not in the iOS mockup; web-only)
- Date-range, account, and amount-sign filters; hide-ignored / ignore toggle.
- CSV export, statement upload.
- Infinite-scroll paging (SwiftUI `List` is already lazy).
- The web's background refresh timers (5-min transactions / 1-min settings) - the
  stores keep the cache-aware `load()` vs. forced `refresh()` split, but iOS
  refreshes on view appearance / after a write, not on an interval.

### Environment constraint (same as UBE-97 / UBE-102)

Xcode Command Line Tools only - no `xcodebuild`, no simulator, no `xcodegen`.
Swift sources and `project.pbxproj` edits are hand-authored to be correct by
inspection; **David must open the project in Xcode to verify it builds and run
it in the simulator.** Foundation-only pure logic (the description-match port)
can be sanity-checked here with the `swift` CLI.

## Plan

1. **API client** - extend `Services/PimApiClient.swift`:
   - `getTransactionDescriptions()` -> `[TransactionDescriptionStat]`.
   - `updateTransactions(_:)` -> `[Transaction]` (`PUT /transactions`).
   - `saveDescriptionMapping(descriptionStart:category:)` (`POST /mapping/description`).
   - Add a shared `send` helper (method + optional JSON body) alongside `get`.
2. **Models** - `Models/TransactionDescriptionStat.swift` (`Decodable`), and make
   `Transaction` `Encodable` too (needed for the `PUT` body) - keep the field
   set / camelCase identical to the Api's `Transaction`.
3. **Shared stores** (`Stores/`, `@MainActor` `ObservableObject`, held by the
   tab shell and injected as `@EnvironmentObject`):
   - `TransactionsStore` - port of `stores/transactions.ts`: `@Published
     transactions`, `UserDefaults` JSON persistence keyed `pim.transactions`,
     10-min expiry, in-flight-task dedup, `load()` (cache-aware) / `refresh()`
     (forced) / `updateTransaction(_:changes:)` (merges the `PUT` response in
     place) / `clear()`.
   - `SettingsStore` - port of `stores/settings.ts`: `@Published accounts /
     categories / minTransactionDate`, key `pim.settings`, load-once (no
     expiry), same dedup + `clear()`. `categoryColor(_:)` lives here.
   - A `.unauthorized` throw from either propagates so views can show the
     session-expired state.
4. **Refactor the dashboard onto the stores** - `DashboardViewModel` takes
   `TransactionsStore` + `SettingsStore` instead of building its own
   `PimApiClient`; its computed metrics now read `store.transactions` /
   `store.categories`. It keeps `selectedMonthKey` + the load-state enum, and
   re-publishes when the stores change (observe via Combine `objectWillChange`).
   `DashboardView` gets the stores from the environment. Adjust the existing
   `DashboardViewModelTests` (if any) to inject stores.
5. **Description-match port** - `Utils/DescriptionMatching.swift`, a direct port
   of `descriptionMatching.ts` (`findApproximateMatch`), plus a small
   sanity-check via the `swift` CLI.
6. **Transaction filters port** - `Utils/TransactionFilters.swift`: the `search`
   + `needsCategoryOnly` predicates from `transactionFilters.ts` (the only two
   the iOS screen exposes) and the `needsCategoryCount` helper.
7. **Transactions view model** - `Views/Transactions/TransactionsViewModel.swift`
   (`@MainActor`, `ObservableObject`): reads the shared stores + a lazily-loaded
   descriptions list; holds `searchQuery` and `needsCategoryOnly`; exposes the
   filtered list, the needs-category count, `categoryColor(_:)`, and the
   category-save flow (direct save vs. pending "apply to similar", with
   per-row / modal saving state + an error state). Same load-state enum as the
   dashboard.
8. **Transactions UI** (SwiftUI, `Views/Transactions/`):
   - `TransactionsView.swift` - nav bar (reused), large title + needs-category
     sub-line, search field, filter-chip row, the list card.
   - `TransactionRow.swift` - description, `date · account` meta, category chip /
     "+ Add category", amount; tapping the category opens the picker.
   - `CategoryPickerSheet.swift` - the settings category list.
   - `ApplyToSimilarSheet.swift` - the "Apply to similar transactions?" prompt.
   - Reuse `DashboardTheme` for colours / radii / fonts.
9. **Tab shell** - `Views/AppTabView.swift`: owns the two stores as
   `@StateObject`, injects them, renders a `TabView` (Dashboard + Transactions).
   `LoginView`'s `fullScreenCover` points at `AppTabView`; sign-out calls
   `store.clear()` on both before dropping the session.
10. **Project file** - add every new `.swift` file to
    `iosApp.xcodeproj/project.pbxproj` (PBXBuildFile + PBXFileReference + group +
    Sources phase), following the UBE-102 entries exactly.
11. **Docs** - keep this worklog's checklist current; note the tab shell / shared
    stores where relevant.

## Checklist

- [x] 1. Extend `PimApiClient` (descriptions / update / mapping + send helper)
- [x] 2. Models: `TransactionDescriptionStat`, `Transaction: Codable` (+ `withCategory`)
- [x] 3. `Stores/TransactionsStore.swift` + `Stores/SettingsStore.swift`
- [x] 4. Refactor `DashboardViewModel` / `DashboardView` onto the shared stores
- [x] 5. `Utils/DescriptionMatching.swift` + `swift` CLI sanity-check (6 cases pass)
- [x] 6. `Utils/TransactionFilters.swift`
- [x] 7. `TransactionsViewModel`
- [x] 8. Transactions UI (`TransactionsView`, `TransactionRow`, `CategoryPickerSheet`, `ApplyToSimilarSheet`)
- [x] 9. `AppTabView` tab shell + wire up `LoginView` (+ clear stores on sign-out)
- [x] 10. `project.pbxproj` entries for all new files (`plutil -lint` OK)
- [x] 11. Docs / worklog tidy-up
- [x] 12. Hand off to David to build & run in Xcode - confirmed working

## Prompt log

### Prompt 1

> start a worklog for UBE-103

Retrieved UBE-103 from Linear, reviewed `dashboard-mockup-ios.html` (Transactions
tab), the web `TransactionsView.vue` + its utils, the existing iOS dashboard
code (`DashboardView`, `DashboardViewModel`, `PimApiClient`, models), and the
relevant Api controllers. Created branch `UBE-103/ios-app-transaction-screen`
off `origin/main` (which has the squash-merged UBE-102 dashboard, #88) and this
worklog. Awaiting confirmation of the plan before implementing.

### Prompt 2

> GET /transactions is already implemented. This should use the existing cached
> data, similar to the front end implementation

Reviewed `stores/transactions.ts` + `stores/settings.ts`. Reworked the plan to
introduce shared `TransactionsStore` / `SettingsStore` (ports of those Pinia
stores - in-memory + `UserDefaults`, cache-aware `load()` vs. forced
`refresh()`, in-flight dedup) and to **refactor `DashboardViewModel` onto them**
so the Transactions tab reuses the dashboard's cached data and a category edit
shows on both tabs. Still awaiting plan confirmation.

### Prompt 3

> go

Implemented the whole screen against the revised plan:

- **`PimApiClient`** - added `getTransactionDescriptions()`, `updateTransactions(_:)`
  (`PUT /transactions`), `saveDescriptionMapping(descriptionStart:category:)`
  (`POST /mapping/description`); generic `send` / `sendNoContent` / `perform`
  transport (pre-encoded `Data` body, no existential opening).
- **Models** - `TransactionDescriptionStat` + `TransactionDescriptionsResponse`;
  `Transaction` is now `Codable` with `category`/`ignore`/`type` mutable and a
  `withCategory(_:)` / `isUncategorized` helper. `Account` / `CategoryDefinition`
  are `Codable, Equatable` (store persistence).
- **`Stores/TransactionsStore` + `Stores/SettingsStore`** - `@MainActor`
  `ObservableObject`, `UserDefaults` JSON persistence (`pim.transactions` 10-min
  expiry, `pim.settings` load-once), in-flight-`Task` dedup, `clear()` on
  sign-out. `TransactionsStore.setCategory` merges the `PUT` response;
  `applyDescriptionMapping` POSTs then `refresh()` + re-loads descriptions
  (lazy, transactions-screen-only).
- **`DashboardViewModel`** - now takes the two stores instead of its own
  `PimApiClient`; derives every metric from `store.transactions` /
  `store.categories` and re-publishes on the stores' `objectWillChange`.
  `DashboardView` / its `#Preview` updated.
- **`Utils/DescriptionMatching.swift`** (port of `descriptionMatching.ts`, 6 CLI
  cases pass) + **`Utils/TransactionFilters.swift`** (search + needs-category
  predicates only).
- **`TransactionsViewModel`** - reads the shared stores; `searchQuery` /
  `needsCategoryOnly`; filtered list + needs-category count; category flow
  (direct save vs. `pendingCategoryChange` sheet, per-row / modal spinner state,
  error state, `.sessionExpired` on 401).
- **Transactions UI** - `TransactionsView` (nav bar, title + needs-category
  sub-line, search field, dashed "N need a category" chip, list card, error
  banner, retry / session-expired states), `TransactionRow`,
  `CategoryPickerSheet`, `ApplyToSimilarSheet`.
- **`AppTabView`** - owns the two stores (`@StateObject`), `TabView` with
  Dashboard + Transactions, `signOut` clears both stores. `LoginView`'s
  `fullScreenCover` now shows `AppTabView`.
- **`project.pbxproj`** - 11 new files + `Stores` / `Views/Transactions` groups
  wired into refs / groups / Sources; `plutil -lint` OK.

All new/changed Swift files pass `swiftc -parse`. Full type-check / build is on
David in Xcode (CLI-tools-only environment) - see Handoff below.

### Prompt 4

> works

David confirmed the screen builds and runs in Xcode. Checked off the handoff
item.

### Prompt 5

> commit and raise PR

Committed as `507d167`, pushed, opened PR #89 against `main`:
https://github.com/dcamdupe/pim/pull/89 (excludes the pre-existing
`UserInterfaceState.xcuserstate` churn).

## Handoff

Open `iosApp/iosApp.xcodeproj` in Xcode and:

1. **Build** (`⌘B`). New files are already in `project.pbxproj`; if Xcode shows
   any as red, re-add from `iosApp/iosApp/{Stores,Utils,Models,Views/Transactions}`.
2. **Run** in the simulator, sign in, and check:
   - Tab bar has **Dashboard** + **Transactions**; the dashboard is unchanged.
   - Transactions tab: search filters the list; the dashed **"N need a category"**
     chip toggles the needs-category-only filter and its count tracks the search.
   - Tapping a row's category chip opens the picker; choosing a category with no
     similar descriptions saves it directly (row spinner), and the dashboard's
     "Spending by category" / recent list reflect it without a reload.
   - Choosing a category that matches other descriptions shows **"Apply to
     similar transactions?"** - "Just this one" vs. "Apply to N".
   - Sign out clears both caches (next sign-in re-fetches).
3. Watch for **`@MainActor` concurrency warnings** - Swift 5 mode makes them
   warnings, not errors, and the target has no warnings-as-errors, but flag any
   that look real (esp. around the store `objectWillChange` forwarding).

Known trade-offs (deliberate, see Scope): no account/amount/ignore filters, no
CSV export/upload, no background refresh timers. Both tabs stay alive in the
`TabView` and both view models observe the shared stores, so a category edit on
the transactions tab updates the dashboard immediately.
