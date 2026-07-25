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

- [ ] Add `MongoDB.Driver` package reference
- [ ] Add Mongo connection settings to `appsettings.json` / `appsettings.Development.json`
- [ ] Define `IRepository<T>` interface
- [ ] Implement `MongoRepository<T>`
- [ ] Wire up DI registration in `Program.cs`
- [ ] Verify build and local Mongo connectivity

## Prompt Log

1. "create a worklog for UBE-8"
