import { describe, it, expect } from 'vitest'
import { resolveNavigation } from '../../FrontEnd/src/router/guard'

describe('resolveNavigation', () => {
  it('always allows navigation to the login route, even when unauthenticated', () => {
    expect(resolveNavigation('login', false)).toBe(true)
  })

  it('allows navigation to a protected route when authenticated', () => {
    expect(resolveNavigation('dashboard', true)).toBe(true)
  })

  it('redirects to login when navigating to a protected route while unauthenticated', () => {
    expect(resolveNavigation('dashboard', false)).toEqual({ name: 'login' })
  })
})
