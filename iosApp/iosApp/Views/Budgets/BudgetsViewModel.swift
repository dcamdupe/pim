import Combine
import Foundation

// Drives the Budgets tab (UBE-119), matching FrontEnd's BudgetsView.vue: one amount field per
// Expense category, 6-month-average recommendations (UBE-123), a running total, and Save
// (PUT /budgets replaces the whole list).
@MainActor
final class BudgetsViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded
        case failed
        case sessionExpired
    }

    @Published private(set) var state: LoadState = .loading
    // Raw field text per category name - blank means no budget.
    @Published var inputs: [String: String] = [:] {
        didSet { if oldValue != inputs { saved = false } }
    }
    // Recommended amount per category (UBE-123); a missing entry means no recommendation.
    @Published private(set) var recommendations: [String: Decimal] = [:]
    @Published private(set) var saving = false
    @Published private(set) var saved = false
    @Published private(set) var saveError: String?

    private let settingsStore: SettingsStore
    private let api: PimApiClient
    private var cancellables: Set<AnyCancellable> = []

    init(settingsStore: SettingsStore, api: PimApiClient) {
        self.settingsStore = settingsStore
        self.api = api
        // Re-render when categories change (e.g. a settings refresh elsewhere).
        settingsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
    }

    var expenseCategories: [CategoryDefinition] {
        settingsStore.categories
            .filter { $0.type == "Expense" }
            .sorted { $0.name.localizedCompare($1.name) == .orderedAscending }
    }

    func error(for category: String) -> String? {
        if case .invalid(let message) = BudgetAmounts.parse(inputs[category] ?? "") { return message }
        return nil
    }

    var hasErrors: Bool { expenseCategories.contains { error(for: $0.name) != nil } }

    var total: Decimal { BudgetAmounts.total(expenseCategories.map { inputs[$0.name] ?? "" }) }

    func load() async {
        state = .loading
        do {
            async let budgets = api.getBudgets()
            async let recommended = loadRecommendations()
            try await settingsStore.load()
            recommendations = await recommended
            inputs = Dictionary(
                try await budgets.map { ($0.category, BudgetAmounts.formatInput($0.amount)) },
                uniquingKeysWith: { first, _ in first }
            )
            saved = false
            state = .loaded
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            state = .failed
        }
    }

    var hasRecommendations: Bool { expenseCategories.contains { recommendations[$0.name] != nil } }

    func useRecommendation(for category: String) {
        guard let amount = recommendations[category] else { return }
        inputs[category] = BudgetAmounts.formatInput(amount)
    }

    // Overwrites every field that has a recommendation; others are left as they are.
    func useAllRecommendations() {
        for category in expenseCategories { useRecommendation(for: category.name) }
    }

    // Recommendations are optional - a failure just leaves the column empty.
    private func loadRecommendations() async -> [String: Decimal] {
        guard let result = try? await api.getBudgetRecommendations() else { return [:] }
        return Dictionary(result.map { ($0.category, $0.amount) }, uniquingKeysWith: { first, _ in first })
    }

    func save() async {
        guard !hasErrors, !saving else { return }
        let budgets = expenseCategories.compactMap { category -> Budget? in
            if case .valid(let amount) = BudgetAmounts.parse(inputs[category.name] ?? "") {
                return Budget(category: category.name, amount: amount)
            }
            return nil
        }
        saving = true
        saveError = nil
        defer { saving = false }
        do {
            try await api.saveBudgets(budgets)
            saved = true
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            saveError = "Could not save your budgets. Please try again."
        }
    }
}
