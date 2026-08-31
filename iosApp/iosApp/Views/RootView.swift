import SwiftUI

// Switches between the sign-in / unlock screen and the signed-in app shell based on
// SessionController state (UBE-105).
struct RootView: View {
    @EnvironmentObject private var session: SessionController

    var body: some View {
        switch session.state {
        case .locked, .signedOut:
            LoginView()
        case .signedIn(let cognitoSession):
            AppTabView(session: cognitoSession, onSignOut: { session.signOut() })
        }
    }
}
