import SwiftUI

@main
struct iosAppApp: App {
    @StateObject private var session = SessionController()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
        }
    }
}
