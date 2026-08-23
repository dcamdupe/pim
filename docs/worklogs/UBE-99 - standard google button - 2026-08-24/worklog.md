# UBE-99: Change the login with google button to a standard one

## Linear issue

https://linear.app/uberconcept/issue/UBE-99/change-the-login-with-google-button-to-a-standard-one

> There is a standard button for this, use the standard button

## Description

`LoginView.vue`'s Google sign-in button is currently just a plain `<button>`
styled by the app's generic scoped `button` rule ("Sign in with Google" text,
no logo, no Google branding). Google publishes a standard branded "Sign in
with Google" button spec (white background, border, Google "G" logomark,
Roboto-ish font/sizing) under its Identity Services branding guidelines. This
work replaces the plain button with one that matches that standard look,
without changing the underlying click behavior (`onGoogleLogin` /
`beginGoogleLogin`).

## Plan

1. Add the Google "G" logomark as an inline SVG (or asset file) for use in
   the button.
2. Update the Google button markup/styles in `LoginView.vue` so it matches
   Google's standard branded button (white background, border, logo + "Sign
   in with Google" text, standard sizing/font), separate from the app's
   generic `button` style used for the email/password form's submit button.
3. Keep `onGoogleLogin`'s click handling and the "Redirecting…" disabled
   state unchanged.
4. Visually verify in the browser via `scripts/run_local.sh`.
5. Run `npm run lint` and `npm run build` in `FrontEnd/` to confirm no
   errors.

## Checklist

- [x] Add Google "G" logomark asset/SVG
- [x] Restyle the Google sign-in button to match Google's standard button
- [x] Verify visually in the browser
- [x] `npm run lint` passes
- [x] `npm run build` passes

## Session log

### Prompt: "start a worklog for UBE-99"

Fetched issue details from Linear, inspected the current Google login button
(`FrontEnd/src/views/LoginView.vue`, `FrontEnd/src/services/auth/cognitoAuthService.ts`),
confirmed no existing unit/functional tests assert on its markup, drafted the
plan above, wrote this worklog, and created the branch
`UBE-99/standard-google-login-button` off `main`.

### Prompt: "gp"

Replaced the plain "Sign in with Google" button in `LoginView.vue` with
Google's standard branded button: inline four-color Google "G" logomark SVG,
white background, `#747775` border, 4px radius, Roboto 500/14px `#1f1f1f`
text, 40px height — kept in a separate `.google-btn` style block from the
app's generic `button` rule, and left `onGoogleLogin`'s click handling and
disabled/"Redirecting…" state unchanged. Ran `npm run lint` and
`npm run build` in `FrontEnd/` (both clean). Local dev isn't configured with
`VITE_AUTH_PROVIDER=cognito`, so the button doesn't render in the running
app locally; verified the look by rendering the exact markup/CSS standalone
and screenshotting it with Playwright (matches Google's branding spec)
rather than editing the local `.env`.
