import SwiftUI

// Category detail for the Insights tab, shown as a sheet (port of FrontEnd's InsightDetail.vue,
// UBE-118): headline, month facts, a 6-month bar chart with the average line, and "What changed".
// No "View transactions" link - the iOS Transactions tab has no month/category deep link yet.
struct InsightDetailSheet: View {
    let insight: CategoryInsight
    let drivers: [InsightDriver]
    let selected: CalMonth
    let colour: String

    private var previous: CalMonth { SpendingInsights.addMonths(selected, -1) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                head
                facts
                chart
                if !drivers.isEmpty { driversTable }
            }
            .padding(22)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var head: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Circle().fill(Color(hex: colour)).frame(width: 10, height: 10)
                    Text(insight.name)
                        .font(.system(size: 20, weight: .heavy, design: .rounded))
                        .foregroundColor(DashboardTheme.ink)
                }
                Text(SpendingInsights.headline(insight, selected: selected))
                    .font(.system(size: 13.5))
                    .foregroundColor(DashboardTheme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            insightPill(insight.ratio.map(SpendingInsights.pct) ?? "new", change: insight.change)
        }
    }

    private var facts: some View {
        HStack(spacing: 8) {
            fact(SpendingInsights.monthName(selected), SpendingInsights.money(insight.cur))
            fact(SpendingInsights.monthName(previous), SpendingInsights.money(insight.prev))
            fact("vs 6-mo avg", SpendingInsights.signed(insight.cur - insight.avg))
        }
    }

    private func fact(_ kicker: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(kicker.uppercased())
                .font(.system(size: 9.5, weight: .bold))
                .foregroundColor(DashboardTheme.ink3)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(value)
                .font(.system(size: 15, weight: .semibold, design: .monospaced))
                .foregroundColor(DashboardTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(DashboardTheme.surface2)
        .clipShape(RoundedRectangle(cornerRadius: 9))
    }

    // MARK: - Bar chart

    private var chart: some View {
        VStack(alignment: .leading, spacing: 8) {
            InsightBarChart(spend: insight.spend, average: insight.avg, months: SpendingInsights.sixMonthWindow(selected))
                .frame(height: 170)
                .accessibilityLabel("\(insight.name) spending, \(SpendingInsights.monthName(SpendingInsights.sixMonthWindow(selected)[0])) to \(SpendingInsights.monthName(selected)) \(selected.year)")
            HStack(spacing: 14) {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2).fill(DashboardTheme.accent).frame(width: 14, height: 8)
                    Text("Selected month")
                }
                HStack(spacing: 6) {
                    Path { p in p.move(to: .zero); p.addLine(to: CGPoint(x: 14, y: 0)) }
                        .stroke(DashboardTheme.ink2, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                        .frame(width: 14, height: 1)
                    Text("6-month average \(SpendingInsights.money(insight.avg))")
                }
            }
            .font(.system(size: 11.5))
            .foregroundColor(DashboardTheme.ink2)
        }
    }

    // MARK: - What changed

    private var driversTable: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("What changed")
                .font(.system(size: 13.5, weight: .bold))
                .foregroundColor(DashboardTheme.ink)
                .padding(.bottom, 6)
            HStack {
                Text("DESCRIPTION")
                Spacer()
                Text(DashboardMetrics.monthAbbreviations[previous.month - 1].uppercased()).frame(width: 52, alignment: .trailing)
                Text(DashboardMetrics.monthAbbreviations[selected.month - 1].uppercased()).frame(width: 52, alignment: .trailing)
                Text("CHANGE").frame(width: 64, alignment: .trailing)
            }
            .font(.system(size: 9.5, weight: .bold))
            .foregroundColor(DashboardTheme.ink3)
            .padding(.vertical, 6)
            ForEach(drivers) { driver in
                Divider().overlay(DashboardTheme.border)
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(driver.name)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundColor(DashboardTheme.ink)
                            .lineLimit(1)
                        if !driver.meta.isEmpty {
                            Text(driver.meta)
                                .font(.system(size: 11))
                                .foregroundColor(DashboardTheme.ink2)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                    Text(SpendingInsights.money(driver.prev)).frame(width: 52, alignment: .trailing)
                    Text(SpendingInsights.money(driver.cur)).frame(width: 52, alignment: .trailing)
                    insightPill(driver.change.rounded() == 0 ? "—" : SpendingInsights.signed(driver.change),
                                change: driver.change.rounded())
                        .frame(width: 64, alignment: .trailing)
                }
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(DashboardTheme.ink)
                .padding(.vertical, 7)
            }
        }
    }
}

