# UBE-50 — Add qif support

Linear: https://linear.app/uberconcept/issue/UBE-50/add-qif-support

## Description

Add support for importing the QIF file format alongside the existing TM Bank CSV format. The
upload pipeline currently assumes CSV unconditionally (`ICsvParser`/`ICSVParserFactory` build a
`CsvReader` up front and hand it to a single hard-coded `TmBankCsvParser`). This ticket
generalises that pipeline to dispatch on the uploaded file's name, and adds a `QifParser` for the
`.qif` format, per four real example exports attached to the Linear issue (`TMBank.qif`,
`amex.qif`, `Macquarie Offset.qif`, `Westpac Card.qif`).

Renames required by the ticket: `CsvProcessor` → `FileProcessor` (+ `ICsvProcessor` →
`IFileProcessor`), `CSVParserFactory` → `FileParserFactory` (+ `ICSVParserFactory` →
`IFileParserFactory`, whose `Create` signature changes from `(CsvReader reader)` to
`(Stream fileStream, string fileName)`), `ICsvParser` → `IFileParser`.

## What I found in the four example QIF files

Downloaded and inspected all four attachments. Every record in every file is `D`/`T` plus some
subset of `P` (Payee), `M` (Memo), `N` (Number), `L` (Category/class), terminated by a `^` line:

| File | Header | Date format | Fields present (every record) | Description source |
|---|---|---|---|---|
| `TMBank.qif` | `!Type:Bank` | `dd/MM/yy` | D, M, T | `M` (only field available) |
| `amex.qif` | `!Type:CCard` | `dd/MM/yyyy` | D, N, T, P, M | `P` (`M` is blank in 651/670 rows, occasionally has extra foreign-spend detail in the rest) |
| `Macquarie Offset.qif` | `!Type:Bank` | `dd/MM/yy` | D, P, N, T | `P` (`N` is always blank) |
| `Westpac Card.qif` | `!Type:Bank` | `dd/MM/yyyy` | D, M, T, L | `M` (`L` is a coarse type like `OTHER`/`PAYMENT`, not a description) |

Also noted: `amex.qif` separates records with a blank line after each `^`; the other three don't.
Amounts are plain decimals with an explicit sign (no parentheses, no thousands separators) in all
four files, so no special number-parsing logic is needed beyond what `TmBankCsvParser` already
does for `T`.

## My calls

- **Description = `P` (Payee) if present and non-blank, else `M` (Memo).** Derived directly from
  the table above — this rule alone produces a correct description for all four sample files
  without needing per-bank special-casing.
- **Date parsing handles both 2- and 4-digit years** (`dd/MM/yy` and `dd/MM/yyyy` both appear
  across the real files) — try 4-digit first, fall back to 2-digit.
- **Unrecognised file extensions throw and are caught by `FileProcessor`'s existing broad
  catch**, surfacing as the same `400 "Could not parse the uploaded file."` the controller
  already returns for a malformed CSV — no new API contract/response shape for this case.
- **`N` and `L` fields are read but not used for anything** (no `Transaction` field they map to
  today - `L`/category is set later via `CreditDescriptionMapping`, not from the source file).
- **`TmBankCsvParser` and `CsvParseException` keep their names.** The ticket's rename list is
  explicit and doesn't include them; `TmBankCsvParser` is one of (now) two concrete parsers
  behind `IFileParser`, same relationship `QifParser` will have.
- **Frontend scope (confirmed with David):** also widen `TransactionUploadView.vue`'s file input
  from `accept=".csv"` to `accept=".csv,.qif"` — otherwise the feature isn't reachable through the
  upload UI even once the backend supports it. Not in the ticket's own change list, but needed
  for the feature to actually be usable end-to-end.

## Plan

### Backend

1. `Api/Services/CSVParsers/ICsvParser.cs` → rename interface to `IFileParser` (same
   `Parse(string account)` signature).
