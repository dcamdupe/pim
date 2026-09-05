import SwiftUI
import UIKit

// Palette + measurements from docs/design/dashboard-mockup-ios.html's :root (light values).
// Dark values added for UBE-113 following Apple HIG semantic-colour conventions - every token
// resolves dynamically off the system appearance, so all 9 screens that read colour only through
// this enum get dark mode for free.
enum DashboardTheme {
    static let bg = Color(light: "#f2f4f8", dark: "#0b0d12")
    static let surface = Color(light: "#ffffff", dark: "#1c1f27")
    static let surface2 = Color(light: "#f8f9fc", dark: "#262b36")
    static let ink = Color(light: "#171a24", dark: "#f2f4f8")
    static let ink2 = Color(light: "#5b6070", dark: "#9aa0b4")
    static let ink3 = Color(light: "#9093a3", dark: "#6b7080")
    static let border = Color(light: "#e7e9f1", dark: "#2c3140")
    static let accent = Color(light: "#0f766e", dark: "#2dd4bf")
    static let accentDark = Color(light: "#0b5c56", dark: "#5eead4")
    static let accentWash = Color(light: "#e3f3f1", dark: "#123a37")
    static let good = Color(light: "#0ca30c", dark: "#30d158")
    static let crit = Color(light: "#d03b3b", dark: "#ff453a")

    static let incomeColor = Color(light: "#2a78d6", dark: "#0a84ff")
    static let expenseColor = Color(light: "#eb6834", dark: "#ff9f0a")

    // RecentTransactionsList.vue / SpendingByCategoryChart.vue FALLBACK_COLOR - a neutral gray
    // that reads acceptably on both light and dark backgrounds, so it doesn't need a dark variant.
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

    // Resolves to `light` or `dark` per the current UITraitCollection.userInterfaceStyle - like a
    // UIColor(dynamicProvider:) or an asset-catalog colour set, this also repaints live if the
    // user changes Settings > Display & Brightness while the app is running.
    init(light: String, dark: String) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(Color(hex: dark)) : UIColor(Color(hex: light))
        })
    }
}
