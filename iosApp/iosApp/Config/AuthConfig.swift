import Foundation

// Mirrors FrontEnd/src/config/auth.ts's cognitoConfig - same User Pool App Client, since it's a
// public client (no secret) shared across the web and iOS frontends.
enum AuthConfig {
    static let cognitoDomain = "pim-production.auth.ap-southeast-2.amazoncognito.com"
    static let clientId = "2cacasgfpel52naggi8fmn991a"

    // Custom URL scheme registered in Info.plist's CFBundleURLTypes, used as the Hosted UI's
    // redirect_uri so ASWebAuthenticationSession can catch the callback. Must also be added to
    // Terraform/modules/cognito/main.tf's callback_urls for Cognito to accept it.
    static let redirectUri = "pim://auth/callback"
    static let redirectUriScheme = "pim"
}
