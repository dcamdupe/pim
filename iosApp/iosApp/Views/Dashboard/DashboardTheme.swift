import SwiftUI

// Palette + measurements from docs/design/dashboard-mockup-ios.html's :root. Light-only, matching
// the mockup (color-scheme: light).
enum DashboardTheme {
    static let bg = Color(hex: "#f2f4f8")
    static let surface = Color(hex: "#ffffff")
    static let surface2 = Color(hex: "#f8f9fc")
    static let ink = Color(hex: "#171a24")
    static let ink2 = Color(hex: "#5b6070")
    static let ink3 = Color(hex: "#9093a3")
    static let border = Color(hex: "#e7e9f1")
    static let accent = Color(hex: "#0f766e")
    static let accentDark = Color(hex: "#0b5c56")
    static let accentWash = Color(hex: "#e3f3f1")
    static let good = Color(hex: "#0ca30c")
    static let crit = Color(hex: "#d03b3b")

    static let incomeColor = Color(hex: "#2a78d6")
    static let expenseColor = Color(hex: "#eb6834")

    // RecentTransactionsList.vue / SpendingByCategoryChart.vue FALLBACK_COLOR.
    static let fallbackCategoryColor = "#9093a3"

    static let cardRadius: CGFloat = 24
    static let tileRadius: CGFloat = 18
}

extension Color {
    // #rgb / #rrggbb / #rrggbbaa. Falls back to gray on a malformed string.
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var value: UInt64 = 0
        guard Scanner(string: cleaned).scanHexInt64(&value) else {
            self = .gray
            return
        }

        let r, g, b, a: Double
        switch cleaned.count {
        case 3:
            r = Double((value >> 8) & 0xF) / 15
            g = Double((value >> 4) & 0xF) / 15
            b = Double(value & 0xF) / 15
            a = 1
        case 8:
            r = Double((value >> 24) & 0xFF) / 255
            g = Double((value >> 16) & 0xFF) / 255
            b = Double((value >> 8) & 0xFF) / 255
            a = Double(value & 0xFF) / 255
        default:
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
            a = 1
        }

        self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
