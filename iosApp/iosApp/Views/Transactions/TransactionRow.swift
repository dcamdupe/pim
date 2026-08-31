import SwiftUI

// One row of the transactions list, matching the `.tx-row` block of
// docs/design/dashboard-mockup-ios.html: description, "date · account" meta, a category chip
// (coloured dot + name) or a dashed "+ Add category", and the signed monospace amount.
struct TransactionRow: View {
    let transaction: Transaction
    let categoryColor: (String) -> String?
    let isSaving: Bool
    let onTapCategory: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.description)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink)
                    .lineLimit(1)
                Text("\(displayDate(transaction.date)) · \(transaction.account)")
                    .font(.system(size: 11))
                    .foregroundColor(DashboardTheme.ink3)
                    .lineLimit(1)
                categoryChip
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(formatAmount(transaction.amount))
                .font(.system(size: 13.5, weight: .bold, design: .monospaced))
                .foregroundColor(transaction.amount > 0 ? DashboardTheme.good : DashboardTheme.ink)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var categoryChip: some View {
        Button(action: onTapCategory) {
            HStack(spacing: 5) {
                if isSaving {
                    ProgressView().controlSize(.mini)
                } else if transaction.isUncategorized {
                    Text("+ Add category")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(DashboardTheme.ink3)
                } else {
                    Circle()
                        .fill(Color(hex: categoryColor(transaction.category) ?? DashboardTheme.fallbackCategoryColor))
                        .frame(width: 6, height: 6)
                    Text(transaction.category)
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(DashboardTheme.ink2)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .overlay(
                Capsule().stroke(
                    DashboardTheme.border,
                    style: StrokeStyle(lineWidth: 1, dash: transaction.isUncategorized ? [3] : [])
                )
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isSaving)
        .padding(.top, 2)
    }

    // "28 Jul" from "2026-07-28".
    private func displayDate(_ iso: String) -> String {
        let parts = iso.split(separator: "-")
        guard parts.count == 3, let month = Int(parts[1]) else { return iso }
        return "\(parts[2]) \(DashboardMetrics.monthAbbreviations[month - 1])"
    }

    private func formatAmount(_ amount: Double) -> String {
        let sign = amount > 0 ? "+" : "−"
        let magnitude = abs(amount).formatted(.number.precision(.fractionLength(2)))
        return "\(sign)$\(magnitude)"
    }
}
