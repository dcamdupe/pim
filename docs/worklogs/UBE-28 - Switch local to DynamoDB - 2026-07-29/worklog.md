# UBE-28 — Switch local to DynamoDB

Linear: https://linear.app/uberconcept/issue/UBE-28/switch-local-to-a-dynamodb-emulator

## Description

Remove the MongoDB dependency entirely so local dev and production both use one DB model
(DynamoDB), with local dev pointing at a local DynamoDB Local emulator instead of a real Mongo
install.

From the Linear issue, needs to fix:
- local setup script
- IOC to use DynamoDB
- Remove MongoDB
- Add config for local DynamoDB

## Current state (from repo survey)

- `Api/IoC/ServiceMapping.cs` branches on whether `MongoSettings` config exists: if present (only
  `appsettings.Local.json` today) → `MongoRepository<T>`; if absent (Production/Lambda) →
  `DynamoDbRepository<T>`. So **production already runs on `DynamoDbRepository<T>` today** — only
  local dev uses Mongo. `DynamoDbRepository<T>` already fully implements `IRepository<T>` with the
  same 4 methods as `MongoRepository<T>`.
- `DynamoDbRepository<T>` finds an entity's id property via reflection, keyed off `[BsonId]`
  (`MongoDB.Bson.Serialization.Attributes`) — i.e. it already depends on a Mongo package purely to
  locate the id property. Same pattern in `Api.UnitTests/Helpers/RepositoryMockFactory.cs`.
- `Api/Configuration/AwsSettings.cs` has only `Region` — no way to point `AmazonDynamoDBClient` at
  a local endpoint today.
- `Terraform/modules/data/main.tf` defines exactly one table, `User`, hash key `id` (`S`),
  `PAY_PER_REQUEST` billing. `DynamoDbRepository<T>` stores the whole entity as one JSON string
  under a `data` attribute, keyed by `id`.
- `Api.IntegrationTests/LoginEndpointTests.cs` and `SettingsEndpointTests.cs` both seed/clean up
  test users by talking to `IMongoDatabase`/`IMongoCollection<User>` directly.
- `scripts/setup_local.sh` seeds a test login into Mongo via `mongosh`; `scripts/run_local.sh`
  just documents "requires MongoDB already running" as a comment.
- `Account.cs`'s `[BsonRepresentation(BsonType.String)]` on `AccountType` only affects Mongo's BSON
  serializer — `DynamoDbRepository<T>` already serializes with plain `System.Text.Json` (no
  enum-as-string converter), so **production already stores `AccountType` as an int today**;
  removing the Mongo attribute doesn't change existing production behaviour, it just makes local
  storage match what production already does.
- `RootController.cs` has unused `using MongoDB.Bson;`/`using MongoDB.Driver;`, and
  `RootEndpointTests.cs` has a test named `..._WhenMongoIsReachable` — but there is no actual
  Mongo-ping/reachability code anywhere in `Api/` today (confirmed via repo-wide search). Both are
  already stale relative to the actual code; cleaning them up while touching this area.
- DynamoDB Local is already running locally as a Docker container (`amazon/dynamodb-local:latest`,
  `-inMemory`, port 8000) from earlier this session, and both `aws` CLI and `jq` are available on
  this machine.

## My calls (flagging up front, since this is a bigger change)

- **Id attribute:** replace `[BsonId]` with a small new `[Id]` attribute
  (`Api/Repository/IdAttribute.cs`) used by `User.Email`, `DynamoDbRepository<T>`'s reflection, and
  `RepositoryMockFactory`'s reflection — rather than keeping a a dependency on `MongoDB.Bson` just
  for one marker attribute once `MongoDB.Driver` itself is being removed.
- **Endpoint override:** add an optional `ServiceUrl` to `AwsSettings`. When set,
  `ServiceMapping` builds `AmazonDynamoDBClient` with `AmazonDynamoDBConfig { ServiceURL = ... }`
  and static dummy credentials (`BasicAWSCredentials("local", "local")`) instead of the default SDK
  credential chain — DynamoDB Local doesn't check credentials, but the SDK still requires *some*
  static credentials to be supplied when there's no real AWS environment/role to fall back to.
  `ServiceUrl` stays unset/absent in `appsettings.Production.json`, so production is unaffected and
  keeps using the default credential chain (Lambda execution role).
- **`ServiceMapping` simplification:** once Mongo is gone, drop the
  `MongoSettings`-exists branching entirely — always wire up `DynamoDbRepository<T>`. This also
  means local dev and production now share the exact same DI wiring, just with different `Aws`
  config values.
