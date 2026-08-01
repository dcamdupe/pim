# UBE-53 — Transaction classification for non-credit payments

Linear: https://linear.app/uberconcept/issue/UBE-53/transaction-classification-for-non-credit-payments

## Description

Ticket text: "Remove the references to Credit for all transaction descriptions."

The description-mapping feature (save a `DescriptionStart` → `Category` rule, auto-applied to
every matching transaction on import and reclassification) was built under UBE-48 named entirely
around "Credit" - `CreditDescriptionMapping`, `SaveCreditDescriptionMapping`,
`ApplyCreditDescriptionMappingAsync`, route `POST /mapping/credit`, etc. As confirmed earlier this
session (David asked "does the current implementation only categorise credit transactions?"),
nothing in the actual logic ever restricted this to credit-card/positive-amount transactions -
`ApplyCreditDescriptionMappingAsync` matches purely on `Description.StartsWith(...)`, with no
check on `Amount` sign or `Account.Type` anywhere. So "Credit" in the naming was always
inaccurate, not a deliberate scope restriction - this ticket is a pure rename to stop implying a
restriction that never existed.

**Not in scope:** `Account.Type.Credit` / `AccountType = 'Credit'` (`Api/Data/Account.cs`,
`FrontEnd/src/services/settingsService.ts`) is a genuinely separate concept - one of the three
account types (Credit/Transaction/Savings) a user configures in Settings. That "Credit" has
nothing to do with the description-mapping feature and stays as-is.

## Current state (every in-scope "Credit" reference)

- `Api/Data/CreditDescriptionMapping.cs` - `CreditDescriptionMapping` class (`[Id] Email` +
  `List<CreditDescriptionMappingEntry> Mappings`), `CreditDescriptionMappingEntry` (`DescriptionStart`,
  `Category`).
- `Api/Controllers/MappingController.cs` - `[HttpPost("mapping/credit")] SaveCreditDescriptionMapping(CreditDescriptionMappingRequest request)`.
- `Api/Services/ITransactionUpdateService.cs` / `TransactionUpdateService.cs` -
  `ApplyCreditDescriptionMappingAsync`, `_creditDescriptionMappings` field, `creditDescriptionMappings` ctor param.
- `Api/Services/FileProcessor.cs` - same field/param naming, calls the above.
- `Api/Repository/DynamoDbRepository.cs` - `_tableName = typeof(T).Name`, so `CreditDescriptionMapping`
  is also today's literal DynamoDB table name (see "My calls" below).
- `scripts/setup_local.sh` - creates the `CreditDescriptionMapping` table by that literal name.
- `Api.IntegrationTests/AuthorizationTests.cs` - `"/mapping/credit"` in `ProtectedEndpoints()`.
- `Api.IntegrationTests/MappingEndpointTests.cs`, `Api.UnitTests/Services/FileProcessorTests.cs`,
  `Api.UnitTests/Services/TransactionUpdateServiceTests.cs` - type refs + test method names.
- `FrontEnd/src/services/transactionsService.ts` - `saveCreditDescriptionMapping()`,
  `CreditDescriptionMappingRequestFailedError`, fetches `/mapping/credit`.
- `FrontEnd/src/views/TransactionsView.vue` - imports/calls `saveCreditDescriptionMapping`.
- `FrontEnd.UnitTests/services/transactionsService.test.ts` - matching test refs.
- `FunctionalTests/tests/transactionCategorization.spec.ts:76` - one comment mentioning
  `CreditDescriptionMapping`.

## My calls

