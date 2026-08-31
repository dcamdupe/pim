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
        let response: TransactionsResponse = try await send(components.url!, method: "GET")
        return response.transactions
    }

    // GET /settings
    func getSettings() async throws -> Settings {
        try await send(URL(string: "\(baseURL)/settings")!, method: "GET")
    }

    // GET /transactions/descriptions - per-description stats for the "apply to similar" prompt,
    // matching transactionDescriptionsService.ts's refreshTransactionDescriptions().
    func getTransactionDescriptions() async throws -> [TransactionDescriptionStat] {
        let response: TransactionDescriptionsResponse = try await send(
            URL(string: "\(baseURL)/transactions/descriptions")!, method: "GET"
        )
        return response.descriptions
    }

    // PUT /transactions - the whole transaction objects go back; the Api can stamp type/ignore as
    // a side effect, so the response is authoritative (transactionsService.ts's updateTransactions).
    func updateTransactions(_ transactions: [Transaction]) async throws -> [Transaction] {
        let response: TransactionsResponse = try await send(
            URL(string: "\(baseURL)/transactions")!, method: "PUT", body: transactions
        )
        return response.transactions
    }

    // POST /mapping/description - a description-prefix -> category rule; the Api retroactively
    // recategorises every matching transaction (MappingController).
    func saveDescriptionMapping(descriptionStart: String, category: String) async throws {
        try await sendNoContent(
            URL(string: "\(baseURL)/mapping/description")!,
            method: "POST",
            body: DescriptionMappingRequest(descriptionStart: descriptionStart, category: category)
        )
    }

    // MARK: - Transport

    private func send<T: Decodable>(_ url: URL, method: String) async throws -> T {
        try decode(try await perform(url, method: method, body: nil))
    }

    private func send<T: Decodable, Body: Encodable>(_ url: URL, method: String, body: Body) async throws -> T {
        try decode(try await perform(url, method: method, body: try JSONEncoder().encode(body)))
    }

    private func sendNoContent<Body: Encodable>(_ url: URL, method: String, body: Body) async throws {
        _ = try await perform(url, method: method, body: try JSONEncoder().encode(body))
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw PimApiError.requestFailed
        }
    }

    private func perform(_ url: URL, method: String, body: Data?) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

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
        return data
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

private struct DescriptionMappingRequest: Encodable {
    let descriptionStart: String
    let category: String
}