- **Table/data bootstrapping lives in `setup_local.sh`**, matching its existing "safe to re-run"
  philosophy: idempotently start-or-reuse the `dynamodb-local` Docker container (mirrors how
  `run_local.sh` already always kills+restarts its own ports), create the `User` table via `aws
  dynamodb create-table` if it doesn't already exist (schema copied from
  `Terraform/modules/data/main.tf`: hash key `id`, type `S`, `PAY_PER_REQUEST`), then seed the test
  login as a DynamoDB item (`id` = email, `data` = JSON-encoded `User`) instead of a Mongo document.
  Using `jq` to build the nested `--item` JSON (a JSON string embedded as a DynamoDB attribute
  value) safely rather than hand-rolled string concatenation/escaping.
- **`run_local.sh`** no longer needs a "MongoDB already running" prerequisite comment — replaced
  with a note that `source scripts/setup_local.sh` now also brings up the local DynamoDB emulator.
- **Integration tests seed/clean up via `IRepository<User>` from DI**, not raw
  `IAmazonDynamoDB`/table calls — decouples the tests from the storage engine entirely (they
  already resolve other services from `_factory.Services`), and is a smaller change than writing
  DynamoDB-specific fixture code.
- **`RootEndpointTests`**: rename `Get_ReturnsOkWithVersion_WhenMongoIsReachable` →
  `Get_ReturnsOkWithVersion` while in this area, since the Mongo reference is already stale
  (no such check exists) and this change removes Mongo from the codebase entirely.
- **Docs**: update `CLAUDE.md`, root `README.md`, and `FunctionalTests/README.md` where they
  currently say "requires MongoDB" — otherwise they're wrong the moment this merges.
- **Out of scope**: not adding docker-compose or automating "install Docker Desktop" — Docker
  itself is assumed already present (it now is, on this machine). Not touching
  `FunctionalTests/playwright.config.ts` beyond nothing (its one Mongo mention is just a comment,
  no functional dependency).

## Plan

1. `Api/Repository/IdAttribute.cs` (new) — simple marker attribute.
2. `Api/Data/User.cs` — swap `[BsonId]` → `[Id]`, drop the `MongoDB.Bson.Serialization.Attributes`
   using.
3. `Api/Data/Account.cs` — drop `[BsonRepresentation(BsonType.String)]` and the `MongoDB.Bson*`
   usings.
4. `Api/Repository/DynamoDbRepository.cs` — reflect on `[Id]` instead of `[BsonId]`, drop the
   `MongoDB.Bson.Serialization.Attributes` using.
5. `Api/Repository/MongoRepository.cs` — delete.
6. `Api/Configuration/MongoSettings.cs` — delete.
7. `Api/Configuration/AwsSettings.cs` — add optional `ServiceUrl` property.
8. `Api/IoC/ServiceMapping.cs` — remove the Mongo branch entirely; always configure
   `DynamoDbRepository<T>`; build `AmazonDynamoDBClient` with `ServiceURL`/dummy credentials when
   `AwsSettings.ServiceUrl` is set.
9. `Api/Controllers/RootController.cs` — drop unused `MongoDB.Bson`/`MongoDB.Driver` usings.
10. `Api/Pim.Api.csproj` — remove the `MongoDB.Driver` package reference.
11. `Api/appsettings.Local.json` — replace `MongoSettings` with an `Aws` section (`Region`:
    `us-east-1`, `ServiceUrl`: `http://localhost:8000`).
12. `Api.UnitTests/Helpers/RepositoryMockFactory.cs` — reflect on `[Id]` instead of `[BsonId]`,
    drop the Mongo using.
13. `Api.IntegrationTests/LoginEndpointTests.cs` and `SettingsEndpointTests.cs` — seed/clean up via
    `IRepository<User>` (`AddAsync`/`DeleteAsync`) resolved from `_factory.Services`, instead of
    `IMongoDatabase`/`IMongoCollection<User>`; drop the `MongoDB.Driver` using from both.
14. `Api.IntegrationTests/RootEndpointTests.cs` — rename the Mongo-referencing test.
15. `scripts/setup_local.sh` — replace the `mongosh`-based seed with: ensure `dynamodb-local`
    Docker container is running (start existing or `docker run` a new one), ensure the `User` table
    exists (`aws dynamodb create-table` if `describe-table` fails), seed the test login as a
    DynamoDB item (`jq`-built nested JSON) if it doesn't already exist.
