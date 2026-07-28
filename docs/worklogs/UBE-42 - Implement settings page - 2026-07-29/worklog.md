# UBE-42 — Implement settings page

Linear: https://linear.app/uberconcept/issue/UBE-42/implement-settings-page

## Description

- remove the existing dashboard placeholder from the front end
- Add the top nav bar from dashboard-mockup-calm.html, excluding the Dashboard and Transactions switch
- Replace the DC - David item with a generic profile image
- Add a Cog with a hover that takes you to a settings page
- The Settings page should display a list of accounts
  - Load the list of accounts from the api /settings
  - Save button at the bottom to call PUT /settings
- Implement api GET /settings
  - authenticated endpoint
  - use the login email to retrieve the user
  - expand the User object to store a list of accounts. Attributes
    - Name (string)
    - Number (string)
    - Type (enum, values: Credit, Transaction, Savings)
- Implement api PUT /setting
  - Takes the list of accounts and saves the user

## Clarifications (resolved before implementation)

- **Cog interaction:** click navigates to `/settings`; hover is just a visual highlight, not the
  navigation trigger. Literal "hover that takes you" would be unusual/inaccessible UX (accidental
  triggers, breaks keyboard nav) and hard to test reliably.
- **Account editing scope:** full manage (add / edit / remove rows, then Save persists the whole
  list) rather than edit-only — otherwise a user with zero accounts could never add one.
- **`PUT /setting` vs `/settings`:** treating the singular in the last bullet as a typo; implementing
  both verbs on the same `/settings` route the GET bullet specifies.

## Context (from reading the current code)

- No `[Authorize]`-protected endpoint exists yet anywhere in the Api — this is the first one. JWT
  bearer auth itself was already wired up in `Api/IoC/ServiceMapping.cs` (from `UBE-38`/an earlier
  ticket), and `JwtTokenGenerator` puts the login email in `ClaimTypes.NameIdentifier`, so
  `User.FindFirstValue(ClaimTypes.NameIdentifier)` in a controller gives the email directly.
- `Api/Data/User.cs` is currently just `Email` + `PasswordHash`. `IRepository<T>` is generic
  (`GetAsync`/`AddAsync`/`UpdateAsync`/`DeleteAsync`, keyed by the `[BsonId]` property) and already
  has both a Mongo and a DynamoDB implementation — adding a `List<Account>` property to `User` needs
  no repository changes, since both serialize the whole object generically (BSON / `System.Text.Json`
  respectively).
- No enum has existed in the domain model before, so nothing configures how enums serialize yet.
  Mongo's C# driver defaults to storing enums as integers unless told otherwise
  (`[BsonRepresentation(BsonType.String)]`); ASP.NET Core's default JSON output for an enum is also
  numeric unless a `JsonStringEnumConverter` is registered. Doing both keeps `GET`/`PUT /settings`
  reading/writing `"Credit"`/`"Transaction"`/`"Savings"` instead of `0`/`1`/`2`.
- `FrontEnd/src/App.vue` is currently just a bare `<RouterView />` — no persistent chrome. There's no
  `components/` directory yet.
- `FrontEnd/src/views/DashboardView.vue` is the placeholder from the earlier "added placeholder
  dashboard" commit — full mock-data stat tiles/charts/transaction table, not wired to the API.
  Removing it still needs to leave the `dashboard` route in place (login redirects there, and the
  existing Playwright specs assert `toHaveURL(/\/dashboard$/)`).
- `docs/design/dashboard-mockup-calm.html` (the design mockup from earlier) has its own separate
  hardcoded palette (teal accent etc.) distinct from the app's actual live tokens in
  `FrontEnd/src/style.css` (`--bg`/`--text`/`--text-h`/`--border`/`--accent`, light/dark aware,
  already used by `LoginView.vue`). Building the new nav bar against the mockup's *layout* but the
  app's *existing* CSS tokens, rather than forking in the mockup's separate palette, to stay
  consistent with the rest of the app.
- The existing auth guard (`router/guard.ts`, from `UBE-38`) already redirects anything other than
  the `login` route when unauthenticated — a new `/settings` route needs no extra guard wiring.
- `Api.IntegrationTests`/`Api.UnitTests` conventions: `ApiWebApplicationFactory` (real Mongo),
  `RepositoryMockFactory.Create(...)` for mocking `IRepository<T>` in unit tests. `JwtSettings` lives
  in the base `appsettings.json` (not just `.Local`), so integration tests can resolve
  `IJwtTokenGenerator` from the factory to mint a real bearer token for a seeded user.

## Plan

### API

1. **`Api/Data/AccountType.cs`** (new) — `enum AccountType { Credit, Transaction, Savings }`.
2. **`Api/Data/Account.cs`** (new) — `Name` (string), `Number` (string), `Type` (`AccountType`,
   `[BsonRepresentation(BsonType.String)]`).
3. **`Api/Data/User.cs`** — add `public List<Account> Accounts { get; set; } = [];`.
4. **`Api/IoC/ServiceMapping.cs`** — `AddJsonOptions` on `AddControllers()` registering
   `JsonStringEnumConverter`, so `Type` reads/writes as `"Credit"` etc. over the wire.
5. **`Api/Controllers/SettingsController.cs`** (new) — `[Authorize]`, `[Route("settings")]`:
   - `GET` — resolve email from `ClaimTypes.NameIdentifier`, load the `User`, return `Accounts`.
   - `PUT` — same lookup, replace `Accounts` with the request body, `UpdateAsync`.
