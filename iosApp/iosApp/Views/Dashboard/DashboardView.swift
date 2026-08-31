import SwiftUI

// The dashboard screen (UBE-102), matching docs/design/dashboard-mockup-ios.html. Reads the shared
// TransactionsStore / SettingsStore (UBE-103); every metric is computed locally
// (DashboardViewModel), so the month picker recomputes without a refetch.
struct DashboardView: View {
    var onSignOut: (() -> Void)?

    @StateObject private var viewModel: DashboardViewModel

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore, onSignOut: (() -> Void)? = nil) {
        self.onSignOut = onSignOut
        _viewModel = StateObject(wrappedValue: DashboardViewModel(
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
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Dashboard")
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                Text("Your financial overview.")
                    .font(.system(size: 13.5))
                    .foregroundColor(DashboardTheme.ink2)
            }
            Spacer()
            monthPicker
        }
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private var monthPicker: some View {
        let months = viewModel.availableMonths
        Menu {
            ForEach(months) { month in
                Button(month.label) { viewModel.selectedMonthKey = month.value }
            }
        } label: {
            HStack(spacing: 4) {
                Text(currentMonthLabel(months))
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
            }
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundColor(DashboardTheme.ink2)
            .padding(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 10))
            .background(DashboardTheme.surface2)
            .overlay(Capsule().stroke(DashboardTheme.border, lineWidth: 1))
            .clipShape(Capsule())
        }
        .disabled(months.count <= 1)
    }

    private func currentMonthLabel(_ months: [MonthOption]) -> String {
        months.first { $0.value == viewModel.selectedMonthKey }?.label ?? viewModel.selectedMonthLabel
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(.top, 60)
        case .failed:
            statusView(
                message: "Could not load your dashboard. Please try again later.",
                actionTitle: "Retry",
                action: { Task { await viewModel.load() } }
            )
        case .sessionExpired:
            statusView(
                message: "Your session has expired. Please sign in again.",
                actionTitle: "Back to sign in",
                action: { onSignOut?() }
            )
        case .loaded:
            loadedContent
        }
    }

    private func statusView(message: String, actionTitle: String, action: @escaping () -> Void) -> some View {
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

    private var loadedContent: some View {
        VStack(spacing: 14) {
            kpiGrid
            card {
                cardHeader("Spending by category",
                           sub: "\(viewModel.selectedMonthLabel) · \(formatCurrency(viewModel.tiles.currentMonthExpenses)) total")
                SpendingByCategoryChart(
                    expenses: viewModel.expensesByCategory,
                    centerValue: formatCurrency(viewModel.tiles.currentMonthExpenses),
                    centerLabel: viewModel.selectedMonthLabel
                )
            }
            card {
                cardHeader("Income vs. expenses", sub: viewModel.sixMonthRangeLabel)
                IncomeVsExpensesChart(data: viewModel.monthlyIncomeExpenses)
            }
            card {
                Text("Recent transactions")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 4)
                RecentTransactionsList(
                    transactions: viewModel.recentTransactions,
                    categoryColor: viewModel.categoryColor
                )
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
    }

    private var kpiGrid: some View {
        let tiles = viewModel.tiles
        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: columns, spacing: 10) {
            DashboardTile(kicker: "Profit", label: viewModel.selectedMonthLabel,
                          value: formatCurrency(tiles.currentMonthProfit),
                          showDelta: true, deltaPct: tiles.currentMonthProfitDeltaPct)
            DashboardTile(kicker: "Profit", label: "Average · \(viewModel.sixMonthRangeLabel)",
                          value: formatCurrency(tiles.previousSixMonthsProfitAverage))
            DashboardTile(kicker: "Expenses", label: viewModel.selectedMonthLabel,
                          value: formatCurrency(tiles.currentMonthExpenses),
                          showDelta: true, deltaPct: tiles.currentMonthExpensesDeltaPct)
            DashboardTile(kicker: "Expenses", label: "Average · \(viewModel.sixMonthRangeLabel)",
                          value: formatCurrency(tiles.previousSixMonthsExpensesAverage))
        }
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0, content: content)
            .padding(EdgeInsets(top: 18, leading: 18, bottom: 16, trailing: 18))
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DashboardTheme.surface)
            .overlay(RoundedRectangle(cornerRadius: DashboardTheme.cardRadius).stroke(DashboardTheme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: DashboardTheme.cardRadius))
    }

    private func cardHeader(_ title: String, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 15, weight: .bold, design: .rounded))
            Text(sub).font(.system(size: 11.5)).foregroundColor(DashboardTheme.ink3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 14)
    }

    // Matches DashboardView.vue's formatCurrency: no decimals, "−" for negatives.
    private func formatCurrency(_ amount: Double) -> String {
        let sign = amount < 0 ? "−" : ""
        let magnitude = abs(amount).formatted(.number.precision(.fractionLength(0)))
        return "\(sign)$\(magnitude)"
    }
}

#Preview {
    DashboardView(
        transactionsStore: TransactionsStore(idToken: "preview"),
        settingsStore: SettingsStore(idToken: "preview")
    )
}
