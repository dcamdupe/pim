# UBE-64: Internal transfers overmatches

Linear: https://linear.app/uberconcept/issue/UBE-64/internal-transfers-overmatches
Status: In Progress · Priority: No priority

## Description (from Linear)

UBE-52 - implemented internal transfers. This is overmatching. The time period is quite long and
matching on just the amount picks up too much.

Reduce the time period to 2 business days. Add the following additional match rules, at least 1
must be true:

* The transaction with the + amount must [have] BPAY in the description
* The transaction with the - amount must contain transfer (any case) in the description

## Plan

All the matching logic lives in `Api/Services/InternalTransferMatcher.cs`, currently: same amount
magnitude + opposite sign, different account, within `MatchWindowDays = 5` *calendar* days (via
`Math.Abs(candidate.Date.DayNumber - added.Date.DayNumber) <= MatchWindowDays`).

1. Replace the calendar-day window with a business-day window (`MatchWindowBusinessDays = 2`) -
   add a helper that counts weekdays strictly between two dates (skipping Sat/Sun) and compare
   against the new constant, rather than a flat day-number difference.
2. Add the description-based rule: for a candidate pair, identify which side is the `+` amount and
   which is `-`, then require `positive.Description` contains "BPAY" **or** `negative.Description`
   contains "transfer" - both checks case-insensitive (`StringComparison.OrdinalIgnoreCase`), since
   the ticket only spells out "(any case)" for the transfer check but the intent clearly applies to
   matching real bank-statement text in either direction, and BPAY references are typically
   all-caps anyway so this is a safe, low-risk call rather than a real ambiguity.
3. Update `Api.UnitTests/Services/InternalTransferMatcherTests.cs`:
   - The shared `Transaction()` test helper builds descriptions like `"Checking txn 2026-06-01"` -
     none of the existing "should match" tests would satisfy the new description rule as-is, so
     every positive test case needs a qualifying description (BPAY on the `+` side or "transfer" on
     the `-` side).
   - Rename/update the "within five days" / "more than five days apart" tests for the new 2
     business-day window (including a same-week-vs-across-a-weekend case, since business days and
     calendar days now diverge).
   - Add new tests for the description rule: matches via BPAY only, matches via "transfer" only
     (including a mixed-case spelling), doesn't match when neither is present even though
     amount/date/account line up (this is the actual overmatching bug being fixed).
4. `FunctionalTests/tests/internalTransfer.spec.ts` uses descriptions like `"IT Out"`/`"IT In"` for
   its matching pair, which won't satisfy the new rule either - update those descriptions (e.g. to
   include "Transfer"/"BPAY") so the existing scenario still proves a real match, and consider
   adding a case that used to overmatch (amount+date match, no qualifying keyword) to prove it no
   longer does.
5. Run `dotnet test` and the Playwright suite; verify against the running local stack.

## Checklist

- [x] 2-business-day match window (replacing the 5-calendar-day window)
- [x] BPAY / "transfer" description match rule (at least one required)
- [x] Update `InternalTransferMatcherTests.cs` existing tests + add new coverage (16/16 passing;
      also added weekend-boundary and description-rule-specific cases beyond the original plan)
- [x] Update `internalTransfer.spec.ts` descriptions + add an overmatch-prevention case (both
      pass against the running local stack)
- [x] `dotnet test` passes (116/116: 83 unit + 33 integration)
- [x] Playwright suite passes (dashboard.spec.ts + internalTransfer.spec.ts at minimum)

### Full Playwright suite

Ran the full suite to check for regressions. Found a new failure in dashboard.spec.ts's "Recent
transactions" test - confirmed pre-existing (stashed all UBE-64 changes, re-ran against clean
`main`, fails identically) and recorded to memory alongside the two other already-known
pre-existing failures (`settings.spec.ts`, `transactionCategorization.spec.ts`). All 12 remaining
specs pass cleanly with UBE-64's changes in place.

## Prompt log

- "investigate and resolve the conflicts following the merge from main" (UBE-70, separate task)
- "The recent transactions table has regressed..." (UBE-70 CSS report - not reproducible, likely a
  mid-merge stale view)
- "switch to main" (x2)
- "create worklog for UBE-64"
