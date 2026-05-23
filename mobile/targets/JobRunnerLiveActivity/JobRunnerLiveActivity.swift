import ActivityKit
import SwiftUI
import WidgetKit

// JobRunner palette — pulled verbatim from mobile/src/lib/theme.tsx
// dark-mode tokens. The Live Activity card always renders on a dark
// surface (#1C1C1E via .activityBackgroundTint), so we use the app's
// dark-mode values for contrast parity with the rest of the app.
private extension Color {
    static let cardBackground = Color(red: 0.11, green: 0.11, blue: 0.12)      // #1C1C1E
    static let inProgress     = Color(red: 0.239, green: 0.784, blue: 0.459)   // #3DC875
    static let onBreak        = Color(red: 0.961, green: 0.690, blue: 0.098)   // #F5B019
    static let completed      = Color(red: 0.078, green: 0.722, blue: 0.463)   // #14B876
    static let brandBlue      = Color(red: 0.169, green: 0.490, blue: 0.914)   // #2B7DE9 — keyline only
    static let secondaryText  = Color(red: 0.557, green: 0.557, blue: 0.576)   // #8E8E93
    static let tertiaryText   = Color(red: 0.282, green: 0.282, blue: 0.290)   // #48484A
}

struct JobRunnerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: JobRunnerLiveActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.cardBackground)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            // Expanded view (long-press): full card-like layout with the
            // brand logo on the leading edge, address stack in the centre,
            // elapsed timer on the trailing edge, and the status+customer
            // line spanning the bottom. The `.leading` brand badge uses
            // the same `fullColorLogo` helper as the lock screen so iOS 18+
            // can render it in colour where the system allows it.
            //
            // Compact (always-visible) + minimal: just the live state —
            // status-coloured dot on the left, monospaced timer on the
            // right. Apple's own compact islands match this pattern.
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BrandBadge()
                        .frame(width: 40, height: 40)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimerColumn(startedAt: context.attributes.startedAt, size: 18)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(AddressParts(address: context.attributes.address).street)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(AddressParts(address: context.attributes.address).suburbOrFallback)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.secondaryText)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    StatusLine(
                        status: context.state.status,
                        customerName: context.attributes.customerName,
                        size: 13
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                StatusDot(status: context.state.status, size: 14)
                    .padding(.leading, 2)
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 12, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.onBreak)
                    .frame(maxWidth: 56)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.trailing, 2)
            } minimal: {
                StatusDot(status: context.state.status)
            }
            .keylineTint(Color.brandBlue)
        }
    }
}

// MARK: - Lock-screen view

