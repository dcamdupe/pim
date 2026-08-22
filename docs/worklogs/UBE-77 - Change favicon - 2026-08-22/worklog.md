# UBE-77: Change Favicon to something better

## Linear issue

[UBE-77](https://linear.app/uberconcept/issue/UBE-77/change-favicon-to-something-better) — Change Favicon to something better

> [Favicon options artifact](https://claude.ai/code/artifact/1ff5f689-4966-4670-97b4-671edb5c8dc0)

## Description

The current favicon (`FrontEnd/public/favicon.svg`) is an abstract purple blob/arrow mark with
heavy blur filters - it doesn't match the app's actual teal accent colour (`#0f766e` light /
`#2dd4bf` dark, from `FrontEnd/src/style.css`), and doesn't read as anything in particular at
16-32px.

Earlier this session, six alternative concepts (Monogram, Ascending bars, Coin, Ledger check,
Wallet, Sparkline) were designed and published as a comparison artifact, each shown at real
favicon sizes (64/32/16px) and in mocked light/dark browser tabs. That artifact is what UBE-77's
description links to. Asked which concept to implement - **Ledger check** was chosen: a
dog-eared receipt/ticket-stub shape with a checkmark cut through it, on the app's deep teal
(`#0b5a54`), reads on PIM's own categorisation/reconciliation feature.

## Plan

- `FrontEnd/public/favicon.svg`
  - Replace the current markup with the Ledger check mark: rounded-square deep-teal background
    (`#0b5a54`), a cream (`#f2ece0`) dog-eared ticket-stub shape, and a teal checkmark stroke cut
    through it. Same artwork already proven in the comparison artifact, cleaned up into a
    standalone, properly-namespaced SVG file.
- `FrontEnd/index.html`
  - No change expected - `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` already
    points at this file, and there's no manifest/apple-touch-icon/other favicon reference anywhere
    else in the project to also update (checked).
- Verify by running the FrontEnd dev server and checking the browser tab icon directly (per
  CLAUDE.md's UI-change verification guidance), not just the SVG in isolation.

## Checklist

- [x] Replace `FrontEnd/public/favicon.svg` with the Ledger check mark
- [x] Run the FrontEnd dev server and verify the tab icon in a real browser
- [x] `npm run build` to confirm the favicon still resolves/builds cleanly
- [x] Review diff and open PR

## Session log

### 2026-08-22

- Retrieved UBE-77 from Linear - description just links to the favicon-options artifact published
  earlier this session; no comments on the issue specifying a choice.
- Asked the user which of the six concepts to implement - chose **Ledger check**.
- Confirmed `FrontEnd/index.html` has the only favicon reference in the project (no manifest/
  apple-touch-icon elsewhere to also update).
- Created this worklog and branch `UBE-77/change-favicon-to-something-better` off `main`.
- Replaced `FrontEnd/public/favicon.svg` with the Ledger check mark (standalone, properly
  namespaced SVG). `npm run build` succeeds clean.
- Verified visually rather than just trusting valid markup: screenshotted the SVG served by the
  running dev server at full size, then rendered it at actual 16px/32px favicon scale in a test
  page and screenshotted that too - the checkmark stays legible even at 16px.
- Committed and pushed; opened PR #79: https://github.com/dcamdupe/pim/pull/79
