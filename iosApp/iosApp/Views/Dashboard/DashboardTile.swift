import SwiftUI

// Ported from FrontEnd/src/components/DashboardTile.vue: kicker, reserved-space delta pill, label,
// value. The pill always occupies the same space (visible or not) so tiles stay aligned.
struct DashboardTile: View {
    let kicker: String
    let label: String
    let value: String
    var showDelta: Bool = false
    var deltaPct: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 6) {
                Text(kicker.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .kerning(0.3)
                    .foregroundColor(DashboardTheme.ink2)
                Spacer(minLength: 0)
                deltaPill
            }
            Text(label)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundColor(DashboardTheme.ink2)
            Text(value)
                .font(.system(size: 21, weight: .heavy, design: .rounded))
                .foregroundColor(DashboardTheme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(EdgeInsets(top: 14, leading: 14, bottom: 13, trailing: 14))
        .background(DashboardTheme.surface)
        .overlay(
            RoundedRectangle(cornerRadius: DashboardTheme.tileRadius)
                .stroke(DashboardTheme.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: DashboardTheme.tileRadius))
    }

    @ViewBuilder
    private var deltaPill: some View {
        Text(pillText)
            .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(pillBackground)
            .foregroundColor(pillForeground)
            .clipShape(Capsule())
            .opacity(showDelta ? 1 : 0)
    }

    private var pillText: String {
        guard showDelta else { return "—" }
        guard let pct = deltaPct else { return "— flat" }
        return "\(pct >= 0 ? "▲" : "▼") \(String(format: "%.1f", abs(pct)))%"
    }

    private var pillBackground: Color {
        guard showDelta, let pct = deltaPct else { return DashboardTheme.surface2 }
        return pct >= 0
            ? DashboardTheme.good.opacity(0.12)
            : DashboardTheme.crit.opacity(0.12)
    }

    private var pillForeground: Color {
        guard showDelta, let pct = deltaPct else { return DashboardTheme.ink2 }
        return pct >= 0 ? DashboardTheme.good : DashboardTheme.crit
    }
}
