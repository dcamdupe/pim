import Foundation

// Port of FrontEnd/src/utils/spendingInsights.ts (UBE-118 Insights tab). Keep the two in sync.
// Spend uses the dashboard's rules: Expense-type transactions plus uncategorised money-out, net of
// refunds, ignored ones skipped.

// A calendar month, `month` 1-based (like CalDate).
struct CalMonth: Equatable, Hashable {
    let year: Int
    let month: Int
}

struct CategoryInsight: Identifiable, Equatable {
    let name: String
    // Raw category value on transactions ("" for uncategorised).
    let category: String
    // Six months, oldest first; the last is the selected month.
    let spend: [Double]
    let cur: Double
    let prev: Double
    let change: Double
    // nil when the previous month had no spend.
    let ratio: Double?
    let avg: Double
    let tags: [String]
    let flagged: Bool
    var id: String { name }
}

struct InsightGroups: Equatable {
    let up: [CategoryInsight]
    let down: [CategoryInsight]
    let minor: [CategoryInsight]
}

struct InsightSummary: Equatable {
    let totalCur: Double
    let totalPrev: Double
    let totalRatio: Double?
    let upChange: Double
    let downChange: Double
    let biggest: CategoryInsight?
    var totalChange: Double { totalCur - totalPrev }
}

struct InsightDriver: Identifiable, Equatable {
    let name: String
    let prev: Double
    let cur: Double
    let meta: String
    var change: Double { cur - prev }
    var id: String { name }
}

enum SpendingInsights {
    static let thresholdPct = 0.2
    static let thresholdAmt = 50.0
    static let uncategorised = "Uncategorised"
    static let maxDrivers = 8

    static func addMonths(_ m: CalMonth, _ delta: Int) -> CalMonth {
        let index = m.year * 12 + (m.month - 1) + delta
        return CalMonth(year: Int(floor(Double(index) / 12)), month: ((index % 12) + 12) % 12 + 1)
    }

    static func monthKey(_ m: CalMonth) -> String { String(format: "%04d-%02d", m.year, m.month) }

    static func parseMonthKey(_ key: String) -> CalMonth {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        return CalMonth(year: parts.first ?? 1970, month: parts.count > 1 ? parts[1] : 1)
    }

    static func shortLabel(_ m: CalMonth) -> String { "\(DashboardMetrics.monthAbbreviations[m.month - 1]) \(m.year)" }

    static func monthName(_ m: CalMonth) -> String { DashboardMetrics.monthNames[m.month - 1] }

    static func sixMonthWindow(_ selected: CalMonth) -> [CalMonth] {
        (0...5).reversed().map { addMonths(selected, -$0) }
    }

    // Last full month by default, unless history doesn't reach back that far.
    static func defaultMonth(today: CalDate, availableKeys: [String]) -> String {
        let current = CalMonth(year: today.year, month: today.month)
        let lastFull = monthKey(addMonths(current, -1))
        return availableKeys.contains(lastFull) ? lastFull : monthKey(current)
    }

    private static func isSpend(_ t: Transaction) -> Bool {
        if t.ignore == true { return false }
        return t.type == .expense || (t.type == nil && t.amount < 0)
    }

    private static func categoryName(_ t: Transaction) -> String {
        t.category.isEmpty ? uncategorised : t.category
    }

    static func analyse(name: String, category: String, spend: [Double]) -> CategoryInsight {
        let cur = spend[5], prev = spend[4], change = cur - prev
        let ratio: Double? = prev == 0 ? nil : change / prev
        let prior = Array(spend.prefix(5))
        let avg = spend.reduce(0, +) / Double(spend.count)
        var tags: [String] = []
        if prior.allSatisfy({ $0 == 0 }) && cur > 0 {
            tags.append("New this month")
        } else {
            if cur > (prior.max() ?? 0) { tags.append("Highest in 6 months") }
            if cur < (prior.min() ?? 0) { tags.append("Lowest in 6 months") }
            if spend[5] > spend[4] && spend[4] > spend[3] && spend[3] > spend[2] { tags.append("Rising 3 months") }
            if change > 0 && spend[2] > avg * 1.25 && cur > 0 && abs(spend[2] - cur) / cur < 0.15 {
                tags.append("Looks quarterly")
            }
        }
        let flagged = abs(change) >= thresholdAmt && (ratio == nil || abs(ratio!) >= thresholdPct)
        return CategoryInsight(
            name: name, category: category, spend: spend, cur: cur, prev: prev, change: change,
            ratio: ratio, avg: avg, tags: tags, flagged: flagged
        )
    }

    // One insight per category with any spend in the six months ending with `selected`.
    static func computeCategoryInsights(_ transactions: [Transaction], selected: CalMonth) -> [CategoryInsight] {
        let keys = sixMonthWindow(selected).map(monthKey)
        var series: [String: (category: String, spend: [Double])] = [:]
        for t in transactions where isSpend(t) {
            guard let index = keys.firstIndex(of: String(t.date.prefix(7))) else { continue }
            let name = categoryName(t)
            var entry = series[name] ?? (t.category, Array(repeating: 0, count: keys.count))
            entry.spend[index] -= t.amount
            series[name] = entry
        }
        return series
            .map { name, entry in (name, entry.category, entry.spend.map { max(0, $0) }) }
            .filter { $0.2.contains { $0 > 0 } }
            .map { analyse(name: $0.0, category: $0.1, spend: $0.2) }
            .sorted { $0.name < $1.name }
    }

