export type AuthProvider = 'local' | 'cognito'

// Defaults to 'local' so an unset .env (e.g. a fresh checkout that hasn't been given the
// production values yet) doesn't silently try to build Cognito URLs out of undefined config.
export const authProvider: AuthProvider =
  import.meta.env.VITE_AUTH_PROVIDER === 'cognito' ? 'cognito' : 'local'

export const cognitoConfig = {
  domain: import.meta.env.VITE_COGNITO_DOMAIN ?? '',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI ?? '',
}
