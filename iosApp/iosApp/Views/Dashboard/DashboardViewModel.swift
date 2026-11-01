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

    // Budget cards (UBE-124) - loaded separately so a failure doesn't block the rest of the dashboard.
    @Published private(set) var budgets: [Budget] = []
    @Published private(set) var budgetsLoaded = false
    @Published private(set) var budgetsFailed = false
    @Published var selectedBudgetCategory: String {
        didSet { UserDefaults.standard.set(selectedBudgetCategory, forKey: Self.budgetCategoryDefaultsKey) }
    }

    private let transactionsStore: TransactionsStore
    private let settingsStore: SettingsStore
    private let api: PimApiClient?
    private var cancellables: Set<AnyCancellable> = []

    private static let monthDefaultsKey = "pim.dashboard.month"
    private static let budgetCategoryDefaultsKey = "pim.dashboard.budgetCategory"
    private static let projectionFilterDefaultsKey = "pim.dashboard.budgetProjectionFilter"

    // Month Budget card filter (UBE-125), defaulting to Top 5 Spend.
    @Published var projectionFilter: ProjectionFilter {
        didSet { UserDefaults.standard.set(projectionFilter.rawValue, forKey: Self.projectionFilterDefaultsKey) }
    }

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore, api: PimApiClient? = nil) {
        self.transactionsStore = transactionsStore
        self.settingsStore = settingsStore
        self.api = api
        self.selectedBudgetCategory = UserDefaults.standard.string(forKey: Self.budgetCategoryDefaultsKey) ?? ""
        self.projectionFilter = UserDefaults.standard.string(forKey: Self.projectionFilterDefaultsKey)
            .flatMap(ProjectionFilter.init(rawValue:)) ?? .top5
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

    var budgetProjection: BudgetProjection {
        BudgetMetrics.computeBudgetProjection(
            transactions, budgets: budgets, selectedMonth: referenceMonth, today: DashboardMetrics.today()
        )
    }

    // Only the rows shown are filtered; the card's totals still cover every budget.
    var filteredBudgetProjection: BudgetProjection {
        let projection = budgetProjection
        return BudgetProjection(
            isProjected: projection.isProjected,
            daysElapsed: projection.daysElapsed,
            daysInMonth: projection.daysInMonth,
            rows: BudgetMetrics.filterProjectionRows(projection.rows, filter: projectionFilter)
        )
    }

    var budgetCategories: [String] { budgets.map(\.category).sorted() }

    // A stored filter for a category that no longer has a budget falls back to "all".
    var effectiveBudgetCategory: String {
        budgetCategories.contains(selectedBudgetCategory) ? selectedBudgetCategory : ""
    }

    var monthlyBudgetVsActual: [MonthlyBudgetVsActual] {
        BudgetMetrics.computeMonthlyBudgetVsActual(
            transactions, budgets: budgets, selectedMonth: referenceMonth, category: effectiveBudgetCategory
        )
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
        Task { await loadBudgets() }
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

    private func loadBudgets() async {
        guard let api else { return }
        do {
            budgets = try await api.getBudgets()
            budgetsFailed = false
        } catch {
            budgetsFailed = true
        }
        budgetsLoaded = true
    }

    // A stored month can fall outside the (freshly loaded) available range - snap back to the newest.
    private func clampSelectedMonthToAvailable() {
        let months = availableMonths
        guard !months.isEmpty, !months.contains(where: { $0.value == selectedMonthKey }) else { return }
        selectedMonthKey = months[0].value
    }
}
