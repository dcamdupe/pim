import SwiftUI

// Google's four-color "G" logomark, ported from the exact same path data as
// FrontEnd/src/views/LoginView.vue's inline SVG (20x20 viewBox) via SVGPath, rather than
// hand-redrawn - so it stays a byte-for-byte match if that source ever changes.
struct GoogleLogoView: View {
    private static let viewBoxSize: CGFloat = 20

    private static let layers: [(d: String, color: Color)] = [
        (
            "M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z",
            Color(red: 0x42 / 255, green: 0x85 / 255, blue: 0xF4 / 255)
        ),
        (
            "M10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45c-.87.59-2 .94-3.46.94-2.66 0-4.92-1.79-5.73-4.2H1.02v2.53A9.99 9.99 0 0010 20z",
            Color(red: 0x34 / 255, green: 0xA8 / 255, blue: 0x53 / 255)
        ),
        (
            "M4.27 11.87A5.99 5.99 0 013.96 10c0-.65.11-1.29.31-1.87V5.6H1.02A9.99 9.99 0 000 10c0 1.61.39 3.14 1.02 4.4l3.25-2.53z",
            Color(red: 0xFB / 255, green: 0xBC / 255, blue: 0x05 / 255)
        ),
        (
            "M10 3.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.7 2.24 1.02 5.6l3.25 2.53C5.08 5.73 7.34 3.96 10 3.96z",
            Color(red: 0xEA / 255, green: 0x43 / 255, blue: 0x35 / 255)
        ),
    ]

    var body: some View {
        GeometryReader { geometry in
            let scale = min(geometry.size.width, geometry.size.height) / Self.viewBoxSize
            ZStack {
                ForEach(Array(Self.layers.enumerated()), id: \.offset) { _, layer in
                    Path(SVGPath.parse(layer.d))
                        .fill(layer.color)
                }
            }
            .scaleEffect(scale, anchor: .topLeading)
        }
    }
}

#Preview {
    GoogleLogoView()
        .frame(width: 40, height: 40)
}
