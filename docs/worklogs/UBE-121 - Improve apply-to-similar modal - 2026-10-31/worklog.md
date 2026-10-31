# UBE-121: Improve the "Apply to similar transactions?" confirmation window

## Linear issue

https://linear.app/uberconcept/issue/UBE-121/improve-the-apply-to-similar-transactions-confirmation-window

> Make the description editable for this, allowing someone to choose how to match. Also show the
> full description of the current transaction.

## Description

When a category is changed on `/transactions` and `findApproximateMatch`
(`FrontEnd/src/utils/descriptionMatching.ts`) finds similar descriptions, the modal in
`FrontEnd/src/views/TransactionsView.vue` offers to save a description mapping for the
auto-picked `descriptionStart` (longest shared whole-word prefix). Right now:
- the matched prefix can't be changed, so the user can't widen (e.g. `COLES`) or narrow
  (e.g. `COLES 0717`) the rule;
- the transaction's full description isn't shown, so it's hard to judge whether the prefix is right.

The API needs no change. `PUT` mapping takes any `DescriptionStart`, and both
`TransactionUpdateService` and `FileProcessor` already match with ordinal `StartsWith`.

## Plan

1. **Matching util:** add `countMatchingTransactions(prefix, description, stats)` to
   `descriptionMatching.ts`. It counts the other transactions whose description starts with `prefix`,
   excluding the edited transaction itself (same rule `findApproximateMatch` uses). Refactor
   `findApproximateMatch` to use it.
2. **Modal:**
   - Show the transaction's full description (e.g. "Transaction: **COLES 0717 SYDNEY AU**").
   - Replace the fixed "starting with **X**" text with a text input pre-filled with the
     suggested `descriptionStart`.
   - Recount the matches live as it's edited ("N other transactions start with this text"), and
     the "Apply to N similar transactions" button uses the live count.
   - Disable Apply when the trimmed text is empty, the count is 0, or the text isn't a prefix of
     this transaction's description. That keeps the current transaction inside its own rule.
     Show a short hint explaining which case applies.
   - Save the edited (trimmed) prefix via `saveDescriptionMapping`.
   - "Just this one" and Cancel don't change.
3. **Tests:**
   - FrontEnd.UnitTests: `countMatchingTransactions` cases (wider/narrower prefix, self-exclusion,
     no match) and check that `findApproximateMatch` still passes its existing tests.
   - FunctionalTests: add a scenario to `transactionCategorization.spec.ts`. It checks that the full
     description is shown, that editing the prefix updates the count and button, that Apply is
     disabled for a non-prefix, and that applying with an edited prefix recategorises the right
     transactions. Update existing selectors if the modal text changes.
4. `npm run build` + `npm run lint` (FrontEnd), `npm run test` (FrontEnd.UnitTests), run
   `transactionCategorization.spec.ts`.

**Confirmed:** the edited text must be a prefix of the current transaction's
description. The alternative is allowing any text and also applying the category to this
transaction separately.

## Checklist

- [x] `countMatchingTransactions` util + refactor `findApproximateMatch`
- [x] Modal shows the full transaction description
- [x] Editable prefix input with live count + validation
- [x] Apply saves the edited prefix
- [x] Unit tests (FrontEnd.UnitTests)
- [x] Functional test scenario (+ update existing selectors if needed)
- [x] FrontEnd build + lint pass
- [x] Unit tests + `transactionCategorization.spec.ts` pass

## Results

- `descriptionMatching.ts`: new `countMatchingTransactions`; `findApproximateMatch` uses it.
- Modal: full description shown, editable "starting with" input (seeded from the suggestion),
  live count + button label, inline hint when Apply is disabled, Apply saves the trimmed text.
  The description stats are snapshotted when the modal opens rather than re-parsed per keystroke.
- FrontEnd build + lint clean; FrontEnd.UnitTests 218 passing (5 new);
  `transactionCategorization.spec.ts` 8/8 passing (1 new UBE-121 scenario, existing selectors
  unchanged).

## Log

### Prompt
start a worklog for UBE-121

### Response
Fetched UBE-121 (no comments or attachments), reviewed the modal, matching util and API mapping
semantics. Created branch `UBE-121/improve-apply-to-similar-modal` off `origin/main` and this
worklog. Asked for confirmation of the plan, including the prefix-only assumption.

### Prompt
yes the decision is correct. Start work

### Response
Prefix-only assumption confirmed; starting implementation.
Implemented the plan: util, editable modal, unit tests and a Playwright scenario. Build, lint,
unit tests and `transactionCategorization.spec.ts` (8/8) pass. Not committed.

### Prompt
how do I run the front end?

### Response
`scripts/run_local.sh` from the repo root (Api + FrontEnd, http://localhost:5173), or
`npm run dev` in `FrontEnd/` for the FrontEnd alone. Later noted the background stack had been
killed (likely by another run_local.sh start).

### Prompt
commit and raise PR

### Response
Committed, pushed and opened a PR against main.
