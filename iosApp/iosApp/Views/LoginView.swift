import SwiftUI

struct LoginView: View {
    @State private var authService = CognitoAuthService()
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var session: CognitoSession?

    var body: some View {
        VStack(spacing: 16) {
            Text("Log in")
                .font(.system(size: 24, weight: .semibold))

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13))
                    .foregroundColor(Color(red: 0.83, green: 0.2, blue: 0.2))
            }

            Button(action: signIn) {
                HStack(spacing: 10) {
                    GoogleLogoView()
                        .frame(width: 20, height: 20)
                    Text(isSubmitting ? "Redirecting…" : "Sign in with Google")
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
            .disabled(isSubmitting)
            .opacity(isSubmitting ? 0.6 : 1)
        }
        .padding(32)
        .frame(maxWidth: 320)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.separator), lineWidth: 1)
        )
        .fullScreenCover(item: $session) { session in
            DashboardView(session: session, onSignOut: { self.session = nil })
        }
    }

    private func signIn() {
        errorMessage = nil
        isSubmitting = true
        Task {
            do {
                session = try await authService.signInWithGoogle()
            } catch {
                errorMessage = "Could not sign in. Please try again."
            }
            isSubmitting = false
        }
    }
}

extension CognitoSession: Identifiable {
    var id: String { idToken }
}

#Preview {
    LoginView()
}
