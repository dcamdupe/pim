import Foundation

// The search + needs-category predicates from FrontEnd/src/utils/transactionFilters.ts - the only
// two the iOS transactions screen exposes (the web's account / category / amount-sign / hide-ignored
// filters are not in the iOS mockup).
enum TransactionFilters {
    // Case-insensitive substring match on the description; an empty/whitespace query matches all.
    static func matchesSearch(_ transaction: Transaction, query: String) -> Bool {
        let search = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !search.isEmpty else { return true }
        return transaction.description.lowercased().contains(search)
    }

    // Ignored transactions never get (or need) a category, so they don't count as "needing" one.
    static func needsCategory(_ transaction: Transaction) -> Bool {
        transaction.isUncategorized && transaction.ignore != true
    }

    static func filter(_ transactions: [Transaction], search: String, needsCategoryOnly: Bool) -> [Transaction] {
        transactions.filter { transaction in
            guard matchesSearch(transaction, query: search) else { return false }
            if needsCategoryOnly, !needsCategory(transaction) { return false }
            return true
        }
    }

    static func needsCategoryCount(_ transactions: [Transaction]) -> Int {
        transactions.filter(needsCategory).count
    }
}
