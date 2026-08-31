import Foundation

// One transaction as returned by GET /transactions. Mirrors FrontEnd/src/services/transactionsService.ts's
// Transaction and the Api's Pim.Api.Data.Transaction (camelCase JSON, string enums, "yyyy-MM-dd" dates).
struct Transaction: Decodable, Identifiable, Equatable {
    let account: String
    let date: String
    let description: String
    let category: String
    let amount: Double
    let ignore: Bool?
    let type: TransactionType?

    // No surrogate id from the Api - date+description+amount+account is the closest thing to a
    // stable identity (same combination the Api uses for dedupe/matching).
    var id: String { "\(date)|\(description)|\(amount)|\(account)" }

    enum TransactionType: String, Decodable {
        case income = "Income"
        case expense = "Expense"
        case ignore = "Ignore"
    }
}

struct TransactionsResponse: Decodable {
    let transactions: [Transaction]
}
