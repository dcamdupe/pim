import Foundation

// Port of FrontEnd/src/utils/budgetAmounts.ts (UBE-119). Keep the two in sync.
enum ParsedBudgetAmount: Equatable {
    case empty
    case valid(Decimal)
    case invalid(String)
}

enum BudgetAmounts {
    // Blank means "no budget". Accepts an optional leading "$" and thousands commas.
    static func parse(_ input: String) -> ParsedBudgetAmount {
        var cleaned = input.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        if cleaned.hasPrefix("$") { cleaned.removeFirst() }
        if cleaned.isEmpty { return .empty }
        guard cleaned.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil,
              let amount = Decimal(string: cleaned, locale: Locale(identifier: "en_US_POSIX"))
        else {
            return .invalid("Enter an amount like 250 or 99.50.")
        }
        if amount <= 0 { return .invalid("Enter an amount greater than 0.") }
        return .valid(amount)
    }

    // Sum of the valid amounts (Decimal, so no float drift).
    static func total(_ inputs: [String]) -> Decimal {
        inputs.reduce(Decimal(0)) { sum, input in
            if case .valid(let amount) = parse(input) { return sum + amount }
            return sum
        }
    }

    // Shows a stored amount in its field: whole dollars without decimals, otherwise 2 places.
    static func formatInput(_ amount: Decimal) -> String {
        var rounded = Decimal()
        var value = amount
        NSDecimalRound(&rounded, &value, 0, .plain)
        if rounded == amount { return "\(rounded)" }
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}
