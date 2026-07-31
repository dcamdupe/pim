# UBE-54 — Store statistics in TransactionDescriptions Table

Linear: https://linear.app/uberconcept/issue/UBE-54/store-statistics-in-transactiondescriptions-table

## Description

Fixes a real bug in the UBE-48 category-select flow: the "apply to similar transactions?"
modal never appears when two or more transactions share the exact same description (the
common case for real bank data, e.g. `NETFLIX.COM` repeated identically), because
`TransactionDescriptions.Descriptions` is a **deduplicated** list of unique strings, and the
frontend match check (`findApproximateMatch`) excludes any candidate equal to the transaction's
own description — which, for an exact-duplicate description, is the *only* entry there is. The
existing unit test for that exclusion passes a hand-built list with the description duplicated
twice, which isn't how the real (deduplicated) cache behaves — so it gave false confidence.

This ticket fixes it by tracking per-description transaction counts (total + unclassified)
alongside each description string, maintained as CSVs are imported and as transactions are
classified, and using those counts (rather than "does a different string exist") to decide
whether to show the modal.

## Current state

- `Api/Data/TransactionDescriptions.cs` — `Email` (`[Id]`) + `List<string> Descriptions`, one
  entry per unique description ever seen for that user.
- `Api/Services/CsvProcessor.cs` — `ProcessAsync`: parses → `ApplyCreditDescriptionMappingAsync`
  (auto-sets `Category` on new transactions matching a saved `CreditDescriptionMapping` rule) →
  per-month dedup (`IsDuplicate`/`Transaction.MatchesIdentity`) → `UpdateMinTransactionDateAsync`
  → `AddNewTransactionDescriptionsAsync` (adds any description strings not already in the cache).
  The last step runs against the *original* parsed `transactions` list, not the deduped set — it
  gets away with that today only because it's tracking existence, not counts.
- `Api/Services/TransactionUpdateService.cs` — `UpdateTransactionsAsync` (backs `PUT
  /transactions`, the single-edit "No" path) and `ApplyCreditDescriptionMappingAsync` (backs
  `POST /mapping/credit`, the bulk-apply "Yes" path + upserts the `CreditDescriptionMapping` rule
  and reuses `ITransactionQueryService` to find/update every matching transaction across all
  history). Neither touches `TransactionDescriptions` today.
- `Api/Controllers/TransactionsController.cs` — `GET /transactions/descriptions` returns
  `TransactionDescriptionsResponse(List<string> Descriptions)`.
- `FrontEnd/src/services/transactionDescriptionsService.ts` — caches the raw `string[]` in
  `localStorage`, refreshed on login and after CSV upload.
- `FrontEnd/src/utils/descriptionMatching.ts` — `findApproximateMatch(description,
  otherDescriptions: string[])`: longest word-boundary-terminated common prefix wins; explicitly
  filters `other !== description`, which is the root of the bug described above.
- `FrontEnd/src/views/TransactionsView.vue` — `onCategoryChange` computes the match against
  `getCachedTransactionDescriptions()`; the modal text says "apply to
  `pendingCategoryChange.match.matchingDescriptions.length` similar transactions" — today that's
  a count of distinct *other description strings*, not actual transactions, so it already
  undercounts whenever one matched description has more than one transaction behind it.

## My calls

- **Stats are per-description, not a single per-user total.** The ticket says "store statistics
  in TransactionDescriptions table" (which is a list keyed by description) and the stated purpose
  is fixing the popup-gating bug above, which needs "how many transactions does *this*
  description have" — a per-user total wouldn't help with that.
- **"At least one transaction" (for expanding when the popup shows) means at least one *other*
  transaction than the one being edited.** For the entry matching the transaction's own
  description exactly, that means `TransactionCount > 1`; for any other prefix-matching
  description entry, its `TransactionCount` is always ≥ 1 by construction (an entry only exists
  because a transaction created it), so those always qualify once the prefix rule matches.
- **`UnclassifiedCount` is maintained on every path that changes `Category`:** CSV import (after
  `ApplyCreditDescriptionMappingAsync` has already auto-set some categories, so only genuinely
  still-empty ones count as unclassified), the single-transaction edit (`PUT /transactions`), and
  the bulk mapping-apply (`POST /mapping/credit`) — comparing old vs. new `Category` on each
  changed transaction rather than assuming direction.
- **`CsvProcessor` needs to compute stats off the actual post-dedup, post-mapping transaction
  set**, not the raw parsed list — otherwise re-uploading a CSV that contains
  already-seen transactions would inflate `TransactionCount`. This is a real (if currently
  harmless) latent bug in today's existence-only tracking that becomes a visible one once we
  count.
