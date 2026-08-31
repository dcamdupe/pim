import SwiftUI

// Ported from FrontEnd/src/components/SpendingByCategoryChart.vue + the mockup's buildDoughnut().
// Same geometry: 168x168 space, cx/cy 84, r 64, thickness 24. Wedges are built from explicit arc
// points (not SwiftUI's addArc) to keep the JS `polar()` math identical and sidestep SwiftUI's
// clockwise-flag ambiguity.
struct SpendingByCategoryChart: View {
    let expenses: [CategoryExpense]
    let centerValue: String
    let centerLabel: String

    @State private var selected: String?

    private static let viewBox: CGFloat = 168
    private static let cx: CGFloat = 84
    private static let cy: CGFloat = 84
    private static let r: CGFloat = 64
    private static let thickness: CGFloat = 24
    private static let maxSweep = 359.99

    var body: some View {
        VStack(spacing: 14) {
            if segments.isEmpty {
                Text("No expenses this month.")
                    .font(.system(size: 13))
                    .foregroundColor(DashboardTheme.ink2)
                    .frame(maxWidth: .infinity, minHeight: 120)
            } else {
                doughnut
                legend
                tip
            }
        }
    }

    // MARK: - Doughnut

    private var doughnut: some View {
        GeometryReader { geo in
            let scale = geo.size.width / Self.viewBox
            ZStack {
                ForEach(segments) { seg in
                    seg.path
                        .fill(Color(hex: seg.color))
                        .opacity(selected == nil || selected == seg.category ? 1 : 0.35)
                        .onTapGesture { toggle(seg.category) }
                }
                VStack(spacing: 2) {
                    Text(centerValue)
                        .font(.system(size: 21, weight: .heavy, design: .rounded))
                        .foregroundColor(DashboardTheme.ink)
                    Text(centerLabel)
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundColor(DashboardTheme.ink3)
                }
            }
            .frame(width: Self.viewBox, height: Self.viewBox)
            .scaleEffect(scale, anchor: .topLeading)
        }
        .frame(width: 150, height: 150)
    }

    // MARK: - Legend

    private var legend: some View {
        let columns = [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]
        return LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
            ForEach(segments) { seg in
                HStack(spacing: 7) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color(hex: seg.color))
                        .frame(width: 8, height: 8)
                    Text(displayName(seg.category))
                        .font(.system(size: 11.5))
                        .foregroundColor(DashboardTheme.ink2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(Int(seg.pct.rounded()))%")
                        .font(.system(size: 11.5, weight: .bold, design: .monospaced))
                        .foregroundColor(DashboardTheme.ink)
                }
                .padding(.vertical, 2)
                .padding(.horizontal, 4)
                .background(selected == seg.category ? DashboardTheme.surface2 : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .contentShape(Rectangle())
                .onTapGesture { toggle(seg.category) }
            }
        }
    }

    private var tip: some View {
        Text(tipText)
            .font(.system(size: 11.5, weight: .semibold))
            .foregroundColor(DashboardTheme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .padding(.horizontal, 10)
            .background(DashboardTheme.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var tipText: String {
        guard let selected, let seg = segments.first(where: { $0.category == selected }) else {
            return "Tap a slice or category"
        }
        let amount = seg.amount.formatted(.number.precision(.fractionLength(0)))
        return "\(displayName(seg.category))  $\(amount) · \(Int(seg.pct.rounded()))%"
    }

    private func toggle(_ category: String) {
        selected = (selected == category) ? nil : category
    }

    private func displayName(_ category: String) -> String {
        category.isEmpty ? "Uncategorized" : category
    }

    // MARK: - Geometry

    private struct Segment: Identifiable {
        let category: String
        let amount: Double
        let pct: Double
        let color: String
        let path: Path

        var id: String { category }
    }

    private var segments: [Segment] {
        var acc = 0.0
        return expenses.map { expense in
            let sweep = min(expense.pct * 3.6, Self.maxSweep)
            let start = acc
            let end = acc + sweep
            acc += sweep
            return Segment(
                category: expense.category,
                amount: expense.amount,
                pct: expense.pct,
                color: expense.color ?? DashboardTheme.fallbackCategoryColor,
                path: Self.wedgePath(start: start, end: end)
            )
        }
    }

    private static func polar(radius: CGFloat, angle: Double) -> CGPoint {
        let a = (angle - 90) * .pi / 180
        return CGPoint(x: cx + radius * CGFloat(cos(a)), y: cy + radius * CGFloat(sin(a)))
    }

    private static func wedgePath(start: Double, end: Double) -> Path {
        let rOuter = r + thickness / 2
        let rInner = r - thickness / 2
        var path = Path()

        // Outer arc, start -> end.
        path.move(to: polar(radius: rOuter, angle: start))
        for angle in stride(from: start, through: end, by: 1) {
            path.addLine(to: polar(radius: rOuter, angle: angle))
        }
        path.addLine(to: polar(radius: rOuter, angle: end))

        // Inner arc, end -> start.
        path.addLine(to: polar(radius: rInner, angle: end))
        for angle in stride(from: end, through: start, by: -1) {
            path.addLine(to: polar(radius: rInner, angle: angle))
        }
        path.addLine(to: polar(radius: rInner, angle: start))
        path.closeSubpath()
        return path
    }
}
