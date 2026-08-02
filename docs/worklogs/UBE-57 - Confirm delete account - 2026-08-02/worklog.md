# UBE-57: Add modal pop up to confirm removing an account

Linear: https://linear.app/uberconcept/issue/UBE-57/add-modal-pop-up-to-confirm-removing-an-account
Status: In Progress · Priority: No priority

## Description (from Linear)

Text: This will also delete all the transaction for this account? Do you want to delete the
account?

Clicking Yes should delete the account.

Remove will be applied immediately, not on calling PUT /settings

API Changes:

* Add new endpoint DELETE /settings/account
  * body: all account details
* Retrieve all transactions and delete the ones linked with this bank account name

Other changes:

* enforce uniqueness on name of the bank account
  * client side
  * in API when calling PUT /settings
* Add validation on PUT /settings to ensure no existing accounts have been removed

## Current behaviour

`SettingsView.vue`'s "Remove" button just splices the account out of the local `accounts` array -
nothing happens server-side until "Save" (`PUT /settings`) sends the whole new list, which
implicitly drops whatever's missing. Removed accounts' transactions are never touched - they're
silently orphaned (still exist, still show up in the Transactions list, just no longer linked to a
configured account). There's no confirmation and no uniqueness enforcement at all today.

## Plan

### Api (`Api/Controllers/SettingsController.cs` + a new service method)

1. **`DELETE /settings/account`** - body is the full `Account` (name, number, type), matched
   against `user.Accounts` on all three fields (not just name) for precision, even though name
   alone is what actually links to transactions - defence in depth against a stale/racy client
   payload. 404 if no exact match. On match:
   - Remove it from `user.Accounts`, persist via `_users.UpdateAsync`.
   - Delete every transaction with `Account == name`: reuses the exact pattern
     `TransactionUpdateService.ApplyDescriptionMappingAsync` already uses -
     `ITransactionQueryService.GetTransactionsAsync(email, null, today)` to fetch everything, group
     the matches by `(Year, Month)`, and `UpdateAsync` each affected `TransactionMonth` bucket with
     that account's transactions filtered out.
   - Return `204 No Content`, matching the existing `PUT /settings` convention.
   - New endpoint → add to `Api.IntegrationTests/AuthorizationTests.cs`'s `ProtectedEndpoints()`,
     and needs its own `Api.IntegrationTests` coverage (per `CLAUDE.md`).
2. **Uniqueness on `PUT /settings`**: reject (400) if `request.Accounts` has two entries with the
   same name (case-insensitive - `Everyday` and `everyday` shouldn't both be allowed, since a
   human reading the list wouldn't consider them distinct).
3. **"No accounts removed" validation on `PUT /settings`**: reject (400) unless every account name
   currently in `user.Accounts` is still present (by name) in `request.Accounts`.

   **Flagging this one explicitly**: since an account's *name* is the only identity linking it to
   its transactions (there's no separate id), this check can't distinguish "renamed" from
   "removed-and-a-different-one-added" - so as an emergent (not explicitly stated) consequence,
   this will also block editing an existing account's name via Save, not just deleting it. That
   actually seems like the *correct* outcome given the rest of this ticket (renaming would silently
   orphan that account's transactions from their configured account, the exact problem this ticket
   is fixing for deletion) - but flagging it since it's a real behaviour change beyond "you can't
   remove via Save" alone, in case that's not intended.

**Explicit simplifications (out of scope unless told otherwise):**
- Description-stats (`TransactionDescriptions.TransactionCount`/`UnclassifiedCount`) aren't
  adjusted when a transaction is deleted - those are soft heuristic counters for description
  matching, not financial data, and the ticket doesn't mention them.
- `User.MinTransactionDate` isn't recalculated after a deletion, even if the deleted account held
  the user's earliest transactions - it'll just be slightly conservative (may include a now-empty
  leading month or two in range calculations), not incorrect.

### FrontEnd

4. `settingsService.ts`: add `deleteAccount(account: Account): Promise<void>` → `DELETE /settings/account`.
5. `SettingsView.vue`:
   - Track which rows are newly-added-and-never-saved (a plain `Set<Account>` of objects pushed by
     `addAccount()`) - removing one of *those* stays instant/local, no confirmation or API call,
     since nothing exists server-side to delete yet.
   - Removing a persisted account opens a confirmation modal with the ticket's exact text and
     Yes/No buttons (porting the `.modal-backdrop`/`.modal`/`.modal-button` structure already
     established in `TransactionsView.vue`, not extracting a shared component for just two
     differently-shaped modals across the app).
   - "Yes" calls `deleteAccount()` immediately, then removes it from the local list on success.
   - "No" just closes the modal.
   - Client-side uniqueness check (case-insensitive, ignoring blank in-progress names): inline
     error + disabled Save button while two accounts share a name.
6. `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests`; new Playwright scenario(s) for
   delete-with-confirmation (incl. transactions actually being removed) and duplicate-name
   validation; manual browser check, light + dark.

## Checklist

- [x] `DELETE /settings/account` endpoint + cascading transaction delete (added
      `ITransactionUpdateService.DeleteTransactionsForAccountAsync`, mirroring the existing
      `ApplyDescriptionMappingAsync` fetch-all/group-by-month/update-bucket pattern)
- [x] `Api.IntegrationTests` for the new endpoint + `AuthorizationTests.cs` entry
- [x] `PUT /settings` uniqueness validation (400 on duplicate names)
- [x] `PUT /settings` "no accounts removed" validation (400)
- [x] `Api.UnitTests`/`Api.IntegrationTests` for both new `PUT /settings` validations (125/125 Api
      tests passing)
- [x] `settingsService.deleteAccount()`
- [x] Confirmation modal in `SettingsView.vue` (skips the modal for never-saved rows)
- [x] Client-side duplicate-name validation in `SettingsView.vue`
- [x] Playwright scenario(s): confirm-delete removes account + its transactions; duplicate-name
      validation - new `accountDeletion.spec.ts` (4 tests). Along the way, found and fixed a real
      production bug (Vue wraps pushed objects in a reactive Proxy, so the original `Set<Account>`
      object-identity check for "is this row unsaved" never matched anything - replaced with an
      index-aligned `isUnsaved` boolean array), and had to update the cleanup step in every other
      spec that adds-then-removes a Settings account (`dashboard.spec.ts`, `internalTransfer.spec.ts`,
      `settings.spec.ts`, `transactionListing.spec.ts`, `transactionIgnore.spec.ts`,
      `transactionUpload.spec.ts`, `transactionCategorization.spec.ts`) - they all used the old
      "click Remove, then click Save" pattern, which now hangs since the confirmation modal blocks
      the Save button underneath it. Also found and deduplicated ~20 pre-existing duplicate-named
      accounts already sitting in the shared local dev dataset (from imperfect historical test
      cleanup) that the new uniqueness validation correctly flagged and which were blocking all
      further Settings saves in this environment.
- [x] Manual browser check, light + dark - confirmation modal matches the ticket's exact text,
      "Yes" styled red (destructive), "No" secondary
- [x] `dotnet test`, `npm run lint` / `vue-tsc -b` build / `FrontEnd.UnitTests` all pass
      (125 Api tests, 100 FrontEnd unit tests, full Playwright suite green modulo the
      already-documented pre-existing-broken specs)

## Prompt log

- "start worklog on UBE-57"
