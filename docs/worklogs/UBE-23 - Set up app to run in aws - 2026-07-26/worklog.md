# UBE-23 — Set up app to run in aws

Linear: https://linear.app/uberconcept/issue/UBE-23/set-up-app-to-run-in-aws

## Description

- Create dynamodb repo implementation
  - Implement IRepository
- Split appsettings.json files by environment (local and production)
  - Move all config specific to local to the local file (eg `MongoSettings`)
- Set api to run as a lambda connected to the API gateway
  - should still be able to run on local
- Change DI to use dynamodb when MongoSettings is not present
- Update local_setup.sh to set the local env variable

## Clarifications (resolved before implementation)

- **DynamoDB data model:** *(revised)* not a single shared table — one table per entity, named after the entity, mirroring how `MongoRepository<T>` already derives its Mongo collection name from `typeof(T).Name`. `DynamoDbRepository<T>` computes its table name the same way (`typeof(T).Name`, e.g. `User`) with no environment prefix — each environment is its own separate AWS account (see `Terraform/README.md`), so DynamoDB table names (unique only per account+region) can't collide across environments regardless of naming. `Terraform/modules/data/main.tf` is updated to match: the table's `name` changes from the hardcoded `${var.application}-${var.environment}-users` to a `table_name` variable (currently passed as `"User"`, no environment in it), keeping the module reusable if a second entity/table shows up later without building unused multi-table machinery now.
- **DynamoDB hash key attribute:** *(my call, flagging)* renaming Terraform's hash key attribute from `userId` to a generic `id`, since the table is no longer specifically a "users" table — a future entity (e.g. a `Transaction` table) wouldn't naturally have a `userId` hash key. `DynamoDbRepository<T>` writes/reads this attribute name regardless of entity type.
- **Lambda hosting:** add the `Amazon.Lambda.AspNetCoreServer.Hosting` package and `builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi)` to `Program.cs`, so the same `Api` project runs via Kestrel locally and auto-detects Lambda in AWS — no separate handler class needed (replacing the `lambda-stub` approach entirely).
- **Terraform:** update `Terraform/modules/api/main.tf` now (not deferred) to deploy the real `Api` project instead of `lambda-stub` — in scope for this ticket.
- **Local environment name:** a custom `"Local"` environment (not ASP.NET Core's built-in `"Development"`) — `appsettings.Development.json` → `appsettings.Local.json`, `ASPNETCORE_ENVIRONMENT=Local` in `launchSettings.json`/`.vscode/launch.json`, `Program.cs`'s dev-only block (`IsDevelopment()`) → `IsEnvironment("Local")`, and `Api.IntegrationTests`'s `WebApplicationFactory<Program>` (which otherwise defaults to `"Development"` itself) explicitly told to use `"Local"`.
- **appsettings split:** `appsettings.Development.json` → `appsettings.Local.json` (keeps `MongoSettings`); new `appsettings.Production.json` (currently no keys of its own — see AWS config note below); shared config (`Logging`, `JwtSettings`, `AllowedHosts`, `Version`, and now `Aws`) stays in the base `appsettings.json`.
- **AWS config:** region lives in a new shared `Aws` section (`AwsSettings.Region`) in the base `appsettings.json` (`ap-southeast-2`), not per-environment — it's the same value everywhere, so there's no reason to duplicate/override it per environment. `DynamoDbRepository<T>` reads it from there rather than from its own settings class.
- **`setup_local.sh`:** should actually set `ASPNETCORE_ENVIRONMENT=Local` (not just rely on `launchSettings.json`). Since a script's `export` doesn't persist to the invoking shell unless the script is *sourced*, `setup_local.sh` needs to be run with `source scripts/setup_local.sh` (not executed directly) for this to take effect — README updated accordingly, and the script detects+warns if it's run directly instead of sourced.

## My calls (low-stakes, flagging rather than asking)

- **Lambda `Handler` value:** with `AddAWSLambdaHosting`, AWS's Lambda .NET base runtime auto-discovers the entry point, so `Handler` becomes just the assembly name (`"Pim.Api"`), no `Class::Method` string needed.
- **Terraform `lifecycle.ignore_changes`:** removing it from `aws_lambda_function.api` now that a real, evolving artifact is deployed — it existed specifically to protect a future out-of-band CI/CD deploy from Terraform reverting a *stub*; there's no such pipeline yet, so Terraform should manage the full lifecycle for now.
- **Terraform CI workflow:** `.github/workflows/terraform.yml` needs a `dotnet publish` step again (removed earlier when the stub became a committed static zip) since the real `Api` project changes regularly and can't be a hand-committed artifact.

## Plan

1. **`Api/Data/AwsSettings.cs`** — new shared settings class (`Region` only), bound from a new `Aws` config section in the base `appsettings.json` (`"Aws": { "Region": "ap-southeast-2" }`) — not environment-specific, so it lives in the shared base file, not `Local`/`Production`.
2. **`Api/Data/DynamoDbRepository.cs`** — implements `IRepository<T>`: table name computed as `typeof(T).Name` (mirroring `MongoRepository<T>`'s `typeof(T).Name` collection naming, no environment prefix); constructs its `AmazonDynamoDBClient` using `AwsSettings.Region`; `GetAsync`/`AddAsync`/`UpdateAsync`/`DeleteAsync` store `{ id = <id>, data = <JSON-serialized T> }`.
3. **`Api.csproj`** — add `AWSSDK.DynamoDBv2` and `Amazon.Lambda.AspNetCoreServer.Hosting` package references.
4. **appsettings split:**
   - Rename `appsettings.Development.json` → `appsettings.Local.json`, keep `MongoSettings` there.
   - New `appsettings.Production.json` — no DynamoDB-specific keys needed currently (region is shared/base, table name is automatic), kept as a placeholder for genuine future production-only overrides.
   - Remove `MongoSettings` from the base `appsettings.json`; add the new `Aws` section there instead.
5. **`Program.cs`:**
   - `AddAWSLambdaHosting(LambdaEventSource.HttpApi)`.
   - Conditionally register Mongo (`IMongoClient`/`IMongoDatabase`/`MongoRepository<>`) vs DynamoDB (`IAmazonDynamoDB`/`DynamoDbRepository<>`) based on whether the `MongoSettings` config section is present.
   - `app.Environment.IsDevelopment()` → `app.Environment.IsEnvironment("Local")`.
6. **`Api/Properties/launchSettings.json`** + **`.vscode/launch.json`** — `ASPNETCORE_ENVIRONMENT` → `"Local"`.
7. **`Api.IntegrationTests/ApiWebApplicationFactory.cs`** — explicitly set the test host's environment to `"Local"`.
8. **`scripts/setup_local.sh`** — `export ASPNETCORE_ENVIRONMENT=Local`; detect+warn if the script is executed instead of sourced.
9. **`README.md`** — update the setup instruction to `source scripts/setup_local.sh`.
10. **Terraform (`Terraform/modules/data/`):**
    - Add a `table_name` variable (passed as `"User"` from the root module for now); rename `aws_dynamodb_table.users` → keyed by that variable, hash key attribute `userId` → `id`.
11. **Terraform (`Terraform/modules/api/`):**
    - Remove `lambda-stub/`.
    - Publish the real `Api` project as the Lambda deployment package (`dotnet publish -c Release -r linux-x64 --self-contained false`), update `filename`/`source_code_hash`/`handler` (`"Pim.Api"`) on `aws_lambda_function.api`, remove the now-unneeded `lifecycle.ignore_changes`.
    - No Lambda-specific environment variable needed for the region — it's a static, non-secret value already committed in the base `appsettings.json`, which ships inside the deployment package.
12. **`.github/workflows/terraform.yml`** — add back a `dotnet publish` step (with `actions/setup-dotnet`) before `terraform plan`/`apply`, since the real `Api` Lambda package can no longer be a static committed zip.
13. Verify: `dotnet build`/`dotnet test` (unit + integration, against local Mongo under `ASPNETCORE_ENVIRONMENT=Local`), `terraform fmt`/`validate`, and a manual local run confirming the Api still starts normally via Kestrel.

## Checklist

- [ ] `Api/Data/AwsSettings.cs` + shared `Aws` config section in base `appsettings.json`
- [ ] `Api/Data/DynamoDbRepository.cs`
- [ ] `Api.csproj` — add AWS SDK + Lambda hosting packages
- [ ] appsettings split (`Local`/`Production`/base)
- [ ] `Program.cs` — Lambda hosting, conditional DI, `IsEnvironment("Local")`
- [ ] `launchSettings.json` + `.vscode/launch.json` — `ASPNETCORE_ENVIRONMENT=Local`
- [ ] `ApiWebApplicationFactory.cs` — force `"Local"` environment
- [ ] `scripts/setup_local.sh` — export `ASPNETCORE_ENVIRONMENT=Local`, warn if not sourced
- [ ] `README.md` — document sourcing requirement
- [ ] Terraform: `modules/data` — `table_name` variable (`"User"`), hash key `userId` → `id`
- [ ] Terraform: remove `lambda-stub`, deploy real `Api` artifact, drop `lifecycle.ignore_changes`
- [ ] `.github/workflows/terraform.yml` — restore `dotnet publish` step
- [ ] Verify: `dotnet build`/`test`, `terraform fmt`/`validate`, local Kestrel run

## Prompt Log

1. "create worklog for UBE-23"
2. "like (1), except instead of Development, call it Local" (clarification on appsettings split)
3. "it should set the environment as Local" (clarification on setup_local.sh)
4. "The DynamoDb table name should match the entity name. Ie, if the entity is Login, the dynamoDb table should be Login"
5. "Why TableNamePrefix?"
6. "TF was wrong to prefix this with the environment, each environment would have their own AWS Account. Remove TablePrefix & adjust the TF readme accordingly"
7. "Update instructions to create a AWS config section which stores the region. DynamoDb should load this information from there. This can be set in app.settings as ap-southeast-2, no need to have env specific settings"
