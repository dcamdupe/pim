import Foundation

// Loads transactions + settings once, then recomputes every dashboard metric locally when the
// month picker changes (no refetch) - same model as FrontEnd's DashboardView.vue.
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

    private let api: PimApiClient
    private var transactions: [Transaction] = []
    private var categories: [CategoryDefinition] = []
    private var minTransactionDate: CalDate?

    private static let monthDefaultsKey = "pim.dashboard.month"

    init(idToken: String, api: PimApiClient? = nil) {
        self.api = api ?? PimApiClient(idToken: idToken)
        let today = DashboardMetrics.today()
        let stored = UserDefaults.standard.string(forKey: Self.monthDefaultsKey)
        self.selectedMonthKey = stored
            ?? DashboardMetrics.monthKey(year: today.year, month0: today.month - 1)
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

    // Settings lookup with the shared fallback, matching categoriesService.ts + the components'
    // FALLBACK_COLOR.
    func categoryColor(_ name: String) -> String? {
        categories.first { $0.name == name }?.colour
    }

    func load() async {
        state = .loading
        do {
            async let transactionsCall = api.getTransactions()
            async let settingsCall = api.getSettings()
            let (fetchedTransactions, settings) = try await (transactionsCall, settingsCall)

            transactions = fetchedTransactions
            categories = settings.categories
            minTransactionDate = settings.minTransactionDate.flatMap(DashboardMetrics.parseTransactionDate)
            clampSelectedMonthToAvailable()
            state = .loaded
        } catch PimApiError.unauthorized {
            state = .sessionExpired
        } catch {
            state = .failed
        }
    }

    // A stored month can fall outside the (freshly loaded) available range - snap back to the newest.
    private func clampSelectedMonthToAvailable() {
        let months = availableMonths
        guard !months.isEmpty, !months.contains(where: { $0.value == selectedMonthKey }) else { return }
        selectedMonthKey = months[0].value
    }
}
