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
                // Three regions only — leading, trailing, bottom.
                // Apple's reference Live Activities never combine
                // .center with .leading + .trailing; doing so makes
                // the layout collapse and the regions don't render
                // (the "blank pill" symptom). Address + suburb +
                // status all live in the .bottom region as a single
                // vertical stack instead.
                DynamicIslandExpandedRegion(.leading) {
                    BrandBadge()
                        .frame(width: 38, height: 38)
                        .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(context.attributes.startedAt, style: .timer)
                            .font(.system(size: 20, weight: .bold, design: .rounded).monospacedDigit())
                            .foregroundStyle(Color.onBreak)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .multilineTextAlignment(.trailing)
                        Text("ELAPSED")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(1.4)
                            .foregroundStyle(Color.tertiaryText)
                            .lineLimit(1)
                    }
                    .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(AddressParts(address: context.attributes.address).street)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(AddressParts(address: context.attributes.address).suburbOrFallback)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.secondaryText)
                            .lineLimit(1)
                        // Match the lock-screen status pill treatment —
                        // Liquid Glass on iOS 26+, capsule fallback below.
                        HStack(spacing: 8) {
                            LiquidStatusPill(status: context.state.status)
                            if !context.attributes.customerName.isEmpty {
                                Text(context.attributes.customerName)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Color.secondaryText)
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                            }
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 6)
                    .padding(.top, 6)
                }
            } compactLeading: {
                // Logo on the left of the notch — small but recognisable
                // as the JobRunner mark. The raster may render monochrome
                // here too; that's accepted.
                BrandBadge()
                    .frame(width: 22, height: 22)
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
                // Minimal slot is ~36pt — no logo fits legibly. Show just
                // the live timer in brand amber so the user reads the
                // elapsed time at a glance.
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 11, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.onBreak)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .keylineTint(Color.brandBlue)
        }
    }
}

// MARK: - Lock-screen view

// Single-section card. Two-section + divider variant got clipped by
// the iOS Live Activity height ceiling on the lock screen (~120pt),
// which made the bottom row + timer disappear. Folding the status
// line back inside the centre VStack keeps every piece inside the
// allowed envelope.
//
// Three columns: 44pt brand badge anchors the left, address + suburb
// + status stack flexes in the middle (.frame(maxWidth: .infinity)
// so it greedily claims the remaining width), 72pt elapsed-timer
// column pinned right (fixed width so it never squeezes the centre).
private struct LockScreenView: View {
    let attributes: JobRunnerLiveActivityAttributes
    let state: JobRunnerLiveActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            // Brand badge with a soft halo — gives the mark presence
            // against the dark card surface without adding a hard
            // container shape (per Apple HIG).
            BrandBadge()
                .frame(width: 46, height: 46)

            VStack(alignment: .leading, spacing: 4) {
                Text(AddressParts(address: attributes.address).street)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .minimumScaleFactor(0.85)

                Text(AddressParts(address: attributes.address).suburbOrFallback)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)

                // Customer name on its own dedicated row (when present) —
                // promoted out of the status-pill row where it was
                // getting squeezed/clipped. Reads as the "for whom" line
                // between the address and the live-state pill.
                if !attributes.customerName.isEmpty {
                    Text(attributes.customerName)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .padding(.top, 1)
                }

                LiquidStatusPill(status: state.status)
                    .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Hairline separator anchors the timer as its own zone.
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(width: 0.5, height: 50)

            // Right column: elapsed timer + a "STARTED HH:MM" metadata
            // row that uses the same startedAt attribute formatted as
            // absolute time-of-day. Fills the previously-empty space
            // below the timer with a useful complementary piece of info
            // (elapsed = how long, started = when did it begin).
            VStack(alignment: .trailing, spacing: 6) {
                LiquidTimerColumn(startedAt: attributes.startedAt)
                HStack(spacing: 4) {
                    Text("STARTED")
                        .font(.system(size: 8, weight: .heavy))
                        .tracking(1.0)
                        .foregroundStyle(Color.tertiaryText)
                    Text(attributes.startedAt, style: .time)
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Color.secondaryText)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }
}

// Status helpers — pulled out of the deleted StatusLine wrapper so they
// can be reused inline from the lock-screen and Dynamic Island views.
private func statusColor(_ status: JobStatus) -> Color {
    switch status {
    case .inProgress: return .inProgress
    case .onBreak:    return .onBreak
    case .completed:  return .completed
    }
}

private func statusLabel(_ status: JobStatus) -> String {
    switch status {
    case .inProgress: return "In progress"
    case .onBreak:    return "On break"
    case .completed:  return "Completed"
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

// The JobRunner runner-figure logo, rendered without a container per
// Apple's Live Activity HIG. The asset catalog's PNG (now sourced
// from mobile/assets/logo.png, which has a genuinely transparent
// surround — RGBA(0,0,0,0) at the corners) lets the figure sit
// directly on the dark card surface with no white tile around it.
//
// Earlier passes used mobile/assets/icon.png by mistake — that file
// has a baked-in white background which was the actual source of
// the "grey tile" symptom on the lock screen.
private struct BrandBadge: View {
    var body: some View {
        Image("JobRunnerLogo")
            .renderingMode(.original)
            .resizable()
            .aspectRatio(contentMode: .fit)
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

// MARK: - Liquid Glass status pill (iOS 26+)
//
// On iOS 26 the pill uses the real `.glassEffect` Liquid Glass material
// — a tinted, light-bending capsule that reacts to the underlying card
// surface. Pre-iOS-26 falls back to a flat translucent capsule fill so
// the design degrades gracefully on older devices.
private struct LiquidStatusPill: View {
    let status: JobStatus

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(statusColor(status))
                .frame(width: 6, height: 6)
            Text(statusLabel(status).uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.8)
                .foregroundStyle(statusColor(status))
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .modifier(StatusPillBackground(color: statusColor(status)))
    }
}

private struct StatusPillBackground: ViewModifier {
    let color: Color

    // .glassEffect was unreliable inside the Live Activity render
    // context — caused the pill to drop out entirely on the lock
    // screen and expanded Dynamic Island. Falling back to a flat
    // tinted capsule which renders consistently.
    func body(content: Content) -> some View {
        content.background(
            Capsule().fill(color.opacity(0.15))
        )
    }
}

// MARK: - Liquid Glass timer column (iOS 26+)
//
// Wraps the elapsed timer + ELAPSED caption inside a Liquid Glass card
// on iOS 26+, so the right-hand "live data" zone reads as a distinct
// glass panel. The 14pt rounded-rect shape matches the card's outer
// corner radius at a smaller scale.
private struct LiquidTimerColumn: View {
    let startedAt: Date

    // Name retained for backwards compatibility — Liquid Glass backing
    // was removed because .glassEffect was unreliable inside the Live
    // Activity render context. Now just a plain elapsed-timer column.
    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(startedAt, style: .timer)
                .font(.system(size: 24, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(Color.onBreak)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .multilineTextAlignment(.trailing)
            Text("ELAPSED")
                .font(.system(size: 9, weight: .heavy))
                .tracking(1.4)
                .foregroundStyle(Color.tertiaryText)
                .lineLimit(1)
        }
        .frame(width: 92, alignment: .trailing)
    }
}
