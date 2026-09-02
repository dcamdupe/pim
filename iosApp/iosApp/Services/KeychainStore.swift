import Foundation
import LocalAuthentication

enum KeychainError: Error {
    case accessControlUnavailable
    case userCancelled
    case authFailed
    case unhandled(OSStatus)
}

// A tiny Keychain wrapper for the one secret this app persists: the Cognito refresh token, guarded
// by a biometric access control so *reading* it triggers Face ID / Touch ID. Existence checks and
// deletes don't prompt.
enum KeychainStore {
    static let refreshTokenKey = "pim.refreshToken"
    private static let service = "com.uberconcept.pim.auth"

    // Stores `value`, replacing any existing item for `key`. The item is bound to the currently
    // enrolled biometric set (`.biometryCurrentSet`) and to this device with a passcode set, so it
    // is invalidated if biometrics are changed and never leaves the device / a backup.
    static func save(_ value: String, for key: String) throws {
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            &error
        ) else {
            throw KeychainError.accessControlUnavailable
        }

        SecItemDelete(baseQuery(for: key) as CFDictionary)

        var attributes = baseQuery(for: key)
        attributes[kSecValueData as String] = Data(value.utf8)
        attributes[kSecAttrAccessControl as String] = access

        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unhandled(status)
        }
    }

    // Reading the data triggers the item's biometric access control. `reason` is surfaced by the
    // system prompt (and is the Touch ID sheet's message on devices without Face ID).
    static func read(for key: String, reason: String) throws -> String? {
        let context = LAContext()
        context.localizedReason = reason

        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        query[kSecUseAuthenticationContext as String] = context

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        switch status {
        case errSecSuccess:
            guard let data = result as? Data else { return nil }
            return String(decoding: data, as: UTF8.self)
        case errSecItemNotFound:
            return nil
        case errSecUserCanceled:
            throw KeychainError.userCancelled
        case errSecAuthFailed:
            throw KeychainError.authFailed
        default:
            throw KeychainError.unhandled(status)
        }
    }

    static func delete(for key: String) {
        SecItemDelete(baseQuery(for: key) as CFDictionary)
    }

    // Attributes-only query - does not request the data, so the biometric access control is not
    // invoked and no prompt is shown. `errSecInteractionNotAllowed` still means the item exists,
    // it just can't be inspected without authenticating.
    static func contains(_ key: String) -> Bool {
        var query = baseQuery(for: key)
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    private static func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}