- **Existing `TransactionDescriptions` rows need handling, not just the schema change.**
  `DynamoDbRepository<T>` stores the whole entity as one JSON blob
  (`Api/Repository/DynamoDbRepository.cs:38`) and `JsonSerializer.Deserialize<T>`s it back —
  today's rows have `Descriptions: string[]`; once that becomes
  `List<TransactionDescriptionStat>`, deserializing an old row throws, breaking every endpoint
  that touches it (CSV upload, `GET /transactions/descriptions`, category edits) for any user
  with pre-existing data. **David's call: delete the existing row(s) rather than backfill from
  `TransactionMonth`** — simpler, at the cost of stats/matching only reflecting transactions
  imported *after* this change until the older ones are re-uploaded. Only known usage today is
  David's own local DynamoDB Local data. Confirmed with David: only the local table needs
  clearing as part of this work — he's clearing the deployed AWS table himself, manually.

## Plan

### Backend

1. Delete the existing `TransactionDescriptions` row(s) in local DynamoDB Local (David is
   clearing the deployed AWS table himself, separately).
2. `Api/Data/TransactionDescriptions.cs` — replace `List<string> Descriptions` with
   `List<TransactionDescriptionStat> Descriptions`, new nested type `Description` (string),
   `TransactionCount` (int), `UnclassifiedCount` (int).
3. `Api/Services/CsvProcessor.cs`:
   - Collect the actual set of newly-added (non-duplicate) transactions across all month groups
     in `ProcessAsync` (currently computed inline per-group and discarded).
   - Replace `AddNewTransactionDescriptionsAsync` with a stats-updating step
     (`UpdateTransactionDescriptionStatsAsync`) that runs against that collected set, after
     `ApplyCreditDescriptionMappingAsync` has run: find-or-create the stat entry by exact
     `Description`, `TransactionCount++`, and `UnclassifiedCount++` if `Category` is still empty.
4. `Api/Services/TransactionUpdateService.cs` — inject `IRepository<TransactionDescriptions>`:
   - `UpdateTransactionsAsync`: before overwriting each matched transaction, compare old vs. new
     `Category` (empty ↔ non-empty) and adjust that description's `UnclassifiedCount`
     accordingly.
   - `ApplyCreditDescriptionMappingAsync`: same before/after comparison for every transaction it
     reclassifies.
   - Persist the `TransactionDescriptions` row once at the end if anything changed.
5. `Api/Controllers/TransactionsController.cs` — update `TransactionDescriptionsResponse` to
   return the new stat shape.
6. Backend unit tests: `CsvProcessorTests` (counts accumulate correctly across uploads, a
   re-uploaded duplicate doesn't double-count, unclassified count reflects auto-applied
   mapping), `TransactionUpdateServiceTests` (stat adjustments on single-edit and bulk-apply
   paths, both directions).
7. Integration tests: extend `TransactionsEndpointTests`/`MappingEndpointTests` for the new
   response shape and end-to-end stat correctness.

### FrontEnd

8. `FrontEnd/src/services/transactionDescriptionsService.ts` — update the cached/returned type to
   the new stats shape; `getCachedTransactionDescriptions()` should treat an old-shaped cached
   value (from before this change) as empty rather than throwing.
9. `FrontEnd/src/utils/descriptionMatching.ts` — rework `findApproximateMatch` to take the stats
   list: same longest-word-boundary-prefix algorithm, but now include the description's own exact
   entry as a candidate (drop the blanket string-equality exclusion); a match requires
   "transactions other than this one" ≥ 1 per the "My calls" rule above. Return a real
   `matchingTransactionCount` (sum of qualifying entries' `TransactionCount`, minus 1 for the
   self entry if included) instead of `matchingDescriptions.length`.
10. `FrontEnd/src/views/TransactionsView.vue` — use `matchingTransactionCount` in the modal text.
11. FrontEnd unit tests: `descriptionMatching.test.ts` (exact-duplicate descriptions now match,
    accurate counts, mixed exact + prefix matches), `transactionDescriptionsService.test.ts`
    (new shape, old-shape cache tolerated).
12. Playwright: extend `transactionCategorization.spec.ts` (or add a new scenario) covering two
    transactions with the literal identical description triggering the modal with an accurate
    count.

### Verify

13. `dotnet build` / `dotnet test`.
14. `FrontEnd.UnitTests`: `npm run test`.
15. `FunctionalTests`: `npm test`.
16. Real local run via `scripts/run_local.sh` — upload a CSV with two identical descriptions,
    confirm the modal now appears with the correct count.

