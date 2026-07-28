export function resolveNavigation(routeName: unknown, isAuthenticated: boolean): true | { name: 'login' } {
  if (routeName === 'login' || isAuthenticated) {
    return true
  }
  return { name: 'login' }
}
