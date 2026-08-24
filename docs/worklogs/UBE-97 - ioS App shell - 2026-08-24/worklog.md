# UBE-97: ioS App shell

## Linear issue

https://linear.app/uberconcept/issue/UBE-97/ios-app-shell

> I want to create the shell of an iOS app that displays a login page for the PIM app.
>
> The iosApp should live inside iosApp folder.
>
> This should:
>
> * use the icon for the PIM app for the favicon
> * display a login / password form using Cognito
> * Be built using swift
>
> Logging in should take someone to a placeholder dashboard

## Description

Scaffold a new native iOS app (SwiftUI) living in `iosApp/`, with a login
screen and a placeholder post-login dashboard.

The ticket text says "login / password form using Cognito", but the actual
Cognito user pool (`Terraform/modules/cognito/main.tf`) is Google-federated
only — no native username/password auth is configured, and the existing
`FrontEnd` login flow is entirely "Sign in with Google" via Cognito Hosted UI
(PKCE, `identity_provider=Google`). Confirmed with David: the iOS shell
should match that same flow (Google via Cognito), not a real username/password
form, rather than requiring new Cognito infrastructure.

**Environment constraint:** this environment has Xcode Command Line Tools
only, not full Xcode (no `xcodebuild`, no iOS SDK, no simulator, no
`xcodegen`). The Xcode project file will be hand-authored and the Swift
source will be written to be correct by inspection, but **it cannot be
built or run from here** — David will need to open it in Xcode locally to
verify it compiles and run it in the simulator.

## Plan

1. Rasterize `FrontEnd/public/favicon.svg` (the PIM app icon) to a 1024x1024
   PNG via `sips` and add it as `iosApp/iosApp/Assets.xcassets/AppIcon.appiconset`
   (single-size universal app icon, modern Xcode format).
2. Hand-author a minimal `iosApp/iosApp.xcodeproj/project.pbxproj` for a
   single-target SwiftUI iOS app named `iosApp`.
3. Add Swift source under `iosApp/iosApp/`:
   - `iosAppApp.swift` — `@main` app entry point, shows `LoginView`.
   - `Config/AuthConfig.swift` — Cognito domain/client id/redirect URI
     constants (placeholder values, same shape as `FrontEnd/src/config/auth.ts`).
   - `Services/PKCE.swift` — code verifier/challenge generation, ported from
     `FrontEnd/src/services/auth/pkce.ts`.
   - `Services/CognitoAuthService.swift` — builds the Hosted UI authorize
     URL (`identity_provider=Google`), drives an `ASWebAuthenticationSession`
     for the redirect, exchanges the returned code for tokens at
     `/oauth2/token`, ported from `cognitoAuthService.ts`.
   - `Views/LoginView.swift` — branded "Sign in with Google" button,
     triggers the auth service, navigates to `DashboardView` on success.
   - `Views/DashboardView.swift` — placeholder ("Welcome" text only).
4. Register a custom URL scheme (`pim://auth/callback`) in `Info.plist` for
   the `ASWebAuthenticationSession` callback, and add that same URL as a
   `callback_urls`/`logout_urls` entry in
   `Terraform/modules/cognito/main.tf`'s `aws_cognito_user_pool_client` (needs
   `terraform apply` by David separately — not run from here).
5. Note in this worklog that build/run verification must be done by David in
   Xcode, since this environment can't do it.

## Checklist

- [x] Rasterize app icon (`favicon.svg` → `AppIcon.appiconset`)
- [x] Hand-author `iosApp.xcodeproj`
- [x] `iosAppApp.swift` entry point
- [x] `AuthConfig.swift`
- [x] `PKCE.swift`
- [x] `CognitoAuthService.swift`
- [x] `LoginView.swift`
- [x] `DashboardView.swift`
- [x] Register `pim://auth/callback` URL scheme in `Info.plist`
- [x] Add iOS callback/logout URLs to `Terraform/modules/cognito/main.tf`
- [x] Fill in `AuthConfig`'s `cognitoDomain`/`clientId`
- [ ] Hand off to David to open in Xcode and verify build/run

