import SwiftUI

// Port of FrontEnd's BudgetProjectionChart.vue (UBE-124): a horizontal bar per budgeted category -
// solid = spent so far, light = projected rest of month, vertical marker = budget. Red when over.
struct BudgetProjectionChart: View {
    let projection: BudgetProjection
    let categoryColor: (String) -> String?

    private var scale: Double {
        max(1, projection.rows.flatMap { [$0.budget, $0.projected] }.max() ?? 1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            legend
            ForEach(projection.rows) { row in
                rowView(row)
            }
        }
    }

    private var legend: some View {
        HStack(spacing: 14) {
            legendItem(Rectangle().fill(DashboardTheme.ink2).frame(width: 9, height: 9).clipShape(RoundedRectangle(cornerRadius: 3)), "Spent")
            if projection.isProjected {
                legendItem(Rectangle().fill(DashboardTheme.ink2.opacity(0.3)).frame(width: 9, height: 9).clipShape(RoundedRectangle(cornerRadius: 3)), "Projected")
            }
            legendItem(Rectangle().fill(DashboardTheme.ink).frame(width: 2, height: 11), "Budget")
        }
    }

    private func legendItem<S: View>(_ swatch: S, _ text: String) -> some View {
        HStack(spacing: 6) {
            swatch
            Text(text).font(.system(size: 12, weight: .semibold)).foregroundColor(DashboardTheme.ink2)
        }
    }

    private func rowView(_ row: BudgetProjectionRow) -> some View {
        let color = row.overBudget ? DashboardTheme.crit : Color(hex: categoryColor(row.category) ?? DashboardTheme.fallbackCategoryColor)
        let shown = projection.isProjected ? row.projected : row.actual
        return VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(row.category)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink)
                Spacer()
                (Text(currency(shown)).foregroundColor(row.overBudget ? DashboardTheme.crit : DashboardTheme.ink)
                    + Text(" of \(currency(row.budget))").foregroundColor(DashboardTheme.ink3))
                    .font(.system(size: 12, weight: row.overBudget ? .semibold : .regular, design: .rounded))
            }
            GeometryReader { geo in
                let width = geo.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(DashboardTheme.surface2)
                    if projection.isProjected {
                        Capsule().fill(color.opacity(0.3)).frame(width: fraction(row.projected) * width)
                    }
                    Capsule().fill(color).frame(width: fraction(row.actual) * width)
                    Rectangle()
                        .fill(DashboardTheme.ink)
                        .frame(width: 2, height: 14)
                        .offset(x: fraction(row.budget) * width - 1)
                }
            }
            .frame(height: 8)
        }
        .accessibilityElement(children: .combine)
    }

    private func fraction(_ value: Double) -> CGFloat {
        CGFloat(min(1, max(0, value / scale)))
    }

    private func currency(_ amount: Double) -> String {
        "$\(amount.formatted(.number.precision(.fractionLength(0))))"
    }
}
