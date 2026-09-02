import Foundation

// Owns the app's auth state (UBE-105). On launch it decides between the biometric-unlock screen
// and a fresh Google sign-in; on success it persists the Cognito refresh token to the Keychain so
// the next cold launch only needs Face ID / Touch ID.
@MainActor
final class SessionController: ObservableObject {
    enum State: Equatable {
        case locked           // a refresh token is stored and biometrics are available
        case signedOut        // no stored token, or biometrics unusable - Google sign-in only
        case signedIn(CognitoSession)
    }

    @Published private(set) var state: State
    @Published private(set) var isAuthenticating = false
    @Published var errorMessage: String?

    let biometricType: BiometricType
    private let authService: CognitoAuthService

    private static let unlockReason = "Unlock PIM"

    init(authService: CognitoAuthService? = nil) {
        self.authService = authService ?? CognitoAuthService()
        let type = BiometricAuth.availableType
        biometricType = type
        state = (type != .none && KeychainStore.contains(KeychainStore.refreshTokenKey))
            ? .locked
            : .signedOut
    }

    // Biometric prompt (via the Keychain item's access control) -> refresh-token exchange -> signed
    // in. A cancelled prompt leaves the screen locked silently; anything else shows an error and
    // keeps the Google button available as the fallback.
    func unlock() async {
        guard !isAuthenticating, state == .locked else { return }
        errorMessage = nil
        isAuthenticating = true
        defer { isAuthenticating = false }

        do {
            guard let refreshToken = try KeychainStore.read(
                for: KeychainStore.refreshTokenKey, reason: Self.unlockReason
            ) else {
                state = .signedOut
                return
            }
            let session = try await authService.refreshSession(refreshToken: refreshToken)
            state = .signedIn(session)
        } catch KeychainError.userCancelled {
            // User dismissed the prompt - stay locked, no error.
        } catch GoogleLoginError.refreshFailed {
            // Refresh token expired / revoked - drop it and fall back to a full sign-in.
            KeychainStore.delete(for: KeychainStore.refreshTokenKey)
            state = .signedOut
            errorMessage = "Your session has expired. Please sign in again."
        } catch {
            errorMessage = "Couldn't unlock. Sign in with Google to continue."
        }
    }

    func signInWithGoogle() async {
        guard !isAuthenticating else { return }
        errorMessage = nil
        isAuthenticating = true
        defer { isAuthenticating = false }

        do {
            let session = try await authService.signInWithGoogle()
            // Best-effort - if the Keychain write fails (e.g. no passcode set) the user simply
            // won't get the biometric shortcut next launch.
            try? KeychainStore.save(session.refreshToken, for: KeychainStore.refreshTokenKey)
            state = .signedIn(session)
        } catch {
            errorMessage = "Could not sign in. Please try again."
        }
    }

    func signOut() {
        KeychainStore.delete(for: KeychainStore.refreshTokenKey)
        errorMessage = nil
        state = .signedOut
    }
}
