import Foundation
import CryptoKit

// PKCE (RFC 7636), ported from FrontEnd/src/services/auth/pkce.ts - required because the App
// Client is a public client (no client secret) with no confidential backend to keep one anyway.
enum PKCE {
    private static func base64UrlEncode(_ data: Data) -> String {
        Data(data)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return base64UrlEncode(Data(bytes))
    }

    static func deriveCodeChallenge(from verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return base64UrlEncode(Data(digest))
    }
}
