# UBE-39 - Cognito auth

## Linear issue

https://linear.app/uberconcept/issue/UBE-39/cognito-auth

> Controlled by an environment variable, use current auth on local, use cognito auth on all
> non-local environments.
>
> Allow google authentication only.
>
> See if there is a way to restrict access to a single user or a list of users.
>
> The email address for the cognito user should also be the same key that is currently used.

## Description

PIM currently authenticates with a hand-rolled flow: `POST /login` takes an email + bcrypt-hashed
password (`Api/Auth/AuthenticationLocal.cs`, `Api/Controllers/LoginController.cs`), and issues a
self-signed HMAC JWT (`IJwtTokenGenerator`) which the Api validates via `AddJwtBearer` using a
shared `JwtSettings:SigningKey` (`Api/IoC/ServiceMapping.cs`). `User.Email` is the DynamoDB
partition key (`Api/Data/User.cs`).

This issue introduces AWS Cognito as the auth provider for every non-local environment (currently
just Production), federated to Google as the only identity provider, while local dev keeps the
existing email/password flow unchanged. Whichever Cognito user logs in via Google must resolve to
`User.Email` (Google's `email` claim) so the rest of the app's DynamoDB lookups keep working
unmodified. Access should be restricted to David only (single user / small allow-list), which
Cognito needs a trigger for since Google federation alone would let any Google account sign up.

## Plan

1. **Terraform** (`Terraform/modules/api` or a new `cognito` module):
   - Cognito User Pool + App Client (Hosted UI / OAuth2 authorization-code flow).
   - Google as the only identity provider (needs a Google OAuth client id/secret — likely a new
     manually-created Google Cloud OAuth client, following the existing pattern of secrets that
     are deliberately kept out of Terraform, e.g. the OIDC IAM role from UBE-22).
   - A Cognito **Pre Sign-up** (or Pre-Token-Generation) Lambda trigger that rejects any email not
     on an allow-list, to satisfy "restrict to a single user or list of users" — Google federation
     alone has no built-in allow-list.
   - Callback/logout URLs restricted to the real FrontEnd domain.
2. **Api**:
   - Add an environment-variable-controlled switch (e.g. `Auth:Provider` or reuse
     `ASPNETCORE_ENVIRONMENT == "Local"`) so `Local` keeps today's `AuthenticationLocal` +
     self-signed JWT bearer validation, and every other environment validates Cognito-issued JWTs
     instead (JWKS from the User Pool's issuer, `ValidateIssuerSigningKey` via
     `Microsoft.AspNetCore.Authentication.JwtBearer`'s `Authority`/`MetadataAddress`, standard for
     Cognito).
   - Confirm the claim used as the user identity key (`ClaimTypes.NameIdentifier` today, from
     `LoginController.Refresh`) maps to the Cognito/Google `email` claim so `IRepository<User>`
     lookups by email keep working unchanged.
   - `login`/`login/refresh` presumably become local-only; non-local relies on the Hosted UI /
     Cognito token endpoint directly, called from the FrontEnd.
3. **FrontEnd**:
   - Env-configured switch between the existing email/password login form (local) and redirecting
     to the Cognito Hosted UI (Google) for non-local, then handling the OAuth callback/token.
   - `authService.ts`/`stores/auth.ts` updated to store/refresh the Cognito-issued token instead
     of (or alongside) the locally-issued one, depending on environment.
4. **Tests**: `Api.IntegrationTests` coverage per repo convention (new/changed auth endpoints,
   `AuthorizationTests.cs`'s `ProtectedEndpoints()` list stays accurate); `FrontEnd.UnitTests` for
   any new frontend auth logic.

### Decisions (confirmed with David)

- **User restriction**: enforced via a Cognito Lambda trigger (Pre Sign-up / Pre-Token-Generation)
  checking the Google email against an allow-list — not just "only ever create one Cognito user".
- **Google OAuth client id/secret**: created manually in Google Cloud Console, configured on the
  Cognito Google IdP outside Terraform/state — same pattern as the UBE-22 OIDC IAM role. Google
  Cloud side setup: OAuth consent screen (External user type, `openid`/`email`/`profile` scopes,
  left in **Testing** mode so only explicitly-added test users can even reach consent — a free
  second layer of restriction alongside the Lambda trigger), OAuth 2.0 Web application client with
  redirect URI `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`.
- **Local login endpoints**: `/login` and `/login/refresh` become **local-only** — not registered
  (or rejected) outside the `Local` environment, so non-local relies entirely on Cognito's Hosted
  UI + token endpoint.

## Checklist

- [x] Create worklog and branch
- [x] Confirm plan with David
- [x] Terraform: Cognito User Pool + Google IdP + App Client
- [x] Terraform: allow-list enforcement (Lambda trigger)
- [x] Api: env-controlled auth provider switch
- [x] Api: Cognito JWT bearer validation for non-local
- [x] FrontEnd: Hosted UI / Google login flow for non-local
- [x] Tests: Api.IntegrationTests + AuthorizationTests.cs coverage (LoginController local-only gating)
- [x] Tests: Api.UnitTests coverage for Cognito claims mapping
- [x] Tests: FrontEnd.UnitTests coverage
- [ ] Deploy: fill in Google OAuth client + confirm allowed email(s) + `terraform apply` + FrontEnd `.env.production` Cognito values
- [ ] Final review / mark issue done

## Session log

### Prompt 1

> start a worklog on UBE-39

Fetched the Linear issue and read the existing auth implementation (`Api/Auth/AuthenticationLocal.cs`,
`Api/Controllers/LoginController.cs`, `Api/IoC/ServiceMapping.cs`, `Api/Data/User.cs`,
`FrontEnd/src/services/authService.ts`) to understand what "current auth" is and confirm
`User.Email` is the DynamoDB key that a Cognito/Google email claim needs to line up with.
Confirmed no existing Cognito references in `Terraform/`. Created the branch `UBE-39/cognito-auth`
off `main` and this worklog.

### Prompt 2

> what is required to configure in Google?

Explained the Google Cloud Console setup needed for a Google-federated Cognito IdP: a Google Cloud
project, an OAuth consent screen (External user type, `openid`/`email`/`profile` scopes, left in
Testing mode so only added test users can reach it), and a Web application OAuth 2.0 client with
redirect URI `https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/idpresponse`,
yielding a client id/secret to feed into Cognito's IdP config.

### Prompt 3

> (answered the remaining two AskUserQuestion prompts)

Confirmed all three open design decisions with David — see "Decisions" above. Plan is now fully
confirmed; ready to start implementation.

### Prompt 4

> go

Implemented the Api-side auth architecture:

- `Api/Auth/CognitoSettings.cs` — `Authority`/`AppClientId` config, bound from a `CognitoSettings`
  section (populated via Lambda env vars in non-Local, once Terraform exists).
- `Api/IoC/ServiceMapping.cs` — split JWT bearer registration into `AddLocalAuthentication`
  (unchanged local email/password flow) and `AddCognitoAuthentication` (validates against the
  Cognito User Pool's own JWKS via `Authority`, audience = App Client Id).
- `Api/Auth/CognitoClaimsMapper.cs` — Cognito's `sub` claim is an opaque user id, not email, so
  `MapInboundClaims` is turned off and this adds `ClaimTypes.NameIdentifier` from the token's own
  `email` claim, keeping every controller's existing
  `HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)` call unchanged regardless of which
  auth path issued the token. Extracted to its own class (rather than inline in `OnTokenValidated`)
  specifically so it's unit-testable per the repo's "no controller unit tests, test the logic
  underneath" convention.
- `Api/IoC/EnvironmentControllerFeatureProvider.cs` + `Program.cs` — `LoginController` (the local
  email/password endpoints) is now excluded from routing entirely outside `Local`, per the
  "local-only" decision. Had to explicitly remove the framework's own default
  `ControllerFeatureProvider` before adding this one - `AddControllers()` registers that provider
  automatically, and providers are additive (each independently adds controllers to the feature),
  so without removing it, the default provider kept including `LoginController` regardless of what
  the custom one excluded. Also had to make `Program.cs` capture `IsEnvironment("Local")` into a
  single eagerly-evaluated variable and thread it through everywhere (`MapServices(builder,
  isLocal)` etc.) rather than re-querying `builder.Environment.IsEnvironment("Local")` inside a
  deferred `ConfigureApplicationPartManager` closure, since that closure runs later than
  `ServiceMapping.MapServices`'s own eager read and could observe a different state.
- New tests: `Api.UnitTests/Auth/CognitoClaimsMapperTests.cs` (claim mapping logic);
  `Api.IntegrationTests/NonLocalApiWebApplicationFactory.cs` +
  `Api.IntegrationTests/EnvironmentGatingTests.cs` (confirms `/login` and `/login/refresh` 404
  outside Local). The new factory supplies `CognitoSettings` via process environment variables
  rather than `ConfigureWebHost`'s `ConfigureAppConfiguration` - the latter doesn't work for this
  codebase's pattern of reading `builder.Configuration` synchronously inside top-level Program.cs
  statements before `Build()`, since that customization is only merged in at `Build()` itself, by
  which point `MapServices` had already thrown on the missing section.

Full test suite (`dotnet test`) passes: 88 unit + 61 integration = 149, no regressions.

Then added the Terraform side, `Terraform/modules/cognito/`:

- `aws_cognito_user_pool` with a `lambda_config.pre_sign_up` trigger.
- `lambda/pre_signup.js` (Node.js, zipped via the existing `archive` provider like the api
  module's build) - checks the federated user's `email` attribute against a comma-separated
  `ALLOWED_EMAILS` env var and throws to reject sign-up if it's not on the list. Federated
  (Google) sign-in auto-provisions a Cognito user on first login, which is what invokes Pre
  Sign-up - this is the standard place to enforce an allow-list, since Google itself will
  authenticate any Google account.
- `aws_cognito_identity_provider` "google" - `provider_details` (client id/secret) sourced from
  `var.google_client_id`/`var.google_client_secret`, which have no default and aren't referenced
  from any committed tfvars file - supplied via `TF_VAR_google_client_id`/`TF_VAR_google_client_secret`
  at apply time only, same "outside Terraform state's committed inputs" pattern as the UBE-22 OIDC
  role (though here the *resource* is still Terraform-managed, just not its secret value).
- `aws_cognito_user_pool_client` - public SPA client (`generate_secret = false`, PKCE
  authorization-code flow), `supported_identity_providers = ["Google"]` only, callback/logout URLs
  scoped to the real FrontEnd domain.
- Outputs: `authority` (OIDC issuer URL, built from `data.aws_region.current.region` +
  `user_pool.id` - matches the existing pattern in `modules/networking`), `app_client_id`,
  `hosted_ui_domain`.

Wired into root `main.tf` as `module "cognito"`, with its `authority`/`app_client_id` outputs fed
into the `api` module as two new Lambda env vars (`CognitoSettings__Authority`,
`CognitoSettings__AppClientId`), read by `Api/Auth/CognitoSettings.cs` exactly like
`ASPNETCORE_ENVIRONMENT` already is. Added `cognito_domain_prefix`/`cognito_allowed_emails` to
`environments/production.tfvars` (not secret, just config). Added two new root outputs
(`cognito_hosted_ui_domain`, `cognito_app_client_id`) for copying into the FrontEnd's build-time
env vars, matching how `frontend_bucket_name` etc. are already documented as "copy into X".

`terraform fmt -recursive` and `terraform validate` (via `terraform init -backend=false`, no AWS
credentials needed) both pass clean.

Then the FrontEnd side:

- `FrontEnd/src/config/auth.ts` - `authProvider` ('local' | 'cognito', from
  `VITE_AUTH_PROVIDER`, defaults to 'local') and `cognitoConfig` (domain/client id/redirect uri).
- `FrontEnd/src/services/auth/pkce.ts` - PKCE code verifier/challenge via the Web Crypto API
  (`crypto.getRandomValues`/`crypto.subtle.digest`), no new dependency needed.
- `FrontEnd/src/services/auth/cognitoAuthService.ts` - `beginGoogleLogin()` (redirects to the
  Hosted UI with `identity_provider=Google` so it skips straight past an IdP picker, stashes the
  PKCE verifier in sessionStorage since it has to survive the round trip through Google),
  `completeGoogleLogin(code)` (exchanges code+verifier for tokens at the Hosted UI's
  `/oauth2/token`, returns the **ID token** - not the access token, since that's the one carrying
  the "email" claim the Api needs, given no custom resource-server scopes are configured to get
  that onto the access token instead), `refreshCognitoToken(refreshToken)`, `buildLogoutUrl()`
  (ends the Hosted UI's own session too, not just this app's token, via Cognito's `/logout`).
- `stores/auth.ts` - `setToken` gained an optional second `refreshToken` param (persisted
  alongside the existing token/expiresAt, falls back to the previously-stored value when omitted
  since Cognito's refresh grant doesn't reissue one); `clearToken` clears it too.
- `views/LoginView.vue` - branches on `authProvider`: unchanged email/password form for 'local',
  a "Sign in with Google" button for 'cognito'.
- `views/AuthCallbackView.vue` (new) + `/auth/callback` route - handles the Hosted UI's redirect
  back, exchanges the code, stores the session, warms caches, navigates to `/dashboard`.
- `services/auth/postLogin.ts` (new) - the cache-warming logic LoginView.vue already had on
  successful login, extracted so both login paths (local form submit, Cognito callback) share it
  instead of duplicating it.
- `router/guard.ts` - `authCallback` is now always-allowed unauthenticated, same as `login`.
  `App.vue` also hides `NavBar` on it.
- `composables/useTokenRefresh.ts` - branches on `authProvider` (now an explicit parameter
  defaulting from `config/auth`, specifically so tests can exercise both branches without
  module-mocking `import.meta.env`): local path unchanged; Cognito path calls
  `refreshCognitoToken` with the stored refresh token (no-ops if there isn't one yet).
- `components/NavBar.vue` - logout now also redirects through Cognito's logout endpoint when
  `authProvider === 'cognito'`, so a later login doesn't silently re-authenticate off a lingering
  Hosted UI session.
- `.env.production` - added `VITE_AUTH_PROVIDER=cognito`, `VITE_COGNITO_REDIRECT_URI`; left
  `VITE_COGNITO_DOMAIN`/`VITE_COGNITO_CLIENT_ID` blank with a `TODO(UBE-39)` - only known after
  `terraform apply` (`cognito_hosted_ui_domain`/`cognito_app_client_id` outputs). `.env`/`.env.local`
  (local dev) untouched - default `authProvider` is 'local', matching "use current auth on local".

New tests: `Api.UnitTests` `CognitoClaimsMapperTests.cs` (already listed above);
`FrontEnd.UnitTests` gained `services/auth/pkce.test.ts`, `services/auth/cognitoAuthService.test.ts`,
extra cases in `stores/auth.test.ts` (refresh token persistence), `router/guard.test.ts`
(`authCallback` always allowed), and `composables/useTokenRefresh.test.ts` (Cognito refresh
branch). `npm run build` (`vue-tsc -b && vite build`) and `npm run lint` both pass clean.
`FrontEnd.UnitTests`: 204/204 passing (was 201, +3 new). Full `.NET` suite still 149/149.

Smoke-tested the actual local dev stack in a real (headless) browser via Playwright, driving
`scripts/run_local.sh`'s FrontEnd+Api: logged in with the seeded test user
(`testuser@example.com`), landed on the dashboard, logged out, ended back on `/login` - confirmed
the local email/password path (still the default, unauthenticated `authProvider`) works completely
unbroken end-to-end despite the scale of the LoginView/NavBar/stores/auth.ts/useTokenRefresh
changes. No browser console errors at any point. The Cognito path itself can't be smoke-tested the
same way - it needs a real deployed User Pool + Google OAuth client, neither of which exist yet.

**Remaining before this can be considered done / the Linear issue closed** (deployment steps, not
code - see the `TODO(UBE-39)` marker in `.env.production`):

1. Create the Google Cloud OAuth client (see the "what's required in Google" answer earlier in
   this log). `cognito_allowed_emails` is confirmed as `["david@uberconcept.com"]`.
2. `terraform apply` with `TF_VAR_google_client_id`/`TF_VAR_google_client_secret` set, from a
   dedicated least-privilege IAM identity (never the root account, per `Terraform/README.md`).
3. Copy the `cognito_hosted_ui_domain`/`cognito_app_client_id` outputs into
   `FrontEnd/.env.production`, replacing the two blank `TODO` lines.
4. Deploy the FrontEnd (picks up the filled-in `.env.production`) and confirm a real Google
   sign-in end-to-end against the deployed Production stack.

### Prompt 5

> the google account is confirmed as david@uberconcept.com, adjust the commnt in TF

Removed the `TODO(UBE-39): confirm which Google account(s)...` comment above
`cognito_allowed_emails` in `Terraform/environments/production.tfvars`, now that
`["david@uberconcept.com"]` is confirmed rather than a guess. `terraform validate` still passes.

### Prompt 6

> update the aws diagram to reflect adding cognito

While preparing to draw the Lambda→Cognito connection, checked whether it's actually reachable:
`Terraform/modules/networking/main.tf`'s Lambda security group only had HTTPS egress to the
DynamoDB gateway endpoint's prefix list, no route to Cognito's public JWKS endpoint, and no VPC
interface endpoint for `cognito-idp` either - as coded, Cognito auth would have failed at runtime
outside Local (the Lambda has no NAT/Internet Gateway, by design). Flagged this before drawing a
diagram that would otherwise show a connection that doesn't actually work.

Asked David how to fix it - a Cognito VPC interface endpoint (private, matches the existing
DynamoDB-gateway-endpoint pattern) vs. a NAT Gateway (general internet egress, more expensive,
broader than needed) vs. leaving the gap for later. Chose the interface endpoint. Then flagged its
real cost (~$0.01-0.014/hr per AZ it's deployed in + ~$0.01/GB, non-trivial for a
otherwise-near-zero-cost personal app) and asked whether to scope it to all 3 AZs (full redundancy,
~$22-30/month) or just 1 (~$7-10/month, single point of failure for token validation - acceptable
for a single-user app). Kept all 3 AZs, matching the existing Lambda subnet spread.

Implemented in `Terraform/modules/networking/main.tf`:
- `aws_security_group.cognito_idp_endpoint` - ingress scoped to `var.vpc_cidr` rather than the
  Lambda SG directly, specifically to avoid a circular reference: both this SG and the Lambda SG
  use inline `egress`/`ingress` rule blocks (not separate `_rule` resources, per the Lambda SG's
  existing "stay authoritative over egress" comment), and inline blocks on two SGs that reference
  each other's `id` can't resolve a creation order. Scoping to the VPC CIDR instead sidesteps that
  - the private subnets only ever contain the Lambda anyway.
- `aws_vpc_endpoint.cognito_idp` - `Interface` type (Cognito doesn't support Gateway endpoints,
  unlike DynamoDB), `private_dns_enabled = true` so the standard
  `https://cognito-idp.<region>.amazonaws.com` hostname (exactly what `CognitoSettings:Authority`
  is already set to) resolves to the private endpoint from inside the VPC with zero Api-side
  changes needed.
- Added a second inline `egress` block to `aws_security_group.lambda` allowing HTTPS to the new
  endpoint's SG (one-way reference only - no cycle, since the endpoint SG's ingress doesn't
  reference the Lambda SG back).

No NACL changes needed - interface endpoint ENIs get private IPs inside `var.vpc_cidr`, already
covered by the existing "allow all within the VPC CIDR" NACL rules (unlike the DynamoDB gateway
endpoint, which specifically needed extra NACL rules because its traffic is addressed to
DynamoDB's real, non-VPC-CIDR IP ranges). `terraform fmt`/`terraform validate` pass clean.

David asked whether the connectivity gap could instead be solved by just relaxing NACL/SG rules -
explained why not: SGs/NACLs only control what's *allowed* once a network path exists; the private
route table has no route to the internet at all (no IGW/NAT), so a packet to Cognito's public IP
has nowhere to go regardless of how open the rules are. Only a NAT Gateway or a VPC endpoint
actually creates a path - the interface endpoint I'd already built was the real fix, not one
option among several equally-valid ones.

Then updated `docs/design/architecture/aws-infrastructure.drawio`/`.svg` (from UBE-12) to add:
- **Amazon Cognito** box in the left-hand "things the browser reaches directly" column, alongside
  CloudFront and API Gateway (using the real AWS Cognito icon, same `aws-icons` npm source as the
  other icons) - browser gets a third direct line to it, for the Hosted UI redirect.
- **VPC Interface Endpoint (Cognito IDP)** box inside the VPC, styled to match Cognito's box
  (soft red/pink) the same way the existing DynamoDB endpoint box is styled to match DynamoDB's
  (orange) - Lambda connects to it directly below, and it exits the VPC westward to the Cognito
  box (a short, unobstructed path, not crossing anything else).
- Moved the existing **VPC Gateway Endpoint (DynamoDB)** box to the right side of the VPC (closer
  to the DynamoDB table box it leads to) so it and the new Cognito endpoint box sit side-by-side
  without their exit paths crossing each other. Lambda's two lines out to them now travel at
  different heights (explicit waypoints) specifically so they don't overlap each other or the
  Lambda→CloudWatch line, which shares the same starting edge.

Verified by rendering the `.svg` in a headless Chromium via Playwright (same approach as the
earlier FrontEnd smoke test - no `rsvg-convert`/`cairosvg` available locally to rasterize
directly) and inspecting the screenshot: clean layout, no crossing lines, all icons rendering
correctly. Also updated the README's "AWS infrastructure" section to describe the new Auth
bullet and mention the `cognito` module. `xmllint` confirms both files stay well-formed XML.
