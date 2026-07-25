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
- [ ] Add JWT auth infrastructure/config
- [ ] Create `User` data object + Mongo collection wiring
- [ ] Create `AuthenticationLocal` service
- [ ] Add `POST /login` endpoint (400 on failure)
- [ ] Add unit tests for `AuthenticationLocal`
- [ ] Verify build/tests pass

## Prompt Log

1. "create worklog for UBE-10"
