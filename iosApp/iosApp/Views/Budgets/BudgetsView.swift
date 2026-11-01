import SwiftUI

// The Budgets tab (UBE-119): a monthly amount per Expense category, a total, and Save. Ported from
// FrontEnd's BudgetsView.vue and styled like the Transactions tab.
struct BudgetsView: View {
    var onSignOut: (() -> Void)?

    @StateObject private var viewModel: BudgetsViewModel
    @FocusState private var focusedCategory: String?

    init(settingsStore: SettingsStore, idToken: String, onSignOut: (() -> Void)? = nil) {
        self.onSignOut = onSignOut
        _viewModel = StateObject(wrappedValue: BudgetsViewModel(
            settingsStore: settingsStore, api: PimApiClient(idToken: idToken)
        ))
    }

    var body: some View {
        VStack(spacing: 0) {
            navBar
            content
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
        VStack(alignment: .leading, spacing: 3) {
            Text("Budgets")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundColor(DashboardTheme.ink)
            Text("A monthly budget for each expense category. Leave blank for no budget.")
                .font(.system(size: 13.5))
                .foregroundColor(DashboardTheme.ink2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 8)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed:
            statusView(
                message: "Could not load your budgets. Please try again later.",
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

    private var loadedContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                if viewModel.expenseCategories.isEmpty {
                    Text("You have no expense categories yet. Add some on the web in Settings.")
                        .font(.system(size: 13.5))
                        .foregroundColor(DashboardTheme.ink2)
                        .padding(.horizontal, 20)
                } else {
                    recommendationHeader
                    budgetList
                    totalRow
                    saveRow
                }
            }
            .padding(.bottom, 16)
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedCategory = nil }
            }
        }
    }

    private var budgetList: some View {
        let categories = viewModel.expenseCategories
        return LazyVStack(spacing: 0) {
            ForEach(Array(categories.enumerated()), id: \.element.name) { index, category in
                budgetRow(category)
                if index < categories.count - 1 {
                    Divider().overlay(DashboardTheme.border).padding(.leading, 16)
                }
            }
        }
        .background(DashboardTheme.surface)
        .overlay(RoundedRectangle(cornerRadius: DashboardTheme.cardRadius).stroke(DashboardTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: DashboardTheme.cardRadius))
        .padding(.horizontal, 20)
    }

    private func budgetRow(_ category: CategoryDefinition) -> some View {
        let error = viewModel.error(for: category.name)
        return VStack(alignment: .trailing, spacing: 2) {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color(hex: category.colour))
                    .frame(width: 10, height: 10)
                Text(category.name)
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 4)
                Text("$")
                    .font(.system(size: 14))
                    .foregroundColor(DashboardTheme.ink3)
                TextField("No budget", text: binding(for: category.name))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .font(.system(size: 14.5, design: .rounded))
                    .foregroundColor(DashboardTheme.ink)
                    .frame(width: 84)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(DashboardTheme.surface2)
                    .overlay(
                        RoundedRectangle(cornerRadius: 9)
                            .stroke(error == nil ? DashboardTheme.border : DashboardTheme.crit, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                    .focused($focusedCategory, equals: category.name)
                    .disabled(viewModel.saving)
                    .accessibilityLabel("\(category.name) budget")
                recommendationCell(category.name)
            }
            if let error {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(DashboardTheme.crit)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 5)
    }

    // "6-month average" column heading with the copy-all button (UBE-123).
    private var recommendationHeader: some View {
        HStack(spacing: 8) {
            Spacer()
            Text("6-month average")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(DashboardTheme.ink3)
            Button("Use all") {
                focusedCategory = nil
                viewModel.useAllRecommendations()
            }
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundColor(DashboardTheme.accentDark)
            .disabled(viewModel.saving || !viewModel.hasRecommendations)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 4)
    }

    // Tapping the recommendation copies it into the row's field.
    @ViewBuilder
    private func recommendationCell(_ category: String) -> some View {
        if let amount = viewModel.recommendations[category] {
            Button {
                viewModel.useRecommendation(for: category)
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "arrow.left")
                        .font(.system(size: 10, weight: .bold))
                    Text("$\(amount.formatted(.number.precision(.fractionLength(0))))")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .foregroundColor(DashboardTheme.accentDark)
                .frame(width: 66, alignment: .trailing)
                .padding(.vertical, 4)
            }
            .disabled(viewModel.saving)
            .accessibilityLabel("Use recommended budget for \(category), $\(amount.formatted())")
        } else {
            Text("—")
                .font(.system(size: 13))
                .foregroundColor(DashboardTheme.ink3)
                .frame(width: 66, alignment: .trailing)
        }
    }

    private var totalRow: some View {
        HStack {
            Text("Total monthly budget")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(DashboardTheme.ink2)
            Spacer()
            Text("$\(viewModel.total.formatted(.number.precision(.fractionLength(2))))")
                .font(.system(size: 17, weight: .heavy, design: .rounded))
                .foregroundColor(DashboardTheme.ink)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 8)
    }

    private var saveRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                focusedCategory = nil
                Task { await viewModel.save() }
            } label: {
                HStack(spacing: 6) {
                    if viewModel.saving { ProgressView().controlSize(.mini).tint(.white) }
                    Text(viewModel.saving ? "Saving…" : "Save")
                }
                .font(.system(size: 14.5, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(DashboardTheme.accent)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(viewModel.saving || viewModel.hasErrors)
            .opacity(viewModel.hasErrors ? 0.5 : 1)

            if viewModel.saved {
                Text("Saved.")
                    .font(.system(size: 13))
                    .foregroundColor(DashboardTheme.good)
            } else if let saveError = viewModel.saveError {
                Text(saveError)
                    .font(.system(size: 13))
                    .foregroundColor(DashboardTheme.crit)
            }
        }
        .padding(.horizontal, 20)
    }

    private func binding(for category: String) -> Binding<String> {
        Binding(
            get: { viewModel.inputs[category] ?? "" },
            set: { viewModel.inputs[category] = $0 }
        )
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 30)
    }
}

#Preview {
    BudgetsView(settingsStore: SettingsStore(idToken: "preview"), idToken: "preview")
}
