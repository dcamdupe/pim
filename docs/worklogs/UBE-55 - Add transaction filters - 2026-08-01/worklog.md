# UBE-55 — Add filters from design to transaction listing

Linear: https://linear.app/uberconcept/issue/UBE-55/add-filters-from-design-to-transaction-listing

## Description

Add the four filter controls shown in the Transactions view of `docs/design/dashboard-mockup-calm.html`'s
`.filter-bar` to the real `TransactionsView.vue`: a description search box, an account dropdown, a
category dropdown, and a "needs a category" toggle chip with a live count. Today the only filter
is the existing date-range `<select>` (week/month/3 months/all time), which drives a server
fetch; the four new filters narrow what's shown from the already-fetched set client-side.

Note: the mockup itself only wires up the needs-category toggle's *display* logic in its inline
script - the search input and the two selects are static/unwired placeholders in the mockup. So
"add filters from design" here means implementing real behaviour for all four, using the mockup
purely for the visual/interaction shape (chip toggle with a count badge, plain selects, a search
box), not copying working JS from it.

## Current state

- `FrontEnd/src/views/TransactionsView.vue` — fetches `Transaction[]` for the selected date range
  via `getTransactions(startDate, endDate)` and renders them directly in `<tbody>`; the only
  filter today is the date-range `<select>` at `.filter-bar`, which triggers a re-fetch
  (`watch(selectedRange, fetchTransactions)`).
- `FrontEnd/src/constants/categories.ts` — `CATEGORIES` (the fixed list) and `categoryColor()`.
- `FrontEnd/src/services/transactionsService.ts` — `Transaction { account, date, description,
  category, amount }`; `account` is a plain string (e.g. `"Everyday"`), no separate accounts
  fetch is currently used on this view.
- No existing FrontEnd unit tests touch Vue components/views at all (despite `@vue/test-utils`
  being an installed dependency) - the established pattern in this codebase is pure-logic
  extraction into `utils/` (e.g. `descriptionMatching.ts`) that gets real Vitest coverage, with
  view-level/DOM behaviour left to Playwright (`FunctionalTests/`) - mirrors the equivalent
  Api convention of not unit-testing controllers directly.
- `FunctionalTests/tests/transactionListing.spec.ts` covers the existing date-range filter only.

## My calls

- **Filtering is entirely client-side over the already-fetched (date-range-scoped) transaction
  list** - consistent with how the table already renders `transactions.value` directly; no new
  API calls needed for search/account/category/needs-category.
- **Filter logic goes in a new pure `FrontEnd/src/utils/transactionFilters.ts`**
  (`filterTransactions(transactions, filters)`), not inline `computed()`s in the view - so it gets
  real Vitest unit coverage rather than relying solely on Playwright, matching this codebase's
  established split (`descriptionMatching.ts` is the precedent).
- **Search matches `description` only, case-insensitive substring** - matches the mockup's
  "Search description…" placeholder.
- **Account filter options are the distinct `account` values present in the currently-loaded
  (date-range) transactions**, not a separate `GET /settings` call - simpler, and doesn't offer an
  account that has zero transactions in the current range (which would just filter to nothing).
- **The needs-category count badge reflects the search/account/category-filtered set, before the
  needs-category toggle itself is applied** - so it updates live as you type/pick a filter, and
  answers "how many of what I'm currently looking at still need a category."
- **Dropped the mockup's page-subtitle claim** ("...before they'll show up in your reports") -
  there's no reports feature in this app yet, so that phrasing would be inaccurate; the
  needs-category count is instead only shown via the toggle chip's badge, matching what already
  exists structurally.
- **A distinct "no matches" empty state** when filters exclude everything from a non-empty range,
  separate from today's "No transactions in this range." message (which now means "the range
  itself came back empty").

## Plan

1. `FrontEnd/src/utils/transactionFilters.ts` — new pure module: `TransactionFilters` type
   (`search`, `account`, `category`, `needsCategoryOnly`) + `filterTransactions()`.
2. `FrontEnd.UnitTests/utils/transactionFilters.test.ts` — cases for each filter independently,
   combinations, and the empty/"all" sentinel values.
3. `TransactionsView.vue`:
   - New reactive state: `searchQuery`, `selectedAccount`, `selectedCategory`,
     `needsCategoryOnly`.
   - `accountOptions` computed (distinct accounts from `transactions.value`).
   - `searchAccountCategoryFiltered` computed (search+account+category only, via
     `filterTransactions`) → drives the needs-category count badge.
   - `filteredTransactions` computed (adds the needs-category toggle on top) → what the table
     renders.
   - Template: add the search `<input type="search">`, account `<select>`, category `<select>`,
     and needs-category `.chip-toggle` (with live count) to `.filter-bar`.
   - Distinguish "no transactions in this range" vs. "no transactions match your filters".
4. Styling for the new controls (search input, selects, chip toggle), matching this app's
   existing CSS variable scheme (`--bg`/`--border`/`--field-bg`/`--text`/`--text-h`/`--accent`),
   adapted from (not copied from) the mockup's own token names.
5. `FunctionalTests/tests/transactionListing.spec.ts` — extend with scenarios for search, account
   filter, category filter, and the needs-category toggle (including the live count badge).

### Verify

6. `FrontEnd.UnitTests`: `npm run test`.
7. `FrontEnd`: `npm run build` / `npm run lint`.
8. `FunctionalTests`: `npm test`.
9. Real local run via `scripts/run_local.sh` - exercise all four filters by hand in a browser.

## Checklist

- [ ] 1. `transactionFilters.ts` utility
- [ ] 2. `transactionFilters.test.ts` unit tests
- [ ] 3. `TransactionsView.vue` reactive state + computeds + template controls
- [ ] 4. Styling for the new filter-bar controls
- [ ] 5. Playwright coverage for all four filters
- [ ] 6. Verify: `FrontEnd.UnitTests` `npm run test`
- [ ] 7. Verify: `FrontEnd` `npm run build` / `npm run lint`
- [ ] 8. Verify: `FunctionalTests` `npm test`
- [ ] 9. Verify: real local run, exercised by hand

## Prompt Log

1. "start worklog for UBE-55" — fetched the Linear issue and read
   `docs/design/dashboard-mockup-calm.html`'s Transactions view in full to ground the filter-bar
   design in the actual mockup markup/CSS/behaviour rather than the ticket's one-line-per-filter
   description; read the current `TransactionsView.vue`, `categories.ts`, `transactionsService.ts`,
   and confirmed no Vue component tests exist anywhere in `FrontEnd.UnitTests` today (checked
   `@vue/test-utils` is installed but unused, and Playwright is the only thing exercising
   `TransactionsView.vue` today).
