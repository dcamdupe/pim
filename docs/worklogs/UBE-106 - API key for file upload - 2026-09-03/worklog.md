# UBE-106 - API key for file upload - 2026-09-03

Linear: https://linear.app/uberconcept/issue/UBE-106/work-out-how-to-get-api-calls-working-with-google-auth
Branch: `UBE-106/api-key-for-file-upload`

## Description

After switching to Google auth (Cognito hosted UI), non-Local `POST /transactions/file`
uploads no longer work: the `FileDownloader` script authenticated via the email/password
`LoginController`, which only exists in the Local environment. There is no interactive
browser flow available to a headless script.

Fix: let a user provision a long-lived API key from the settings page and accept that key
as an alternative credential on `POST /transactions/file`, so the downloader can upload
without a Google token.

### Requirements (from the issue)

- Settings page: new **API Key** section.
  - No key yet → "Generate API Key" button.
  - Key exists → "Invalidate and Regenerate" button.
  - Display the key when it exists, with a copy-to-clipboard icon.
- `POST /settings/api` — generate a random `[a-z0-9]` key, persist it on the user, return it.
- `GET /settings` — include the API key in the response.
- `POST /transactions/file` — authenticate with either the API key or a Google/Cognito token.

## Plan

### Api

1. **`User.ApiKey`** — add nullable `string? ApiKey` to `Api/Data/User.cs`.
2. **`POST /settings/api`** in `SettingsController`:
   - `[Authorize]` (token only — key provisioning always needs the real login).
   - Generate a cryptographically-random key, ~40 chars from `[a-z0-9]`.
   - Set `user.ApiKey`, `UpdateAsync`, return `{ apiKey }`. Overwrites any existing key
     (that is the "invalidate and regenerate" path).
3. **`GET /settings`** — add `ApiKey` to `SettingsResponse`.
4. **API-key authentication** — add a second authentication scheme:
   - New `ApiKeyAuthenticationHandler` (scheme `"ApiKey"`) reading a header
     (`X-Api-Key`).
   - Resolves the key to a user via a dedicated `ApiKey` table keyed by the key string —
     `IRepository<ApiKey>.GetAsync(key)` — see Decisions.
   - On success, emit a `ClaimTypes.NameIdentifier` = email claim, same shape as the JWT /
     Cognito principals, so controllers are unchanged.
5. **`POST /transactions/file`** — change `[Authorize]` on the action to
   `[Authorize(AuthenticationSchemes = "Bearer,ApiKey")]` so either scheme satisfies it.
   All other endpoints stay Bearer-only.
6. **DI wiring** in `ServiceMapping` — register the API-key scheme in both Local and
   non-Local branches (downloader needs it locally too for tests/dev).

### Api.IntegrationTests

7. `SettingsEndpointTests` — `POST /settings/api` returns a key; key is `[a-z0-9]`;
   regenerate returns a different key; `GET /settings` echoes it back.
8. New `ApiKeyAuthTests` (or extend `TransactionsEndpointTests`) — `POST /transactions/file`
   succeeds with a valid API key and no bearer token; rejected with a bad key.
9. `AuthorizationTests.ProtectedEndpoints()` — add `POST /settings/api`. Confirm
   `POST /transactions/file` with no credential still 401s.

### Api.UnitTests

10. Unit-test the key generator (charset, length, randomness/uniqueness) if it lands as a
    standalone service; unit-test the API-key principal resolution logic.

### FrontEnd

11. `settingsService.ts` — `generateApiKey(): Promise<string>` (POST `/settings/api`);
    add `apiKey: string | null` to the `Settings` interface.
12. `stores/settings.ts` — hold `apiKey`, action to regenerate.
13. `SettingsView.vue` — API Key section: conditional button label, key display, copy icon
    (reuse existing icon set / clipboard pattern).

### FrontEnd.UnitTests

14. `settingsService.test.ts` — `generateApiKey` calls the right endpoint / parses response.
15. Component test for the API Key section states (no key / has key / copy).

### FunctionalTests

16. Playwright scenario: settings page → generate key → key visible → regenerate changes it.

### FileDownloader

17. `pim.ts` — send `X-Api-Key` from config instead of the login flow; `config.ts` gains
    `pimApiKey`. (Keep login path for Local if still useful, or drop it.)

### Docs

18. Update `Terraform/README.md` / any auth docs if they describe the upload auth flow.

## Decisions (David said "go" — proceeding with the recommended defaults)

1. **Key lookup** — dedicated `ApiKey` DynamoDB table keyed by the key string, so lookup is
   an O(1) `IRepository<ApiKey>.GetAsync(key)`. The generic repo stores the entity as an
   opaque JSON blob, so scanning `User` for a nested field isn't a good fit; a separate
   key-value item matches the repo's grain. `User.ApiKey` still holds the current key (for
   `GET /settings` display and to delete the superseded `ApiKey` row on regenerate).
2. **Header** — `X-Api-Key: <key>`.
3. **Key format** — 40 chars of `[a-z0-9]` via `RandomNumberGenerator.GetString`.
4. **Scope** — API key accepted only on `POST /transactions/file`. All other endpoints
   stay Bearer-only.
