import { cognitoConfig } from '../../config/auth'
import { deriveCodeChallenge, generateCodeVerifier } from './pkce'

const VERIFIER_STORAGE_KEY = 'pim.auth.pkce_verifier'

export class GoogleLoginFailedError extends Error {
  constructor() {
    super('Google login failed')
  }
}

// Redirects to Cognito's Hosted UI, going straight to Google (identity_provider=Google) since
// it's the only identity provider configured on the App Client anyway (see Terraform/modules/cognito).
// The PKCE verifier has to survive the round trip through Google and back, so it's stashed in
// sessionStorage rather than kept in memory.
export async function beginGoogleLogin(): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await deriveCodeChallenge(verifier)
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier)

  const url = new URL(`https://${cognitoConfig.domain}/oauth2/authorize`)
  url.searchParams.set('client_id', cognitoConfig.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('redirect_uri', cognitoConfig.redirectUri)
  url.searchParams.set('identity_provider', 'Google')
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', challenge)

  window.location.assign(url.toString())
}

export interface CognitoSession {
  idToken: string
  refreshToken: string
}

// Exchanges the /auth/callback route's ?code= for tokens. The ID token (not the access token) is
// what the FrontEnd uses as its bearer token - it's the one carrying the "email" claim the Api
// needs (see Api/Auth/CognitoClaimsMapper.cs), since no custom resource-server scopes are
// configured to get that onto the access token instead.
export async function completeGoogleLogin(code: string): Promise<CognitoSession> {
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY)
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY)
  if (!verifier) {
    throw new GoogleLoginFailedError()
  }

  const response = await fetch(`https://${cognitoConfig.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cognitoConfig.clientId,
      code,
      redirect_uri: cognitoConfig.redirectUri,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    throw new GoogleLoginFailedError()
  }

  const data = (await response.json()) as { id_token: string; refresh_token: string }
  return { idToken: data.id_token, refreshToken: data.refresh_token }
}

export class CognitoRefreshFailedError extends Error {
  constructor() {
    super('Cognito token refresh failed')
  }
}

// Cognito's refresh grant returns a new id/access token pair but not a new refresh token itself -
// the original refresh token keeps being reused until it expires (30 days by default).
export async function refreshCognitoToken(refreshToken: string): Promise<string> {
  const response = await fetch(`https://${cognitoConfig.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cognitoConfig.clientId,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new CognitoRefreshFailedError()
  }

  const data = (await response.json()) as { id_token: string }
  return data.id_token
}

// Ends the Hosted UI's own session (not just this app's stored token) so a subsequent login
// doesn't silently re-authenticate without going through Google again.
export function buildLogoutUrl(): string {
  const url = new URL(`https://${cognitoConfig.domain}/logout`)
  url.searchParams.set('client_id', cognitoConfig.clientId)
  url.searchParams.set('logout_uri', new URL('/login', window.location.origin).toString())
  return url.toString()
}
