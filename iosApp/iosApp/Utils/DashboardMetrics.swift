import Foundation

// Direct port of FrontEnd/src/utils/dashboardMetrics.ts. Keep the two in sync. The web functions
// take a `today` Date that is really "the selected month" (DashboardView passes selectedMonth);
// here that is `CalDate` at the 1st of the selected month.

// A calendar date with no time/zone - all dashboard maths is date-only, so this sidesteps timezone
// drift. `month` is 1-12 (unlike JS's 0-11).
struct CalDate: Comparable, Equatable {
    let year: Int
    let month: Int
    let day: Int

    static func < (lhs: CalDate, rhs: CalDate) -> Bool {
        (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
    }
}

struct DateRange {
    let start: CalDate
    let end: CalDate
}

struct DashboardTiles {
    let currentMonthProfit: Double
    let currentMonthProfitDeltaPct: Double?
    let previousSixMonthsProfitAverage: Double
    let currentMonthExpenses: Double
    let currentMonthExpensesDeltaPct: Double?
    let previousSixMonthsExpensesAverage: Double
}

struct CategoryExpense: Identifiable {
    let category: String
    let amount: Double
    let pct: Double
    let color: String?

    var id: String { category }
}

struct MonthlyFlow: Identifiable {
    let month: String
    let year: Int
    let income: Double
    let expense: Double

    var id: String { "\(month)-\(year)" }
}

struct MonthOption: Identifiable, Equatable {
    let value: String
    let label: String

    var id: String { value }
}

enum DashboardMetrics {
    // Fixed English names, not a locale-dependent DateFormatter, so labels are deterministic
    // (matches dashboardMetrics.ts's MONTH_NAMES rationale).
    static let monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    static let monthAbbreviations = monthNames.map { String($0.prefix(3)) }

    // Gregorian/UTC so `makeDate` arithmetic (month/day under- and overflow) is deterministic and
    // matches JS `new Date(year, month, day)`.
    private static let calendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }()

    // Mirrors JS `new Date(year, month0, day)` including month/day roll-over (e.g. month0 = -1 or
    // day = 0). `month0` is 0-indexed like JS.
    static func makeDate(year: Int, month0: Int, day: Int) -> CalDate {
        var components = DateComponents()
        components.year = year
        components.month = month0 + 1
        components.day = day
        let date = calendar.date(from: components)!
        let out = calendar.dateComponents([.year, .month, .day], from: date)
        return CalDate(year: out.year!, month: out.month!, day: out.day!)
    }

    static func parseTransactionDate(_ iso: String) -> CalDate? {
        let parts = iso.split(separator: "-")
        guard parts.count == 3, let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else {
            return nil
        }
        return CalDate(year: y, month: m, day: d)
    }

    static func today() -> CalDate {
        let out = calendar.dateComponents([.year, .month, .day], from: Date())
        return CalDate(year: out.year!, month: out.month!, day: out.day!)
    }

    static func formatMonthYear(_ date: CalDate) -> String {
        "\(monthNames[date.month - 1]) \(date.year)"
    }

    // "YYYY-MM" - stable, sortable key for a calendar month.
    static func monthKey(year: Int, month0: Int) -> String {
        String(format: "%04d-%02d", year, month0 + 1)
    }

    static func parseMonthKey(_ key: String) -> CalDate {
        let parts = key.split(separator: "-")
        let year = Int(parts[0]) ?? today().year
        let month = Int(parts[1]) ?? 1
        return CalDate(year: year, month: month, day: 1)
    }

    // Every calendar month from `minTransactionDate` through the real current month, newest first.
    // Falls back to just the current month when there is no history.
    static func computeAvailableMonths(minTransactionDate: CalDate?, today: CalDate) -> [MonthOption] {
        let oldest = minTransactionDate ?? today
        var options: [MonthOption] = []

        var year = today.year
        var month0 = today.month - 1

        while year > oldest.year || (year == oldest.year && month0 >= oldest.month - 1) {
            options.append(
                MonthOption(value: monthKey(year: year, month0: month0), label: "\(monthNames[month0]) \(year)")
            )
            month0 -= 1
            if month0 < 0 {
                month0 = 11
                year -= 1
            }
        }

        return options
    }

    static func getCurrentMonthRange(_ ref: CalDate) -> DateRange {
        DateRange(
            start: makeDate(year: ref.year, month0: ref.month - 1, day: 1),
            end: makeDate(year: ref.year, month0: ref.month, day: 0)
        )
    }

    // The 6 full calendar months before the current month.
    static func getPreviousSixMonthsRange(_ ref: CalDate) -> DateRange {
        let end = makeDate(year: ref.year, month0: ref.month - 1, day: 0)
        let start = makeDate(year: end.year, month0: (end.month - 1) - 5, day: 1)
        return DateRange(start: start, end: end)
    }

    static func formatSixMonthRangeLabel(_ ref: CalDate) -> String {
        let range = getPreviousSixMonthsRange(ref)
        return "\(formatMonthYear(range.start)) - \(formatMonthYear(range.end))"
    }

