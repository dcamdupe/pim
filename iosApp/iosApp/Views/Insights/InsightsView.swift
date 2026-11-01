import SwiftUI

// The Insights tab (port of FrontEnd's InsightsView.vue / docs/design/spending-trends-mockup.html,
// UBE-118): month stepper, summary, "Spending more" / "Spending less" cards and smaller changes.
// Tapping a category opens its detail as a sheet (the web's side panel doesn't fit a phone).
struct InsightsView: View {
    var onSignOut: (() -> Void)?

    @StateObject private var viewModel: InsightsViewModel

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore, onSignOut: (() -> Void)? = nil) {
        self.onSignOut = onSignOut
        _viewModel = StateObject(wrappedValue: InsightsViewModel(
            transactionsStore: transactionsStore, settingsStore: settingsStore
        ))
    }

    var body: some View {
        VStack(spacing: 0) {
            navBar
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    content
                }
                .padding(.bottom, 32)
            }
        }
        .background(DashboardTheme.bg.ignoresSafeArea())
        .task { await viewModel.load() }
        .sheet(item: Binding(
            get: { viewModel.detailInsight },
            set: { viewModel.detailCategory = $0?.name }
        )) { insight in
            InsightDetailSheet(
                insight: insight,
                drivers: viewModel.drivers(for: insight),
                selected: viewModel.selected,
                colour: viewModel.colour(for: insight)
            )
        }
    }

    // MARK: - Chrome

    private var navBar: some View {
        HStack {
            HStack(spacing: 7) {
                Text("P")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .frame(width: 20, height: 20)
                    .background(DashboardTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                Text("Pim")
                    .font(.system(size: 13.5, weight: .heavy, design: .rounded))
                    .foregroundColor(DashboardTheme.ink2)
            }
            Spacer()
            Menu {
                Button("Sign out", role: .destructive) { onSignOut?() }
            } label: {
                Text("DC")
                    .font(.system(size: 12.5, weight: .bold, design: .rounded))
                    .foregroundColor(DashboardTheme.accentDark)
                    .frame(width: 32, height: 32)
                    .background(DashboardTheme.accentWash)
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Spending trends")
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundColor(DashboardTheme.ink)
                Text("Categories where your spending changed noticeably from one month to the next.")
                    .font(.system(size: 13.5))
                    .foregroundColor(DashboardTheme.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack(spacing: 8) {
                stepper
                Text("Flag over **\(Int(SpendingInsights.thresholdPct * 100))%** and **\(SpendingInsights.money(SpendingInsights.thresholdAmt))**")
                    .font(.system(size: 11.5))
                    .foregroundColor(DashboardTheme.ink2)
                    .padding(EdgeInsets(top: 6, leading: 10, bottom: 6, trailing: 10))
                    .overlay(Capsule().stroke(DashboardTheme.border, lineWidth: 1))
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 12)
    }

    private var stepper: some View {
        HStack(spacing: 0) {
            Button { viewModel.step(-1) } label: {
                Image(systemName: "chevron.left").frame(width: 30, height: 30)
            }
            .disabled(!viewModel.canGoBack)
            .accessibilityLabel("Previous month")
            Text(viewModel.monthLabel)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundColor(DashboardTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Button { viewModel.step(1) } label: {
                Image(systemName: "chevron.right").frame(width: 30, height: 30)
            }
            .disabled(!viewModel.canGoForward)
            .accessibilityLabel("Next month")
        }
        .font(.system(size: 12, weight: .bold))
        .foregroundColor(DashboardTheme.ink2)
        .background(DashboardTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(DashboardTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 9))
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
        case .failed:
            statusView("Could not load your transactions. Please try again later.", actionTitle: "Retry") {
                Task { await viewModel.load() }
            }
        case .sessionExpired:
            statusView("Your session has expired. Please sign in again.", actionTitle: "Back to sign in") {
                onSignOut?()
            }
        case .loaded:
            loadedContent
        }
    }

    @ViewBuilder
    private var loadedContent: some View {
        let insights = viewModel.insights
        if insights.isEmpty {
            Text("No spending in the six months to \(SpendingInsights.shortLabel(viewModel.selected)).")
                .font(.system(size: 13.5))
                .foregroundColor(DashboardTheme.ink2)
                .padding(.horizontal, 20)
        } else {
            let groups = viewModel.groups
            let summary = viewModel.summary
            VStack(alignment: .leading, spacing: 18) {
                summaryGrid(summary, groups: groups)
                if groups.up.isEmpty && groups.down.isEmpty {
                    Text("No big changes this month.")
                        .font(.system(size: 13.5))
                        .foregroundColor(DashboardTheme.ink2)
                }
                if !groups.up.isEmpty {
                    insightGroup("Spending more", total: summary.upChange, insights: groups.up)
                }
                if !groups.down.isEmpty {
                    insightGroup("Spending less", total: summary.downChange, insights: groups.down)
                }
                if !groups.minor.isEmpty {
                    minorChanges(groups.minor)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func summaryGrid(_ summary: InsightSummary, groups: InsightGroups) -> some View {
        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        let prevName = String(SpendingInsights.monthName(viewModel.previous).prefix(3))
        return LazyVGrid(columns: columns, spacing: 10) {
            stat("Total spending", value: SpendingInsights.money(summary.totalCur)) {
                HStack(spacing: 4) {
                    if let ratio = summary.totalRatio { insightPill(SpendingInsights.pct(ratio), change: summary.totalChange) }
                    Text("\(SpendingInsights.signed(summary.totalChange)) on \(prevName)")
                }
            }
            stat("Spending more", value: categoriesLabel(groups.up.count)) {
                Text("\(SpendingInsights.signed(summary.upChange)) combined")
            }
            stat("Spending less", value: categoriesLabel(groups.down.count)) {
                Text("\(SpendingInsights.signed(summary.downChange)) combined")
            }
            if let biggest = summary.biggest {
                stat("Biggest change", value: biggest.name) {
                    Text(SpendingInsights.signed(biggest.change)
                        + (biggest.ratio.map { ", \(SpendingInsights.pct($0))" } ?? ", new this month"))
                }
            } else {
                stat("Biggest change", value: "—") { Text("No big changes") }
            }
        }
    }

    private func stat<Sub: View>(_ kicker: String, value: String, @ViewBuilder sub: () -> Sub) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(kicker.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(DashboardTheme.ink3)
            Text(value)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundColor(DashboardTheme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            sub()
                .font(.system(size: 11.5))
                .foregroundColor(DashboardTheme.ink2)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(DashboardTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: DashboardTheme.tileRadius).stroke(DashboardTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: DashboardTheme.tileRadius))
    }

    private func insightGroup(_ title: String, total: Double, insights: [CategoryInsight]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(DashboardTheme.ink2)
                Spacer()
                Text(SpendingInsights.signed(total))
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(DashboardTheme.ink2)
            }
            ForEach(insights) { insight in
                insightCard(insight)
            }
        }
    }

    private func insightCard(_ insight: CategoryInsight) -> some View {
        let colour = Color(hex: viewModel.colour(for: insight))
        return Button { viewModel.detailCategory = insight.name } label: {
            HStack(alignment: .center, spacing: 12) {
                RoundedRectangle(cornerRadius: 2).fill(colour).frame(width: 4).padding(.vertical, -2)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(insight.name)
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundColor(DashboardTheme.ink)
                        insightPill(insight.ratio.map(SpendingInsights.pct) ?? "new", change: insight.change)
                    }
                    if !insight.tags.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(insight.tags, id: \.self) { tag in insightTagPill(tag) }
                        }
                    }
                    Text(SpendingInsights.headline(insight, selected: viewModel.selected))
                        .font(.system(size: 12.5))
                        .foregroundColor(DashboardTheme.ink2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 4) {
                    InsightSparkline(values: insight.spend, colour: colour)
                        .frame(width: 70, height: 22)
                    Text(SpendingInsights.signed(insight.change))
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(DashboardTheme.ink2)
                }
            }
            .padding(EdgeInsets(top: 11, leading: 0, bottom: 11, trailing: 12))
            .background(DashboardTheme.surface)
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(DashboardTheme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(insight.name), \(SpendingInsights.headline(insight, selected: viewModel.selected))")
    }

    private func minorChanges(_ insights: [CategoryInsight]) -> some View {
        DisclosureGroup {
            VStack(spacing: 0) {
                ForEach(insights) { insight in
                    Divider().overlay(DashboardTheme.border)
                    Button { viewModel.detailCategory = insight.name } label: {
                        HStack(spacing: 8) {
                            Circle().fill(Color(hex: viewModel.colour(for: insight))).frame(width: 8, height: 8)
                            Text(insight.name)
                                .font(.system(size: 13))
                                .foregroundColor(DashboardTheme.ink)
                            Spacer()
                            Text("\(SpendingInsights.money(insight.prev)) → \(SpendingInsights.money(insight.cur))")
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundColor(DashboardTheme.ink2)
                            insightPill(insight.change.rounded() == 0 ? "no change" : SpendingInsights.signed(insight.change),
                                 change: insight.change.rounded())
                        }
                        .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
            }
        } label: {
            Text("Smaller changes · \(categoriesLabel(insights.count))")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(DashboardTheme.ink2)
        }
        .tint(DashboardTheme.ink2)
        .padding(EdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14))
        .background(DashboardTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(DashboardTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func categoriesLabel(_ count: Int) -> String {
        "\(count) \(count == 1 ? "category" : "categories")"
    }

    private func statusView(_ message: String, actionTitle: String, action: @escaping () -> Void) -> some View {
        VStack(spacing: 12) {
            Text(message)
                .font(.system(size: 13.5))
                .foregroundColor(DashboardTheme.ink2)
                .multilineTextAlignment(.center)
            Button(actionTitle, action: action)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundColor(DashboardTheme.accentDark)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 30)
        .padding(.top, 50)
    }
}

// Red for spending more, green for less, grey for no change - matching the web pills.
func insightPill(_ text: String, change: Double) -> some View {
    let colour = change > 0 ? DashboardTheme.crit : change < 0 ? DashboardTheme.good : DashboardTheme.ink2
    return Text(text)
        .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
        .foregroundColor(colour)
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(colour.opacity(0.12))
        .clipShape(Capsule())
}

func insightTagPill(_ text: String) -> some View {
    Text(text)
        .font(.system(size: 10.5, weight: .semibold))
        .foregroundColor(DashboardTheme.accentDark)
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(DashboardTheme.accentWash)
        .clipShape(Capsule())
        .lineLimit(1)
}

// Small area sparkline with an end dot (web SpendSparkline.vue).
struct InsightSparkline: View {
    let values: [Double]
    let colour: Color

    var body: some View {
        GeometryReader { geo in
            let points = points(in: geo.size)
            ZStack {
                Path { path in
                    guard let first = points.first, let last = points.last else { return }
                    path.move(to: CGPoint(x: first.x, y: geo.size.height))
                    points.forEach { path.addLine(to: $0) }
                    path.addLine(to: CGPoint(x: last.x, y: geo.size.height))
                    path.closeSubpath()
                }
                .fill(colour.opacity(0.12))
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    points.dropFirst().forEach { path.addLine(to: $0) }
                }
                .stroke(colour, style: StrokeStyle(lineWidth: 1.6, lineJoin: .round))
                if let last = points.last {
                    Circle().fill(colour).frame(width: 5, height: 5).position(last)
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func points(in size: CGSize) -> [CGPoint] {
        let maxValue = max(values.max() ?? 0, 1)
        let step = values.count > 1 ? (size.width - 4) / CGFloat(values.count - 1) : 0
        return values.enumerated().map { index, value in
            CGPoint(x: 2 + CGFloat(index) * step, y: size.height - 2 - CGFloat(value / maxValue) * (size.height - 4))
        }
    }
}

#Preview {
    InsightsView(
        transactionsStore: TransactionsStore(idToken: "preview"),
        settingsStore: SettingsStore(idToken: "preview")
    )
}
