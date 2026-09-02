import SwiftUI

// Sign-in / unlock screen (UBE-105). When a Cognito refresh token is stored and biometrics are
// available (`SessionController.state == .locked`), the primary action is a Face ID / Touch ID
// unlock and it auto-prompts once on appear; the Google button is always the fallback.
struct LoginView: View {
    @EnvironmentObject private var session: SessionController

    private var isLocked: Bool { session.state == .locked }

    var body: some View {
        VStack(spacing: 16) {
            Text("Log in")
                .font(.system(size: 24, weight: .semibold))

            if let errorMessage = session.errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13))
                    .foregroundColor(Color(red: 0.83, green: 0.2, blue: 0.2))
                    .multilineTextAlignment(.center)
            }

            if isLocked {
                unlockButton
                googleButton(label: "Sign in with a different account")
            } else {
                googleButton(label: "Sign in with Google")
            }
        }
        .padding(32)
        .frame(maxWidth: 320)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.separator), lineWidth: 1)
        )
        .task {
            if isLocked {
                await session.unlock()
            }
        }
    }

    private var unlockButton: some View {
        Button {
            Task { await session.unlock() }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: session.biometricType.systemImage)
                    .font(.system(size: 18, weight: .medium))
                Text(session.isAuthenticating ? "Unlocking…" : "Unlock with \(session.biometricType.label)")
                    .font(.system(size: 14, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.accentColor)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .disabled(session.isAuthenticating)
        .opacity(session.isAuthenticating ? 0.6 : 1)
    }

    private func googleButton(label: String) -> some View {
        Button {
            Task { await session.signInWithGoogle() }
        } label: {
            HStack(spacing: 10) {
                GoogleLogoView()
                    .frame(width: 20, height: 20)
                Text(showRedirecting ? "Redirecting…" : label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color(red: 0.12, green: 0.12, blue: 0.12))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(Color(red: 0.45, green: 0.46, blue: 0.46), lineWidth: 1)
            )
        }
        .disabled(session.isAuthenticating)
        .opacity(session.isAuthenticating ? 0.6 : 1)
    }

    // Only the Google button shows "Redirecting…" - and not while the unlock button owns the
    // in-flight state.
    private var showRedirecting: Bool {
        session.isAuthenticating && !isLocked
    }
}

#Preview {
    LoginView()
        .environmentObject(SessionController())
}