16. `scripts/run_local.sh` — update the header comment (Docker/`setup_local.sh` instead of "MongoDB
    already running").
17. `CLAUDE.md`, `README.md`, `FunctionalTests/README.md` — update Mongo-specific
    prerequisite/description text to describe the DynamoDB Local emulator instead.
18. Verify: `dotnet build`, `dotnet test` (unit + integration, against the local DynamoDB emulator
    — no real Mongo needed at all anymore), then a real local run via `scripts/run_local.sh` +
    `source scripts/setup_local.sh`, confirming login and the settings page work end-to-end against
    DynamoDB Local.

## Checklist

- [x] `Api/Repository/IdAttribute.cs` — new `[Id]` marker attribute
- [x] `Api/Data/User.cs` — `[BsonId]` → `[Id]`
- [x] `Api/Data/Account.cs` — drop Mongo attribute/usings
- [x] `Api/Repository/DynamoDbRepository.cs` — reflect on `[Id]` (confirmed no naming collision
      with the existing `private const string IdAttribute` — build is clean)
- [x] Delete `Api/Repository/MongoRepository.cs`
- [x] Delete `Api/Configuration/MongoSettings.cs`
- [x] `Api/Configuration/AwsSettings.cs` — add `ServiceUrl`
- [x] `Api/IoC/ServiceMapping.cs` — drop Mongo branch, wire endpoint override (build clean)
- [x] `Api/Controllers/RootController.cs` — drop unused Mongo usings
- [x] `Api/Pim.Api.csproj` — remove `MongoDB.Driver` package reference (build clean, package fully
      gone from `Api`)
- [x] `Api/appsettings.Local.json` — `MongoSettings` → `Aws` (Region + ServiceUrl)
- [x] `Api.UnitTests/Helpers/RepositoryMockFactory.cs` — reflect on `[Id]` (build clean)
- [x] `Api.IntegrationTests/LoginEndpointTests.cs` — seed/clean up via `IRepository<User>`
      (via `_factory.Services.CreateScope()`, since `IRepository<T>` is scoped — resolving it
      directly off the root `_factory.Services` risks a DI validation error); full project build
      still fails until `SettingsEndpointTests.cs` (next step) is also converted, since it's the
      only other place still referencing the now-removed `MongoDB.Driver` package
- [x] `Api.IntegrationTests/SettingsEndpointTests.cs` — seed/clean up via `IRepository<User>` —
      full solution now builds clean with zero Mongo references anywhere
- [x] `Api.IntegrationTests/RootEndpointTests.cs` — rename Mongo-referencing test
- [x] `scripts/setup_local.sh` — Docker container + table bootstrap + Dynamo-based seed; tested all
      4 paths directly: cold start (no container/table), stopped-but-existing container (data
      resets with `-inMemory`, handled gracefully), already-running+table-exists (seed only), and
      full idempotency (everything skipped, just reports the existing login)
- [x] `scripts/run_local.sh` — update prerequisite comment
- [x] Update `CLAUDE.md`, `README.md`, `FunctionalTests/README.md` Mongo references (also fixed a
      pre-existing stale claim in `CLAUDE.md` that `GET /` "pings Mongo and returns 503" — confirmed
      during the earlier repo survey that `RootController` never actually did this)
- [x] Verify: `dotnet build`/`dotnet test` pass against DynamoDB Local — full solution build clean,
      14/14 tests pass (7 unit + 7 integration); repo-wide sweep confirms zero remaining Mongo
      references in any `.cs`/`.json`/`.csproj`/`.md`/`.sh` file
- [x] Verify: real local run via `run_local.sh` — login + settings page work end-to-end (confirmed
      by David)

## Prompt Log

1. "start UBE-28"
2. "yes, go ahead" (step 1 — IdAttribute.cs)
3. "yes" (step 2 — User.cs)
4. "yes, go ahead" (step 3 — Account.cs)
5. "yes, go ahead" (step 4 — DynamoDbRepository.cs)
6. "yes, go ahead" (step 5 — delete MongoRepository.cs)
7. "yes, go ahead" (step 6 — delete MongoSettings.cs)
8. "yes, go ahead" (step 7 — AwsSettings.cs ServiceUrl)
9. "yes, go ahead" (step 8 — ServiceMapping.cs)
10. "yes, go ahead" (step 9 — RootController.cs usings)
11. "yes, go ahead" (step 10 — Pim.Api.csproj)
12. "yes, go ahead" (step 11 — appsettings.Local.json)
13. "yes, go ahead" (step 12 — RepositoryMockFactory.cs)
14. "yes, go ahead" (step 13 — LoginEndpointTests.cs)
15. "yes, go ahead" (step 14 — SettingsEndpointTests.cs)
16. "yes, go ahead" (step 15 — RootEndpointTests.cs rename)
17. "yes, go ahead" (step 16 — setup_local.sh)
18. "yes, go ahead" (step 17 — run_local.sh)
19. "yes, go ahead" (step 18 — CLAUDE.md/README.md/FunctionalTests/README.md)
20. "yes, go ahead" (step 19 — dotnet build/test verification)
21. "verified" (step 20 — real local run confirmed by David)
