# UBE-8 — Add DB connectivity

Linear: https://linear.app/uberconcept/issue/UBE-8/add-db-connectivity

## Description

Add DB connectivity for local dev:

- Add MongoDB connection settings into the default `appsettings` file.
- Create an interfaced generic repository class supporting `Get`, `Add`, `Update`, and `Delete` methods.
- Implement a concrete version of this repository for MongoDB.

## Plan

1. Add the `MongoDB.Driver` package to `Api`.
2. Add a `MongoSettings` (connection string / database name) section to `appsettings.json` / `appsettings.Development.json`.
3. Define an `IRepository<T>` interface with `Get`, `Add`, `Update`, `Delete` methods.
4. Implement `MongoRepository<T>` as the concrete MongoDB-backed implementation.
5. Register the repository and Mongo client/settings in DI (`Program.cs`).
6. Verify the API builds and the repository can connect to a local MongoDB instance.

## Checklist

- [x] Add `MongoDB.Driver` package reference
- [x] Add Mongo connection settings to `appsettings.json` / `appsettings.Development.json`
- [x] Define `IRepository<T>` interface
- [x] Implement `MongoRepository<T>`
- [x] Wire up DI registration in `Program.cs`
- [x] Verify build and local Mongo connectivity

## Notes

- `Api/Data/IEntity.cs`, `IRepository.cs`, `MongoSettings.cs`, `MongoRepository.cs` add the generic repository abstraction (`Get`, `Add`, `Update`, `Delete`) and its MongoDB-backed implementation, keyed by `IEntity.Id` and one collection per entity type name.
- `Program.cs` registers `MongoSettings` from config, an `IMongoClient`/`IMongoDatabase` singleton, and `IRepository<>` → `MongoRepository<>` via DI. Added `MongoSettings` (`ConnectionString`, `DatabaseName`) to `appsettings.json` (`mongodb://localhost:27017`, db `pim`).
- Added `Api/Controllers/RootController.cs`: a `GET /` MVC controller that pings MongoDB (`{ ping: 1 }`) before responding — returns `200` with the assembly version on success, or a `503` ProblemDetails response with the connection failure detail if Mongo is unreachable. Enabled MVC controllers in `Program.cs` (`AddControllers()` / `MapControllers()`) to support this.
- Verified end-to-end against a local `mongod` (via `brew services`): `GET /` returns `200 {"version":"1.0.0.0"}` when Mongo is up, and `503` with a `MongoConnectionException`/timeout detail when Mongo is stopped.
- `dotnet build` is clean (0 warnings / 0 errors) with `TreatWarningsAsErrors` still enabled.

## Prompt Log

1. "create a worklog for UBE-8"
2. "start the worklog"
3. "Create a / get controller which connects to mongo and returns the version of the API. This should also connect to Mongo to confirm this works before returning a 200/"
4. "mongo is running, I've connected to it"
5. "mongodb://localhost:27017"
6. "try now"
