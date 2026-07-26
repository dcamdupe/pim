# UBE-26 — Add environment variables into the front end

Linear: https://linear.app/uberconcept/issue/UBE-26/add-environment-variables-into-the-front-end

## Description

- .env file for local and production
- extract the API url to environment variable & update code
- Update .gitignore to exclude the .env file
- Update the local_setup.sh to copy the local .env file to .env

## Clarifications (resolved before implementation)

- **Production API URL:** use the current temporary API Gateway URL, `https://flyquy7vlg.execute-api.ap-southeast-2.amazonaws.com`, directly (not a placeholder) — update by hand later if/when a stable custom domain exists.
- **File naming:** `FrontEnd/.env.local.example` (committed template for local dev, copied to the gitignored `FrontEnd/.env`) and `FrontEnd/.env.production` (committed, since it holds a non-secret endpoint URL and Vite loads it automatically for production builds).
- **`authService.ts`'s fallback:** remove the hardcoded `?? 'http://localhost:5037'` fallback — a missing `VITE_API_BASE_URL` should fail loudly rather than silently default.
- **`setup_local.sh` copy behavior:** originally skip-if-exists; changed per later feedback to always overwrite `FrontEnd/.env` from the template, keeping it in sync on every run.

## Plan

1. `FrontEnd/.env.local.example` (committed) — template with `VITE_API_BASE_URL=http://localhost:5037`.
2. `FrontEnd/.env.production` (committed) — `VITE_API_BASE_URL=https://flyquy7vlg.execute-api.ap-southeast-2.amazonaws.com`.
3. `FrontEnd/.gitignore` — add `.env` so the real, locally-generated file never gets committed.
4. `FrontEnd/src/services/authService.ts` — drop the hardcoded fallback, read `VITE_API_BASE_URL` directly.
5. `scripts/setup_local.sh` — copy `FrontEnd/.env.local.example` → `FrontEnd/.env`, always overwriting.
6. `README.md` — document the new setup step.

## Checklist

- [x] `FrontEnd/.env.local.example`
- [x] `FrontEnd/.env.production`
- [x] `FrontEnd/.gitignore` — exclude `.env`
- [x] `FrontEnd/src/services/authService.ts` — env-driven API URL, no fallback
- [x] `scripts/setup_local.sh` — copy local env template (always overwrite)
- [x] `README.md` — document the new step
- [x] Verify: `FrontEnd` build + lint + unit tests, functional tests still pass (all green, including confirming the production build embeds the `.env.production` URL, not localhost)

## Prompt Log

1. "start worklog for UBE-26"
2. "use the current temporary URL: https://flyquy7vlg.execute-api.ap-southeast-2.amazonaws.com"
3. "Remove the fallback" / "Skip if it already exists" (clarifying question answers)
4. "start"
5. "merge from maain"
6. "remove the validation for FRONTEND_ENV existing, always overwrite"
