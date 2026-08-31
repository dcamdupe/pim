import SwiftUI

// The transactions screen (UBE-103), matching the Transactions tab of
// docs/design/dashboard-mockup-ios.html: title + needs-category sub-line, a search field, a
// "N need a category" filter chip, and the card-styled list. Reads the shared stores, so it
// reuses the dashboard's cached data and its edits show there too.
struct TransactionsView: View {
    var onSignOut: (() -> Void)?

    @StateObject private var viewModel: TransactionsViewModel
    @State private var categorySheetTransaction: Transaction?

    init(transactionsStore: TransactionsStore, settingsStore: SettingsStore, onSignOut: (() -> Void)? = nil) {
        self.onSignOut = onSignOut
        _viewModel = StateObject(wrappedValue: TransactionsViewModel(
            transactionsStore: transactionsStore, settingsStore: settingsStore
        ))
    }

    var body: some View {
        VStack(spacing: 0) {
            navBar
            content
        }
        .background(DashboardTheme.bg.ignoresSafeArea())
        .task { await viewModel.load() }
        .sheet(item: $categorySheetTransaction) { transaction in
            CategoryPickerSheet(
                transaction: transaction,
                categoryNames: viewModel.categoryNames,
                categoryColor: viewModel.categoryColor,
                onSelect: { category in
                    Task { await viewModel.selectCategory(category, for: transaction) }
                }
            )
        }
        .sheet(item: $viewModel.pendingCategoryChange) { pending in
            ApplyToSimilarSheet(
                pending: pending,
                activeAction: viewModel.modalAction,
                errorMessage: viewModel.categorySaveError,
                onApplyToAll: { Task { await viewModel.confirmApplyToSimilar() } },
                onJustThisOne: { Task { await viewModel.declineApplyToSimilar() } },
                onCancel: { viewModel.cancelApplyToSimilar() }
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
        VStack(alignment: .leading, spacing: 3) {
            Text("Transactions")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundColor(DashboardTheme.ink)
            Text(subtitle)
                .font(.system(size: 13.5))
                .foregroundColor(DashboardTheme.ink2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 10)
        .padding(.bottom, 12)
    }

    private var subtitle: String {
        let count = viewModel.needsCategoryCount
        guard count > 0 else { return "Every transaction has a category." }
        return "\(count) \(count == 1 ? "entry needs" : "entries need") a category"
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
                message: "Could not load your transactions. Please try again later.",
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
                searchField
                filterChips
                if let error = viewModel.categorySaveError, viewModel.pendingCategoryChange == nil {
                    Text(error)
                        .font(.system(size: 12.5))
                        .foregroundColor(DashboardTheme.crit)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }
                listCard
            }
            .padding(.bottom, 32)
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(DashboardTheme.ink3)
            TextField("Search description", text: $viewModel.searchQuery)
                .font(.system(size: 14))
                .foregroundColor(DashboardTheme.ink)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !viewModel.searchQuery.isEmpty {
                Button {
                    viewModel.searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(DashboardTheme.ink3)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(DashboardTheme.surface2)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(DashboardTheme.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 20)
    }

    @ViewBuilder
    private var filterChips: some View {
        let count = viewModel.needsCategoryCount
        if count > 0 {
            HStack {
                Button {
                    viewModel.needsCategoryOnly.toggle()
                } label: {
                    Text("\(count) need a category")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundColor(viewModel.needsCategoryOnly ? .white : DashboardTheme.crit)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 7)
                        .background(viewModel.needsCategoryOnly ? DashboardTheme.crit : Color(hex: "#fdf3e0"))
                        .overlay(
                            Capsule().stroke(
                                DashboardTheme.crit,
                                style: StrokeStyle(lineWidth: 1, dash: viewModel.needsCategoryOnly ? [] : [3])
                            )
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        } else {
            Color.clear.frame(height: 12)
        }
    }

    @ViewBuilder
    private var listCard: some View {
        let rows = viewModel.visibleTransactions
        if rows.isEmpty {
            Text(viewModel.isEmpty ? "No transactions yet." : "No transactions match your filters.")
                .font(.system(size: 13.5))
                .foregroundColor(DashboardTheme.ink2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 8)
        } else {
            LazyVStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, transaction in
                    TransactionRow(
                        transaction: transaction,
                        categoryColor: viewModel.categoryColor,
                        isSaving: viewModel.savingCategoryFor == transaction.id,
                        onTapCategory: { categorySheetTransaction = transaction }
                    )
                    if index < rows.count - 1 {
                        Divider().overlay(DashboardTheme.border).padding(.leading, 16)
                    }
                }
            }
            .background(DashboardTheme.surface)
            .overlay(RoundedRectangle(cornerRadius: DashboardTheme.cardRadius).stroke(DashboardTheme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: DashboardTheme.cardRadius))
            .padding(.horizontal, 20)
            .padding(.top, 6)
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, 30)
    }
}

#Preview {
    TransactionsView(
        transactionsStore: TransactionsStore(idToken: "preview"),
        settingsStore: SettingsStore(idToken: "preview")
    )
}
