# UBE-79: Expand transaction matching to include exact match

Linear: https://linear.app/uberconcept/issue/UBE-79/expand-transaction-matching-to-include-exact-match
Status: In Progress · Priority: No priority
PR: https://github.com/dcamdupe/pim/pull/58

## Description (from Linear)

Currently if 2 transactions share exactly the same description they're not identified as a match.
Expand the matching rules to include this.

## Current state

`FrontEnd/src/utils/descriptionMatching.ts`'s `findApproximateMatch()` is what decides whether editing
a transaction's category should pop up the "apply to similar transactions?" bulk-apply modal
(`TransactionsView.vue`'s `onCategoryChange()`). It already handles the exact-same-description case
**for descriptions that contain at least one space** - that was UBE-54's fix (the description-stats
list is deduplicated per unique description string, and the entry for the description being edited is
itself a valid match target when its `transactionCount > 1`). Confirmed via
`FrontEnd.UnitTests/utils/descriptionMatching.test.ts`'s existing `'matches against its own stat entry
when more than one transaction shares the exact same description'` test.

**The actual remaining gap: a description with zero spaces at all never matches anything, even an
exact duplicate of itself.** `findApproximateMatch()` builds its list of candidate "boundaries" only
from space positions in `description` (`i + 1` for every space); with no spaces, `boundaries` is empty,
so the matching loop never runs and the function always returns `null` - regardless of whether another
transaction has the literal same description. Reproduced directly:
`findApproximateMatch('Netflix', [stat('Netflix', 2)])` → `null` (should be a match). This is likely
what the ticket is describing - a real single-token bank description (no store number/suffix) that's
genuinely identical across transactions still isn't offered as a match.

There's an existing test, `'returns null when the description has no spaces at all'`
(`findApproximateMatch('Netflix', [stat('Netflix Extra', 1)])`), that must keep passing - it's a
*different* description ("Netflix Extra" isn't a duplicate of "Netflix"), and the whole point of the
word-boundary rule is that a single-token source description shouldn't fuzzy-*prefix*-match into a
longer, different description. So the fix has to add exact-duplicate detection specifically, not just
fall back to a generic `startsWith` check using the full description as one more boundary (that would
wrongly turn "Netflix" into a prefix match against "Netflix Extra" again, breaking that test's intent).

No server-side (`Api/`) equivalent needed - `Api/Services/FileProcessor.cs`/`TransactionUpdateService.cs`
only ever *apply* an already-saved `DescriptionMapping.DescriptionStart` via `StartsWith` to new
uploads; they don't decide whether to *offer* the bulk-apply prompt in the first place, so they're
unaffected by this fix.

## Plan

1. `FrontEnd/src/utils/descriptionMatching.ts` - after the existing word-boundary loop finds nothing
   (which today is the only path reachable when `description` has no spaces), add one further,
   narrowly-scoped check: if some `otherDescriptions` entry has `description === description` (the
   literal same string) and `transactionCount > 1`, return a match on the full description
   (`{ descriptionStart: description, matchingTransactionCount: transactionCount - 1 }`). This only
   adds a previously-unreachable path for zero-space descriptions - every description with at least
   one space already finds its own exact-duplicate entry within the existing loop (the self-entry
   trivially `startsWith` every prefix of itself), so this is a no-op for anything the loop already
   covers.
2. `FrontEnd.UnitTests/utils/descriptionMatching.test.ts` - add cases: an exact duplicate with no
   spaces now matches; a single-token description still returns `null` against a different,
   longer description (the existing `'Netflix'`/`'Netflix Extra'` test, confirming it still passes
   unchanged); a single-token description with only one transaction (`transactionCount: 1`) still
   returns `null` (no duplicate exists yet).
3. `FunctionalTests/tests/transactionCategorization.spec.ts` - add one scenario end-to-end: upload two
   transactions with the exact same single-word (no-space) description and confirm the bulk-apply
   modal is offered, mirroring the existing UBE-54 scenario but with a no-space description.
4. Verification: `npm run build`/`lint`; `FrontEnd.UnitTests`; full Playwright suite.

## Checklist

- [x] `descriptionMatching.ts` - exact-duplicate fallback for zero-space descriptions
- [x] `descriptionMatching.test.ts` - new + reconfirmed cases (116/116 passing overall)
- [x] `transactionCategorization.spec.ts` - new end-to-end scenario (UBE-79) - 4/4 passing in that file
- [x] Build/lint/unit/Playwright verification - `npm run build`/`lint` clean, `FrontEnd.UnitTests`
      116/116, `transactionCategorization.spec.ts` 4/4 (ran that file only, not the full suite - this
      is a narrow pure-function fix already covered by unit tests)

## Verification

`npm run build`/`lint` clean. `FrontEnd.UnitTests` 116/116 (`descriptionMatching.test.ts` gained 3
cases: the UBE-79 fix itself, a no-duplicate-yet no-space case, and confirming a no-space description
still doesn't fuzzy-prefix-match into a different, longer one even when that other description has its
own duplicate). `transactionCategorization.spec.ts` 4/4, including the new UBE-79 scenario - ran just
this spec file, not the full Playwright suite, since this is a narrow pure-function fix with solid
unit coverage.

## Prompt log

- "start a worklog for UBE-79"
- "go"
- "skip the playwright verification, this can be done with unit tests" / "as you've added the test,
  run the playwright tests" (kept the new scenario, scoped verification to that one spec file)
