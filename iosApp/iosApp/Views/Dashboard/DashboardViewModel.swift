import Combine
import Foundation

// Holds the selected month + load state and derives every dashboard metric from the shared
// TransactionsStore / SettingsStore (UBE-103) - same model as FrontEnd's DashboardView.vue, which
// reads the shared Pinia stores. Changing the month recomputes locally, no refetch.
@MainActor
final class DashboardViewModel: ObservableObject {
    enum LoadState: Equatable {
        case loading
        case loaded
        case failed
        case sessionExpired
    }

    @Published private(set) var state: LoadState = .loading
    @Published var selectedMonthKey: String {
        didSet {
            guard oldValue != selectedMonthKey else { return }
            UserDefaults.standard.set(selectedMonthKey, forKey: Self.monthDefaultsKey)
        }
    }

    private let transactionsStore: TransactionsStore
    private let settingsStore: SettingsStore
    private var cancellables: Set<AnyCancellable> = []

    private static let monthDefaultsKey = "pim.dashboard.month"

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore) {
        self.transactionsStore = transactionsStore
        self.settingsStore = settingsStore
        let today = DashboardMetrics.today()
        let stored = UserDefaults.standard.string(forKey: Self.monthDefaultsKey)
        self.selectedMonthKey = stored
            ?? DashboardMetrics.monthKey(year: today.year, month0: today.month - 1)

        // Re-publish whenever the shared stores change (e.g. a category edit on the transactions
        // screen) so the derived metrics below refresh.
        transactionsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
        settingsStore.objectWillChange
            .sink { [weak self] _ in self?.objectWillChange.send() }
            .store(in: &cancellables)
    }

    private var transactions: [Transaction] { transactionsStore.transactions }

    private var minTransactionDate: CalDate? {
        settingsStore.minTransactionDate.flatMap(DashboardMetrics.parseTransactionDate)
    }

    var referenceMonth: CalDate {
        DashboardMetrics.parseMonthKey(selectedMonthKey)
    }

    var availableMonths: [MonthOption] {
        DashboardMetrics.computeAvailableMonths(
            minTransactionDate: minTransactionDate,
            today: DashboardMetrics.today()
        )
    }

    var selectedMonthLabel: String {
        DashboardMetrics.formatMonthYear(referenceMonth)
    }

    var sixMonthRangeLabel: String {
        DashboardMetrics.formatSixMonthRangeLabel(referenceMonth)
    }

    var tiles: DashboardTiles {
        DashboardMetrics.computeDashboardTiles(transactions, referenceMonth)
    }

    var expensesByCategory: [CategoryExpense] {
        DashboardMetrics.computeExpensesByCategory(transactions, referenceMonth, categoryColor: categoryColor)
    }

    var monthlyIncomeExpenses: [MonthlyFlow] {
        DashboardMetrics.computeMonthlyIncomeExpenses(transactions, referenceMonth)
    }

    var recentTransactions: [Transaction] {
        Array(DashboardMetrics.computeRecentTransactions(transactions).prefix(5))
    }

    func categoryColor(_ name: String) -> String? {
        settingsStore.categoryColor(name)
    }

    func load() async {
        if !transactions.isEmpty {
            state = .loaded
        } else {
            state = .loading
        }
        do {
            async let transactionsCall: Void = transactionsStore.load()
            async let settingsCall: Void = settingsStore.load()
            _ = try await (transactionsCall, settingsCall)
            clampSelectedMonthToAvailable()
            state = .loaded
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            state = transactions.isEmpty ? .failed : .loaded
        }
    }

    // A stored month can fall outside the (freshly loaded) available range - snap back to the newest.
    private func clampSelectedMonthToAvailable() {
        let months = availableMonths
        guard !months.isEmpty, !months.contains(where: { $0.value == selectedMonthKey }) else { return }
        selectedMonthKey = months[0].value
    }
}
