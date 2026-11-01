# UBE-118: Implement insights tab

## Linear issue

https://linear.app/uberconcept/issue/UBE-118/implement-insights-tab

> Implement the design in docs: docs/design/spending-trends-mockup.html
>
> * use already stored client side data
> * Add a new menu item into the top nav, in the same style as Dashboard and Transactions

## Description

Builds the "Spending trends" page from `docs/design/spending-trends-mockup.html` as a new
**Insights** tab (`/insights`) in the web top nav (`NavBar.vue`). Everything is computed on the
client from the transactions already loaded in the Pinia transactions store and the categories in
the settings store, so there are no Api changes. The issue doesn't mention iOS, so this is
**web only**.

The page compares the selected month with the month before, per expense category:
- **Summary row:** total spending (with % and $ change), "Spending more" / "Spending less"
  (category counts + combined change), and the biggest change.
- **Groups:**
  - "Spending more" and "Spending less" list flagged categories: change ≥ **$50** and
    ≥ **20%**, or new this month.
  - Each card shows a % pill, tags, a one-line headline, a 6-month sparkline and the $ change.
  - "Smaller changes" is a collapsible table of everything else.
- **Tags:** New this month, Highest in 6 months, Lowest in 6 months, Rising 3 months, Looks
  quarterly (same rules as the mockup's `analyse()`).
- **Detail panel** for the selected category:
  - Headline and facts: this month, last month, vs 6-month average.
  - A 6-month bar chart (selected month highlighted, previous month dimmed, dashed 6-month
    average line).
  - A "What changed" table.
  - A "View <category> transactions for <month> →" link to
    `/transactions?range=month:YYYY-MM&category=…`, which already exists.

## Plan

**Choices (confirmed 2026-11-01):**
1. **Default month:** the last full month, e.g. October now. The current partial month would
   nearly always show as "spending less". The ‹ › stepper moves between months from
   `MinTransactionDate` up to the current month.
2. **"What changed" grouping:** spend is grouped by merchant, meaning the description's first
   word with digits and punctuation stripped, so "WOOLWORTHS 1294 HORNSBY" becomes WOOLWORTHS.
   The note reads "N visits, was M" when the count changed, "Grouped: N descriptions" when more
   than one description was merged, "Not seen in <month>" or "New". The table shows the top 8
   merchants by absolute change.
3. **Threshold chip:** "Flag changes over 20% and $50" is shown as fixed text, not editable.
4. **Spend rules:** the same as the dashboard: net spend per category, ignored transactions
   skipped, and uncategorised money-out grouped as "Uncategorised".
5. **Empty state:** if nothing is flagged, show "No big changes this month", with the smaller
   changes still listed.

**Steps**
1. **Insights calculations:** `FrontEnd/src/utils/spendingInsights.ts`, pure functions:
   - per-category 6-month series
   - analyse (change, ratio, average, tags, flagged)
   - grouping and summary
   - drivers (by merchant)
   - month navigation helpers
   - Thorough unit tests in FrontEnd.UnitTests.
2. **Components:** `InsightCard.vue` (card + sparkline), `InsightDetail.vue` (facts, bar chart,
   drivers table, link), `Sparkline.vue`. All SVG, no new library. Styling follows the mockup
   using the app's existing CSS variables, with red/green from the mockup's `--up`/`--down`.
3. **Page and nav:** `InsightsView.vue`, the `/insights` route, and an "Insights" tab in
   `NavBar.vue` after Transactions (Budgets comes after it). The selected month and category are
   kept on the page only.
4. **Playwright:** new `insights.spec.ts`. It uploads a few transactions with unique descriptions
   across two months, then checks the page structure: the tab, the stepper, a flagged category
   card and its detail panel, and the "View transactions" link. Exact amounts aren't checked,
   since they depend on the shared test user's data.
5. **Checks:** FrontEnd build/lint, unit tests and the new spec.

## Checklist

- [x] `spendingInsights.ts` + unit tests
- [x] Sparkline (`SpendSparkline.vue`), InsightCard, InsightDetail components
- [x] `InsightsView.vue`, `/insights` route, NavBar tab
- [x] Playwright `insights.spec.ts`
- [x] Checks: FrontEnd build/lint/unit, Playwright spec

## Results

- **Calculations:** `utils/spendingInsights.ts` (series, analyse/tags/flagging, grouping, summary,
  headline, `merchantKey`, `computeDrivers`, month helpers) with 20 unit tests.
- **Components:**
  - `SpendSparkline.vue` (renamed from `Sparkline`; lint requires multi-word names).
  - `InsightCard.vue`.
  - `InsightDetail.vue`: facts, the bar chart with the average line, the "What changed" table,
    and a "View … transactions" link. The link is hidden for Uncategorised, since the
    Transactions page has no deep-link filter for it.
- **Page:** `InsightsView.vue`.
  - **Navigation:** the `/insights` route and an "Insights" nav tab after Transactions.
  - **Default month:** the last full month, re-defaulted until the user steps.
  - **Detail panel:** defaults to the biggest change; "Smaller changes" names are clickable too.
  - **Styling:** mockup red/green pill colours as page-scoped CSS variables (light + dark).
- **`insights.spec.ts`:**
  - Uploads a $25,000 uncategorised spend into a throwaway account, then checks the tab, the
    default month label, the flagged "Uncategorised" card, the detail panel + drivers row and
    the stepper.
  - Deletes the account (and so its transactions) in a `finally`.
  - The first run's cleanup used an `input[value=…]` selector that doesn't match Vue-bound
    inputs. That left the account behind, and I removed it via `DELETE /settings/account` on
    the local Api. I switched to the `findAccountRow` pattern from `accountDeletion.spec.ts`.
- **Checks:**
  - FrontEnd build/lint clean; FrontEnd.UnitTests 261 passing.
  - Playwright: `insights` + `dashboard` + `transactionCategorization`: 13/14 on the first run.
    `dashboard.spec.ts` "Dashboard tiles" failed once, then passed alone and in 2 further
    insights + dashboard runs (6/6 each). Cause not identified.
- **Known data:** a stale "Playwright Listing Account" (from the UBE-124 full-suite run) is still
  on the shared test user. Not touched here.

## Log

### Prompt
start a worklog for UBE-118

### Response
Fetched UBE-118 (no comments), read the mockup and the existing nav, metrics and transactions
deep link. Pulled `main`, created branch `UBE-118/implement-insights-tab` and this worklog. Asked
to confirm the plan and the five choices.

### Prompt
yes, get started

### Response
Plan and all five choices confirmed; starting implementation.
Implemented calculations, components, page, route and nav, plus unit and Playwright tests. Cleaned
up a leftover test account from a failed run. All checks pass (one intermittent dashboard test,
see Results). Not committed.

### Prompt
commit and raise PR as draft

### Response
Committed, pushed and opened a draft PR against main.