## Checklist

- [x] 1. Delete existing `TransactionDescriptions` row(s) in local DynamoDB Local (David clearing
      AWS himself) - deleted the one row (`testuser@example.com`, leftover Playwright test data)
- [x] 2. `TransactionDescriptions` data model: per-description stats
- [x] 3. `CsvProcessor`: stats maintained off the real post-dedup/post-mapping transaction set
- [x] 4. `TransactionUpdateService`: stats maintained on single-edit and bulk-apply paths
- [x] 5. Controller: new stats response shape (reuses the domain `TransactionDescriptionStat`
      type directly in the response, matching how `TransactionsResponse` already reuses
      `Transaction` - no separate DTO layer in this codebase)
- [x] 6. Backend unit tests (4 new/rewritten `CsvProcessorTests`, 4 new
      `TransactionUpdateServiceTests`)
- [x] 7. Backend integration tests (extended `Post_PopulatesTransactionDescriptions_...` for the
      new shape)
- [x] 8. FrontEnd transaction-descriptions service: new shape + old-cache tolerance
- [x] 9. FrontEnd `descriptionMatching.ts`: exact-duplicate fix + real transaction counts
      (`npm run build`/`npm run lint` clean)
- [x] 10. FrontEnd `TransactionsView.vue`: accurate modal count
- [x] 11. FrontEnd unit tests (4 new `descriptionMatching.test.ts` cases for the exact-duplicate
      fix + count summation, 1 new `transactionDescriptionsService.test.ts` case for old-cache
      tolerance; 41/41 pass)
- [x] 12. Playwright scenario for identical-description matching (new test in
      `transactionCategorization.spec.ts`: two transactions with the literal same description,
      confirms the modal now appears with an accurate "1 other transaction" count)
- [x] 13. Verify: `dotnet build`/`dotnet test` - 50/50 unit + 29/29 integration pass
- [x] 14. Verify: `FrontEnd.UnitTests` `npm run test` - 41/41 pass
- [x] 15. Verify: `FunctionalTests` `npm test` - 9/10 pass (both `transactionCategorization.spec.ts`
      scenarios pass, including the new one). `settings.spec.ts` failed on its pre-existing
      stale-account accumulation (documented as unrelated in the UBE-48 worklog) - hit and fixed a
      real problem first: a stale, already-running Api process from *before* this session (serving
      pre-UBE-54 code) was what the FrontEnd's `.env` actually points to
      (`VITE_API_BASE_URL=https://localhost:7010`), not the `:5037` instance I'd started per the
      README - it was silently corrupting `TransactionDescriptions` back to the old shape on every
      write, causing a 500 and the modal to never appear. Confirmed and resolved by clearing the
      corrupted row and re-running against a fresh `scripts/run_local.sh`-managed instance (David
      appears to have restarted his own local dev environment around the same time); also cleaned
      up the two Settings accounts my failed first attempt left behind.
- [x] 16. Verify: real local run via `scripts/run_local.sh` - confirmed via direct API calls
      against the running `run_local.sh` instance (upload with a duplicate description ->
      `GET /transactions/descriptions` returns the correct `transactionCount`/`unclassifiedCount`
      shape) and the full Playwright suite above, which drives the real stack in a real browser.
      David may still want to click through it by hand.

## Prompt Log

1. "start a new worklog for UBE-48. A significant item was missed. The Category column in the
   transaction listing should allow you to select the category, which then triggers other work
   described under 'When the category is selected'" — investigated the existing UBE-48
   implementation and found it already appeared complete in code.
2. "The modal pop up does not appear when selecting a transaction which has other matching
   transaction descriptions" — root-caused to the deduplicated-description-list /
   self-exclusion bug described above.
3. "I'll raise a new issue to resolve this" (in response to being asked whether to create the
   Linear issue) — David raised UBE-54 himself.
4. "start worklog on UBE-54" — this worklog.
5. "will existing data in TransactionDescriptions table need to be updated for this to work?" —
   yes; found the deserialization break in `DynamoDbRepository<T>`. Asked David whether to
   backfill from `TransactionMonth` or just delete the existing row(s); he chose delete. Added as
   plan step 1 / checklist item 1.
6. "just local, will clear AWS manually" — confirmed only the local DynamoDB Local row needs
   clearing as part of this work; David is handling the deployed AWS table himself.
7. "start work" — implemented the full plan end to end (steps 1-16) without further check-ins,
   including diagnosing and resolving the stale-server issue described in checklist item 15.
