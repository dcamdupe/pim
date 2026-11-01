import Foundation

// A recurring monthly budget for one Expense category (UBE-119). Mirrors budgetsService.ts's Budget.
struct Budget: Codable, Equatable {
    let category: String
    let amount: Decimal
}
