import Combine
import Foundation

// Drives the transactions screen (UBE-103), matching the Transactions tab of
// docs/design/dashboard-mockup-ios.html and the categorize flow of FrontEnd's TransactionsView.vue.
// Reads the shared TransactionsStore / SettingsStore, so it reuses whatever the dashboard already
// loaded and an edit here shows on the dashboard too.
@MainActor
final class TransactionsViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded
        case failed
        case sessionExpired
    }

    // A category change that hit an approximate description match - drives the "apply to similar?"
    // sheet.
    struct PendingCategoryChange: Identifiable {
        let transaction: Transaction
        let category: String
        let match: ApproximateMatch
        var id: String { transaction.id }
    }

    enum ModalAction: Equatable { case confirm, decline }

    @Published private(set) var state: LoadState = .loading
    @Published var searchQuery: String = ""
    @Published var needsCategoryOnly: Bool = false

    @Published private(set) var savingCategoryFor: Transaction.ID?
    @Published var pendingCategoryChange: PendingCategoryChange?
    @Published private(set) var modalAction: ModalAction?
    @Published private(set) var categorySaveError: String?

    private let transactionsStore: TransactionsStore
    private let settingsStore: SettingsStore
    private var cancellables: Set<AnyCancellable> = []

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore) {
        self.transactionsStore = transactionsStore
        self.settingsStore = settingsStore
        transactionsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        settingsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
    }

    // MARK: - Derived data

    // Newest first, matching the mockup's list order; a stable sort keeps same-day API order.
    private var sortedTransactions: [Transaction] {
        transactionsStore.transactions.sorted { $0.date > $1.date }
    }

    // Search applied but not the needs-category toggle - this is what the chip's count reflects, so
    // it tracks the search live (matches TransactionsView.vue's `searchedAndCategorised`).
    private var searchedTransactions: [Transaction] {
        sortedTransactions.filter { TransactionFilters.matchesSearch($0, query: searchQuery) }
    }

    var visibleTransactions: [Transaction] {
        needsCategoryOnly ? searchedTransactions.filter(TransactionFilters.needsCategory) : searchedTransactions
    }

    var needsCategoryCount: Int {
        TransactionFilters.needsCategoryCount(searchedTransactions)
    }

    var categoryNames: [String] {
        settingsStore.categoryNames
    }

    func categoryColor(_ name: String) -> String? {
        settingsStore.categoryColor(name)
    }

    var isEmpty: Bool { transactionsStore.transactions.isEmpty }

    // MARK: - Loading

    func load() async {
        if !isEmpty {
            state = .loaded
        } else {
            state = .loading
        }
        do {
            async let transactionsCall: Void = transactionsStore.load()
            async let settingsCall: Void = settingsStore.load()
            _ = try await (transactionsCall, settingsCall)
            try await transactionsStore.loadDescriptions()
            state = .loaded
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            state = isEmpty ? .failed : .loaded
        }
    }

    // MARK: - Categorize flow

    // Picking a category: if other transactions share a description prefix, prompt before applying;
    // otherwise save this one directly.
    func selectCategory(_ category: String, for transaction: Transaction) async {
        categorySaveError = nil
        let match = DescriptionMatching.findApproximateMatch(
            description: transaction.description,
            otherDescriptions: transactionsStore.descriptions
        )
        if let match {
            // The category picker sheet is dismissing as this runs - let it finish before
            // presenting the "apply to similar?" sheet, or SwiftUI drops the second presentation.
            try? await Task.sleep(nanoseconds: 350_000_000)
            pendingCategoryChange = PendingCategoryChange(transaction: transaction, category: category, match: match)
            return
        }
        await directSave(category, for: transaction)
    }

    private func directSave(_ category: String, for transaction: Transaction) async {
        savingCategoryFor = transaction.id
        defer { savingCategoryFor = nil }
        do {
            try await transactionsStore.setCategory(category, for: transaction)
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            categorySaveError = "Could not save the category. Please try again."
        }
    }

    // "Apply to N similar" - save the description rule, then the store refreshes.
    func confirmApplyToSimilar() async {
        guard let pending = pendingCategoryChange else { return }
        categorySaveError = nil
        modalAction = .confirm
        defer { modalAction = nil }
        do {
            try await transactionsStore.applyDescriptionMapping(
                descriptionStart: pending.match.descriptionStart, category: pending.category
            )
            pendingCategoryChange = nil
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            categorySaveError = "Could not save the category. Please try again."
        }
    }

    // "Just this one".
    func declineApplyToSimilar() async {
        guard let pending = pendingCategoryChange else { return }
        categorySaveError = nil
        modalAction = .decline
        defer { modalAction = nil }
        do {
            try await transactionsStore.setCategory(pending.category, for: pending.transaction)
            pendingCategoryChange = nil
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            categorySaveError = "Could not save the category. Please try again."
        }
    }

    func cancelApplyToSimilar() {
        pendingCategoryChange = nil
    }
}
