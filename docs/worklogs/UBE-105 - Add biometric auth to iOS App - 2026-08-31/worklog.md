# UBE-105: Add biometric auth to iOS App

## Linear issue

https://linear.app/uberconcept/issue/UBE-105/add-biometric-auth-to-ios-app

> Add biometric auth to iOS App

(No description on the issue - scope below is inferred from the current iOS auth
code and confirmed with David before implementation.)

## Description

Today the iOS app keeps **no** persisted session: `LoginView` holds the
`CognitoSession` in `@State`, so every cold launch means a full Google Hosted-UI
sign-in via `ASWebAuthenticationSession`. Nothing is written to the Keychain and
the `refreshToken` returned by the token exchange is never used.

This adds a **Face ID / Touch ID unlock** on launch:

1. After a successful Google sign-in, persist the Cognito `refreshToken` to the
   **Keychain**, behind a biometric-gated access control.
2. On cold launch, if a stored refresh token exists, show an "Unlock" screen ->
   `LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)` -> on
   success, read the refresh token and exchange it for a fresh `idToken`
   (Cognito `grant_type=refresh_token`, mirroring web's `refreshCognitoToken`)
   -> straight into `AppTabView`, skipping the web flow.
3. If biometrics are unavailable / the user cancels / the refresh fails, fall
   back to the existing "Sign in with Google" button.
4. Sign out clears the Keychain entry (in addition to the store `clear()` that
   UBE-103 added).

### Not in scope

- Transparent token refresh on a 401 mid-session (the app still shows the
  "session expired" state from UBE-102/103). Could be a follow-up now that a
  refresh token is available - noted, not done here.
- A passcode (non-biometric) fallback via `.deviceOwnerAuthentication`. Keeping
  it biometrics-only for now; the Google button is the fallback.
- Remembering / persisting the `idToken` itself - only the refresh token is
  stored; the id token is always re-derived on unlock.

### Dependencies

Branched off **`UBE-103/ios-app-transaction-screen`** (PR #89, open), not `main`:
biometric unlock needs to land in `AppTabView` (UBE-103) and both changes edit
`LoginView`. If #89 merges first, rebase this onto `main`.

### Environment constraint (same as UBE-97 / 102 / 103)

Xcode Command Line Tools only - no `xcodebuild` / simulator. Swift + `pbxproj`
edits are hand-authored and host-`swiftc`-checked where they are Foundation-only;
**David builds & runs in Xcode.** Biometric flows can only really be verified on
a device / simulator with a configured Face ID.

## Plan

1. **Keychain helper** - `Services/KeychainStore.swift`: `save(_:for:)` /
   `read(for:)` / `delete(for:)` around `SecItem*`, using a
   `SecAccessControlCreateWithFlags(..., .biometryCurrentSet, ...)` access
   control and `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. One key:
   `pim.refreshToken`.
2. **Biometric gate** - `Services/BiometricAuth.swift`: wraps `LAContext` -
   `canEvaluate` (which biometry type is available, if any) and
   `authenticate(reason:)` returning success / a typed failure
   (`unavailable`, `cancelled`, `failed`).
3. **Token refresh** - add `refreshSession(refreshToken:)` to
   `CognitoAuthService`: POST `grant_type=refresh_token`, decode `id_token`,
   return a `CognitoSession` reusing the same refresh token (Cognito does not
   reissue it). Mirrors `refreshCognitoToken` in the web
   `cognitoAuthService.ts`.
4. **Session bootstrap** - a `SessionController` (`@MainActor ObservableObject`)
   owning the app's auth state:
   `.locked` (a stored refresh token exists) / `.signedOut` / `.signedIn(session)`.
   - `bootstrap()` on launch: Keychain has a token -> `.locked`, else `.signedOut`.
   - `unlock()`: biometric prompt -> refresh -> `.signedIn`, on failure stay
     `.locked` with an error (Google button still available).
   - `signInWithGoogle()`: existing flow, then persist the refresh token ->
     `.signedIn`.
   - `signOut()`: clear Keychain + stores -> `.signedOut`.
5. **UI**
   - `iosAppApp` / a new root `RootView` switches on `SessionController.state`:
     `LoginView` (signedOut / locked) vs. `AppTabView` (signedIn).
   - `LoginView` gains an "Unlock with Face ID" primary button when `.locked`
     (icon per `BiometricAuth` type), with the Google button beneath as
     "Use a different account" / fallback. Auto-trigger the biometric prompt
     once on appear when `.locked`.
   - Replace `LoginView`'s local `@State session` + `fullScreenCover` with the
     `SessionController` (env object); `AppTabView` sign-out calls
     `controller.signOut()`.
6. **Info.plist** - add `NSFaceIDUsageDescription`.
7. **Project file** - add the new Swift files to `project.pbxproj` (refs /
   `Services` group / Sources), following the UBE-103 entries.
8. **Checks** - host `swiftc -typecheck` the Foundation/LocalAuthentication-only
   files (`KeychainStore`, `BiometricAuth`, `CognitoAuthService`); `plutil -lint`
   the plist + pbxproj; hand off to David for the on-device build & test.

## Checklist

- [x] 1. `Services/KeychainStore.swift` - biometric-gated `SecItem` wrapper, one key `pim.refreshToken`
- [x] 2. `Services/BiometricAuth.swift` - `BiometricType` + `availableType` (LAContext)
- [x] 3. `CognitoAuthService.refreshSession(refreshToken:)` + `CognitoSession: Equatable`
- [x] 4. `SessionController` (`.locked` / `.signedOut` / `.signedIn`, bootstrap in `init`)
- [x] 5. `RootView` state switch + `LoginView` rework (unlock + Google fallback, auto-prompt on appear) + `iosAppApp` env object
- [x] 6. `Info.plist` `NSFaceIDUsageDescription`
- [x] 7. `project.pbxproj` entries (4 files, `plutil -lint` OK)
- [x] 8. Host `swiftc -typecheck` (KeychainStore + BiometricAuth + SessionController via a Cognito stub) + `swiftc -parse` all; lint OK
- [x] 9. Worklog tidy-up
- [ ] 10. Hand off to David for on-device build & test

## Prompt log

### Prompt 1

> start a worklog for UBE-105

Issue has no description. Reviewed the current iOS auth code
(`CognitoAuthService`, `LoginView`, `iosAppApp`, `Info.plist`) - found there is
no session persistence at all today, and the `refreshToken` from the token
exchange is unused. Reviewed the web `refreshCognitoToken` for the refresh-grant
shape. Drafted the plan above (Keychain-stored refresh token + `LAContext`
unlock on launch). Created branch `UBE-105/ios-biometric-auth` off
`UBE-103/ios-app-transaction-screen` and this worklog. **Awaiting confirmation
of the plan before implementing.**

### Prompt 2

> what is the expiry for the cognito token?

The user-pool client (`Terraform/modules/cognito/main.tf`) sets no validity
attributes, so Cognito defaults apply: **id token 1 h, access token 1 h, refresh
token 30 days**. So the biometric-unlock path keeps working for up to 30 days
since the last full Google sign-in; after that the refresh grant 401s and the
app falls back to the Google button. Noted in Scope.

### Prompt 3

> implement according to the plan

Implemented all of steps 1-8:

- **`KeychainStore`** - `SecItem*` wrapper, one key `pim.refreshToken`, stored
  with a `.biometryCurrentSet` access control + `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly`.
  `read` triggers the biometric prompt (via `kSecUseAuthenticationContext`);
  `contains` / `delete` don't.
- **`BiometricAuth`** - `BiometricType` (`faceID` / `touchID` / `none`, with
  `label` + SF Symbol) and `availableType` from `LAContext`.
- **`CognitoAuthService.refreshSession(refreshToken:)`** - `grant_type=refresh_token`
  POST -> new id token, same refresh token reused (mirrors web
  `refreshCognitoToken`); throws `GoogleLoginError.refreshFailed` on non-200.
  `CognitoSession` is now `Equatable`.
- **`SessionController`** (`@MainActor ObservableObject`) - `.locked` /
  `.signedOut` / `.signedIn(CognitoSession)`, decided in `init` (stored token +
  biometrics available -> `.locked`). `unlock()` = Keychain read (biometric
  prompt) -> `refreshSession` -> `.signedIn`; a cancelled prompt stays locked
  silently, a `refreshFailed` deletes the token and drops to `.signedOut` with a
  "session expired" message, other errors keep the Google fallback.
  `signInWithGoogle()` persists the refresh token best-effort. `signOut()` wipes
  the Keychain entry.
- **UI** - `RootView` switches `LoginView` vs. `AppTabView` on
  `SessionController.state`; `iosAppApp` owns the controller as a `@StateObject`
  env object. `LoginView` reworked: env object instead of local `@State`; when
  `.locked` it shows "Unlock with Face ID/Touch ID" (auto-prompts once via
  `.task`) with "Sign in with a different account" beneath, else just the Google
  button. Removed the old `fullScreenCover` + `CognitoSession: Identifiable`.
- **`Info.plist`** - `NSFaceIDUsageDescription`.
- **`project.pbxproj`** - 4 new files into `Services` / `Views` groups + refs +
  Sources; `plutil -lint` OK.

Fixed one real issue the host type-check caught: a `@MainActor`-isolated
`CognitoAuthService()` default argument - switched `SessionController.init` to
`authService: CognitoAuthService? = nil` (same pattern as the UBE-103 stores).
`KeychainStore` + `BiometricAuth` + `SessionController` (with a Cognito stub)
pass host `swiftc -typecheck`; every changed file passes `swiftc -parse`. The
SwiftUI views and the on-device biometric flow are David's to verify in Xcode.

## Handoff

Open `iosApp/iosApp.xcodeproj` (build off this branch until #89 merges, then
rebase on `main`). The 4 new files are already in `project.pbxproj`.

Test on a **simulator with Face ID enrolled** (Features > Face ID > Enrolled) or
a real device:

1. **First run** - clean install -> only "Sign in with Google". Sign in; the
   refresh token is written to the Keychain.
2. **Relaunch** (swipe-kill + reopen) -> "Unlock with Face ID" screen,
   auto-prompting. Simulator: Features > Face ID > Matching Face -> straight to
   the dashboard, no web flow. Non-matching face -> stays put with an error; the
   Google button still works.
3. **Sign out** (avatar menu) -> back to the plain Google screen; the Keychain
   entry is deleted, so no unlock button next launch until you sign in again.
4. **Biometric change** - enrolling a new face after signing in invalidates the
   stored item (`.biometryCurrentSet`); next unlock fails cleanly to Google.
5. Confirm the Face ID permission prompt shows the `NSFaceIDUsageDescription`
   string on first use.

Not done (deliberate, see Scope): transparent refresh on a mid-session 401,
non-biometric passcode fallback, persisting the id token itself.

### Prompt 4

> commit and raise PR

Committed as `8501916`, pushed. Opened PR #90
(https://github.com/dcamdupe/pim/pull/90), stacked on #89
(`base: UBE-103/ios-app-transaction-screen`) - retarget to `main` once #89
merges. Excludes the pre-existing `UserInterfaceState.xcuserstate` churn.