## Session log

### Prompt: "start a worklog for UBE-97"

Fetched issue details from Linear. Found a conflict between the ticket text
("login / password form using Cognito") and the actual infra: the Cognito
user pool is Google-federated only, no native username/password pool exists.
Confirmed with David to build the same "Sign in with Google via Cognito"
flow the `FrontEnd` already uses, rather than a real password form. Checked
this environment for Xcode/iOS tooling — only Command Line Tools are
installed (no `xcodebuild`, no simulator, no `xcodegen`) — and confirmed
`sips` can rasterize the existing `favicon.svg` app icon to PNG. Drafted the
plan above, wrote this worklog, and created the branch
`UBE-97/ios-app-shell` off `main`.

### Prompt: "what URL will you use for the api>"

Confirmed the shell doesn't call the Api at all yet - the placeholder
dashboard has no data fetch, so only Cognito's Hosted UI domain is used
(`/oauth2/authorize`, `/oauth2/token`). Offered to add an `apiBaseUrl`
constant (matching `FrontEnd/.env.production`'s
`https://pim-api.uberconcept.com`) for future-proofing.

### Prompt: "Leave it out for now, start implementing the plan"

Implemented the full plan:

- Rasterized `FrontEnd/public/favicon.svg` to a 1024x1024 PNG via `sips`
  (SVG rasterization support) and wired it into
  `iosApp/iosApp/Assets.xcassets/AppIcon.appiconset` (single-size universal
  icon format) plus an `AccentColor.colorset` using the same teal (`#0b5a54`).
- Wrote `Info.plist` registering the `pim` URL scheme
  (`CFBundleURLTypes`) needed for `ASWebAuthenticationSession` to catch the
  Cognito redirect.
- Ported `FrontEnd/src/services/auth/pkce.ts` to `Services/PKCE.swift`
  (`CryptoKit`/`SecRandomCopyBytes` instead of Web Crypto).
- Ported `FrontEnd/src/services/auth/cognitoAuthService.ts`'s Google sign-in
  flow to `Services/CognitoAuthService.swift`, using
  `ASWebAuthenticationSession` to drive the Hosted UI
  (`identity_provider=Google`) and catch the `pim://auth/callback` redirect
  in one call (no separate begin/complete split needed, unlike the web SPA's
  full-page redirect).
- Added `Config/AuthConfig.swift` with placeholder `cognitoDomain`/`clientId`
  (David to fill in from the Cognito Terraform outputs) and the
  `pim://auth/callback` redirect URI.
- Built `Views/LoginView.swift` (branded "Sign in with Google" button
  matching `LoginView.vue`'s spec - white bg, `#747775` border, 4px radius -
  though using a single-color SF Symbol placeholder for the Google "G"
  logomark rather than porting the exact 4-color SVG paths, since it can't be
  visually verified from here) and `Views/DashboardView.swift` (static
  placeholder).
- Wrote `iosAppApp.swift` as the `@main` entry point.
- Hand-authored `iosApp.xcodeproj/project.pbxproj` (single SwiftUI app
  target, iOS 17 deployment target, bundle id `com.uberconcept.pim`).
  Validated it's well-formed with `plutil -lint` and cross-checked every
  object ID is referenced consistently, but **could not run `xcodebuild`**
  (only Command Line Tools installed, no full Xcode/SDK) - David needs to
  open it in Xcode to confirm it actually builds.
- Added `pim://auth/callback` to `callback_urls`/`logout_urls` on the
  Cognito App Client in `Terraform/modules/cognito/main.tf`. Ran
  `terraform fmt -recursive` and `terraform validate` (both clean) - David
  needs to `terraform apply` this separately.

Remaining: David to open `iosApp/iosApp.xcodeproj` in Xcode and verify it
builds/runs in the simulator.

### Prompt: "cognito app clientid is 2cacasgfpel52naggi8fmn991a"

