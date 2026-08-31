import SwiftUI

// "Apply to similar transactions?" - shown when a category change matches other transactions by
// description prefix. Ported from the modal in TransactionsView.vue.
struct ApplyToSimilarSheet: View {
    let pending: TransactionsViewModel.PendingCategoryChange
    let activeAction: TransactionsViewModel.ModalAction?
    let errorMessage: String?
    let onApplyToAll: () -> Void
    let onJustThisOne: () -> Void
    let onCancel: () -> Void

    private var isBusy: Bool { activeAction != nil }

    private var similarCount: Int { pending.match.matchingTransactionCount }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Apply to similar transactions?")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(DashboardTheme.ink)

            Text(bodyText)
                .font(.system(size: 13.5))
                .foregroundColor(DashboardTheme.ink2)
                .fixedSize(horizontal: false, vertical: true)

            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 12.5))
                    .foregroundColor(DashboardTheme.crit)
            }

            VStack(spacing: 8) {
                Button(action: onApplyToAll) {
                    HStack(spacing: 6) {
                        if activeAction == .confirm { ProgressView().controlSize(.mini).tint(.white) }
                        Text("Apply to \(similarCount) similar transaction\(similarCount == 1 ? "" : "s")")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(DashboardTheme.accent)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .disabled(isBusy)

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
        .presentationDetents([.height(320)])
    }

    private var bodyText: String {
        let count = similarCount
        let noun = count == 1 ? "transaction" : "transactions"
        return "\(count) other \(noun) starting with \u{201C}\(pending.match.descriptionStart)\u{201D} "
            + "could also be categorised as \(pending.category)."
    }
}
