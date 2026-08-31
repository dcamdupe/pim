import Foundation

// One transaction as returned by GET /transactions. Mirrors FrontEnd/src/services/transactionsService.ts's
// Transaction and the Api's Pim.Api.Data.Transaction (camelCase JSON, string enums, "yyyy-MM-dd" dates).
// Encodable too - PUT /transactions takes the whole object back (matching stores/transactions.ts's
// `{ ...transaction, ...changes }`).
struct Transaction: Codable, Identifiable, Equatable {
    let account: String
    let date: String
    let description: String
    var category: String
    let amount: Double
    var ignore: Bool?
    var type: TransactionType?

    // No surrogate id from the Api - date+description+amount+account is the closest thing to a
    // stable identity (same combination the Api uses for dedupe/matching).
    var id: String { "\(date)|\(description)|\(amount)|\(account)" }

    var isUncategorized: Bool { category.isEmpty }

    enum TransactionType: String, Codable {
        case income = "Income"
        case expense = "Expense"
        case ignore = "Ignore"
    }

    // A copy with the category changed - the one edit the transactions screen makes.
    func withCategory(_ newCategory: String) -> Transaction {
        var copy = self
        copy.category = newCategory
        return copy
    }
}

struct TransactionsResponse: Decodable {
    let transactions: [Transaction]
}