2. `Api/Services/CSVParsers/TmBankCsvParser.cs` → implement `IFileParser` instead of
   `ICsvParser` (class name unchanged).
3. `Api/Services/CSVParsers/ICSVParserFactory.cs` → rename to `IFileParserFactory`, change
   `Create(CsvReader reader)` to `Create(Stream fileStream, string fileName)`.
4. `Api/Services/CSVParsers/CSVParserFactory.cs` → rename class to `FileParserFactory`,
   implement the new signature: build the `CsvReader` internally and return `TmBankCsvParser`
   for `.csv`, return a new `QifParser` for `.qif`, throw for anything else.
5. New `Api/Services/CSVParsers/QifParser.cs` implementing `IFileParser`: parse `D`/`T`/`P`/`M`
   fields per record (`^`-terminated, blank separator lines tolerated), description = `P` else
   `M`, date tried as `dd/MM/yyyy` then `dd/MM/yy`.
6. `Api/Services/ICsvProcessor.cs` → rename interface to `IFileProcessor`.
7. `Api/Services/CsvProcessor.cs` → rename class to `FileProcessor`; `ProcessAsync` now calls
   `_fileParserFactory.Create(file.OpenReadStream(), file.FileName)` instead of constructing a
   `CsvReader` itself.
8. `Api/IoC/ServiceMapping.cs` — update DI registrations to the renamed types.
9. `Api/Controllers/TransactionsController.cs` — update the injected type to `IFileProcessor`.
10. Rename/update backend tests: `CsvProcessorTests` → `FileProcessorTests`,
    `CSVParserFactoryTests` → `FileParserFactoryTests` (extended for `.qif`/unrecognised
    extensions), new `QifParserTests` covering all four real-file shapes (TMBank-style
    memo-only, amex-style payee + blank memo + blank-line separators, Macquarie-style payee +
    blank number, Westpac-style memo + class label).
11. Integration test: extend `Api.IntegrationTests` with a `.qif` end-to-end upload (reuse a
    trimmed real sample).

### FrontEnd

12. `FrontEnd/src/views/TransactionUploadView.vue` — `accept=".csv"` → `accept=".csv,.qif"`.

### Verify

13. `dotnet build` / `dotnet test`.
14. `FrontEnd`: `npm run build` (confirms the trivial template change doesn't break the build).
15. Real local run via `scripts/run_local.sh` — upload one of the real `.qif` sample files,
    confirm transactions appear correctly.

## Checklist

- [ ] 1. `ICsvParser` → `IFileParser`
- [ ] 2. `TmBankCsvParser` implements `IFileParser`
- [ ] 3. `ICSVParserFactory` → `IFileParserFactory`, new `Create(Stream, string)` signature
- [ ] 4. `CSVParserFactory` → `FileParserFactory`, dispatches on file extension
- [ ] 5. `QifParser` implemented
- [ ] 6. `ICsvProcessor` → `IFileProcessor`
- [ ] 7. `CsvProcessor` → `FileProcessor`
- [ ] 8. `ServiceMapping` DI updated
- [ ] 9. `TransactionsController` updated
- [ ] 10. Backend unit tests renamed/updated + new `QifParserTests`
- [ ] 11. Integration test for `.qif` upload
- [ ] 12. FrontEnd `accept` attribute widened to include `.qif`
- [ ] 13. Verify: `dotnet build` / `dotnet test`
- [ ] 14. Verify: `FrontEnd` `npm run build`
- [ ] 15. Verify: real local run with a real `.qif` sample

## Prompt Log

1. "start worklog on UBE-50" — fetched the Linear issue, downloaded and inspected all four
   attached example `.qif` files to ground the parser design in real data rather than a generic
   spec reading.
2. Asked whether the FrontEnd upload accept attribute should be widened too, since the ticket's
   own change list is backend-only but the feature isn't reachable from the UI without it —
   confirmed: include it.
