# UBE-69: Fix front end issues

Linear: https://linear.app/uberconcept/issue/UBE-69/fix-front-end-issues
Status: In Progress · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/55

## Description (from Linear)

It doesn't look like it matches the original design all that well. See dashboard-mockup-calm.html

Issues:

* background should be grey
* Dashboard / Transaction switch in the top menu is not correct
  * missing gray background
  * Selected option is green
  * Displays as 2 buttons, not a switch

## Current state

Reference mockup: `docs/design/dashboard-mockup-calm.html`.

- **Page background**: `FrontEnd/src/style.css` defines a single `--bg` var used for *both* the page
  background (`:root { background: var(--bg) }`) and every card/panel surface (`NavBar.vue`,
  `DashboardTile.vue`, `TransactionsView.vue`, `DashboardView.vue`, `SettingsView.vue` all use
  `var(--bg)` for their own white panel background). Currently `--bg` is `#fff` in light mode, so the
  whole app - page and cards alike - is flat white. The mockup instead has two distinct tokens:
  `--bg: #f2f4f8` (grey page background) and `--surface` (white, used for the header/cards). There's
  no grey/white distinction in the app today.
- **Nav switch**: `NavBar.vue`'s `.tabs` (Dashboard/Transactions) is currently two plain links with no
  container background; the active link (`.tab.router-link-active`) gets `background: var(--accent)`
  (teal/green) with `var(--accent-ink)` text - i.e. it reads as two buttons, one of which is
  green-highlighted. The mockup's `nav.tabs` has a grey pill container
  (`background:var(--surface-2); padding:4px; border-radius:12px`) and the active tab gets
  `background:var(--surface)` (white) with a shadow, not an accent color - reading as one segmented
  switch with a white "thumb", not two separate buttons.

## Plan

1. `FrontEnd/src/style.css` - add a `--page-bg` var (light: `#f2f4f8` per mockup; dark: a shade
   distinct from the existing card `--bg`, e.g. `#101116`) alongside the existing `--bg`/`--field-bg`
   tokens. Change `body { margin: 0 }` block (or `:root`'s `background`) so the actual page background
   uses `--page-bg` while `--bg` keeps its existing meaning (white/dark card surface) for
   `NavBar`/`DashboardTile`/views - i.e. only the page-level background changes, card surfaces stay as
   they are today.
2. `FrontEnd/src/components/NavBar.vue` - restyle `.tabs`/`.tab`:
   - `.tabs` gets a grey pill container (padding, border-radius, a muted background - `--field-bg` or
     a new `--surface-2`-equivalent token).
   - `.tab.router-link-active` background changes from `var(--accent)`/`var(--accent-ink)` to the card
     surface color (`var(--bg)`) plus a subtle shadow, text color `var(--text-h)` - matching the
     mockup's white "thumb" look instead of a green highlight.
3. Manual browser check (light + dark, `scripts/run_local.sh`) - confirm page background is grey,
   cards/navbar/header stay white (light) or their existing dark surface, and the Dashboard/
   Transactions control reads as a single segmented switch with a white thumb on the active side, not
   two buttons.
4. `npm run build`/`lint` (FrontEnd) - confirm no regressions; no unit/integration/functional test
   changes expected since this is styling-only, but re-run `FrontEnd.UnitTests` and the Playwright
   suite as a sanity check (styling changes shouldn't affect them, but confirms nothing else broke).

## Checklist

- [x] `style.css` - add `--page-bg` token (light `#f2f4f8`, dark `#0e0f13`), apply to page background
      only (`:root { background: var(--page-bg) }`) - `--bg` untouched, still drives card/nav surfaces
- [x] `NavBar.vue` - `.tabs` grey pill container (`background: var(--page-bg)`, `padding: 4px`,
      `border-radius: 12px`)
- [x] `NavBar.vue` - `.tab.router-link-active` white/surface thumb (`background: var(--bg)` + subtle
      shadow, `color: var(--text-h)`) instead of the green `var(--accent)` highlight
- [x] Manual browser check (light + dark) - Playwright screenshots of Dashboard + Transactions in both
      color schemes
- [x] `npm run build`/`lint` clean
- [x] `FrontEnd.UnitTests` (112/112), full Playwright suite (24/24), `dotnet test` (85 + 49) - all
      passing, no regressions

## Verification

Screenshotted Dashboard and Transactions pages in light and dark mode via a Playwright script (logged
in as `testuser@example.com`, `scripts/run_local.sh` running the real stack). Confirmed: page
background is grey (light `#f2f4f8`) / near-black (dark `#0e0f13`), distinct from the white/dark card
and navbar surfaces; the Dashboard/Transactions switch reads as a single grey pill with a white
(light) / dark-surface (dark) "thumb" behind whichever tab is active, matching
`docs/design/dashboard-mockup-calm.html` - no more two-button green-highlight look. No console errors
in either screenshot pass.

`npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112, full Playwright suite 24/24, `dotnet test`
85 + 49 passing (styling-only change, no API/data impact expected or observed).

## Prompt log

- "switch to main"
- "git pull"
- "start a worklog on UBE-69"
- "yes go ahead"
- "yes, commit and open a PR"
