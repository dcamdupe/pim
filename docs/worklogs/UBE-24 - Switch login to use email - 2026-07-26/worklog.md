# UBE-24 — Switch login to use email

Linear: https://linear.app/uberconcept/issue/UBE-24/switch-login-to-use-email

## Description

- Switch the test login to an email address
- update the script that populates this
- update the functional and integration tests
- update validation in the front end

## Clarifications (resolved before implementation)

- **Naming scope:** rename "Login" to "Email" throughout, not just the value — `User.Login` → `User.Email`, `LoginRequest.Login` → `LoginRequest.Email`, `authService.login`'s parameter, the form field id/label. The `LoginController`/`/login` route and `authService.login()` function name stay as-is (they name the *action*, not the credential), since the ticket doesn't ask to rename those.
- **Front-end validation:** switch the input to native `type="email"` and validate via the browser's built-in `validity`/`checkValidity()`, matching the existing lightweight validation style rather than adding a hand-rolled regex.
- **Test email address (my call, low-stakes):** `testuser@example.com`, keeping the existing `testuser` prefix for continuity with current docs/habits.

## Plan

1. `Api/Data/User.cs` — rename `Login` property to `Email` (still `[BsonId]`).
2. `Api/Auth/IAuthenticationLocal.cs` / `AuthenticationLocal.cs` — rename the `login` parameter to `email` (`ValidateAsync(string email, string password)`), update the `_users.GetAsync(email)` call.
3. `Api/Auth/IJwtTokenGenerator.cs` / `JwtTokenGenerator.cs` — rename the `login` parameter to `email` (claim type stays `ClaimTypes.NameIdentifier` — still correct for any unique identifier).
4. `Api/Controllers/LoginController.cs` — `LoginRequest(string Login, ...)` → `LoginRequest(string Email, ...)`, update the two call sites that read `request.Login`.
5. `Api.IntegrationTests/LoginEndpointTests.cs` — rename the `_login` field to `_email`, give it an email-shaped value, update the JSON payload key (`login` → `email`) and the `User { Email = ... }` construction.
6. `scripts/setup_local.sh` — rename `TEST_LOGIN` → `TEST_EMAIL` (`testuser@example.com`), update the mongosh script's variable references and the final echo message.
7. `FunctionalTests/tests/login.spec.ts` — fill `testuser@example.com` instead of `testuser`, update the `#login` locator to `#email`.
8. `FrontEnd/src/services/authService.ts` — rename the `login` parameter to `email`, update the JSON body key.
9. `FrontEnd/src/views/LoginView.vue` — rename `loginValue` → `email`, input `id`/`type` → `email`/`"email"`, `autocomplete="email"`, label "Email", validate via `input.validity.valid`, update error copy.
10. `FrontEnd.UnitTests/services/authService.test.ts` — update the two `login('testuser', ...)` calls and the expected JSON body key to match the renamed parameter/email value.
11. `README.md`'s "Test login" section — `Login: testuser` → `Email: testuser@example.com`.
12. Run `dotnet test`, `FrontEnd.UnitTests`' `npm run test`, and (if Mongo/Api/FrontEnd are running) `FunctionalTests`' `npm test`.

## Checklist

- [x] `Api/Data/User.cs` — rename `Login` → `Email`
- [x] `Api/Auth/IAuthenticationLocal.cs` + `AuthenticationLocal.cs` — rename param, update `GetAsync` call
- [x] `Api/Auth/IJwtTokenGenerator.cs` + `JwtTokenGenerator.cs` — rename param
- [x] `Api/Controllers/LoginController.cs` — rename `LoginRequest.Login` → `Email`
- [x] `Api.IntegrationTests/LoginEndpointTests.cs` — email-shaped test value
- [x] `scripts/setup_local.sh` — seed an email test login
- [x] `FunctionalTests/tests/login.spec.ts` — email value + `#email` locator
- [x] `FrontEnd/src/services/authService.ts` — rename param
- [x] `FrontEnd/src/views/LoginView.vue` — email input + native validation
- [x] `FrontEnd.UnitTests/services/authService.test.ts` — update test data
- [x] `README.md` — update documented test login
- [x] `Api.UnitTests/Auth/AuthenticationLocalTests.cs` — rename `Login` → `Email` (missed in initial file sweep; caught by `dotnet build`)
- [x] Run `dotnet test`, `FrontEnd.UnitTests`, `FunctionalTests` — all pass (`dotnet test` unit + `LoginEndpointTests` integration, `FrontEnd.UnitTests`, and `FunctionalTests`' `login.spec.ts` against a live local Api/FrontEnd/Mongo)

## Prompt Log

1. "start worklog for UBE-24"
2. "Rename to \"Email\" everywhere" / "Native type=\"email\" input" (clarifying question answers)
3. "start"
