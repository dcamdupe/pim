# UBE-85 — Compress the bank account list in settings

Linear issue: https://linear.app/uberconcept/issue/UBE-85/compress-the-bank-account-list-in-settings

## Description

"Put the labels and inputs on a single line" — in `SettingsView.vue`'s account list, each
`.account-row` currently renders its `Name`/`Type` fields as a `.field` (label stacked above the
input), making each row taller than it needs to be. The ask is to put each field's label and input
on the same line instead, compressing the list's overall vertical footprint.

## Investigation

- `FrontEnd/src/views/SettingsView.vue:233-254` — the account row markup: a `.account-row` grid
  (`Name` field, `Type` field, `Remove` button), each field using the shared `.field` class
  (`display: flex; flex-direction: column`, label above input) at `SettingsView.vue:438-442`.
- `.field` is also reused lower in the same file for the "Add category" row (`Name`, `Colour`,
  `Type` — `SettingsView.vue:293-339`), which is **not** in scope for this ticket ("bank account
  list" only). Since Vue SFC `<style>` blocks are scoped per-component, `.field` isn't shared with
  other views (`LoginView.vue`, `TransactionUploadView.vue` each have their own scoped `.field`),
  but changing the base `.field` rule here would also compress the "Add category" row, which the
  ticket doesn't ask for. So the fix needs a more specific selector (e.g. `.account-row .field`)
  rather than editing `.field` itself.
- `.account-row` (`SettingsView.vue:428-436`) uses `align-items: end` in its grid, which matters
  because the fields are currently taller (label-above-input) than the `Remove` button — that'll
  need revisiting once the fields are single-line and shorter.

## Plan

1. Add a `.account-row .field` override (`flex-direction: row; align-items: center`) so the Name/
   Type labels sit beside their inputs, leaving the shared `.field` (used by "Add category") alone.
2. Revisit `.account-row`'s `align-items: end` — likely `center` reads better once the fields are a
   single line tall, matching the `Remove` button's height.
3. Visually verify via the dev server (`npm run dev`) in a browser — this is a pure layout/CSS
   change with no new logic, so no unit test coverage applies; screenshot/compare before-and-after.
4. `npm run build` / `npm run lint`.

## Checklist

- [x] `.account-row .field` — label/input on one line
- [x] Revisit `.account-row`'s `align-items`
- [x] Visually verify in a browser — verified manually by David
- [x] `npm run build` / `npm run lint` pass
- [x] Update this worklog with results

## Session log

### Prompt: "start a worklog for UBE-85"

Retrieved issue UBE-85 from Linear. Read `SettingsView.vue`'s account-row markup and the shared
`.field`/`.account-row` CSS, and checked that `.field` is also reused by the (out-of-scope) "Add
category" row in the same file, and confirmed Vue SFC scoped styles mean no cross-view blast
radius. Drafted the plan and checklist above and created this worklog file.

### Prompt: "start"

Implemented the plan in `SettingsView.vue`:

- `.account-row .field { flex-direction: row; align-items: center; gap: 8px; }` — scoped to the
  account rows only, leaving the shared `.field` (and the "Add category" row that also uses it)
  untouched.
- `.account-row .field input, .account-row .field select { flex: 1; min-width: 0; }` — needed
  because switching `.field` to `flex-direction: row` stopped the input/select from stretching to
  fill the row (that stretch came from the column flex container's default cross-axis behaviour).
- `.account-row`'s grid `align-items` changed from `end` to `center`, since the fields are now a
  single line tall like the `Remove` button, rather than taller than it.

Started the local stack (`scripts/setup_local.sh` + `scripts/run_local.sh`) so the Settings page
could be checked with real data. David verified the result manually in a browser rather than via an
automated screenshot. `npm run build` and `npm run lint` both pass clean. Stopped the local dev
servers afterward.
