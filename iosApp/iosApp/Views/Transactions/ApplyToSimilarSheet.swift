import SwiftUI

// "Apply to similar transactions?" - shown when a category change matches other transactions by
// description prefix. Ported from the modal in TransactionsView.vue, including UBE-121's editable prefix.
struct ApplyToSimilarSheet: View {
    let pending: TransactionsViewModel.PendingCategoryChange
    @Binding var matchPrefix: String
    let matchCount: Int
    let validationMessage: String?
    let activeAction: TransactionsViewModel.ModalAction?
    let errorMessage: String?
    let onApplyToAll: () -> Void
    let onJustThisOne: () -> Void
    let onCancel: () -> Void

    private var isBusy: Bool { activeAction != nil }

    var body: some View {
        ScrollView {
            content
        }
        .scrollDismissesKeyboard(.interactively)
        .presentationDetents([.height(470), .large])
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Apply to similar transactions?")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(DashboardTheme.ink)

            VStack(alignment: .leading, spacing: 4) {
                Text("Transaction")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink3)
                Text(pending.transaction.description)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("applyToSimilar.fullDescription")
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Apply to descriptions starting with")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink3)
                // Matching is case-sensitive, so no auto-capitalisation/correction.
                TextField("Description starts with", text: $matchPrefix)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .font(.system(size: 14))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(DashboardTheme.surface2)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(validationMessage == nil ? DashboardTheme.border : DashboardTheme.crit, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .disabled(isBusy)
                    .accessibilityIdentifier("applyToSimilar.prefix")

                Text(helpText)
                    .font(.system(size: 12.5))
                    .foregroundColor(validationMessage == nil ? DashboardTheme.ink2 : DashboardTheme.crit)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12.5))
                    .foregroundColor(DashboardTheme.crit)
            }

            VStack(spacing: 8) {
                Button(action: onApplyToAll) {
                    HStack(spacing: 6) {
                        if activeAction == .confirm { ProgressView().controlSize(.mini).tint(.white) }
                        Text("Apply to \(matchCount) similar transaction\(matchCount == 1 ? "" : "s")")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(DashboardTheme.accent)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(isBusy || validationMessage != nil)
                .opacity(validationMessage != nil ? 0.5 : 1)

                Button(action: onJustThisOne) {
                    HStack(spacing: 6) {
                        if activeAction == .decline { ProgressView().controlSize(.mini) }
                        Text("Just this one")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(DashboardTheme.surface2)
                    .foregroundColor(DashboardTheme.ink)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(DashboardTheme.border, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(isBusy)

                Button("Cancel", action: onCancel)
                    .font(.system(size: 13.5))
                    .foregroundColor(DashboardTheme.ink2)
                    .padding(.top, 2)
                    .disabled(isBusy)
            }
            .font(.system(size: 13.5, weight: .semibold))
        }
        .padding(22)
    }

    private var helpText: String {
        if let validationMessage { return validationMessage }
        let noun = matchCount == 1 ? "transaction" : "transactions"
        return "\(matchCount) other \(noun) could also be categorised as \(pending.category)."
    }
}
