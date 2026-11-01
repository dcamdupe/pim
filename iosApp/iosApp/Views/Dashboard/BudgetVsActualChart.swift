import SwiftUI

// Port of FrontEnd's BudgetVsActualChart.vue (UBE-124): budget vs actual grouped bars per month,
// same geometry as IncomeVsExpensesChart.swift.
struct BudgetVsActualChart: View {
    let data: [MonthlyBudgetVsActual]

    @State private var tip: String?

    private static let w: CGFloat = 337
    private static let h: CGFloat = 160
    private static let padL: CGFloat = 32
    private static let padR: CGFloat = 6
    private static let padT: CGFloat = 8
    private static let padB: CGFloat = 22
    private static let barW: CGFloat = 12
    private static let barGap: CGFloat = 2.5

    private var plotW: CGFloat { Self.w - Self.padL - Self.padR }
    private var plotH: CGFloat { Self.h - Self.padT - Self.padB }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                swatchLabel(color: DashboardTheme.ink3, text: "Budget")
                swatchLabel(color: DashboardTheme.incomeColor, text: "Actual")
            }
            if hasData {
                chart
                Text(tip ?? "Tap a bar for the exact amount")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .padding(.horizontal, 10)
                    .background(DashboardTheme.surface2)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                Text("No budgeted spending in these 6 months.")
                    .font(.system(size: 13))
                    .foregroundColor(DashboardTheme.ink2)
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
        }
    }

    private func swatchLabel(color: Color, text: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 3).fill(color).frame(width: 9, height: 9)
            Text(text).font(.system(size: 12, weight: .semibold)).foregroundColor(DashboardTheme.ink2)
        }
    }

    private var chart: some View {
        GeometryReader { geo in
            let scale = geo.size.width / Self.w
            ZStack(alignment: .topLeading) {
                ForEach(gridValues, id: \.self) { value in
                    let y = Self.padT + plotH - CGFloat(value / maxVal) * plotH
                    ZStack(alignment: .leading) {
                        Rectangle().fill(DashboardTheme.border).frame(height: 1).offset(y: y)
                        Text(axisLabel(value))
                            .font(.system(size: 9))
                            .foregroundColor(DashboardTheme.ink3)
                            .offset(x: -2, y: y - 6)
                    }
                }
                ForEach(Array(data.enumerated()), id: \.element.id) { index, month in
                    let gx = Self.padL + CGFloat(index) * groupW + groupW / 2
                    bar(month.budget, centerX: gx - Self.barGap / 2 - Self.barW / 2, color: DashboardTheme.ink3,
                        tip: "\(month.month) budget  \(currency(month.budget))")
                    bar(month.actual, centerX: gx + Self.barGap / 2 + Self.barW / 2,
                        color: DashboardTheme.incomeColor,
                        tip: "\(month.month) actual  \(currency(month.actual))")
                    Text(month.month)
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundColor(DashboardTheme.ink2)
                        .position(x: gx, y: Self.h - 6)
                }
            }
            .frame(width: Self.w, height: Self.h)
            .scaleEffect(scale, anchor: .topLeading)
            .frame(width: geo.size.width, height: Self.h * scale, alignment: .topLeading)
        }
        .frame(height: Self.h)
        .frame(maxWidth: .infinity)
    }

    private func bar(_ value: Double, centerX: CGFloat, color: Color, tip: String) -> some View {
        let height = max(CGFloat(value / maxVal) * plotH, 0)
        return RoundedRectangle(cornerRadius: 4)
            .fill(color)
            .frame(width: Self.barW, height: height)
            .position(x: centerX, y: Self.padT + plotH - height / 2)
            .onTapGesture { self.tip = tip }
    }

    private var groupW: CGFloat { plotW / CGFloat(max(data.count, 1)) }

    private var hasData: Bool { data.contains { $0.budget != 0 || $0.actual != 0 } }

    // Rounds the axis max up to a "nice" 1/2/5 x 10^n value.
    private var maxVal: Double {
        let peak = data.flatMap { [$0.budget, $0.actual] }.max() ?? 0
        guard peak > 0 else { return 1000 }
        let magnitude = pow(10, floor(log10(peak)))
        let normalized = peak / magnitude
        let nice = normalized <= 1 ? 1.0 : normalized <= 2 ? 2.0 : normalized <= 5 ? 5.0 : 10.0
        return nice * magnitude
    }

    private var gridValues: [Double] { (0...4).map { maxVal / 4 * Double($0) } }

    // Budgets are often under $1k, so only switch to "k" once the axis reaches it.
    private func axisLabel(_ value: Double) -> String {
        if value == 0 { return "0" }
        if maxVal >= 1000 { return "\((value / 1000).formatted(.number.precision(.fractionLength(0...1))))k" }
        return value.formatted(.number.precision(.fractionLength(0)))
    }

    private func currency(_ amount: Double) -> String {
        "$\(amount.formatted(.number.precision(.fractionLength(0))))"
    }
}