6. **`Api.UnitTests/Controllers/SettingsControllerTests.cs`** (new) — via `RepositoryMockFactory`:
   GET returns the authenticated user's accounts; PUT persists the new list.
7. **`Api.IntegrationTests/SettingsEndpointTests.cs`** (new) — real Mongo + a real minted JWT: GET
   returns seeded accounts, PUT persists (verified by a follow-up GET), unauthenticated request → 401.

### Front end

8. **`FrontEnd/src/components/NavBar.vue`** (new) — "Pim" wordmark, generic profile icon (replacing
   the mockup's "DC - David"), cog icon linking to `/settings` (click navigates; hover is a plain
   `:hover` style, no navigation-on-hover). Styled from the mockup's *layout* using the app's
   existing `style.css` tokens, no Dashboard/Transactions tab switcher.
9. **`FrontEnd/src/App.vue`** — render `<NavBar>` above `<RouterView>` for every route except `login`.
10. **`FrontEnd/src/views/DashboardView.vue`** — strip the mock-data placeholder down to a minimal
    page (a real dashboard is future work, not this ticket).
11. **`FrontEnd/src/services/settingsService.ts`** (new) — `getSettings()` / `saveSettings(accounts)`,
    attaching `Authorization: Bearer <token>` from `useAuthStore().token`, mirroring
    `authService.ts`'s plain-`fetch` style.
12. **`FrontEnd/src/views/SettingsView.vue`** (new) — loads accounts on mount; editable rows
    (Name/Number text inputs, Type `<select>`), "Add account" and per-row "Remove", "Save" button
    at the bottom calling `saveSettings`.
13. **`FrontEnd/src/router/index.ts`** — add the `settings` route (`/settings` → `SettingsView`).
14. **`FrontEnd.UnitTests/services/settingsService.test.ts`** (new) — mirrors
    `services/authService.test.ts`'s fetch-mocking style. `NavBar.vue`/`SettingsView.vue` are left
    to the functional test rather than a Vitest unit test — importing a `.vue` file into
    `FrontEnd.UnitTests` trips the Oxc/tsconfig-discovery CI bug hit (and worked around) in `UBE-38`.
15. **`FunctionalTests/tests/settings.spec.ts`** (new) — log in, use the cog to reach `/settings`,
    add an account, Save, reload, assert it persisted.

### Verify

16. `dotnet build` / `dotnet test`, `npm run test` (`FrontEnd.UnitTests`), `npm run build` /
    `npm run lint` (`FrontEnd`), Playwright functional tests, a real check via `scripts/run_local.sh`.

## Checklist

- [x] `Api/Data/AccountType.cs`
- [x] `Api/Data/Account.cs`
- [x] `Api/Data/User.cs` — `Accounts` list
- [x] `Program.cs` — `JsonStringEnumConverter` (chained onto the existing `AddControllers()` call
      there, rather than `ServiceMapping.cs` — that's where `AddControllers()` itself already lives)
- [x] `Api/Controllers/SettingsController.cs` — `GET`/`PUT /settings`, `[Authorize]`
- [x] `Api.UnitTests` — `SettingsControllerTests`
- [x] `Api.IntegrationTests` — `SettingsEndpointTests` (incl. 401 when unauthenticated)
- [x] `FrontEnd/src/components/NavBar.vue`
- [x] `FrontEnd/src/App.vue` — render `NavBar`
- [x] `FrontEnd/src/views/DashboardView.vue` — remove placeholder
- [x] `FrontEnd/src/services/settingsService.ts`
- [x] `FrontEnd/src/views/SettingsView.vue`
- [x] `FrontEnd/src/router/index.ts` — `/settings` route
- [x] `FrontEnd.UnitTests` — `settingsService.test.ts`
- [x] `FunctionalTests` — `settings.spec.ts`
- [x] Verify: `dotnet build`/`test`, `npm run test`, `npm run build`/`lint`, Playwright, real local run

## Notes

- **Discovered while writing `SettingsEndpointTests`:** `HttpContent.ReadFromJsonAsync<T>()` with no
  explicit options (as `LoginEndpointTests` already uses) defaults to `JsonSerializerDefaults.Web`
  (case-insensitive property names, camelCase). Once `SettingsEndpointTests` needed its own
  `JsonSerializerOptions` (to add `JsonStringEnumConverter`, so the test could read the `"Transaction"`/
  `"Savings"` strings the Api now writes), constructing it as plain `new JsonSerializerOptions { ... }`
  silently dropped those Web defaults — property names became case-sensitive again, so `"accounts"` in
  the response no longer bound to the `Accounts` record parameter (silently `null`, not an exception,
  until an assertion tripped over it). Fixed by building it as
  `new JsonSerializerOptions(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } }`.
- **Out-of-scope repo-wide change, requested after the ticket's own checklist was done:** moved every
  controller's route from a class-level `[Route("...")]` onto the HTTP method attribute instead
  (`[HttpGet("settings")]`, `[HttpPost("login")]`, `[HttpGet("/")]`), and documented it as the standing
  convention in `CLAUDE.md`. Touches `RootController`/`LoginController` too, not just this ticket's
  `SettingsController` — re-ran the full `dotnet build`/unit/integration suite afterward to confirm
  `/`, `/login`, and `/settings` still resolve correctly.

## Prompt Log

1. "start worklog for UBE-42"
2. Cog interaction → "Click navigates"; Account editing scope → "Add + edit + remove"
3. "start"
4. "change all the controllers to specify the full endpoint path in the controller action and update the project md file to set this as standard behaviour"
