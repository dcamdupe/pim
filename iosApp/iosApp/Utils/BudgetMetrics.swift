import Foundation

// Port of FrontEnd/src/utils/budgetMetrics.ts (UBE-124). Keep the two in sync.

struct BudgetProjectionRow: Identifiable, Equatable {
    let category: String
    let budget: Double
    let actual: Double
    let projected: Double
    var overBudget: Bool { projected > budget }
    var id: String { category }
}

struct BudgetProjection: Equatable {
    // False for a past month - `projected` then equals the final actual.
    let isProjected: Bool
    let daysElapsed: Int
    let daysInMonth: Int
    let rows: [BudgetProjectionRow]

    var totalBudget: Double { rows.reduce(0) { $0 + $1.budget } }
    var totalActual: Double { rows.reduce(0) { $0 + $1.actual } }
    var totalProjected: Double { rows.reduce(0) { $0 + $1.projected } }
}

struct MonthlyBudgetVsActual: Identifiable, Equatable {
    let month: String
    let year: Int
    let budget: Double
    let actual: Double
    var id: String { "\(month)-\(year)" }
}

enum BudgetMetrics {
    private static let calendar = Calendar(identifier: .gregorian)

    static func daysInMonth(year: Int, month: Int) -> Int {
        let date = calendar.date(from: DateComponents(year: year, month: month, day: 1))!
        return calendar.range(of: .day, in: .month, for: date)!.count
    }

    // ISO "yyyy-MM-dd" bounds for a 1-based month - string compare works on ISO dates.
    private static func monthRange(year: Int, month: Int) -> (start: String, end: String) {
        let prefix = String(format: "%04d-%02d", year, month)
        return ("\(prefix)-01", String(format: "\(prefix)-%02d", daysInMonth(year: year, month: month)))
    }

    // Net spend per category in [start, end]; refunds reduce it, never below 0.
    private static func spendByCategory(
        _ transactions: [Transaction], categories: Set<String>, start: String, end: String
    ) -> [String: Double] {
        var totals: [String: Double] = [:]
        for t in transactions where t.ignore != true && categories.contains(t.category) && t.date >= start && t.date <= end {
            totals[t.category, default: 0] -= t.amount
        }
        return totals.mapValues { max(0, $0) }
    }

    // Budget vs actual for the selected month; the current month is projected linearly to month end.
    static func computeBudgetProjection(
        _ transactions: [Transaction], budgets: [Budget], selectedMonth: CalDate, today: CalDate
    ) -> BudgetProjection {
        let days = daysInMonth(year: selectedMonth.year, month: selectedMonth.month)
        let isProjected = selectedMonth.year == today.year && selectedMonth.month == today.month
        let elapsed = isProjected ? today.day : days
        let range = monthRange(year: selectedMonth.year, month: selectedMonth.month)
        let spend = spendByCategory(transactions, categories: Set(budgets.map(\.category)), start: range.start, end: range.end)

        let rows = budgets
            .map { budget -> BudgetProjectionRow in
                let actual = spend[budget.category] ?? 0
                let projected = isProjected ? actual / Double(elapsed) * Double(days) : actual
                return BudgetProjectionRow(
                    category: budget.category, budget: budget.amountValue, actual: actual, projected: projected
                )
            }
            .sorted { $0.budget != $1.budget ? $0.budget > $1.budget : $0.category < $1.category }

        return BudgetProjection(isProjected: isProjected, daysElapsed: elapsed, daysInMonth: days, rows: rows)
    }

    // Budget vs actual for the 6 months ending with the selected month. An empty `category` sums every
    // budgeted category. Budgets aren't versioned, so today's amounts apply to every month.
    static func computeMonthlyBudgetVsActual(
        _ transactions: [Transaction], budgets: [Budget], selectedMonth: CalDate, category: String = ""
    ) -> [MonthlyBudgetVsActual] {
        let included = category.isEmpty ? budgets : budgets.filter { $0.category == category }
        let categories = Set(included.map(\.category))
        let budget = included.reduce(0) { $0 + $1.amountValue }

        return (0...5).reversed().map { offset in
            let index = selectedMonth.year * 12 + (selectedMonth.month - 1) - offset
            let year = index / 12
            let month = index % 12 + 1
            let range = monthRange(year: year, month: month)
            let spend = spendByCategory(transactions, categories: categories, start: range.start, end: range.end)
            return MonthlyBudgetVsActual(
                month: DashboardMetrics.monthAbbreviations[month - 1],
                year: year,
                budget: budget,
                actual: spend.values.reduce(0, +)
            )
        }
    }
}

// Month Budget card filter (UBE-125), matching budgetMetrics.ts's ProjectionFilter.
enum ProjectionFilter: String, CaseIterable, Identifiable {
    case top5, over, under

    var id: String { rawValue }

    var label: String {
        switch self {
        case .top5: return "Top 5 Spend"
        case .over: return "Over Budget"
        case .under: return "Under Budget"
        }
    }
}

extension BudgetMetrics {
    // Top 5 by actual spend; over budget (projected) by biggest overspend; under/at budget by spend.
    static func filterProjectionRows(_ rows: [BudgetProjectionRow], filter: ProjectionFilter) -> [BudgetProjectionRow] {
        let bySpend: (BudgetProjectionRow, BudgetProjectionRow) -> Bool = {
            $0.actual != $1.actual ? $0.actual > $1.actual : $0.category < $1.category
        }
        switch filter {
        case .top5:
            return Array(rows.sorted(by: bySpend).prefix(5))
        case .over:
            return rows.filter(\.overBudget).sorted {
                let a = $0.projected - $0.budget, b = $1.projected - $1.budget
                return a != b ? a > b : $0.category < $1.category
            }
        case .under:
            return rows.filter { !$0.overBudget }.sorted(by: bySpend)
        }
    }
}

extension Budget {
    var amountValue: Double { NSDecimalNumber(decimal: amount).doubleValue }
}
