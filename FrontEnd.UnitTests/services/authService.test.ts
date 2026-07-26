import { describe, it, expect, vi, afterEach } from 'vitest'
import { login, LoginFailedError } from '../../FrontEnd/src/services/authService'

describe('authService.login', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the login and password and returns the token on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'a-jwt' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const token = await login('testuser@example.com', 'TestPassword123!')

    expect(token).toBe('a-jwt')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/login$/),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'testuser@example.com', password: 'TestPassword123!' }),
      }),
    )
  })

  it('throws LoginFailedError when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }),
    )

    await expect(login('testuser@example.com', 'wrong')).rejects.toBeInstanceOf(LoginFailedError)
  })
})
