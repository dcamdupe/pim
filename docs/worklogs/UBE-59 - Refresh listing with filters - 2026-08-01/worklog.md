# UBE-59 — Bug: refresh the transaction listing applying filters

Linear: https://linear.app/uberconcept/issue/UBE-59/bug-refresh-the-transaction-listing-applying-filters

## Description

Ticket text: "When I set the category for transaction, when there is filter for 'needs a
category' set, the transactions I just set a category for are shown. This is a bug." - i.e. after
picking a category for a row while the "needs a category" toggle is active, that row should drop
out of the filtered view (it no longer needs a category) but was reportedly staying visible.

## Investigation

Before writing a fix plan, tried to reproduce this on current `main` (which includes both UBE-53
and the just-merged UBE-51). Traced the relevant reactivity first: `filteredTransactions`
(`TransactionsView.vue`) reads `t.category` directly during its own `computed()` execution
whenever the needs-category toggle is active (`searchedAndCategorised.value.filter((t) =>
!t.category)`), which Vue tracks as a per-object dependency regardless of the `.filter()` closure
nesting - so mutating `transaction.category` in `applySingleCategory` should correctly invalidate
and re-exclude that row. Then verified this empirically via Playwright against the real running
stack (`scripts/run_local.sh`), four ways:

1. Two fresh transactions, toggle on, categorise one directly (no bulk-apply match) - row
   correctly disappeared.
2. Two similarly-named transactions triggering the bulk-apply modal, "Apply to N similar" (a full
   `fetchTransactions()` reload) - both correctly disappeared.
3. The full real accumulated dataset (1445 "needs a category" rows from this session's test
   runs, `allTime` range) - categorising the first row correctly dropped the count to 1444 and
   removed it.
4. Re-ran (3) again after UBE-51 merged (new Actions column changes row structure/indices) -
   still correct.

Could not reproduce the reported behaviour in any of these paths.

## Conclusion

Discussed with David: most likely explanation is stale-session/stale-bundle testing (a real,
recurring issue this session - e.g. the UBE-54 worklog documented a near-identical case where a
stale running `Api` process silently served pre-fix code) rather than a live bug in the current
code. **Closing without a code change** - no branch/implementation work done. Re-open and retest
if this recurs with a precise repro (exact filter combination, whether the bulk-apply modal
appeared, browser used).

## Prompt Log

1. "start worklog for UBE-59" - fetched the Linear issue, read the current `TransactionsView.vue`
   filter/reactivity code, then reproduced against the live stack via Playwright four different
   ways (clean 2-row case, bulk-apply case, full real dataset, and again post-UBE-51-merge) -
   none reproduced the bug.
2. Asked David how to proceed given no repro - confirmed: likely already fixed/stale-session
   testing, close out without a code change.