// Six bars (selected month in the accent colour, previous month dimmed) plus a dashed average line.
struct InsightBarChart: View {
    let spend: [Double]
    let average: Double
    let months: [CalMonth]

    private let leftPad: CGFloat = 40
    private let bottomPad: CGFloat = 20
    private let topPad: CGFloat = 16

    var body: some View {
        GeometryReader { geo in
            let plotW = geo.size.width - leftPad
            let plotH = geo.size.height - bottomPad - topPad
            let top = axisTop
            let y = { (value: Double) -> CGFloat in topPad + plotH * CGFloat(1 - value / top) }
            let slot = plotW / CGFloat(max(spend.count, 1))
            let barW = min(34, slot * 0.58)

            ZStack(alignment: .topLeading) {
                ForEach(gridValues(top), id: \.self) { value in
                    Path { p in
                        p.move(to: CGPoint(x: leftPad, y: y(value)))
                        p.addLine(to: CGPoint(x: geo.size.width, y: y(value)))
                    }
                    .stroke(DashboardTheme.border, lineWidth: 1)
                    Text(SpendingInsights.money(value))
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(DashboardTheme.ink3)
                        .frame(width: leftPad - 6, alignment: .trailing)
                        .position(x: (leftPad - 6) / 2, y: y(value))
                }
                ForEach(Array(spend.enumerated()), id: \.offset) { index, value in
                    let isCur = index == spend.count - 1
                    let isPrev = index == spend.count - 2
                    let x = leftPad + slot * CGFloat(index) + slot / 2
                    let height = max(0, y(0) - y(value))
                    RoundedRectangle(cornerRadius: 3)
                        .fill(isCur ? DashboardTheme.accent : isPrev ? DashboardTheme.ink2.opacity(0.55) : DashboardTheme.border)
                        .frame(width: barW, height: height)
                        .position(x: x, y: y(0) - height / 2)
                    if isCur || isPrev {
                        Text(SpendingInsights.money(value))
                            .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                            .foregroundColor(DashboardTheme.ink)
                            .position(x: x, y: y(value) - 8)
                    }
                    Text(DashboardMetrics.monthAbbreviations[months[index].month - 1])
                        .font(.system(size: 10, weight: isCur ? .bold : .regular))
                        .foregroundColor(isCur ? DashboardTheme.ink : DashboardTheme.ink2)
                        .position(x: x, y: geo.size.height - 7)
                }
                Path { p in
                    p.move(to: CGPoint(x: leftPad, y: y(average)))
                    p.addLine(to: CGPoint(x: geo.size.width, y: y(average)))
                }
                .stroke(DashboardTheme.ink2, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
        }
    }

    // Same step rule as the web chart, so gridlines land on tidy amounts.
    private var step: Double {
        let peak = max(spend.max() ?? 0, average)
        return peak > 4000 ? 1000 : peak > 800 ? 250 : peak > 400 ? 100 : 50
    }

    private var axisTop: Double {
        let peak = max(spend.max() ?? 0, average)
        return max(step, ceil(peak / step) * step)
    }

    private func gridValues(_ top: Double) -> [Double] {
        stride(from: 0, through: top, by: step).map { $0 }
    }
}
