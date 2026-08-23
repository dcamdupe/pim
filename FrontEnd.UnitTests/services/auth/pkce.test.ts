import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, deriveCodeChallenge } from '../../../FrontEnd/src/services/auth/pkce'

describe('pkce', () => {
  it('generateCodeVerifier returns a URL-safe string with no padding', () => {
    const verifier = generateCodeVerifier()

    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(verifier.length).toBeGreaterThan(0)
  })

  it('generateCodeVerifier returns a different value each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
  })

  it('deriveCodeChallenge is deterministic for the same verifier', async () => {
    const verifier = generateCodeVerifier()

    const [first, second] = await Promise.all([deriveCodeChallenge(verifier), deriveCodeChallenge(verifier)])

    expect(first).toBe(second)
    expect(first).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('deriveCodeChallenge differs for different verifiers', async () => {
    const [a, b] = await Promise.all([deriveCodeChallenge('verifier-one'), deriveCodeChallenge('verifier-two')])

    expect(a).not.toBe(b)
  })
})
