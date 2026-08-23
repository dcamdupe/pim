import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  completeGoogleLogin,
  refreshCognitoToken,
  buildLogoutUrl,
  GoogleLoginFailedError,
  CognitoRefreshFailedError,
} from '../../../FrontEnd/src/services/auth/cognitoAuthService'
import { cognitoConfig } from '../../../FrontEnd/src/config/auth'

const VERIFIER_STORAGE_KEY = 'pim.auth.pkce_verifier'

describe('cognitoAuthService.completeGoogleLogin', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws GoogleLoginFailedError when no PKCE verifier was stashed', async () => {
    await expect(completeGoogleLogin('some-code')).rejects.toBeInstanceOf(GoogleLoginFailedError)
  })

  it('exchanges the code and verifier for tokens, then clears the stashed verifier', async () => {
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, 'the-verifier')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'an-id-token', refresh_token: 'a-refresh-token' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const session = await completeGoogleLogin('the-code')

    expect(session).toEqual({ idToken: 'an-id-token', refreshToken: 'a-refresh-token' })
    expect(sessionStorage.getItem(VERIFIER_STORAGE_KEY)).toBeNull()

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = options.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('code_verifier')).toBe('the-verifier')
  })

  it('throws GoogleLoginFailedError when the token endpoint responds not-ok', async () => {
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, 'the-verifier')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    await expect(completeGoogleLogin('the-code')).rejects.toBeInstanceOf(GoogleLoginFailedError)
  })
})

describe('cognitoAuthService.refreshCognitoToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the refresh token grant and returns the new id token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: 'a-new-id-token' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const idToken = await refreshCognitoToken('the-refresh-token')

    expect(idToken).toBe('a-new-id-token')
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = options.body as URLSearchParams
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('the-refresh-token')
  })

  it('throws CognitoRefreshFailedError when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))

    await expect(refreshCognitoToken('the-refresh-token')).rejects.toBeInstanceOf(CognitoRefreshFailedError)
  })
})

describe('cognitoAuthService.buildLogoutUrl', () => {
  const originalDomain = cognitoConfig.domain

  beforeEach(() => {
    // VITE_COGNITO_DOMAIN isn't configured in this test project - an empty host makes
    // `https:///logout` degenerate/ambiguous to parse back out, so give it a real-shaped one.
    cognitoConfig.domain = 'pim-production.auth.ap-southeast-2.amazoncognito.com'
  })

  afterEach(() => {
    cognitoConfig.domain = originalDomain
  })

  it('builds a logout URL redirecting back to /login on this origin', () => {
    const url = new URL(buildLogoutUrl())

    expect(url.hostname).toBe('pim-production.auth.ap-southeast-2.amazoncognito.com')
    expect(url.pathname).toBe('/logout')
    expect(url.searchParams.get('logout_uri')).toBe(`${window.location.origin}/login`)
  })
})