Found the matching `cognitoDomain` in `FrontEnd/.env.production`
(`VITE_COGNITO_CLIENT_ID` there matches the id given, confirming it's the
same App Client). Filled in `AuthConfig.cognitoDomain` =
`pim-production.auth.ap-southeast-2.amazoncognito.com` and `clientId` =
`2cacasgfpel52naggi8fmn991a`.

### Prompt: "poligh the G logo to get it right"

Replaced the single-color SF Symbol placeholder with the real four-color
Google "G" logomark. Rather than hand-porting each curve/arc number (error
prone with no simulator here to visually check the result against), wrote a
small SVG path "d" parser (`Views/SVGPath.swift`, M/L/H/V/C/A/Z commands,
including the SVG endpoint-to-center arc parameterization for the `A`
commands) and fed it the exact same path strings `LoginView.vue` uses, so
the shape is a byte-for-byte port rather than a redraw. Verified the parser
against those exact 4 paths with a standalone `swift` script (this
environment's Command Line Tools include `CoreGraphics`/`CGMutablePath` even
without full Xcode) - all 4 pieces' bounding boxes landed within the
expected 20x20 viewBox and their union matched it almost exactly, which is
strong evidence the arc math is right. `GoogleLogoView.swift` now renders
the 4 `Path(SVGPath.parse(...))` layers with Google's official colors
(`#4285F4`/`#34A853`/`#FBBC05`/`#EA4335`), scaled to fit its frame. Added
both new files to `project.pbxproj`'s Views group and Sources build phase;
re-validated with `plutil -lint`.

### Prompt: "commit and raise the PR"

Committed and pushed `UBE-97/ios-app-shell`, opened
[PR #86](https://github.com/dcamdupe/pim/pull/86).

### Prompt: "the simulator in xcode fails with no bundle id"

Root cause: `Info.plist` is custom (`GENERATE_INFOPLIST_FILE = NO`), and a
custom Info.plist doesn't get `CFBundleIdentifier` (or
`CFBundleExecutable`/`CFBundlePackageType`/etc) auto-injected by Xcode the
way a generated one does - it needs those keys listed explicitly using the
usual `$(PRODUCT_BUNDLE_IDENTIFIER)` etc. build-setting substitution, which
the hand-written file was missing entirely. Added them. Also noticed Xcode
had created `project.xcworkspace`/`xcuserdata` (per-user state) when David
opened the project, untracked; added Xcode entries to the root
`.gitignore` for those (first attempt used
`*.xcodeproj/project.xcworkspace/`, which turned out to anchor to repo root
because of its internal slash and didn't match the nested `iosApp/` path -
fixed with a `**/` prefix). Committed and pushed both fixes.

### Prompt: "the app built and ran. The google logo on the login screen was incomplete"

Reproduced without a simulator by rasterizing the real `LoginView.vue` SVG
(`sips`, same trick as the app icon) as ground truth, and separately
rendering `SVGPath.parse(...)`'s `CGPath` output for each of the 4 layers
straight to a PNG via a plain `CGContext` (both approaches available from
just Command Line Tools, no Xcode needed). Diffing/eyeballing the two
found the real bug: `SVGPath.swift`'s parser loop required every command
to start with a letter, but SVG allows *implicit repeated commands* - extra
coordinate pairs after a command letter that reuse it without repeating
the letter (e.g. `C x1 y1 x2 y2 x y x1 y1 x2 y2 x y` is two curves). Both
the red and green paths use exactly this to chain a second curve after
their first `C`, so the parser was silently stopping partway through
each of those two paths - before the fix their bounding boxes stopped at
x=10 instead of reaching x=1.02, i.e. roughly the left half of each piece
was simply never drawn, leaving the ring visibly broken/incomplete
(matches what David saw). My earlier "polish" pass had only bbox-checked
the 4 paths, which doesn't catch a mid-path truncation like this - this
time verified with an actual pixel-level comparison against the
rasterized reference, confirming an exact visual match after the fix.
Committed and pushed.
