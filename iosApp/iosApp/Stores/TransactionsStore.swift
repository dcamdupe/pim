import Combine
import Foundation

// Shared cache of the user's transactions, ported from FrontEnd/src/stores/transactions.ts. Both
// the dashboard and the transactions screen read this one copy: an in-memory list backed by
// UserDefaults, refreshed at most once per EXPIRY window, with edits merged in place so the other
// screen sees them without its own fetch.
@MainActor
final class TransactionsStore: ObservableObject {
    @Published private(set) var transactions: [Transaction] = []
    @Published private(set) var loadedAt: Date?
    // Per-description stats for the "apply to similar" prompt - the web keeps these in a separate
    // service cache (transactionDescriptionsService.ts); here they ride along with the store since
    // only the transactions screen uses them.
    @Published private(set) var descriptions: [TransactionDescriptionStat] = []

    private let api: PimApiClient
    private var inFlightRefresh: Task<Void, Error>?

    private static let storageKey = "pim.transactions"
    private static let expiry: TimeInterval = 10 * 60

    init(idToken: String, api: PimApiClient? = nil) {
        self.api = api ?? PimApiClient(idToken: idToken)
        if let stored = Self.loadStored() {
            transactions = stored.transactions
            loadedAt = stored.loadedAt
        }
    }

    // Fetches only when there is no cache or it is past the expiry window - avoids a redundant
    // fetch when both screens call load() on appear.
    func load() async throws {
        if let loadedAt, Date().timeIntervalSince(loadedAt) < Self.expiry {
            return
        }
        try await refresh()
    }

    // Forced fetch, deduped to a single in-flight task so concurrent callers await the same one.
    func refresh() async throws {
        if let inFlightRefresh {
            return try await inFlightRefresh.value
        }
        let task = Task<Void, Error> {
            defer { inFlightRefresh = nil }
            let fetched = try await api.getTransactions()
            transactions = fetched
            loadedAt = Date()
            persist()
        }
        inFlightRefresh = task
        return try await task.value
    }

    // Lazily loaded by the transactions screen (the dashboard never needs them). `force` re-fetches
    // after a mapping rule has retroactively recategorised transactions server-side.
    func loadDescriptions(force: Bool = false) async throws {
        if !force, !descriptions.isEmpty { return }
        descriptions = try await api.getTransactionDescriptions()
    }

    // Sets one transaction's category via PUT /transactions and merges the server's response
    // (which can also stamp type/ignore) back into the cached list.
    func setCategory(_ category: String, for transaction: Transaction) async throws {
        let updated = try await api.updateTransactions([transaction.withCategory(category)])
        for server in updated {
            if let index = transactions.firstIndex(where: { $0.id == server.id }) {
                transactions[index] = server
            }
        }
        persist()
    }

    // Saves a description-prefix rule, then refreshes - the rule recategorises many transactions
    // server-side that we hold no individual reference to.
    func applyDescriptionMapping(descriptionStart: String, category: String) async throws {
        try await api.saveDescriptionMapping(descriptionStart: descriptionStart, category: category)
        try await refresh()
        try await loadDescriptions(force: true)
    }

    func clear() {
        transactions = []
        descriptions = []
        loadedAt = nil
        inFlightRefresh?.cancel()
        inFlightRefresh = nil
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    // MARK: - Persistence

    private struct Stored: Codable {
        let transactions: [Transaction]
        let loadedAt: Date
    }

    private func persist() {
        guard let loadedAt else { return }
        let stored = Stored(transactions: transactions, loadedAt: loadedAt)
        if let data = try? JSONEncoder().encode(stored) {
            UserDefaults.standard.set(data, forKey: Self.storageKey)
        }
    }

    private static func loadStored() -> Stored? {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else { return nil }
        return try? JSONDecoder().decode(Stored.self, from: data)
    }
}
