import SwiftUI

// The signed-in shell (UBE-103): a Dashboard + Transactions tab bar matching
// docs/design/dashboard-mockup-ios.html. Owns the shared TransactionsStore / SettingsStore so both
// tabs read one cached copy of the data and edits on one show on the other.
struct AppTabView: View {
    let session: CognitoSession
    var onSignOut: () -> Void

    @StateObject private var transactionsStore: TransactionsStore
    @StateObject private var settingsStore: SettingsStore

    init(session: CognitoSession, onSignOut: @escaping () -> Void) {
        self.session = session
        self.onSignOut = onSignOut
        _transactionsStore = StateObject(wrappedValue: TransactionsStore(idToken: session.idToken))
        _settingsStore = StateObject(wrappedValue: SettingsStore(idToken: session.idToken))
    }

    var body: some View {
        TabView {
            DashboardView(
                transactionsStore: transactionsStore,
                settingsStore: settingsStore,
                onSignOut: signOut
            )
            .tabItem { Label("Dashboard", systemImage: "house") }

            TransactionsView(
                transactionsStore: transactionsStore,
                settingsStore: settingsStore,
                onSignOut: signOut
            )
            .tabItem { Label("Transactions", systemImage: "list.bullet") }
        }
        .tint(DashboardTheme.accentDark)
    }

    private func signOut() {
        transactionsStore.clear()
        settingsStore.clear()
        onSignOut()
    }
}
