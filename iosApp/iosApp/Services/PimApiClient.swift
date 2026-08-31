import Foundation

enum PimApiError: Error {
    case unauthorized
    case requestFailed
}

// Thin client for the PIM Api. Auth is the Cognito id token as a Bearer header, exactly like
// FrontEnd's authHeaders(). No refresh handling - a 401 surfaces as .unauthorized for the caller
// to send the user back to login.
struct PimApiClient {
    let idToken: String
    var baseURL: String = AuthConfig.apiBaseUrl
    var session: URLSession = .shared

    // GET /transactions?endDate=<today> - all transactions up to today, matching
    // stores/transactions.ts (startDate omitted).
    func getTransactions(endDate: Date = Date()) async throws -> [Transaction] {
        var components = URLComponents(string: "\(baseURL)/transactions")!
        components.queryItems = [URLQueryItem(name: "endDate", value: Self.apiDateFormatter.string(from: endDate))]
        let response: TransactionsResponse = try await get(components.url!)
        return response.transactions
    }

    // GET /settings
    func getSettings() async throws -> Settings {
        try await get(URL(string: "\(baseURL)/settings")!)
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        var request = URLRequest(url: url)
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw PimApiError.requestFailed
        }
        if http.statusCode == 401 {
            throw PimApiError.unauthorized
        }
        guard (200..<300).contains(http.statusCode) else {
            throw PimApiError.requestFailed
        }

        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw PimApiError.requestFailed
        }
    }

    // "yyyy-MM-dd" in a fixed locale/timezone, matching FrontEnd/src/utils/dateFormat.ts (which
    // formats in local time). Uses the current calendar's local day.
    private static let apiDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
