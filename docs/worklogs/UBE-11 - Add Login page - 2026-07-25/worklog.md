# UBE-11 — Add Login page

Linear: https://linear.app/uberconcept/issue/UBE-11/add-login-page

## Description

Add the login page in the front end project, connecting to the API to perform authentication.

- The login form should be centered vertically and horizontally.
- There should be client side validation that the fields are populated.
- Calling the API should be implemented in a service class.

## Plan

1. Remove the initial Vue.js boilerplate (default `HelloWorld`/`TheWelcome` components, sample views/assets from `create-vue` scaffold) from `FrontEnd/src/`.
2. Create a `LoginView.vue` page under `FrontEnd/src/views/` with a form (login/password fields), styled to be centered vertically and horizontally on the page.
3. Add client-side validation requiring both fields to be populated before submit, showing inline error state/messages.
4. Create an `authService` (e.g. `FrontEnd/src/services/authService.ts`) that wraps the `POST /login` call to the Api, returning the JWT on success and surfacing failure (400) to the caller.
5. Wire the login page to the service: on submit, call the service, handle success (store token, e.g. via Pinia store) and failure (display error) cases.
6. Add a `/login` route via `vue-router`.
7. Add a `DashboardView.vue` placeholder page and a `/dashboard` route (target for a successful login).
8. Verify manually against the running Api (`dotnet run --project Api`) + FrontEnd dev server (`npm run dev`): empty submit shows validation errors, invalid credentials shows API error, valid credentials succeeds and reaches the dashboard placeholder.

## Checklist

- [x] Remove initial Vue.js boilerplate
- [x] Create `LoginView.vue` with centered layout
- [x] Add client-side validation for required fields
- [x] Create `authService` to call `POST /login`
- [x] Wire login form submit to `authService`, handle success/failure
- [x] Add `/login` route
- [x] Add `DashboardView.vue` placeholder page + `/dashboard` route
- [x] Verify end-to-end against local Api + Mongo

## Notes

- Removed scaffold files: `HelloWorld.vue`, `HomeView.vue`, `stores/counter.ts`, `assets/{hero.png,vite.svg,vue.svg}`, `public/icons.svg`; reset `style.css` to a minimal baseline (kept the light/dark theme CSS variables); updated `index.html` title from `frontend` to `PIM`.
- `FrontEnd/src/services/authService.ts`: `login(login, password)` calls `POST {VITE_API_BASE_URL ?? http://localhost:5037}/login`, returns the JWT on `200`, throws `LoginFailedError` otherwise.
- `FrontEnd/src/stores/auth.ts`: Pinia store holding the JWT (`token`, `setToken`).
- `FrontEnd/src/views/LoginView.vue`: form centered via flexbox on a full-viewport-height wrapper; required-field validation on submit (no native browser validation — `novalidate` + manual checks so error styling is consistent); calls `authService.login`, stores the token, routes to `/dashboard` on success, shows an inline error on failure.
- `FrontEnd/src/views/DashboardView.vue`: placeholder page ("Dashboard" / "Coming soon.").
- `FrontEnd/src/router/index.ts`: `/` redirects to `/login`; added `/login` and `/dashboard` routes.
- **Deviation from ticket:** the ticket didn't mention CORS or transport, but the Api's `UseHttpsRedirection()` (redirecting to a self-signed dev cert) plus no CORS policy would block the browser from calling it from the Vite dev server entirely. In `Api/Program.cs`, added a `FrontEndDev` CORS policy (`http://localhost:5173`) and skip `UseHttpsRedirection()` in Development — both gated behind `IsDevelopment()`, so production behaviour (HTTPS redirect, no CORS) is unchanged.
- `FrontEnd/vite.config.ts`: pinned the dev server to port `5173` (`server.port`) since another process on the machine was intermittently occupying it and the CORS policy is pinned to that origin.
- Verified end-to-end: `dotnet build` and `npm run build`/`npm run lint` clean; `POST /login` returns `200`+JWT for `testuser`/`TestPassword123!` and `400` for a wrong password (curl); CORS preflight from `http://localhost:5173` succeeds; manually checked in-browser (user) — empty submit shows validation errors, wrong password shows the invalid-login error, correct credentials redirect to the dashboard placeholder.

## Prompt Log

1. "create worklog for UBE-11"
2. "add an additional step to remove all the initial vue.js boilerplate. And an additional step to add a dashboard placholder page"
3. "start implementing the checklist"
4. "set Vite to explicitly use 5173"
5. "checked" / "all three cases passed" (manual browser verification)
