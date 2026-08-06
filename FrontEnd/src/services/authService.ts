const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export class LoginFailedError extends Error {
  constructor() {
    super('Login failed')
  }
}

export async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new LoginFailedError()
  }

  const data = (await response.json()) as { token: string }
  return data.token
}

export class TokenRefreshFailedError extends Error {
  constructor() {
    super('Token refresh failed')
  }
}

export async function refreshToken(token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/login/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new TokenRefreshFailedError()
  }

  const data = (await response.json()) as { token: string }
  return data.token
}
