import SwiftUI

// The settings-defined category list, shown when a transaction's category chip is tapped. Mirrors
// the <select> of categories in TransactionsView.vue.
struct CategoryPickerSheet: View {
    let transaction: Transaction
    let categoryNames: [String]
    let categoryColor: (String) -> String?
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(categoryNames, id: \.self) { name in
                        Button {
                            dismiss()
                            onSelect(name)
                        } label: {
                            HStack(spacing: 10) {
                                Circle()
                                    .fill(Color(hex: categoryColor(name) ?? DashboardTheme.fallbackCategoryColor))
                                    .frame(width: 9, height: 9)
                                Text(name)
                                    .foregroundColor(DashboardTheme.ink)
                                Spacer()
                                if name == transaction.category {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(DashboardTheme.accent)
                                }
                            }
                        }
                    }
                } header: {
                    Text(transaction.description)
                        .textCase(nil)
                }
            }
            .navigationTitle("Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
