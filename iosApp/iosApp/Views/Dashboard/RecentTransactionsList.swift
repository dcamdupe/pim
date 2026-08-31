import SwiftUI

// Ported from FrontEnd/src/components/RecentTransactionsList.vue: avatar initial on a tinted
// background, description, "date · account", category chip (or dashed "Uncategorized"), signed
// monospace amount (green when positive).
struct RecentTransactionsList: View {
    let transactions: [Transaction]
    let categoryColor: (String) -> String?

    var body: some View {
        if transactions.isEmpty {
            Text("No transactions yet.")
                .font(.system(size: 13))
                .foregroundColor(DashboardTheme.ink2)
                .padding(.vertical, 20)
        } else {
            VStack(spacing: 0) {
                ForEach(Array(transactions.enumerated()), id: \.offset) { index, transaction in
                    row(transaction)
                    if index < transactions.count - 1 {
                        Divider().overlay(DashboardTheme.border)
                    }
                }
            }
        }
    }

    private func row(_ transaction: Transaction) -> some View {
        HStack(spacing: 11) {
            RoundedRectangle(cornerRadius: 10)
                .fill(avatarBackground(transaction.category))
                .frame(width: 34, height: 34)
                .overlay(
                    Text(avatarInitial(transaction.description))
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundColor(DashboardTheme.ink)
                )

            VStack(alignment: .leading, spacing: 1) {
                Text(transaction.description)
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundColor(DashboardTheme.ink)
                    .lineLimit(1)
                Text("\(displayDate(transaction.date)) · \(transaction.account)")
                    .font(.system(size: 11))
                    .foregroundColor(DashboardTheme.ink3)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(formatAmount(transaction.amount))
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundColor(transaction.amount > 0 ? DashboardTheme.good : DashboardTheme.ink)
        }
        .padding(.vertical, 10)
    }

    private func avatarInitial(_ description: String) -> String {
        let trimmed = description.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? "?" : String(trimmed.prefix(1)).uppercased()
    }

    private func avatarBackground(_ category: String) -> Color {
        guard !category.isEmpty else { return DashboardTheme.border }
        return Color(hex: categoryColor(category) ?? DashboardTheme.fallbackCategoryColor).opacity(0.16)
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
