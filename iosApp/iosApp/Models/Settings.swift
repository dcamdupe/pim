import Foundation

// GET /settings response. Mirrors FrontEnd/src/services/settingsService.ts's Settings and the Api's
// SettingsResponse(Accounts, Categories, MinTransactionDate).
struct Settings: Decodable {
    let accounts: [Account]
    let categories: [CategoryDefinition]
    // "yyyy-MM-dd" or null - the oldest transaction date, used as the lower bound for the month picker.
    let minTransactionDate: String?
}

struct Account: Decodable {
    let name: String
    let type: String
}

struct CategoryDefinition: Decodable {
    let name: String
    let colour: String
    let type: String
}
