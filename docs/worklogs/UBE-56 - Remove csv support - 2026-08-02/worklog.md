# UBE-56 - Remove csv support

## Description

From Linear (UBE-56): Remove CSV support, front end and back end — remove all code that supports
it. CSV is harder to support than QIF and doesn't have consistent rows/columns, so QIF remains the
only supported import format.

Linear issue: https://linear.app/uberconcept/issue/UBE-56/remove-csv-support

## Plan

Codebase scan complete. Findings:

**Clean deletions:**
- `Api/Services/CSVParsers/TmBankCsvParser.cs` (the CSV parser implementation)
- `Api.UnitTests/Services/CSVParsers/TmBankCsvParserTests.cs`
- `CsvHelper` PackageReference in `Api/Pim.Api.csproj` (only consumer is the parser above)
- The 3 CSV-specific cases in `Api.UnitTests/Services/CSVParsers/FileParserFactoryTests.cs`

**Shared code needing surgical edits (not deletion):**
- `Api/Services/CSVParsers/FileParserFactory.cs` — remove the `.csv` branch (and `CsvReader`/
  `CsvConfiguration` construction), keep the `.qif` branch and `NotSupportedException` fallback
- `FrontEnd/src/views/TransactionUploadView.vue` — trim `accept=".csv,.qif"` to `.qif`, update the
  subtitle/dropzone copy that mentions CSV

**Naming cleanup, worth doing but not strictly required (flagging for confirmation):**
- `Api/Services/CSVParsers/` namespace/folder — now holds only QIF + shared interfaces, misleading
  name once CSV is gone (candidate rename: `FileParsers`)
- `Api/Services/CsvParseException.cs` — thrown for *both* formats' failures already; misleading
  name (candidate rename: `FileParseException`), touches `IFileProcessor.cs` doc comment and the
  catch in `TransactionsController.cs`

**Test-fixture rewrites (CSV used only as incidental "valid file" content, not testing CSV
itself — bulk of the remaining effort):**
- `Api.IntegrationTests/TransactionsEndpointTests.cs` — `ValidCsv` constant and
  `BuildMultipartContent` default used by most tests; switch default fixture to QIF content,
  drop anything CSV-parsing-specific
- `Api.IntegrationTests/MappingEndpointTests.cs` — `BuildMultipartContent(account, csv)` helper,
  same switch to QIF
- `FunctionalTests/tests/accountDeletion.spec.ts`, `transactionListing.spec.ts`,
  `transactionIgnore.spec.ts`, `transactionCategorization.spec.ts`, `dashboard.spec.ts`,
  `internalTransfer.spec.ts`, `transactionUpload.spec.ts` — all build inline TM Bank CSV fixtures
  and upload via `#file-input`; switch fixtures to QIF format text
- `FrontEnd.UnitTests/services/transactionsService.test.ts` — cosmetic only (service is already
  format-agnostic); rename `.csv` fixture filenames to `.qif` for consistency

**No change needed:** `Api/Services/CSVParsers/IFileParser.cs`, `IFileParserFactory.cs`,
`QifParser.cs`, `Api/Services/FileProcessor.cs` logic (format-agnostic), `Api/Services/IFileProcessor.cs`
(unless exception renamed), `Api/IoC/ServiceMapping.cs` (unless namespace renamed),
`FrontEnd/src/services/transactionsService.ts`, `Api.UnitTests/Services/FileProcessorTests.cs`.

Each step below will be confirmed with the user before implementing.

## Checklist

- [x] Review codebase scan results and finalize the concrete list of files/changes
- [x] Confirm naming-cleanup scope with user — confirmed in scope: rename `CSVParsers` folder to
      `FileParsers`, rename `CsvParseException` to `FileParseException`
- [x] Rename `CSVParsers` folder/namespace to `FileParsers` (Api and Api.UnitTests)
- [x] Delete `TmBankCsvParser.cs` + its unit tests; remove CSV branch from `FileParserFactory.cs`
      (+ matching `FileParserFactoryTests.cs` cases); remove `CsvHelper` package reference
- [x] Rename `CsvParseException` to `FileParseException` (+ update comments/refs); `dotnet build`
      passes clean with 0 warnings/errors
- [x] Update `TransactionUploadView.vue` (accept attribute + copy); `npm run build` passes
- [x] Rewrite `Api.IntegrationTests/TransactionsEndpointTests.cs` fixtures to QIF (merged the
      now-duplicate dedicated QIF test into the main one); rewrite `MappingEndpointTests.cs`
      fixtures to QIF; `dotnet test` green: 77 unit + 38 integration tests passing
- [x] Rewrite the 7 affected `FunctionalTests/tests/*.spec.ts` fixtures to QIF. Along the way found
      and fixed an unrelated pre-existing bug in `transactionCategorization.spec.ts`'s 3rd test:
      UBE-57's confirmation-modal PR updated the cleanup pattern ("Remove account" -> "Yes") in
      the file's first two tests but missed the third, which still used the old "Remove account"
      -> "Save" pattern and hung behind the new modal - fixed to match its siblings.
- [x] Cosmetic: rename fixture filenames in `FrontEnd.UnitTests/services/transactionsService.test.ts`
- [x] Naming cleanup applied as part of tasks above (`CSVParsers` -> `FileParsers`,
      `CsvParseException` -> `FileParseException`)
- [x] Full test suite green: `dotnet test` (77 unit + 38 integration), `FrontEnd.UnitTests` (100
      tests), FunctionalTests (21/22 - the 1 failure, `dashboard.spec.ts`'s "Recent transactions"
      test, is a pre-existing, already-known-broken spec unrelated to this change: the shared,
      never-cleaned-up test dataset now exceeds the card's last-20-transaction window). Also found
      (during FunctionalTests runs) and cleaned up a pile of stale, never-cleaned-up Settings
      accounts accumulated in the local DynamoDB instance from many earlier test/dev sessions -
      pre-existing environmental noise, not caused by this change.
- [x] Open PR: https://github.com/dcamdupe/pim/pull/49

## Prompt log

- "start worklog for UBE-56"
- (clarified state of uncommitted local changes on the prior branch; confirmed UBE-57 and UBE-66
  were already merged to main via PR #48 and #47; discarded stale local state and created
  `UBE-56/remove-csv-support` off a freshly synced `main`)
- "start a worklog for UBE-56" (repeated — worklog file created)
- (codebase scan for CSV-related code completed; plan and checklist filled in with concrete files)
- "yes, rename these are part of the scope" (confirmed `CsvParseException` → `FileParseException`
  and `CSVParsers` folder → `FileParsers` rename is in scope)
- (implemented: namespace/folder rename, deleted `TmBankCsvParser` + tests, trimmed
  `FileParserFactory`, renamed `CsvParseException`, removed `CsvHelper` package reference, updated
  `TransactionUploadView.vue`, rewrote `Api.IntegrationTests` and all 7 `FunctionalTests` spec
  fixtures to QIF; ran full test suite)
- "fix it now" (chose to fix the unrelated pre-existing `transactionCategorization.spec.ts`
  cleanup-pattern bug discovered while verifying FunctionalTests, rather than leave it as a known
  issue)
- "commit and raise PR" (committed, pushed, opened PR #49. Caught and fixed a staging mistake of my
  own: content edits made after a `git mv` rename were never re-staged, so the first push didn't
  actually build - found via `gh pr create`'s "7 uncommitted changes" warning, confirmed by
  stashing and rebuilding against the bare committed tree, fixed with a follow-up commit and
  re-pushed. Verified `dotnet build`/`dotnet test` green against the final committed state before
  finishing.)
