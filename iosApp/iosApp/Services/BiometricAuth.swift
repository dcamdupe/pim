import LocalAuthentication

enum BiometricType {
    case faceID
    case touchID
    case none

    var label: String {
        switch self {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .none: return "biometrics"
        }
    }

    var systemImage: String {
        switch self {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .none: return "lock"
        }
    }
}

// The Keychain item's own access control is what actually gates the refresh token read; this only
// reports which biometry is available so the UI can label the "Unlock" affordance and so the
// SessionController knows whether to offer it at all.
enum BiometricAuth {
    static var availableType: BiometricType {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return .none
        }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        default: return .none
        }
    }
}
