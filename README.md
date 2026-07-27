# PIM for David Cameron

This creates a Personal Financial Manager specifically for one user.

# Running on local

- Install MongoDb https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/
- Install node
- Install dotnet
- Run `source scripts/setup_local.sh` (must be *sourced*, not executed directly, so `ASPNETCORE_ENVIRONMENT=Local` persists in your shell) to seed a test login into MongoDB, copy `FrontEnd/.env.local` to `FrontEnd/.env`, and set `ASPNETCORE_ENVIRONMENT=Local` for the Api (requires `mongosh` and `htpasswd` on `PATH`; safe to re-run - skips the login insert if it already exists, always overwrites `FrontEnd/.env`)

## Starting the app

- Run `scripts/run_local.sh` to build and start both the API and the front end together in one
  terminal - kills anything already bound to their ports first, so it's always safe to re-run;
  `Ctrl+C` stops both. Requires MongoDB already running and `source scripts/setup_local.sh` already
  done at least once (see above).
- To run just one piece on its own, see the sections below.

## Running the API

- `cd Api && dotnet run`
- Accessible at http://localhost:5037 (or https://localhost:7010)

## Running the front end

- `cd FrontEnd && npm install && npm run dev`
- Accessible at http://localhost:5173
- Requires `FrontEnd/.env` (see `scripts/setup_local.sh` above) providing `VITE_API_BASE_URL`; `FrontEnd/.env.production` is used automatically for production builds (`npm run build`)

## Running in VS Code

- Open the Run and Debug panel and select **Api + FrontEnd** to start both the API and the front end together

## Test login

- Email: `testuser@example.com`
- Password: `TestPassword123!`