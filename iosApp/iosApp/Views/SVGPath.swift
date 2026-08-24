import CoreGraphics

// Minimal SVG path "d" parser -> CGPath, supporting the commands GoogleLogoView's path data
// uses: M/m, L/l, H/h, V/v, C/c, A/a, Z/z. Not a general-purpose SVG parser - e.g. no S/Q/T
// curves - just enough to reproduce the Google "G" logomark's exact path data without hand
// re-deriving each curve/arc's numbers.
enum SVGPath {
    static func parse(_ d: String) -> CGPath {
        var parser = Parser(d)
        parser.run()
        return parser.path
    }

    private struct Parser {
        private var scanner: Substring
        private var current = CGPoint.zero
        private var start = CGPoint.zero
        let path = CGMutablePath()

        init(_ d: String) {
            scanner = Substring(d)
        }

        private mutating func skipSeparators() {
            while let c = scanner.first, c == " " || c == "," || c == "\n" || c == "\t" {
                scanner.removeFirst()
            }
        }

        private mutating func readNumber() -> CGFloat {
            skipSeparators()
            var s = ""
            if let c = scanner.first, c == "-" || c == "+" {
                s.append(c)
                scanner.removeFirst()
            }
            var seenDot = false
            while let c = scanner.first, c.isNumber || (c == "." && !seenDot) {
                if c == "." { seenDot = true }
                s.append(c)
                scanner.removeFirst()
            }
            return CGFloat(Double(s) ?? 0)
        }

        private mutating func readFlag() -> Bool {
            skipSeparators()
            return scanner.removeFirst() == "1"
        }

        mutating func run() {
            while true {
                skipSeparators()
                guard let cmd = scanner.first, cmd.isLetter else { break }
                scanner.removeFirst()
                switch cmd {
                case "M": moveTo(relative: false)
                case "m": moveTo(relative: true)
                case "L": lineTo(relative: false)
                case "l": lineTo(relative: true)
                case "H": horizontalTo(relative: false)
                case "h": horizontalTo(relative: true)
                case "V": verticalTo(relative: false)
                case "v": verticalTo(relative: true)
                case "C": curveTo(relative: false)
                case "c": curveTo(relative: true)
                case "A": arcTo(relative: false)
                case "a": arcTo(relative: true)
                case "Z", "z":
                    path.closeSubpath()
                    current = start
                default:
                    return
                }
            }
        }

        private mutating func moveTo(relative: Bool) {
            let x = readNumber(), y = readNumber()
            let p = relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
            path.move(to: p)
            current = p
            start = p
        }

        private mutating func lineTo(relative: Bool) {
            let x = readNumber(), y = readNumber()
            let p = relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
            path.addLine(to: p)
            current = p
        }

        private mutating func horizontalTo(relative: Bool) {
            let x = readNumber()
            let p = relative ? CGPoint(x: current.x + x, y: current.y) : CGPoint(x: x, y: current.y)
            path.addLine(to: p)
            current = p
        }

        private mutating func verticalTo(relative: Bool) {
            let y = readNumber()
            let p = relative ? CGPoint(x: current.x, y: current.y + y) : CGPoint(x: current.x, y: y)
            path.addLine(to: p)
            current = p
        }

        private mutating func curveTo(relative: Bool) {
            let x1 = readNumber(), y1 = readNumber()
            let x2 = readNumber(), y2 = readNumber()
            let x = readNumber(), y = readNumber()
            let c1 = relative ? CGPoint(x: current.x + x1, y: current.y + y1) : CGPoint(x: x1, y: y1)
            let c2 = relative ? CGPoint(x: current.x + x2, y: current.y + y2) : CGPoint(x: x2, y: y2)
            let p = relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
            path.addCurve(to: p, control1: c1, control2: c2)
            current = p
        }

        // Endpoint-to-center arc parameterization (SVG spec appendix F.6.5), specialized to the
        // case this logo uses (x-axis-rotation always 0).
        private mutating func arcTo(relative: Bool) {
            let rx = abs(readNumber()), ry = abs(readNumber())
            _ = readNumber() // x-axis-rotation, always 0 here
            let largeArc = readFlag()
            let sweep = readFlag()
            let x = readNumber(), y = readNumber()
            let end = relative ? CGPoint(x: current.x + x, y: current.y + y) : CGPoint(x: x, y: y)
            let start = current

            guard rx != 0, ry != 0 else {
                path.addLine(to: end)
                current = end
                return
            }

            let x1p = (start.x - end.x) / 2
            let y1p = (start.y - end.y) / 2

            var rxs = rx, rys = ry
            let lambda = (x1p * x1p) / (rxs * rxs) + (y1p * y1p) / (rys * rys)
            if lambda > 1 {
                let s = lambda.squareRoot()
                rxs *= s
                rys *= s
            }

            let sign: CGFloat = (largeArc != sweep) ? 1 : -1
            let num = rxs * rxs * rys * rys - rxs * rxs * y1p * y1p - rys * rys * x1p * x1p
            let den = rxs * rxs * y1p * y1p + rys * rys * x1p * x1p
            let coef = sign * (max(0, num / den)).squareRoot()
            let cxp = coef * (rxs * y1p / rys)
            let cyp = coef * -(rys * x1p / rxs)

            let cx = cxp + (start.x + end.x) / 2
            let cy = cyp + (start.y + end.y) / 2

            func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
                let dot = ux * vx + uy * vy
                let len = (ux * ux + uy * uy).squareRoot() * (vx * vx + vy * vy).squareRoot()
                var ang = acos(max(-1, min(1, dot / len)))
                if ux * vy - uy * vx < 0 { ang = -ang }
                return ang
            }

            let theta1 = angle(1, 0, (x1p - cxp) / rxs, (y1p - cyp) / rys)
            var dtheta = angle((x1p - cxp) / rxs, (y1p - cyp) / rys, (-x1p - cxp) / rxs, (-y1p - cyp) / rys)
            if !sweep, dtheta > 0 { dtheta -= 2 * .pi }
            if sweep, dtheta < 0 { dtheta += 2 * .pi }

            path.addRelativeArc(center: CGPoint(x: cx, y: cy), radius: rxs, startAngle: theta1, delta: dtheta)
            current = end
        }
    }
}
