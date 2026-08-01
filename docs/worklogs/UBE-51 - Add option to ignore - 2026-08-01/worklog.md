# UBE-51 — Add option to ignore transactions

Linear: https://linear.app/uberconcept/issue/UBE-51/add-option-to-ignore-transactions

## Description

Ticket text:
- Update `Pim.Api.Data.Transaction` to add `Inactive (bool?)`.
- Add a "..." button on each transaction row, opening a menu of options:
  - If `Inactive`, show "set active" → `PUT /transactions` with `inactive: false`.
  - If not `Inactive`, show "set inactive" → `PUT /transactions` with `inactive: true`.
  - Reload the transaction listing when the status is changed.

This adds a way to mark a transaction as ignored (e.g. an internal transfer, a mistake, a
duplicate the app doesn't otherwise catch) without deleting it - `Inactive` is purely a flag on
the existing transaction, not a new concept the rest of the app needs to understand yet (no
dashboard/reporting feature exists to actually exclude inactive transactions from anything today -
that's future scope, not this ticket).

## Current state

- `Api/Data/Transaction.cs` - `Account`, `Date`, `Description`, `Category`, `Amount`, all
  `required`; `MatchesIdentity(a, b)` compares Date+Description+Amount+Account only - `Category`
  is deliberately excluded since it's edited after import. `Inactive` should follow the same
  precedent (excluded from identity, since it's also a post-import edit).
- `PUT /transactions` (`TransactionsController.UpdateTransactions` →
  `TransactionUpdateService.UpdateTransactionsAsync`) already accepts a full `List<Transaction>`
  and overwrites whichever stored transaction `MatchesIdentity` finds a match for - this already
  generically carries any field on `Transaction`, `Inactive` included, with zero backend service
  changes needed beyond adding the property itself.
- `GET /transactions` (`TransactionQueryService.GetTransactionsAsync`) has no filtering beyond
  the date range - returns inactive transactions the same as any other. Not changing this: the
  ticket doesn't ask for inactive transactions to disappear from the listing, only to be
  toggleable and (per "My calls" below) visually distinguishable.
- `FrontEnd/src/views/TransactionsView.vue` - the existing per-row "change category" `<select>`
  is the only per-row interactive control today; no existing per-row popover-menu pattern. The
  navbar (`FrontEnd/src/components/NavBar.vue`) has a hover-triggered profile menu
  (`.profile-wrap:hover .menu`), which isn't the right interaction model for a table (hovering
  over any part of many rows while scrolling would pop menus open) - the ticket says "clicking
  this bring up a menu", so this needs its own click-toggled/click-outside-to-close popover.
  Re-uses the same `.menu`/`.menu-item` visual language, not the same trigger mechanism.
- `FrontEnd/src/views/TransactionsView.vue`'s `<style>` already defines an unused
  `.chip.chip-muted` class (copied over from the dashboard mockup's CSS, never referenced in this
  view's template) - a ready-made "muted/archived" visual language.

## My calls

- **`Inactive` is excluded from `Transaction.MatchesIdentity`**, matching the existing `Category`
  precedent and for the same reason (it's expected to be edited after import, not part of what
  makes a transaction "the same transaction").
- **`GET /transactions` keeps returning inactive transactions unfiltered.** The ticket only asks
  for a toggle + reload, not for inactive transactions to be hidden from the listing - and hiding
  them would make the "set active" side of the toggle unreachable (nothing left to click on). If a
  future ticket wants inactive transactions excluded from some other view (dashboard aggregates,
  etc.), that's separate scope.
- **A visual indicator for inactive transactions is in scope**, even though not explicitly
  requested: without one, the feature is silent - a user would have to open the "..." menu on
  every single row just to check whether it's already inactive. Kept minimal: the row is dimmed
  and gets a small "Inactive" chip in the description cell, reusing the already-defined-but-unused
  `.chip.chip-muted` style rather than inventing a new visual language.
- **New "Actions" table column** (icon-only header, no visible label) holds the "..." button - a
  per-row global action, not related to any single existing column, so it doesn't belong folded
  into Category or Description.
- **Only one row's menu can be open at a time**, closed by: picking an option, clicking anywhere
  else on the page (a single `document` click listener), or - implicitly - a listing reload
  (`transactions.value` is replaced wholesale, so a stale open-menu index is reset alongside it).
- **No new backend endpoint** - reuses `PUT /transactions` exactly as the ticket specifies, so
  `Api.IntegrationTests/AuthorizationTests.cs`'s `ProtectedEndpoints()` needs no new entry (that
  route is already listed).

## Plan

### Backend

1. `Api/Data/Transaction.cs` - add `public bool? Inactive { get; set; }` (not `required`, so
   existing stored transactions without this field keep deserializing fine - purely additive,
   no data migration needed, unlike UBE-53's schema rename).
2. `Api.UnitTests/Services/TransactionUpdateServiceTests.cs` - add a case confirming
   `UpdateTransactionsAsync` round-trips `Inactive` (both directions: null→true, true→false).
3. `Api.IntegrationTests/TransactionsEndpointTests.cs` - add an end-to-end case: upload, `PUT`
   with `inactive: true`, `GET` again and confirm it comes back set; then unset it.

### FrontEnd

4. `FrontEnd/src/services/transactionsService.ts` - add `inactive: boolean | null` to the
   `Transaction` interface.
5. `FrontEnd/src/views/TransactionsView.vue`:
   - `openMenuIndex` (which row's popover is open, if any), `toggleInactiveError`.
   - `toggleInactive(transaction)`: closes the menu immediately, `PUT`s the transaction with
     `inactive` flipped, then re-fetches the listing (per the ticket's explicit "reload" step) -
     unlike the category-select path, which updates local state in place without a full reload.
   - `document` click listener (mounted/unmounted) to close an open row menu on an outside click.
   - New "Actions" column: "..." icon button + click-toggled popover with "Set active"/"Set
     inactive" depending on `t.inactive`.
   - Dim inactive rows, add an "Inactive" `.chip.chip-muted` next to the description.
6. Styling for the new column/button/popover, consistent with the app's existing icon-button and
   menu look (`NavBar.vue`'s `.icon-btn`/`.menu`/`.menu-item`).

### Playwright

7. New scenario (own spec file, `transactionIgnore.spec.ts`) - upload a transaction, toggle it
   inactive via the menu, confirm the listing reloads showing the inactive indicator, toggle it
   back active, confirm the indicator clears.

### Verify

8. `dotnet build` / `dotnet test`.
9. `FrontEnd.UnitTests`: `npm run test` (no logic change expected here, just confirms nothing
   else broke).
10. `FrontEnd`: `npm run build` / `npm run lint`.
11. `FunctionalTests`: `npm test`.
12. Real local run via `scripts/run_local.sh`.

## Checklist

- [x] 1. `Transaction.cs` - `Inactive (bool?)`
- [x] 2. `TransactionUpdateServiceTests.cs` - `Inactive` round-trip coverage (2 new cases:
      set/clear)
- [x] 3. `TransactionsEndpointTests.cs` - end-to-end `Inactive` coverage (`PUT` → `GET` → `PUT`
      back, confirms it round-trips through the real serialized response, not just the repository
      mock) - `dotnet build`/`dotnet test`: 62/62 unit + 32/32 integration pass
- [x] 4. `transactionsService.ts` - `Transaction.inactive` (also updated the two existing test
      fixtures/files that construct typed `Transaction[]` literals - `transactionFilters.test.ts`,
      `transactionsService.test.ts` - to include the new required field)
- [x] 5. `TransactionsView.vue` - state, `toggleInactive`, outside-click close, template
- [x] 6. Styling for the Actions column/menu/inactive-row indicator
- [x] 7. Playwright: `transactionIgnore.spec.ts` - covers toggling inactive→active, the
      "Inactive" indicator, an unrelated row staying untouched, and the outside-click-closes-menu
      behaviour
- [x] 8. Verify: `dotnet build` / `dotnet test` - 62/62 unit + 32/32 integration pass
- [x] 9. Verify: `FrontEnd.UnitTests` `npm run test` - 49/49 pass
- [x] 10. Verify: `FrontEnd` `npm run build` / `npm run lint` - both clean (note: this session's
      shell had a stale `PATH` pinned to node v11 from before `nvm`'s default alias was updated to
      22 - fixed by chaining `source ~/.nvm/nvm.sh && nvm use default` into the same command as
      each FrontEnd npm invocation, since shell state doesn't persist across separate tool calls)
- [x] 11. Verify: `FunctionalTests` `npm test` - 11/12 pass; the 1 failure is `settings.spec.ts`'s
      pre-existing, already-documented stale-account flakiness, unrelated
- [x] 12. Verify: real local run - restarted the stack via `scripts/run_local.sh` (picks up the
      new code), ran the full Playwright suite against it, and took a screenshot confirming the
      dimmed row + "Inactive" chip + Actions button all render correctly end to end

## Prompt Log

1. "start worklog for UBE-51" - fetched the Linear issue, read the current `Transaction.cs`,
   `TransactionsView.vue`, `NavBar.vue` (for the existing menu pattern) and
   `TransactionQueryService`/`TransactionUpdateService` to confirm the PUT path already generically
   carries a new field with no service-layer changes needed.
2. "start work" - implemented steps 1-4 (backend + `Transaction.inactive`), then "why are you
   running nvm.sh?" interrupted a `FrontEnd` build - this session's shell had `node` pinned to v11
   from before `nvm`'s default alias was updated to 22, and (per the harness) shell state doesn't
   persist between separate tool calls, so a one-off `nvm use` doesn't stick; resolved by chaining
   `source ~/.nvm/nvm.sh && nvm use default` into the same command as each FrontEnd npm call for
   the rest of this worklog. Continued through steps 5-12 to completion.
