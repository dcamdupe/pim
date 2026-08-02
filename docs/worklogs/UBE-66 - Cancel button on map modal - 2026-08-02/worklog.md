# UBE-66: Add a Cancel button to the map transaction selection

Linear: https://linear.app/uberconcept/issue/UBE-66/add-a-cancel-button-to-the-map-transaction-selection
Status: In Progress · Priority: No priority

## Description (from Linear)

Clicking cancel will close the modal pop up with no changes

## Current behaviour

`TransactionsView.vue`'s "Apply to similar transactions?" modal (`pendingCategoryChange`) pops up
when picking a category on a transaction whose description approximately matches others already in
the description-mapping cache. It currently has 2 buttons:

- **"Just this one"** (`declineBulkApply`) - saves the category for just this transaction.
- **"Apply to N similar transactions"** (`confirmBulkApply`, primary) - saves the category for this
  transaction *and* remembers the description → category mapping for future uploads.

There's no way to back out without saving *something* - the ticket wants a third option that closes
the modal with no save at all.

## Plan

1. Add a `cancelCategoryChange()` handler that just clears `pendingCategoryChange` - no API call,
   no mutation of `transaction.category`. Since the row's `<select>` is bound as `:value="t.category"`
   (one-way, not `v-model`), clearing the pending state re-renders the row and Vue reconciles the
   `<select>`'s displayed value back to the (unchanged) `t.category` - so the visible selection
   should revert to the original automatically, with no extra state to track. Will verify this
   holds in the browser rather than assume it.
2. Add a "Cancel" button to `.modal-actions`, placed first (leftmost, before "Just this one") -
   reuses the existing `.modal-button.secondary` style.
3. Playwright scenario in `transactionCategorization.spec.ts`: pick a category that triggers the
   modal, click Cancel, assert the modal closes and the row's category-select still shows its
   original value (empty).

   Note: `transactionCategorization.spec.ts` currently has two pre-existing failing tests (recorded
   in memory, confirmed unrelated to any of my recent changes) around the *save* path of this same
   modal. My Cancel scenario doesn't save or reload anything, so it may not hit whatever's broken
   there - but flagging the risk that this file is already a bit fragile.
4. `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests`; manual browser check, light + dark.

## Checklist

- [x] `cancelCategoryChange()` handler
- [x] "Cancel" button in the modal
- [x] Manual browser check confirming the select reverts to its original value, light + dark -
      confirmed the select reverts immediately on cancel, and stays reverted after a page reload
      (nothing was persisted)
- [x] Playwright scenario for the cancel flow - passes cleanly, confirmed unaffected by the two
      pre-existing failures in the same file (asserted the risk noted in the plan didn't apply)
- [x] `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests` pass (98/98)

## Prompt log

- "start worklog UBE-66"