    static func group(_ insights: [CategoryInsight]) -> InsightGroups {
        InsightGroups(
            up: insights.filter { $0.flagged && $0.change > 0 }.sorted { $0.change > $1.change },
            down: insights.filter { $0.flagged && $0.change < 0 }.sorted { $0.change < $1.change },
            minor: insights.filter { !$0.flagged }.sorted { abs($0.change) > abs($1.change) }
        )
    }

    static func summarise(_ insights: [CategoryInsight], _ groups: InsightGroups) -> InsightSummary {
        let totalCur = insights.reduce(0) { $0 + $1.cur }
        let totalPrev = insights.reduce(0) { $0 + $1.prev }
        let biggest = (groups.up + groups.down).max { abs($0.change) < abs($1.change) }
        return InsightSummary(
            totalCur: totalCur,
            totalPrev: totalPrev,
            totalRatio: totalPrev == 0 ? nil : (totalCur - totalPrev) / totalPrev,
            upChange: groups.up.reduce(0) { $0 + $1.change },
            downChange: groups.down.reduce(0) { $0 + $1.change },
            biggest: biggest
        )
    }

    static func money(_ value: Double) -> String {
        "$\(abs(value).formatted(.number.precision(.fractionLength(0))))"
    }

    static func signed(_ value: Double) -> String {
        let rounded = value.rounded()
        return "\(rounded > 0 ? "+" : rounded < 0 ? "−" : "")\(money(rounded))"
    }

    static func pct(_ ratio: Double) -> String {
        let value = Int((abs(ratio) * 100).rounded())
        return "\(value > 0 ? (ratio > 0 ? "+" : "−") : "")\(value)%"
    }

    static func headline(_ a: CategoryInsight, selected: CalMonth) -> String {
        if a.tags.contains("New this month") {
            return "\(money(a.cur)) spent, nothing in the last 5 months"
        }
        let prevName = monthName(addMonths(selected, -1))
        if a.change.rounded() == 0 {
            return "no change on \(prevName) (\(money(a.cur)))"
        }
        return "\(a.change > 0 ? "up" : "down") \(money(a.change)) on \(prevName) (\(money(a.prev)) → \(money(a.cur)))"
    }

    // Groups a description by merchant: its first word with digits/punctuation stripped.
    static func merchantKey(_ description: String) -> String {
        for word in description.split(whereSeparator: \.isWhitespace) {
            let letters = word.filter(\.isLetter)
            if !letters.isEmpty { return letters.uppercased() }
        }
        let trimmed = description.trimmingCharacters(in: .whitespaces).uppercased()
        return trimmed.isEmpty ? "UNKNOWN" : trimmed
    }

    // The merchants behind a category's change between the previous and selected month.
    static func computeDrivers(
        _ transactions: [Transaction], insight: CategoryInsight, selected: CalMonth
    ) -> [InsightDriver] {
        let previous = addMonths(selected, -1)
        let curKey = monthKey(selected), prevKey = monthKey(previous)
        var merchants: [String: (prev: Double, cur: Double, prevCount: Int, curCount: Int, descriptions: Set<String>)] = [:]

        for t in transactions where isSpend(t) && categoryName(t) == insight.name {
            let key = String(t.date.prefix(7))
            guard key == curKey || key == prevKey else { continue }
            let merchant = merchantKey(t.description)
            var e = merchants[merchant] ?? (0, 0, 0, 0, [])
            if key == curKey {
                e.cur -= t.amount
                if t.amount < 0 { e.curCount += 1 }
            } else {
                e.prev -= t.amount
                if t.amount < 0 { e.prevCount += 1 }
            }
            e.descriptions.insert(t.description)
            merchants[merchant] = e
        }

        var drivers: [InsightDriver] = []
        for (name, e) in merchants {
            let prev = max(0, e.prev)
            let cur = max(0, e.cur)
            guard prev > 0 || cur > 0 else { continue }
            drivers.append(InsightDriver(
                name: name, prev: prev, cur: cur,
                meta: driverMeta(prev: prev, cur: cur, prevCount: e.prevCount, curCount: e.curCount,
                                 descriptionCount: e.descriptions.count, previous: previous, selected: selected)
            ))
        }
        drivers.sort { a, b in
            let ca = abs(a.change), cb = abs(b.change)
            return ca != cb ? ca > cb : a.name < b.name
        }
        return Array(drivers.prefix(maxDrivers))
    }

    private static func driverMeta(
        prev: Double, cur: Double, prevCount: Int, curCount: Int,
        descriptionCount: Int, previous: CalMonth, selected: CalMonth
    ) -> String {
        if prev == 0 && cur > 0 { return "Not seen in \(monthName(previous))" }
        if cur == 0 && prev > 0 { return "Not seen in \(monthName(selected))" }
        if curCount != prevCount { return "\(curCount) visit\(curCount == 1 ? "" : "s"), was \(prevCount)" }
        if descriptionCount > 1 { return "Grouped: \(descriptionCount) descriptions" }
        return ""
    }
}