    // MARK: - Predicates

    private static func isCounted(_ t: Transaction) -> Bool {
        t.ignore != true
    }

    private static func isWithinRange(_ t: Transaction, _ range: DateRange) -> Bool {
        guard let date = parseTransactionDate(t.date) else { return false }
        return date >= range.start && date <= range.end
    }

    private static func sumIncome(_ transactions: [Transaction]) -> Double {
        transactions
            .filter { isCounted($0) && $0.type == .income }
            .reduce(0.0) { $0 + $1.amount }
    }

    // Uncategorized transactions have no Income/Expense classification - the raw amount sign stands
    // in (negative = money out).
    private static func isUncategorizedExpense(_ t: Transaction) -> Bool {
        t.type == nil && t.amount < 0
    }

    private static func sumExpenses(_ transactions: [Transaction]) -> Double {
        let total = transactions
            .filter { isCounted($0) && ($0.type == .expense || isUncategorizedExpense($0)) }
            .reduce(0.0) { $0 + $1.amount }
        return total == 0 ? 0 : -total
    }

    private static func computeProfit(_ transactions: [Transaction]) -> Double {
        sumIncome(transactions) - sumExpenses(transactions)
    }

    // nil when the baseline is zero - percentage change against zero is undefined.
    private static func percentChangeVsAverage(_ current: Double, _ baselineAverage: Double) -> Double? {
        guard baselineAverage != 0 else { return nil }
        return ((current - baselineAverage) / abs(baselineAverage)) * 100
    }

    // MARK: - Aggregations

    static func computeExpensesByCategory(
        _ transactions: [Transaction],
        _ ref: CalDate,
        categoryColor: (String) -> String?
    ) -> [CategoryExpense] {
        let range = getCurrentMonthRange(ref)
        let currentMonth = transactions.filter { isWithinRange($0, range) }
        var totals: [String: Double] = [:]

        for t in currentMonth {
            guard isCounted(t), t.type == .expense || isUncategorizedExpense(t) else { continue }
            totals[t.category, default: 0] -= t.amount
        }

        // A category that nets a refund for the month has no real spend to show - excluding it keeps
        // every other percentage positive and summing to 100%.
        let positive = totals.filter { $0.value > 0 }
        let total: Double = positive.values.reduce(0, +)

        return positive
            .map { category, amount in
                CategoryExpense(
                    category: category,
                    amount: amount,
                    pct: total == 0 ? 0 : (amount / total) * 100,
                    color: categoryColor(category)
                )
            }
            .sorted { $0.amount > $1.amount }
    }

    // The 6 calendar months ending with the current month.
    static func computeMonthlyIncomeExpenses(_ transactions: [Transaction], _ ref: CalDate) -> [MonthlyFlow] {
        var months: [MonthlyFlow] = []

        for i in stride(from: 5, through: 0, by: -1) {
            let monthStart = makeDate(year: ref.year, month0: (ref.month - 1) - i, day: 1)
            let monthEnd = makeDate(year: monthStart.year, month0: monthStart.month, day: 0)
            let range = DateRange(start: monthStart, end: monthEnd)
            let monthTransactions = transactions.filter { isWithinRange($0, range) }

            months.append(
                MonthlyFlow(
                    month: monthAbbreviations[monthStart.month - 1],
                    year: monthStart.year,
                    income: sumIncome(monthTransactions),
                    expense: sumExpenses(monthTransactions)
                )
            )
        }

        return months
    }

    // Most recent first, capped to `limit`. ISO date strings sort chronologically as plain strings;
    // Swift's sort is stable, so same-day transactions keep their API order.
    static func computeRecentTransactions(_ transactions: [Transaction], limit: Int = 20) -> [Transaction] {
        Array(transactions.sorted { $0.date > $1.date }.prefix(limit))
    }

    static func computeDashboardTiles(_ transactions: [Transaction], _ ref: CalDate) -> DashboardTiles {
        let currentMonth = transactions.filter { isWithinRange($0, getCurrentMonthRange(ref)) }
        let previousSixMonths = transactions.filter { isWithinRange($0, getPreviousSixMonthsRange(ref)) }

        let currentMonthProfit = computeProfit(currentMonth)
        let previousSixMonthsProfitAverage = computeProfit(previousSixMonths) / 6
        let currentMonthExpenses = sumExpenses(currentMonth)
        let previousSixMonthsExpensesAverage = sumExpenses(previousSixMonths) / 6

        return DashboardTiles(
            currentMonthProfit: currentMonthProfit,
            currentMonthProfitDeltaPct: percentChangeVsAverage(currentMonthProfit, previousSixMonthsProfitAverage),
            previousSixMonthsProfitAverage: previousSixMonthsProfitAverage,
            currentMonthExpenses: currentMonthExpenses,
            currentMonthExpensesDeltaPct: percentChangeVsAverage(currentMonthExpenses, previousSixMonthsExpensesAverage),
            previousSixMonthsExpensesAverage: previousSixMonthsExpensesAverage
        )
    }
}
