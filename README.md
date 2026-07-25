# PIM for David Cameron

This creates a Personal Financial Manager specifically for one user.

# Running on local

- Install MongoDb https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x/
- Install node
- Install dotnet
- Run `scripts/setup_local.sh` to seed a test login into MongoDB (requires `mongosh` and `htpasswd` on `PATH`; safe to re-run, skips the insert if it already exists)

## Test login

- Login: `testuser`
- Password: `TestPassword123!`