# UBE-58: Account adjustments

Linear: https://linear.app/uberconcept/issue/UBE-58/account-adjustments
Status: In Progress · Priority: No priority

## Description (from Linear)

Remove the ability to edit the account name. Accept this as a parameter from the API, but use it as
a key rather than updating it.

Enforce uniqueness of the account name.

Remove the account number.

## Current state

- `Account` (`Api/Data/Account.cs`) has `Name`, `Number`, `Type` - stored as `User.Accounts`.
- `SettingsController.Put` (`PUT /settings`) replaces the *whole* `Accounts` list from the request
  body. It already rejects duplicate names (`HasDuplicateNames`, case-insensitive) and already
  rejects any request where an existing account's name is missing from the new list
  (`RemovesAnExistingAccount`) - since matching is name-only, **renaming an existing account already
  fails today**, just with a generic "cannot be removed via PUT" 400, not a purpose-built message.
  Editing `Number`/`Type` on an account whose name is unchanged already works today (not blocked by
  either check).
- `SettingsController.DeleteAccount` (`DELETE /settings/account`) matches on the full
  `Name`+`Number`+`Type` triple (comment: "defence-in-depth... even though name is the only field
  that actually links to transactions").
- `FrontEnd/src/views/SettingsView.vue`'s account-row form has editable Name/Number/Type inputs for
  *every* row, saved or not - there's no read-only treatment for already-saved accounts' names today
  (attempting to rename one and hitting Save currently surfaces the generic 400 message above).
- `Account.Number` / `account.number` touch points (from a fresh grep, for the removal step):
  - Api: `Api/Data/Account.cs` (the property), `SettingsController.DeleteAccount`'s match.
  - `Api.IntegrationTests/SettingsEndpointTests.cs`: every `new Account {...}` construction (11
    occurrences) across `Get_ReturnsTheAuthenticatedUsersAccounts`,
    `Put_ReplacesTheAccountsAndPersistsThem`, `Put_RejectsDuplicateAccountNames_CaseInsensitively`,
    `Put_RejectsRemovingAnExistingAccount`,
    `Put_AllowsAddingAndEditingAccounts_WhenNoExistingOnesAreRemoved`,
    `DeleteAccount_RemovesTheAccountAndOnlyItsTransactions`,
    `DeleteAccount_ReturnsNotFound_WhenNoMatchingAccountExists`.
  - `Api.UnitTests` - no hits (Account entity isn't constructed there; transactions reference
    accounts by plain `string`).
  - `FrontEnd/src/services/settingsService.ts` - `Account` interface (`number: string`).
  - `FrontEnd/src/views/SettingsView.vue` - the Number `<div class="field">` block, `addAccount()`'s
    pushed object, `.account-row`'s CSS grid columns.
  - `FrontEnd.UnitTests/services/settingsService.test.ts` - 4 account object literals.
  - `FunctionalTests/tests/*.spec.ts` - 8 spec files fill an account-row's inputs via
    `.nth(0)` (name) / `.nth(1)` (number) / a `<select>` (type): `internalTransfer.spec.ts`,
    `dashboard.spec.ts`, `accountDeletion.spec.ts` (via a shared `addAccount(page, name, number,
    type)` helper), `transactionCategorization.spec.ts`, `settings.spec.ts`,
    `transactionIgnore.spec.ts`, `transactionUpload.spec.ts`, `transactionListing.spec.ts`.

## Plan

**Api**

1. `Api/Data/Account.cs` - remove `Number`.
2. `SettingsController.Put` - keep `HasDuplicateNames`/`RemovesAnExistingAccount` as-is (they already
   correctly reject renames), but reword the rename-rejection message to be purpose-built rather than
   reusing "cannot be removed" (e.g. "Account names cannot be changed once created - remove and
   re-add the account instead."), and update the surrounding comments to explicitly document *why*
   (name is the account's key).
3. `SettingsController.DeleteAccount` - since `Name` is now the account's only real identity (unique,
   immutable), simplify the endpoint to match by `Name` alone instead of the full object. Replace the
   `Account` request body with a small `DeleteAccountRequest(string Name)` record (matching the style
   of `DescriptionMappingRequest`), dropping the now-pointless `Number`/`Type` match entirely.
4. `Api.IntegrationTests/SettingsEndpointTests.cs` - drop `Number` from every `Account` construction;
   update `DeleteAccount_*` tests for the new `DeleteAccountRequest` body; add a test explicitly
   named/asserting "renaming an existing account via PUT is rejected" (distinct from the existing
   "removing" test, even though today it's the same code path, so the ticket's specific requirement
   has direct coverage) - e.g. `Put_RejectsRenamingAnExistingAccount`.

**FrontEnd**

5. `FrontEnd/src/services/settingsService.ts` - drop `number` from the `Account` interface; change
   `deleteAccount(account: Account)` to `deleteAccount(name: string)` (matching the simplified Api
   request shape).
6. `FrontEnd/src/views/SettingsView.vue`:
   - Remove the Number field from the account-row template and from `addAccount()`'s pushed object.
   - Make the Name `<input>` read-only for already-saved accounts (`:readonly="!isUnsaved[index]"`),
     staying editable only while adding a brand-new (unsaved) row - this is the actual UX change that
     "removes the ability to edit the account name".
   - Update `.account-row`'s grid-template-columns (drops one column).
   - Update `confirmRemoveAccount`'s call to `deleteAccount(...)` for the new signature.
7. `FrontEnd.UnitTests/services/settingsService.test.ts` - drop `number` from account literals; update
   `deleteAccount` tests for the new `(name: string)` signature.
8. `FunctionalTests/tests/*.spec.ts` - in all 8 affected spec files, stop filling the (now-removed)
   number input; `accountDeletion.spec.ts`'s shared `addAccount` helper drops its `number` parameter
   (and every call site updates accordingly). Add/adjust a scenario asserting the Name field is
   read-only (or at least that editing it and saving doesn't rename anything) for an already-saved
   account, to cover the ticket's core ask end-to-end.

**Verification**

9. `dotnet test`; `npm run build`/`lint`; `FrontEnd.UnitTests`; full Playwright suite; manual browser
   check (light + dark) - add an account, confirm its Name becomes read-only after saving, confirm
   Number is gone from the form entirely, confirm duplicate names are still rejected.

## Checklist

- [x] `Api/Data/Account.cs` - remove `Number`
- [x] `SettingsController.Put` - reworded rename-rejection message + comments
- [x] `SettingsController.DeleteAccount` - `DeleteAccountRequest(Name)`, match by Name only
- [x] `Api.IntegrationTests/SettingsEndpointTests.cs` - updated + new rename-rejection test (49/49
      passing; had to merge in UBE-75's already-merged main first, since this branch was cut from a
      slightly stale main)
- [x] `settingsService.ts` - drop `number`, `deleteAccount(name: string)`
- [x] `SettingsView.vue` - remove Number field, read-only Name for saved accounts, grid CSS, updated
      `deleteAccount` call
- [x] `FrontEnd.UnitTests/services/settingsService.test.ts` - updated fixtures/signatures (112/112
      passing)
- [x] `FunctionalTests` - all 8 affected specs updated (dropped the number input fill, or the
      `addAccount` helper's `number` param in `accountDeletion.spec.ts`); added a read-only-name
      assertion to `settings.spec.ts`'s persist-across-reload test
- [x] Build/test/lint verification + manual browser check (light + dark) - `dotnet test` 134/134,
      `npm run build`/`lint` clean, `FrontEnd.UnitTests` 112/112, full Playwright suite 24/24 on the
      first run (fresh dataset reset first). Confirmed visually in light + dark: Number column gone,
      Name field renders greyed-out/read-only on saved accounts, Type stays editable, "+ Add
      account"'s new row's Name stays editable until saved. Note: this branch was cut from `main`
      moments before UBE-75's PR merged, so `origin/main` had to be merged in before starting
      implementation (clean merge, no conflicts).

## Prompt log

- "start a worklog for UBE-58"
