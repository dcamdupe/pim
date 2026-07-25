# UBE-10 — Add Login API

Linear: https://linear.app/uberconcept/issue/UBE-10/add-login-api

## Description

- `POST /login`
- Request object: `login`, `password`
- Generate a JWT
  - Need to configure the JWT infrastructure to validate JWTs in future
- Create a data object to be saved to a collection
  - `login` → key
  - `password` → store a hashed password (see deviation note below)
- Create an `AuthenticationLocal` service to implement validating the login
  - Check login and password
- Return 400 on login failure
- Add a unit test for the `AuthenticationLocal` service methods
- Future note: this auth method is to be used for local only

**Deviation from ticket:** the ticket says to store the raw password. Confirmed with the user to hash it with BCrypt instead — storing plaintext passwords is a real security risk (breach/backup exposure) even for a "local only" auth method.

## Plan

1. Add JWT auth infrastructure: `Microsoft.AspNetCore.Authentication.JwtBearer` package, JWT settings (issuer/audience/signing key) in `appsettings.json`, `AddAuthentication().AddJwtBearer(...)` + `AddAuthorization()` wiring in `Program.cs`.
2. Create a `User` entity (`login`, `password`) as the Mongo-backed data object, using the existing `IRepository<T>`/`MongoRepository<T>`. Store the password as a BCrypt hash (`BCrypt.Net-Next` package).
3. Create `IAuthenticationLocal` / `AuthenticationLocal` service: validates login+password (via `BCrypt.Verify`) against the repository, issues a JWT on success.
4. Add `POST /login` endpoint (controller) that calls `AuthenticationLocal`, returns the JWT on success or `400` on failure.
5. Add `Api.Tests` unit tests for `AuthenticationLocal` (valid login, invalid login, invalid password).

## Checklist

- [x] Confirm password storage approach with user (raw vs. hashed) — hashed (BCrypt)
- [x] Add JWT auth infrastructure/config
- [x] Create `User` data object + Mongo collection wiring
- [x] Create `AuthenticationLocal` service
- [x] Add `POST /login` endpoint (400 on failure)
- [x] Add unit tests for `AuthenticationLocal`
- [x] Verify build/tests pass
- [x] Add `scripts/setup_local.sh` to seed a test login; document it + credentials in `README.md`

## Notes

- `Api/Auth/`: `JwtSettings`, `IJwtTokenGenerator`/`JwtTokenGenerator` (HMAC-SHA256 via `System.IdentityModel.Tokens.Jwt`), `IAuthenticationLocal`/`AuthenticationLocal` (looks up the `User` by login via `IRepository<User>`, verifies with `BCrypt.Verify`).
- `Api/Data/User.cs`: `[BsonId] Login` + `PasswordHash`, stored via the existing `MongoRepository<T>` (collection `User`).
- `Api/Controllers/LoginController.cs`: `POST /login` — `200` with `{ token }` on success, `400` (no body) on invalid credentials.
- `Program.cs`: wired `AddAuthentication().AddJwtBearer(...)` + `AddAuthorization()` (validates issuer/audience/lifetime/signing key) so future endpoints can use `[Authorize]`; JWT settings added to `appsettings.json` with a dev-only signing key.
- Unit tests (`Api.Tests/Auth/AuthenticationLocalTests.cs`): valid login, unknown login, wrong password. Initially used a hand-rolled `FakeUserRepository`; per feedback, replaced with `Moq` and a new generic `Api.Tests/RepositoryMockFactory.cs` helper — `RepositoryMockFactory.Create<T>(List<T> items)` builds a `Mock<IRepository<T>>` backed by the list, resolving each item's id via reflection (`[BsonId]` property, falling back to a property named `Id`), reusable for any future entity.
- `scripts/setup_local.sh`: seeds a `testuser` / `TestPassword123!` login into the local Mongo `User` collection via `mongosh`, hashing the password with `htpasswd -bnBC 10` (confirmed compatible with `BCrypt.Net-Next`'s `Verify`). Idempotent — skips if the login already exists. Ran it twice locally (insert, then skip) and confirmed via `README.md` update.
- Verified end-to-end against local Mongo: `dotnet build`/`dotnet test` clean (0 warnings/errors, 3/3 tests pass); `POST /login` with the seeded test user returns `200` + a JWT, and `400` with a wrong password.

## Prompt Log

1. "create worklog for UBE-10"
2. "start to implement the checklist"
3. "The FakeUserReposity is poorly designed. Use Moq. Also, create a helper class in the Tests project that will create a Moq repo that implements all the methods, taking a list of type T as the input parameter"
4. "create a shell script in a new directory scripts called setup_local.sh. This should insert a test login if it doesn't already exist. Update the readme to include the test login and reference the shell script"
5. "run the shell script"
6. "why has the checklist not been updated as the work has progressed?"
