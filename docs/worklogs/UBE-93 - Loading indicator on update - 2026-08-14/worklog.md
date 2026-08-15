# UBE-93: Add a loading indicator while transactions are being updated

Linear: https://linear.app/uberconcept/issue/UBE-93/add-a-loading-indicator-while-transactions-are-being-updated
Status: In Progress · Priority: No priority

## Description (from Linear)

When transactions are categorized, there is a notable loading time while the API call is being
completed.

## Current state

- `FrontEnd/src/views/TransactionsView.vue` has two category-save paths, both funnelling through
  `applySingleCategory` (sets `savingCategory` around the await, used only to
  `:disabled="savingCategory"` **every** row's `<select class="category-select">` - no visible
  loading feedback beyond that):
  - **No description match** (`onCategoryChange` → `applySingleCategory` directly): the `<select>`
    just sits there for a moment with no visible feedback at all.
  - **A match exists** (`pendingCategoryChange` modal, "Apply to similar transactions?"): both
    `confirmBulkApply` and `declineBulkApply` close the modal (`pendingCategoryChange.value =
    null`) *before* the async work even starts, so the (often heavier - `confirmBulkApply` does
    `saveDescriptionMapping` + a full `transactionsStore.refresh()`) save runs entirely invisibly
    after the modal's already gone.
- `Transaction` (`transactionsService.ts`) has no id field - rows are only addressable by object
  reference or array index. `updateTransaction` (`stores/transactions.ts:72`) does
  `Object.assign(transaction, updated)` - mutates the existing object in place rather than
  replacing it, so a row can safely be identified by reference (`t === someRef`) across the save.
- No spinner/loading-indicator component or CSS exists anywhere in `FrontEnd/src` today (checked
  via grep). Other async actions in this codebase (`LoginView.vue`, `SettingsView.vue`) instead
  swap a *button's* label to e.g. "Saving…" while disabled - close to what's needed for the modal
  buttons, but the no-modal path has no button (the trigger is the `<select>`'s own `@change`), so
  that path needs a small new inline spinner element instead.
- Per the established convention in this repo (confirmed during UBE-92's work), Vue
  component/view behaviour is tested via `FunctionalTests` (Playwright), not `FrontEnd.UnitTests` -
  no new Vitest test needed here.
- A real local round-trip (DynamoDB Local) is fast enough that a Playwright assertion on
  mid-flight spinner visibility would be flaky without artificially slowing the request - needs
  `page.route()` to delay the `PUT /transactions` response so the assertion is deterministic.

## Plan

1. **Modal path** - keep the modal open through the save instead of closing it immediately:
   - `confirmBulkApply`/`declineBulkApply`: move `pendingCategoryChange.value = null` into
     `finally` (after the await), not before it.
   - New `modalAction: 'confirm' | 'decline' | null` ref, set for the duration of whichever
     handler is running - lets the *specific* clicked button show a spinner (both buttons share
     the same underlying `savingCategory` in-flight flag, so this disambiguates which one to
     visually mark).
   - Modal template: `:disabled="savingCategory"` on all three buttons (Cancel included - don't
     let the user dismiss out from under an in-flight save), spinner + existing label on
     "Just this one"/"Apply to N similar transactions" gated on `modalAction`.
2. **No-modal path** - new `directSaveTransaction: Transaction | null` ref, set only around the
   `onCategoryChange` → `applySingleCategory` call when there's no match. Small spinner in that
   row's `.category-cell`, shown only when `directSaveTransaction === t`. Existing
   `:disabled="savingCategory"` on every row's `<select>` is unchanged.
3. Shared minimal spinner CSS (small rotating ring via `@keyframes spin`, sized/coloured to match
   `--accent`/`--text`) scoped in `TransactionsView.vue`, reused by both the modal buttons and the
   row indicator.
4. `FunctionalTests/tests/transactionCategorization.spec.ts` - extend/add scenarios using
   `page.route()` to delay `PUT /transactions`:
   - No-match path: spinner visible on the changed row while pending, gone after; other rows'
     selects disabled meanwhile (existing behaviour preserved).
   - Modal path (both "Just this one" and "Apply to N similar" buttons): modal stays open with the
     clicked button showing its spinner and all buttons disabled while pending, modal closes only
     once the request resolves.
5. `npm run build`, `npm run lint` (`FrontEnd`) clean; run the new/affected Playwright spec against
   the real local stack.

## Checklist

- [x] Modal path: `pendingCategoryChange` closes only after the save; `modalAction` ref; buttons
      disabled + clicked button shows spinner while saving
- [x] No-modal path: `directSaveTransaction` ref; per-row spinner in `.category-cell`
- [x] Shared spinner CSS - single `currentColor`-based `.spinner` class reused by both the modal
      buttons and the row indicator. `npm run build`/`npm run lint` clean.
- [x] `transactionCategorization.spec.ts` - new delayed-PUT/delayed-POST scenarios for all three
      save paths (no-modal, modal "Just this one", modal "Apply to N similar") - all passing, plus
      the full spec file (7 tests) and a blast-radius check
      (`transactionListing.spec.ts`/`transactionIgnore.spec.ts`/`settings.spec.ts`, 7 tests) green
- [x] `npm run build` / `npm run lint` clean; `FrontEnd.UnitTests` 175 passing (unaffected, run for
      regression-safety); Playwright specs passing locally; row and modal spinners
      screenshot-verified visually

## Prompt log

- "start a worklog for UBE-93" → fetched issue from Linear, read `TransactionsView.vue`'s
  category-save flow, `transactions.ts`/`transactionsService.ts`, confirmed no existing spinner
  pattern in `FrontEnd/src`
- "Why not just keep the modal pop up open, disable the buttons and show a spinner there?" →
  agreed for the modal (match) path - simpler than a new per-row indicator there, and it's the
  heavier of the two save paths
- "add a small indicator there too" (re: the no-modal/no-match path, which has no modal to reuse) →
  settled on the two-path plan above, wrote this worklog
- "go" → implemented both paths + shared spinner CSS in `TransactionsView.vue`; `npm run build`/
  `npm run lint` clean; added 3 new Playwright scenarios - hit and fixed a bug in my own first
  attempt (two test descriptions' merchant tokens differed instead of sharing a common prefix, so
  no match was ever offered); local DynamoDB Local had also gone down between turns (real time
  passed) - restarted via `setup_local.sh`/`run_local.sh`; a first cleanup script for a failed
  run's leftover test accounts used `hasText` against an `<input>`'s *value*, which doesn't match
  (account names aren't in the DOM as text) - silently no-opped, leaving stale accounts that then
  broke the retry via Settings' cross-account "names must be unique" validation; fixed by patching
  the DynamoDB item directly. All 3 new scenarios + full `transactionCategorization.spec.ts` (7) +
  blast-radius specs (7) passing; spinners screenshot-verified visually in both places
