import Foundation

// Direct port of FrontEnd/src/utils/descriptionMatching.ts. Keep the two in sync.

struct ApproximateMatch: Equatable {
    let descriptionStart: String
    let matchingTransactionCount: Int
}

enum DescriptionMatching {
    // A candidate description approximately matches `description` if it starts with the same
    // characters up to and including a space - a whole-word boundary, never mid-word. The longest
    // (most precise) boundary that yields any match wins. `otherDescriptions` is the deduplicated
    // per-description stats list; the entry for `description` itself still counts, minus the one
    // transaction being edited.
    static func findApproximateMatch(
        description: String,
        otherDescriptions: [TransactionDescriptionStat]
    ) -> ApproximateMatch? {
        let chars = Array(description)
        var boundaries: [Int] = []
        for i in chars.indices where chars[i] == " " {
            boundaries.append(i + 1)
        }
        boundaries.sort(by: >)

        for boundary in boundaries {
            let prefix = String(chars[0..<boundary])
            var matchingTransactionCount = 0

            for stat in otherDescriptions where stat.description.hasPrefix(prefix) {
                // The stat for `description` itself also represents the transaction being edited -
                // only the *other* transactions it covers count.
                matchingTransactionCount += stat.description == description
                    ? stat.transactionCount - 1
                    : stat.transactionCount
            }

            if matchingTransactionCount > 0 {
                var trimmed = prefix
                while trimmed.hasSuffix(" ") { trimmed.removeLast() }
                return ApproximateMatch(descriptionStart: trimmed, matchingTransactionCount: matchingTransactionCount)
            }
        }

        // No word-boundary match - only possible when `description` has no spaces. A single-token
        // description can still be a genuine exact duplicate of another transaction's identical
        // description (exact match only, not a prefix - "Netflix" must not match "Netflix Extra").
        if let exact = otherDescriptions.first(where: { $0.description == description }), exact.transactionCount > 1 {
            return ApproximateMatch(descriptionStart: description, matchingTransactionCount: exact.transactionCount - 1)
        }

        return nil
    }
}
