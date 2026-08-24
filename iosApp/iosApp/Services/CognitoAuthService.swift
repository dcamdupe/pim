import AuthenticationServices
import UIKit

struct CognitoSession {
    let idToken: String
    let refreshToken: String
}

enum GoogleLoginError: Error {
    case failed
}

// Drives the Cognito Hosted UI's Google sign-in via ASWebAuthenticationSession, ported from
// FrontEnd/src/services/auth/cognitoAuthService.ts. Unlike the web SPA (which does a full page
// redirect and picks the code back up on /auth/callback), ASWebAuthenticationSession captures the
// redirect_uri callback itself, so begin+complete collapse into one call here.
@MainActor
final class CognitoAuthService: NSObject {
    private var session: ASWebAuthenticationSession?

    func signInWithGoogle() async throws -> CognitoSession {
        let verifier = PKCE.generateCodeVerifier()
        let challenge = PKCE.deriveCodeChallenge(from: verifier)

        var components = URLComponents(string: "https://\(AuthConfig.cognitoDomain)/oauth2/authorize")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: AuthConfig.clientId),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "redirect_uri", value: AuthConfig.redirectUri),
            URLQueryItem(name: "identity_provider", value: "Google"),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: challenge),
        ]

        let callbackURL = try await authenticate(authorizeURL: components.url!)
        guard
            let code = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "code" })?.value
        else {
            throw GoogleLoginError.failed
        }

        return try await exchangeCodeForTokens(code: code, verifier: verifier)
    }

    private func authenticate(authorizeURL: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: authorizeURL,
                callbackURLScheme: AuthConfig.redirectUriScheme
            ) { callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? GoogleLoginError.failed)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            self.session = session
            session.start()
        }
    }

    private func exchangeCodeForTokens(code: String, verifier: String) async throws -> CognitoSession {
        var request = URLRequest(url: URL(string: "https://\(AuthConfig.cognitoDomain)/oauth2/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        var body = URLComponents()
        body.queryItems = [
            URLQueryItem(name: "grant_type", value: "authorization_code"),
            URLQueryItem(name: "client_id", value: AuthConfig.clientId),
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "redirect_uri", value: AuthConfig.redirectUri),
            URLQueryItem(name: "code_verifier", value: verifier),
        ]
        request.httpBody = body.percentEncodedQuery?.data(using: .utf8)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw GoogleLoginError.failed
        }

        struct TokenResponse: Decodable {
            let id_token: String
            let refresh_token: String
        }
        let decoded = try JSONDecoder().decode(TokenResponse.self, from: data)
        return CognitoSession(idToken: decoded.id_token, refreshToken: decoded.refresh_token)
    }
}

extension CognitoAuthService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first ?? ASPresentationAnchor()
    }
}
