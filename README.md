# PIM for David Cameron

This creates a Personal Financial Manager specifically for one user.

# Running on local

- Install MongoDb https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/
- Install node
- Install dotnet
- Run `scripts/setup_local.sh` to seed a test login into MongoDB (requires `mongosh` and `htpasswd` on `PATH`; safe to re-run, skips the insert if it already exists)

## Running the API

- `cd Api && dotnet run`
- Accessible at http://localhost:5037 (or https://localhost:7010)

## Running the front end

- `cd FrontEnd && npm install && npm run dev`
- Accessible at http://localhost:5173

## Running in VS Code

- Open the Run and Debug panel and select **Api + FrontEnd** to start both the API and the front end together

## Test login

- Email: `testuser@example.com`
- Password: `TestPassword123!`