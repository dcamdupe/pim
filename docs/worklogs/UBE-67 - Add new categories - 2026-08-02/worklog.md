# UBE-67: Add new categories

Linear: https://linear.app/uberconcept/issue/UBE-67/add-new-categories
Status: In Progress · Priority: No priority

## Description (from Linear)

* Medical
* Subscriptions

## Plan

`FrontEnd/src/constants/categories.ts` is the single source of truth for the category list (per
UBE-48) - `CATEGORIES` and `CATEGORY_COLORS` both live there, and everything else (the category
`<select>` in `TransactionsView.vue`, the dashboard's spending-by-category doughnut, etc.) derives
from it generically, with no special-casing per category. The Api doesn't validate/whitelist
category names server-side (`Transaction.Category` is a free-form string) - this is purely a
FrontEnd data change.

1. Add `'Medical'` and `'Subscriptions'` to `CATEGORIES`.
2. Add matching `CATEGORY_COLORS` entries - picked two hues distinct from all 10 existing colors:
   `Medical: '#0891b2'` (cyan) and `Subscriptions: '#c026d3'` (fuchsia).
3. Add a small `categories.test.ts` unit test asserting every category in `CATEGORIES` has a
   `CATEGORY_COLORS` entry and that all colors are unique - cheap guard against exactly this kind
   of omission in future additions (there wasn't a dedicated test file for this yet).
4. Manual browser check: new categories appear in the Transactions category filter/select, and a
   transaction categorized as one of them shows up correctly (chip colour, dashboard doughnut
   slice) - light + dark mode.
5. `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests`.

Not planning a new Playwright scenario for this - it's page-config data, not new behavior; the
existing category-select/filter flows already exercise the mechanism generically.

## Checklist

- [x] Add `Medical` / `Subscriptions` to `CATEGORIES` + `CATEGORY_COLORS`
- [x] `categories.test.ts` (all categories have a color, colors unique) - 4/4 passing
- [x] Manual browser check (light + dark mode) - both new categories appear in the row category
      select and the filter-bar select, Medical's dot color matches exactly (#0891b2)
- [x] `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests` pass (98/98)

## Prompt log

- "start a worklog for UBE-67"
