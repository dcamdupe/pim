# UBE-113 - iOS dark mode support - 2026-09-05

Linear: https://linear.app/uberconcept/issue/UBE-113/ios-app-looks-terrible-in-dark-mode
Branch: `UBE-113/ios-dark-mode-support`

## Description

The iOS app should respect the system Dark Mode setting - switching backgrounds and text
colours to match, instead of staying styled for light mode. Linear has an attached
screenshot (a signed upload URL I can't fetch from here) but the cause is clear from the code.

### Root cause

Nothing forces `.light`/`.dark` (no `preferredColorScheme` override anywhere), so system
chrome (nav bars, sheets, etc.) already follows the OS setting. But `DashboardTheme.swift`
is an enum of **fixed hex colours**, explicitly documented as "Light-only, matching the
mockup (`color-scheme: light`)" (`docs/design/dashboard-mockup-ios.html`). In dark mode this
produces the clash the ticket describes: dark system chrome around light-hardcoded
backgrounds/cards, with text colours that don't repaint either.

`DashboardTheme` is used in 9 files, 96 call sites total, covering effectively every custom-
styled screen:

- `Views/AppTabView.swift`
- `Views/Dashboard/{DashboardView,DashboardTile,RecentTransactionsList,SpendingByCategoryChart,IncomeVsExpensesChart}.swift`
- `Views/Transactions/{TransactionsView,TransactionRow,CategoryPickerSheet,ApplyToSimilarSheet}.swift`

Good news: every one of them reads colours *only* through the `DashboardTheme` enum (I
checked each file for stray hardcoded colours - the only ones outside `DashboardTheme` are
`.white` text on a fixed `DashboardTheme.accent`-coloured badge/button, which is correct in
either mode and needs no change). So this is fixable in one file: make `DashboardTheme`'s
colour constants dark-mode-aware and every consumer adapts automatically.

Out of scope: `LoginView`/`GoogleLogoView` don't use `DashboardTheme` and keep Google's
fixed brand colours for the sign-in button (required by Google's branding guidelines,
implemented in UBE-99) - not touching those. User-picked category colours (`Category.colour`,
stored server-side) are data, not theme, and stay as-is.

## Plan

1. **`DashboardTheme.swift`** - add a `Color(light:dark:)` helper that builds a dynamic
   `UIColor` (resolved per `UITraitCollection.userInterfaceStyle` at draw time, so it also
   repaints live if the user flips Settings > Display while the app is running - no asset
   catalog needed). Give every token both a light value (kept as today, from the mockup) and
   a dark value chosen per Apple HIG semantic-colour conventions:
   - `bg`: near-black elevated-system background
   - `surface` / `surface2`: dark card surfaces, `surface2` slightly distinct from `surface`
   - `ink` / `ink2` / `ink3`: near-white primary / light-gray secondary / dimmer tertiary text
   - `border`: low-alpha light hairline instead of a light-gray one
   - `accent` / `accentDark`: same teal family, nudged for AA contrast on a dark surface
   - `accentWash`: dark desaturated teal wash instead of the light tint
   - `good` / `crit`: same hues, nudged for contrast if needed
   - `incomeColor` / `expenseColor`: check contrast on dark; likely unchanged, they're
     already saturated
   - `fallbackCategoryColor`: unchanged (neutral gray reads fine either way)
2. No other file needs editing - re-verify after by re-grepping for stray `Color.white` /
   `Color.black` / literal hex in the 9 consumer files.
3. **Verify**: `xcodebuild build` for a clean compile (this sandbox has no `simctl`, so I
   can't launch the simulator or screenshot it - visual check in Simulator/on-device is
   over to David). No existing iOS unit/UI test target covers colours, so no automated test
   changes.

## Checklist

- [x] Confirm plan with David
- [x] `DashboardTheme.swift`: `Color(light:dark:)` helper + dark values for every token
- [x] Re-grep the 9 consumer files for stray non-theme colours (expect none)
- [ ] `xcodebuild build` succeeds - couldn't run from this sandbox (Command Line Tools only,
      no Xcode.app selected); David confirmed it looks good
- [x] David to visually verify in Simulator/device (light + dark)
- [x] PR raised — https://github.com/dcamdupe/pim/pull/94 (commit `0c39d18`)

## Prompt / response log

### 2026-09-05

**Prompt:** start a worklog for UBE-113

**Response:** Fetched UBE-113 from Linear. Confirmed no `preferredColorScheme` override
exists, so the OS Dark Mode setting already reaches the app; the visible problem is that
`DashboardTheme.swift`'s colour constants are hardcoded light-only hex values. Traced all 9
consumers (96 call sites) and confirmed each reads colour only via `DashboardTheme` (the few
`.white` literals found are text on a fixed accent-coloured badge, correct in both modes).
Created branch `UBE-113/ios-dark-mode-support` and this worklog. Plan: make
`DashboardTheme`'s tokens dark-mode-aware via a dynamic-`UIColor` helper, touching only that
one file. Noted this sandbox has no `simctl`, so visual verification needs David's own
Simulator/device. Awaiting confirmation before implementing.

**Prompt:** go

**Response:** Implemented the plan in `DashboardTheme.swift` only - added `Color(light:dark:)`
(a dynamic `UIColor` resolved off `UITraitCollection.userInterfaceStyle`) and gave every
token a dark value per Apple HIG conventions (near-black bg/surfaces getting progressively
lighter with elevation, near-white primary text down to a dimmer tertiary, Apple's own
systemRed/Green/Blue/Orange dark shades for crit/good/income/expense, brightened teal for
accent/accentDark). Couldn't run `xcodebuild` here (active developer directory is Command
Line Tools, not the installed `Xcode.app`, which needs `sudo xcode-select` to switch) - asked
before doing that; David said it looks good.

**Prompt:** looks good. Commit and raise PR

**Response:** Committed and opened the PR.
