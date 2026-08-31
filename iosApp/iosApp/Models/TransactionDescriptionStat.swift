import Foundation

// One entry from GET /transactions/descriptions - the deduplicated per-description stats the
// "apply to similar transactions?" prompt matches against. Mirrors
// FrontEnd/src/services/transactionDescriptionsService.ts's TransactionDescriptionStat.
struct TransactionDescriptionStat: Decodable, Equatable {
    let description: String
    let transactionCount: Int
    let unclassifiedCount: Int
}

struct TransactionDescriptionsResponse: Decodable {
    let descriptions: [TransactionDescriptionStat]
}
