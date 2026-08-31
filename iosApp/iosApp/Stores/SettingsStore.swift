import Combine
import Foundation

// Shared cache of GET /settings, ported from FrontEnd/src/stores/settings.ts. Load-once (no expiry
// window, unlike TransactionsStore) - the web relies on a forced refresh() after any settings edit
// to keep it current, and this app has no settings-editing screen yet.
@MainActor
final class SettingsStore: ObservableObject {
    @Published private(set) var accounts: [Account] = []
    @Published private(set) var categories: [CategoryDefinition] = []
    @Published private(set) var minTransactionDate: String?
    @Published private(set) var loadedAt: Date?

    private let api: PimApiClient
    private var inFlightRefresh: Task<Void, Error>?

    private static let storageKey = "pim.settings"

    init(idToken: String, api: PimApiClient? = nil) {
        self.api = api ?? PimApiClient(idToken: idToken)
        if let stored = Self.loadStored() {
            accounts = stored.accounts
            categories = stored.categories
            minTransactionDate = stored.minTransactionDate
            loadedAt = stored.loadedAt
        }
    }

    func load() async throws {
        if loadedAt != nil { return }
        try await refresh()
    }

    func refresh() async throws {
        if let inFlightRefresh {
            return try await inFlightRefresh.value
        }
        let task = Task<Void, Error> {
            defer { inFlightRefresh = nil }
            let settings = try await api.getSettings()
            accounts = settings.accounts
            categories = settings.categories
            minTransactionDate = settings.minTransactionDate
            loadedAt = Date()
            persist()
        }
        inFlightRefresh = task
        return try await task.value
    }

    // Settings lookup with the shared fallback, matching categoriesService.ts + the components'
    // FALLBACK_COLOR.
    func categoryColor(_ name: String) -> String? {
        categories.first { $0.name == name }?.colour
    }

    var categoryNames: [String] {
        categories.map(\.name)
    }

    func clear() {
        accounts = []
        categories = []
        minTransactionDate = nil
        loadedAt = nil
        inFlightRefresh?.cancel()
        inFlightRefresh = nil
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    // MARK: - Persistence

    private struct Stored: Codable {
        let accounts: [Account]
        let categories: [CategoryDefinition]
        let minTransactionDate: String?
        let loadedAt: Date
    }

    private func persist() {
        guard let loadedAt else { return }
        let stored = Stored(
            accounts: accounts, categories: categories,
            minTransactionDate: minTransactionDate, loadedAt: loadedAt
        )
        if let data = try? JSONEncoder().encode(stored) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    private static func loadStored() -> Stored? {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else { return nil }
        return try? JSONDecoder().decode(Stored.self, from: data)
    }
}