- **New name: `DescriptionMapping`** (drop "Credit" entirely, don't substitute another qualifier)
  - matches the ticket's literal instruction and this codebase's existing plain-description
  naming (`TransactionDescriptions`, `descriptionMatching.ts`).
- **Route: `POST /mapping/credit` → `POST /mapping/description`** - keeps the existing
  `MappingController`/`mapping/...` shape (consistent with `TransactionsController`'s
  `transactions/...` pattern), just swaps the qualifier.
- **DynamoDB table (confirmed with David):** renaming the C# class changes
  `DynamoDbRepository<T>`'s table-name lookup, so add a new `DescriptionMapping` table locally
  (via `scripts/setup_local.sh`) rather than migrating the old `CreditDescriptionMapping` table's
  data - same precedent as UBE-54. The old local table/data is simply left orphaned (only ever
  held disposable local test data). David is handling the deployed AWS table himself, separately -
  not part of this worklog.
- **Test method names get the same rename** (e.g. `ApplyCreditDescriptionMappingAsync_...` →
  `ApplyDescriptionMappingAsync_...`) rather than leaving stale names on renamed subjects.

## Plan

1. `Api/Data/CreditDescriptionMapping.cs` → rename file + `CreditDescriptionMapping` →
   `DescriptionMapping`, `CreditDescriptionMappingEntry` → `DescriptionMappingEntry`.
2. `Api/Controllers/MappingController.cs` - route `mapping/credit` → `mapping/description`,
   `SaveCreditDescriptionMapping` → `SaveDescriptionMapping`, `CreditDescriptionMappingRequest` →
   `DescriptionMappingRequest`.
3. `Api/Services/ITransactionUpdateService.cs` / `TransactionUpdateService.cs` -
   `ApplyCreditDescriptionMappingAsync` → `ApplyDescriptionMappingAsync`, field/param renames.
4. `Api/Services/FileProcessor.cs` - matching field/param/call renames.
5. `Api/IoC/ServiceMapping.cs` - check for any `IRepository<CreditDescriptionMapping>` DI
   reference (generic `IRepository<>` registration - likely no change needed, verify).
6. `scripts/setup_local.sh` - create the new `DescriptionMapping` table instead of
   `CreditDescriptionMapping`.
7. `Api.IntegrationTests/AuthorizationTests.cs` - update the protected-endpoints route.
8. `Api.IntegrationTests/MappingEndpointTests.cs`, `Api.UnitTests/Services/FileProcessorTests.cs`,
   `Api.UnitTests/Services/TransactionUpdateServiceTests.cs` - rename types/test methods.
9. `FrontEnd/src/services/transactionsService.ts` - `saveCreditDescriptionMapping` →
   `saveDescriptionMapping`, `CreditDescriptionMappingRequestFailedError` →
   `DescriptionMappingRequestFailedError`, URL + error message text.
10. `FrontEnd/src/views/TransactionsView.vue` - update the import/call.
11. `FrontEnd.UnitTests/services/transactionsService.test.ts` - matching renames.
12. `FunctionalTests/tests/transactionCategorization.spec.ts` - update the one comment.

### Verify

13. `dotnet build` / `dotnet test`.
14. `FrontEnd.UnitTests`: `npm run test`.
15. `FrontEnd`: `npm run build` / `npm run lint`.
16. `FunctionalTests`: `npm test` (real stack, confirms the renamed route/table work end to end).
17. Real local run via `scripts/run_local.sh`.

## Checklist

- [ ] 1. `CreditDescriptionMapping.cs` → `DescriptionMapping.cs`
- [ ] 2. `MappingController.cs` renamed (route, action, request record)
- [ ] 3. `ITransactionUpdateService`/`TransactionUpdateService` renamed
- [ ] 4. `FileProcessor.cs` renamed
- [ ] 5. `ServiceMapping.cs` checked/updated
- [ ] 6. `scripts/setup_local.sh` new table name
- [ ] 7. `AuthorizationTests.cs` route updated
- [ ] 8. Backend tests renamed (`MappingEndpointTests`, `FileProcessorTests`,
      `TransactionUpdateServiceTests`)
- [ ] 9. `transactionsService.ts` renamed
- [ ] 10. `TransactionsView.vue` updated
- [ ] 11. `transactionsService.test.ts` renamed
- [ ] 12. `transactionCategorization.spec.ts` comment updated
- [ ] 13. Verify: `dotnet build` / `dotnet test`
- [ ] 14. Verify: `FrontEnd.UnitTests` `npm run test`
- [ ] 15. Verify: `FrontEnd` `npm run build` / `npm run lint`
- [ ] 16. Verify: `FunctionalTests` `npm test`
- [ ] 17. Verify: real local run via `scripts/run_local.sh`

## Prompt Log

1. "does the current implementation only categorise credit transactions?" (earlier in session) -
   traced `ApplyCreditDescriptionMappingAsync` and confirmed it was never actually credit-specific,
   which is the direct motivation for this ticket.
2. "start a worklog on UBE-53" - fetched the Linear issue, grepped the whole repo for every
   in-scope "Credit" reference, and distinguished them from the unrelated `Account.Type.Credit`
   concept.
3. Asked how to handle the DynamoDB table-name change from the `CreditDescriptionMapping` →
   `DescriptionMapping` rename (same class of decision as UBE-54's schema change) - confirmed: new
   local table, David handles the deployed AWS table himself.
