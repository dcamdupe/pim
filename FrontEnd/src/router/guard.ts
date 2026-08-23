export function resolveNavigation(routeName: unknown, isAuthenticated: boolean): true | { name: 'login' } {
  if (routeName === 'login' || routeName === 'authCallback' || isAuthenticated) {
    return true
  }
  return { name: 'login' }
}
