import SwiftUI

// Placeholder shown after a successful login - no real dashboard content yet (UBE-97 is just the
// app shell).
struct DashboardView: View {
    let session: CognitoSession

    var body: some View {
        VStack(spacing: 12) {
            Text("Welcome to PIM")
                .font(.system(size: 24, weight: .semibold))
            Text("Dashboard coming soon.")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    DashboardView(session: CognitoSession(idToken: "preview", refreshToken: "preview"))
}
