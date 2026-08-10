# UBE-83 — Validate account name when importing files

Linear issue: https://linear.app/uberconcept/issue/UBE-83/validate-account-name-when-importing-files
PR: https://github.com/dcamdupe/pim/pull/68

## Description

"Check the account exists" — `POST /transactions/file` (`TransactionsController.UploadFile`) only
validates that `request.Account` is non-blank; it never checks that the name matches one of the
authenticated user's configured `Account`s before parsing the file and persisting transactions
under it. Api-only scope (confirmed with David) — the FrontEnd's upload page already only offers a
`<select>` of the user's real configured accounts (`TransactionUploadView.vue`), so this can't be
triggered from the UI; it's a hardening fix for direct API callers (e.g. the `FileDownloader` tool,
or a typo'd `.env`/script), where a mistyped account name currently succeeds silently and creates
transactions under a name that isn't in Settings at all.

## Investigation

- `Api/Controllers/TransactionsController.cs:31-51` — `UploadFile`'s only validation today is
  `string.IsNullOrWhiteSpace(request.Account) || request.File.Length == 0`. No check against
  `User.Accounts`.
- `Api/Data/User.cs` / `Api/Data/Account.cs` — `User.Accounts` is a `List<Account>`, each with a
  `Name`. `Api/Controllers/SettingsController.cs:73` is the existing precedent for matching by name:
  plain ordinal `a.Name == request.Name` (no case-insensitivity) — the fix should match that
  convention.
- `Api/Services/FileProcessor.cs` already injects `IRepository<User>` (used in
  `UpdateMinTransactionDateAsync`), but the natural place for this check is the controller, in the
  same spot as the existing blank-account/empty-file validation — it's request validation, not file
  processing, and keeps `FileProcessor` focused on the file itself.
- Three `Api.IntegrationTests` files POST to `/transactions/file` against accounts ("Everyday",
  "Savings") that are **never seeded** into the test user's `Accounts` in their own
  `InitializeAsync` — they only pass today because nothing checks. Adding the validation will break
  all of them until accounts are seeded:
  - `TransactionsEndpointTests.cs` (uses "Everyday" and "Savings")
  - `MappingEndpointTests.cs` (uses "Everyday")
  - `RequestResponseLoggingTests.cs` (uses "Everyday", in `Post_TransactionsFile_LogsTheRequestWithoutTheFileContent`)

## Plan

1. `TransactionsController.UploadFile`: inject `IRepository<User>`, load the user, and extend the
   existing validation block to also return `BadRequest` when no `Account` in `user.Accounts`
   matches `request.Account` (ordinal, matching `SettingsController`'s convention).
2. Update `InitializeAsync` in `TransactionsEndpointTests.cs`, `MappingEndpointTests.cs`, and
   `RequestResponseLoggingTests.cs` to seed the account name(s) each file's tests actually upload
   against ("Everyday" everywhere, plus "Savings" in `TransactionsEndpointTests.cs`), so existing
   tests keep passing.
3. Add a new test (`TransactionsEndpointTests.cs`) asserting `BadRequest` when uploading against an
   account name not in `user.Accounts`.
4. Confirm `/transactions/file` is already in `AuthorizationTests.cs`'s `ProtectedEndpoints()` list
   (it is, per the earlier grep) — no change needed there, just noting it stays covered.
5. `dotnet build` / `dotnet test`.

## Checklist

- [x] `TransactionsController.UploadFile` — validate the account exists on the user
- [x] Seed accounts in `TransactionsEndpointTests.cs`'s `InitializeAsync`
- [x] Seed accounts in `MappingEndpointTests.cs`'s `InitializeAsync`
- [x] Seed accounts in `RequestResponseLoggingTests.cs`'s `InitializeAsync`
- [x] New test: `BadRequest` when the account doesn't exist
- [x] `dotnet build` / `dotnet test` pass — 85 unit + 59 integration, 0 failures
- [x] Update this worklog with results

## Session log

### Prompt: "start a worklog on UBE-83"

Retrieved issue UBE-83 from Linear. Read `TransactionsController.UploadFile`, `FileProcessor`,
`User`/`Account` data models, and `SettingsController`'s existing account-name-matching convention.
Started checking the FrontEnd upload view, but David clarified this is Api-only scope - the
FrontEnd dropdown already prevents picking a nonexistent account, so no FrontEnd change is needed
regardless. Found that three `Api.IntegrationTests` files upload against unseeded account names and
will need updating alongside the fix. Drafted the plan and checklist above and created this worklog
file.

### Prompt: "start"

Implemented the plan:

- `TransactionsController`: injected `IRepository<User>`, and `UploadFile` now loads the user and
  returns `BadRequest("Account does not exist.")` when `request.Account` doesn't match any
  `user.Accounts` entry (ordinal `==`, matching `SettingsController`'s existing convention).
- Seeded `Accounts` into the test user in `TransactionsEndpointTests.cs` ("Everyday" + "Savings"),
  `MappingEndpointTests.cs` ("Everyday"), and `RequestResponseLoggingTests.cs` ("Everyday").
- Added `Post_ReturnsBadRequest_WhenTheAccountDoesNotExist` to `TransactionsEndpointTests.cs`.
- Confirmed `/transactions/file` is already in `AuthorizationTests.cs`'s `ProtectedEndpoints()`.
- `dotnet build` and `dotnet test`: 85 unit + 59 integration tests, 0 failures.
