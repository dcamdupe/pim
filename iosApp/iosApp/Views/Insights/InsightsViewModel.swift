import Combine
import Foundation

// Drives the Insights tab (port of FrontEnd's InsightsView.vue, UBE-118): month-on-month spending
// trends computed from the shared TransactionsStore / SettingsStore - no extra Api calls.
@MainActor
final class InsightsViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded
        case failed
        case sessionExpired
    }

    @Published private(set) var state: LoadState = .loading
    @Published var selectedKey: String
    // Category shown in the detail sheet.
    @Published var detailCategory: String?

    private let transactionsStore: TransactionsStore
    private let settingsStore: SettingsStore
    private var cancellables: Set<AnyCancellable> = []
    // Until the user steps, keep re-defaulting as history finishes loading.
    private var userNavigated = false

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore) {
        self.transactionsStore = transactionsStore
        self.settingsStore = settingsStore
        let today = DashboardMetrics.today()
        selectedKey = SpendingInsights.defaultMonth(today: today, availableKeys: [])
        transactionsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        settingsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
    }

    // Newest first.
    var availableKeys: [String] {
        let minDate = settingsStore.minTransactionDate.flatMap(DashboardMetrics.parseTransactionDate)
        return DashboardMetrics.computeAvailableMonths(minTransactionDate: minDate, today: DashboardMetrics.today())
            .map(\.value)
    }

    var selected: CalMonth { SpendingInsights.parseMonthKey(selectedKey) }
    var previous: CalMonth { SpendingInsights.addMonths(selected, -1) }

    private var selectedIndex: Int? { availableKeys.firstIndex(of: selectedKey) }
    var canGoBack: Bool { selectedIndex.map { $0 < availableKeys.count - 1 } ?? false }
    var canGoForward: Bool { selectedIndex.map { $0 > 0 } ?? false }

    var monthLabel: String {
        "\(SpendingInsights.shortLabel(selected)) vs \(SpendingInsights.shortLabel(previous))"
    }

    var insights: [CategoryInsight] {
        SpendingInsights.computeCategoryInsights(transactionsStore.transactions, selected: selected)
    }

    var groups: InsightGroups { SpendingInsights.group(insights) }

    var summary: InsightSummary { SpendingInsights.summarise(insights, groups) }

    var detailInsight: CategoryInsight? {
        guard let detailCategory else { return nil }
        return insights.first { $0.name == detailCategory }
    }

    func drivers(for insight: CategoryInsight) -> [InsightDriver] {
        SpendingInsights.computeDrivers(transactionsStore.transactions, insight: insight, selected: selected)
    }

    func colour(for insight: CategoryInsight) -> String {
        (insight.category.isEmpty ? nil : settingsStore.categoryColor(insight.category))
            ?? DashboardTheme.fallbackCategoryColor
    }

    func step(_ delta: Int) {
        guard let index = selectedIndex else { return }
        let next = index - delta
        guard availableKeys.indices.contains(next) else { return }
        userNavigated = true
        selectedKey = availableKeys[next]
    }

    func load() async {
        state = transactionsStore.transactions.isEmpty ? .loading : .loaded
        do {
            async let transactionsCall: Void = transactionsStore.load()
            async let settingsCall: Void = settingsStore.load()
            _ = try await (transactionsCall, settingsCall)
            if !userNavigated {
                selectedKey = SpendingInsights.defaultMonth(today: DashboardMetrics.today(), availableKeys: availableKeys)
            }
            state = .loaded
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            state = transactionsStore.transactions.isEmpty ? .failed : .loaded
        }
    }
}
