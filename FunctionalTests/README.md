# FunctionalTests

End-to-end tests (TypeScript + Playwright) covering the web app's user flows against the real stack.

## Prerequisites

Before running `npm test`, make sure the following are running:

1. MongoDB (`mongodb://localhost:27017` by default).
2. The test login seeded — run `../scripts/setup_local.sh` (idempotent).
3. The Api, e.g. `dotnet run --project ../Api --urls http://localhost:5037`.

The FrontEnd dev server itself is started automatically by Playwright (`playwright.config.ts`'s `webServer`) — you don't need to start it manually.

## Running

```
npm install
npx playwright install chromium
npm test
```
