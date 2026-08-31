import SwiftUI

// Ported from FrontEnd/src/components/IncomeVsExpensesChart.vue + the mockup's buildBars().
// Grouped bars in a 337x160 space (mockup geometry), scaled to the available width. niceMax /
// 4-step gridlines match the Vue component.
struct IncomeVsExpensesChart: View {
    let data: [MonthlyFlow]

    @State private var tip: String?

    private static let w: CGFloat = 337
    private static let h: CGFloat = 160
    private static let padL: CGFloat = 28
    private static let padR: CGFloat = 6
    private static let padT: CGFloat = 8
    private static let padB: CGFloat = 22
    private static let barW: CGFloat = 12
    private static let barGap: CGFloat = 2.5

    private var plotW: CGFloat { Self.w - Self.padL - Self.padR }
    private var plotH: CGFloat { Self.h - Self.padT - Self.padB }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            legend
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
                Text("No income or expenses in the last 6 months.")
                    .font(.system(size: 13))
                    .foregroundColor(DashboardTheme.ink2)
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
        }
    }

    private var legend: some View {
        HStack(spacing: 14) {
            swatchLabel(color: DashboardTheme.incomeColor, text: "Income")
            swatchLabel(color: DashboardTheme.expenseColor, text: "Expenses")
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
                gridlines
                bars
            }
            .frame(width: Self.w, height: Self.h)
            .scaleEffect(scale, anchor: .topLeading)
            .frame(width: geo.size.width, height: Self.h * scale, alignment: .topLeading)
        }
        .frame(height: Self.h)
        .frame(maxWidth: .infinity)
    }

    private var gridlines: some View {
        ForEach(gridValues, id: \.self) { value in
            let y = Self.padT + plotH - CGFloat(value / maxVal) * plotH
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(DashboardTheme.border)
                    .frame(height: 1)
                    .offset(y: y)
                Text(value == 0 ? "0" : "\(Int(value / 1000))k")
                    .font(.system(size: 9))
                    .foregroundColor(DashboardTheme.ink3)
                    .offset(x: -2, y: y - 6)
            }
        }
    }

    @ViewBuilder
    private var bars: some View {
        ForEach(barRects) { rect in
            RoundedRectangle(cornerRadius: 4)
                .fill(rect.color)
                .frame(width: Self.barW, height: rect.height)
                .position(x: rect.centerX, y: rect.centerY)
                .onTapGesture { tip = rect.tip }
        }
        ForEach(monthLabels) { label in
            Text(label.text)
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundColor(DashboardTheme.ink2)
                .position(x: label.x, y: Self.h - 6)
        }
    }

    private struct BarRect: Identifiable {
        let id: String
        let centerX: CGFloat
        let centerY: CGFloat
        let height: CGFloat
        let color: Color
        let tip: String
    }

    private struct MonthLabel: Identifiable {
        let id: String
        let text: String
        let x: CGFloat
    }

    private var barRects: [BarRect] {
        let groupW = plotW / CGFloat(max(data.count, 1))
        let yBase = Self.padT + plotH
        var rects: [BarRect] = []

        for (index, flow) in data.enumerated() {
            let gx = Self.padL + CGFloat(index) * groupW + groupW / 2
            let entries: [(String, String, Double, Color, Bool)] = [
                ("income", "income", flow.income, DashboardTheme.incomeColor, true),
                ("expense", "expenses", flow.expense, DashboardTheme.expenseColor, false),
            ]
            for (key, label, value, color, isIncome) in entries {
                let leftX = isIncome ? gx - Self.barGap / 2 - Self.barW : gx + Self.barGap / 2
                let height = max(CGFloat(value / maxVal) * plotH, 0)
                let amount = value.formatted(.number.precision(.fractionLength(0)))
                rects.append(
                    BarRect(
                        id: "\(flow.id)-\(key)",
                        centerX: leftX + Self.barW / 2,
                        centerY: yBase - height / 2,
                        height: height,
                        color: color,
                        tip: "\(flow.month) \(label)  $\(amount)"
                    )
                )
            }
        }
        return rects
    }

    private var monthLabels: [MonthLabel] {
        let groupW = plotW / CGFloat(max(data.count, 1))
        return data.enumerated().map { index, flow in
            MonthLabel(
                id: flow.id,
                text: flow.month,
                x: Self.padL + CGFloat(index) * groupW + groupW / 2
            )
        }
    }

    private var hasData: Bool {
        data.contains { $0.income != 0 || $0.expense != 0 }
    }

    // Rounds the axis max up to a "nice" 1/2/5 x 10^n value (IncomeVsExpensesChart.vue's niceMax).
    private var maxVal: Double {
        let peak = data.flatMap { [$0.income, $0.expense] }.max() ?? 0
        guard peak > 0 else { return 1000 }
        let magnitude = pow(10, floor(log10(peak)))
        let normalized = peak / magnitude
        let nice = normalized <= 1 ? 1.0 : normalized <= 2 ? 2.0 : normalized <= 5 ? 5.0 : 10.0
        return nice * magnitude
    }

    private var gridValues: [Double] {
        (0...4).map { maxVal / 4 * Double($0) }
    }
}