5. **FileDownloader** — in scope: switch `pim.ts` to send `X-Api-Key` from config.

## Checklist

- [x] Confirm plan + open questions with David (said "go" — defaults adopted)
- [x] Api: `ApiKey` entity + `User.ApiKey`
- [x] Api: `POST /settings/api`
- [x] Api: `GET /settings` returns `ApiKey`
- [x] Api: `ApiKey` authentication scheme + handler (`X-Api-Key`)
- [x] Api: `POST /transactions/file` accepts `Bearer` or `ApiKey`
- [x] Api: DI wiring in `ServiceMapping` (`.AddApiKey()` on both branches)
- [x] Local: `ApiKey` table in `create_dynamodb_tables.sh`
- [x] Terraform: `ApiKey` data module + IAM resource (fmt + validate pass)
- [x] Api.IntegrationTests: `/settings/api` tests
- [x] Api.IntegrationTests: file upload via API key tests
- [x] Api.IntegrationTests: `AuthorizationTests` updated (`POST /settings/api`)
- [x] Api.UnitTests: `ApiKeyGenerator` tests (handler covered by integration tests)
- [x] FrontEnd: `settingsService.generateApiKey` + store `apiKey`/`regenerateApiKey`
- [x] FrontEnd: `SettingsView` API Key section (generate/regenerate + copy icon)
- [x] FrontEnd.UnitTests: service + store tests (no view-test pattern in this project)
- [x] FunctionalTests: settings API key scenario
- [x] FileDownloader: `pim.ts` sends `X-Api-Key`; `config.ts` `pimApiKey`
- [x] Docs: no central auth doc to update
- [x] `dotnet build` green; `Api.UnitTests` green (90); FrontEnd build + unit tests green (210)
- [ ] `dotnet test` (integration) — needs local DynamoDB with the new `ApiKey` table; run
      `source scripts/setup_local.sh` then `dotnet test`
- [ ] PR raised

## Follow-ups / notes for David

- Run `source scripts/setup_local.sh` (updated) to create the local `ApiKey` table, then
  `dotnet test` for the integration suite.
- `terraform apply` in each environment will create the new `ApiKey` table and extend the
  Lambda's DynamoDB IAM policy.
- The `FileDownloader` `.env` (`.env.age`, encrypted) needs a `PimApiKey=<key>` entry and the
  now-unused `PimLogin`/`PimPassword` can be dropped. `config.ts` there is still mid-refactor
  for the amex work (commented-out `assertComplete` return) — only the pim key lines were touched.

## Prompt / response log

### 2026-09-03

**Prompt:** start a worklog for UBE-106

**Response:** Retrieved UBE-106 from Linear, explored the Api auth setup
(`ServiceMapping`, Cognito vs Local JWT), `SettingsController`, `TransactionsController`,
`FileDownloader` (`pim.ts` uses the Local-only email/password login), and the FrontEnd
settings stack. Created branch `UBE-106/api-key-for-file-upload` and this worklog with a
draft plan and open questions.

**Prompt:** go / (mid-implementation) I want a single API key, not a collection / I want the
API key to be an attribute on the user table / ok, go with the original plan. I had missed
the issue with the key.

**Response:** Briefly went down a "no separate table, `User.ApiKey` only" path, but that
leaves no O(1) way to resolve a presented key back to a user (the generic repo has no scan).
Confirmed with David and reverted to the original plan: a dedicated `ApiKey` lookup table
(one row per key: `{ Key, Email }`) alongside `User.ApiKey`. Implemented the full slice:

- Api: `ApiKey` entity, `User.ApiKey`, `POST /settings/api` (delete old row → generate
  40-char `[a-z0-9]` key → write new row → set `user.ApiKey`), `GET /settings` returns it,
  `ApiKeyAuthenticationHandler` (scheme `ApiKey`, header `X-Api-Key`), `.AddApiKey()` wired
  into both auth branches, `POST /transactions/file` now `[Authorize(AuthenticationSchemes =
  "Bearer,ApiKey")]`.
- `create_dynamodb_tables.sh` + Terraform (`api_key_data` module, IAM resource) gain the
  `ApiKey` table.
- Tests: `ApiKeyGeneratorTests`; `SettingsEndpointTests` (generate / regenerate / GET echo);
  `TransactionsEndpointTests` (upload with valid key + no bearer, reject unknown key);
  `AuthorizationTests` gains `POST /settings/api`.
- FrontEnd: `generateApiKey` service, store `apiKey` + `regenerateApiKey`, `SettingsView`
  API Key section with copy-to-clipboard; service + store unit tests; Playwright scenario.
- `FileDownloader/pim.ts` sends `X-Api-Key`; `config.ts` swaps `pimLogin`/`pimPassword` for
  `pimApiKey`.

`dotnet build`, `Api.UnitTests` (90), FrontEnd build + unit tests (210) all green.
Integration suite pending a local DynamoDB with the new table.
