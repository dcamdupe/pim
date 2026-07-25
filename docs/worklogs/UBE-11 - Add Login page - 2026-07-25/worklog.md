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

- [ ] Remove initial Vue.js boilerplate
- [ ] Create `LoginView.vue` with centered layout
- [ ] Add client-side validation for required fields
- [ ] Create `authService` to call `POST /login`
- [ ] Wire login form submit to `authService`, handle success/failure
- [ ] Add `/login` route
- [ ] Add `DashboardView.vue` placeholder page + `/dashboard` route
- [ ] Verify end-to-end against local Api + Mongo

## Notes

## Prompt Log

1. "create worklog for UBE-11"
2. "add an additional step to remove all the initial vue.js boilerplate. And an additional step to add a dashboard placholder page"