// Two columns: 48pt brand badge anchors the left, three text rows
// (address / suburb / status·customer) flex in the middle, oversized
// elapsed timer pinned right. One font family (system), two weights
// (regular + semibold/bold), three sizes (19 / 13 / 26). Uniform
// 14pt vertical and 16pt horizontal padding — no padding zoo.
private struct LockScreenView: View {
    let attributes: JobRunnerLiveActivityAttributes
    let state: JobRunnerLiveActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            BrandBadge()
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 4) {
                Text(AddressParts(address: attributes.address).street)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .fixedSize(horizontal: false, vertical: true)

                Text(AddressParts(address: attributes.address).suburbOrFallback)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)

                StatusLine(
                    status: state.status,
                    customerName: attributes.customerName,
                    size: 13
                )
                .padding(.top, 1)
            }

            Spacer(minLength: 8)

            TimerColumn(startedAt: attributes.startedAt, size: 24)
                .frame(minWidth: 78, alignment: .trailing)
                .layoutPriority(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

// MARK: - Address parsing

// Splits "26 Ocean Drive, Gordonvale QLD 4865" into a bold street headline
// and a muted suburb line. Falls back to "Active job" when no comma is
// present so the secondary line never collapses to empty and the card
// keeps its rhythmic 3-line content stack.
private struct AddressParts {
    let address: String

    var street: String {
        guard let comma = address.firstIndex(of: ",") else { return address }
        return String(address[..<comma]).trimmingCharacters(in: .whitespaces)
    }

    var suburbOrFallback: String {
        guard let comma = address.firstIndex(of: ",") else { return "Active job" }
        let s = String(address[address.index(after: comma)...]).trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? "Active job" : s
    }
}

// MARK: - Status + customer line

// Coloured status dot + plain-language label + interpunct + customer
// name. Folds the previous "action row" into the main content column
// so it doesn't need its own divider'd section.
private struct StatusLine: View {
    let status: JobStatus
    let customerName: String
    let size: CGFloat

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(accentColor)
                .frame(width: size * 0.46, height: size * 0.46)
            Text(label)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(accentColor)
                .lineLimit(1)
            if !customerName.isEmpty {
                Text("·")
                    .font(.system(size: size, weight: .semibold))
                    .foregroundStyle(Color.tertiaryText)
                Text(customerName)
                    .font(.system(size: size))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
    }

    private var label: String {
        switch status {
        case .inProgress: return "In progress"
        case .onBreak:    return "On break"
        case .completed:  return "Completed"
        }
    }

    private var accentColor: Color {
        switch status {
        case .inProgress: return .inProgress
        case .onBreak:    return .onBreak
        case .completed:  return .completed
        }
    }
}

// MARK: - Timer column

// Big elapsed time + small "elapsed" caption. `.fixedSize()` on the
// label guarantees it never wraps to "ELAPS / ED" regardless of column
// width. Timer text uses the on-break amber colour to read as "live
// counter" against the dark card — the colour itself is taken from the
// app's warning token, so it's brand-aligned, not invented.
private struct TimerColumn: View {
    let startedAt: Date
    let size: CGFloat

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(startedAt, style: .timer)
                .font(.system(size: size, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(Color.onBreak)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .fixedSize(horizontal: true, vertical: false)
            Text("elapsed")
                .font(.system(size: max(size * 0.38, 10), weight: .medium))
                .foregroundStyle(Color.tertiaryText)
                .fixedSize()
        }
    }
}

// MARK: - Brand badge

// JobRunner brand mark — a stylised runner figure on a brand-blue
// squircle. After five attempts to render the raster runner-figure
// PNG in colour on the iOS 26 Live Activity lock screen (template
// rendering intent, .renderingMode(.original), .compositingGroup(),
// brand-blue backing, widgetAccentedRenderingMode(.fullColor)), all
// approaches still got vibrancy-desaturated to grey. The lock-screen
// rendering pipeline does not honour widgetAccentedRenderingMode for
// Live Activity images — only Home Screen widgets do.
//
// Switching to an SF Symbol (`figure.run`) bypasses the desaturation
// pipeline entirely: SF Symbols render with explicit foregroundStyle
// across every Live Activity surface and every device. The runner
// figure concept survives — JobRunner *is* a runner — and the brand
// blue + white treatment is unambiguous as an app mark.
private struct BrandBadge: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                let cornerRadius = geo.size.width * 0.225 // iOS squircle ratio
                let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                shape.fill(Color.brandBlue)
                Image(systemName: "figure.run")
                    .font(.system(size: geo.size.width * 0.58, weight: .bold))
                    .foregroundStyle(.white)
                    .offset(x: geo.size.width * 0.02) // optical centring — figure.run tilts left
            }
        }
    }
}

// MARK: - Status dot (Dynamic Island compact/minimal)

// Status-coloured dot with a soft halo ring. Used in compact + minimal
// Dynamic Island slots where a logo can't render legibly at ~22pt /
// ~10pt. Reads as "the job is live" and shifts hue with the activity
// state — same palette as everywhere else in the card.
private struct StatusDot: View {
    let status: JobStatus
    var size: CGFloat? = nil

    var body: some View {
        if let size = size {
            dot.frame(width: size, height: size)
        } else {
            GeometryReader { geo in
                dot.frame(width: geo.size.width, height: geo.size.height)
            }
        }
    }

    private var dot: some View {
        Circle()
            .fill(accentColor)
            .overlay(
                Circle()
                    .stroke(accentColor.opacity(0.35), lineWidth: 2)
                    .blur(radius: 1.5)
                    .scaleEffect(1.3)
            )
    }

    private var accentColor: Color {
        switch status {
        case .inProgress: return .inProgress
        case .onBreak:    return .onBreak
        case .completed:  return .completed
        }
    }
}
