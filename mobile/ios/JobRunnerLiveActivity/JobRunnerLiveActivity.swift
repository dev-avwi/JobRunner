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
                // All expanded content lives inside .bottom so the
                // expanded view sizes to the content height. Typography
                // is sized up to actually use the bubble's vertical
                // envelope instead of huddling small in the middle.
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 10) {
                        HStack(alignment: .center, spacing: 14) {
                            BrandBadge()
                                .frame(width: 46, height: 46)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(AddressParts(address: context.attributes.address).street)
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundStyle(.white)
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                                    .minimumScaleFactor(0.85)
                                Text(AddressParts(address: context.attributes.address).suburbOrFallback)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color.secondaryText)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            VStack(alignment: .trailing, spacing: 1) {
                                Text(context.attributes.startedAt, style: .timer)
                                    .font(.system(size: 26, weight: .bold, design: .rounded).monospacedDigit())
                                    .foregroundStyle(Color.onBreak)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.55)
                                    .multilineTextAlignment(.trailing)
                                Text("ELAPSED")
                                    .font(.system(size: 10, weight: .heavy))
                                    .tracking(1.4)
                                    .foregroundStyle(Color.tertiaryText)
                                    .lineLimit(1)
                            }
                            .frame(width: 100, alignment: .trailing)
                        }

                        HStack(spacing: 10) {
                            LiquidStatusPill(status: context.state.status)
                            if !context.attributes.customerName.isEmpty {
                                Text("·")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Color.tertiaryText)
                                Text(context.attributes.customerName)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.85))
                                    .lineLimit(1)
                                    .truncationMode(.tail)
                            }
                            Spacer(minLength: 8)
                            HStack(spacing: 4) {
                                Text("STARTED")
                                    .font(.system(size: 9, weight: .heavy))
                                    .tracking(1.0)
                                    .foregroundStyle(Color.tertiaryText)
                                Text(context.attributes.startedAt, style: .time)
                                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                                    .foregroundStyle(Color.secondaryText)
                                    .lineLimit(1)
                            }
                            // Reserve natural width — without this the
                            // status pill on the left expands and chops
                            // off the "am"/"pm" suffix.
                            .fixedSize()
                        }
                    }
                    // Inner horizontal padding overrides whatever
                    // contentMargins(.all, 12, for: .expanded) actually
                    // applies — iOS doesn't honour that modifier
                    // consistently on the .bottom region. 16pt inside
                    // here gives visible breathing room from the bubble
                    // edges regardless of system behaviour, so the
                    // STARTED time and timer never crowd the right
                    // side and the pill never kisses the left.
                    .padding(.horizontal, 16)
                    .padding(.vertical, 4)
                }
            } compactLeading: {
                // Logo on the left of the notch — small but recognisable
                // as the JobRunner mark. The raster may render monochrome
                // here too; that's accepted.
                BrandBadge()
                    .frame(width: 22, height: 22)
                    .padding(.leading, 2)
            } compactTrailing: {
                // Cap the trailing slot to ~MM:SS width so iOS doesn't
                // reserve the full HH:MM:SS envelope that `style: .timer`
                // asks for by default. Past 99:59 the digits scale down
                // to stay inside the frame instead of the pill widening —
                // acceptable trade-off for a job timer (a single shift
                // rarely exceeds ~10h, and at that point the user is on
                // the lock-screen card anyway, not the compact pill).
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 12, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.onBreak)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 44, alignment: .trailing)
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
            // Tighten the iOS-default content margins inside the
            // expanded bubble. Default is ~16-20pt all around (leaves
            // dead space at the edges); 8pt was too tight (content
            // kissed the bubble edges); 12pt sits right between —
            // breathing room without empty perimeter.
            .contentMargins(.all, 12, for: .expanded)
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
        // Two-row card that anchors content to the top and bottom of
        // whatever vertical envelope the system gives the Live
        // Activity. Top row carries the identity + headline + timer;
        // bottom row carries the live state + the "for whom" / "started"
        // metadata. A Spacer pushes them apart so the card fills its
        // height naturally instead of floating one HStack in the middle.
        VStack(spacing: 0) {
            // ─── TOP ROW ─────────────────────────────────────────────
            HStack(alignment: .center, spacing: 14) {
                BrandBadge()
                    .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 2) {
                    Text(AddressParts(address: attributes.address).street)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .minimumScaleFactor(0.85)

                    Text(AddressParts(address: attributes.address).suburbOrFallback)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.secondaryText)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 1) {
                    Text(attributes.startedAt, style: .timer)
                        .font(.system(size: 28, weight: .bold, design: .rounded).monospacedDigit())
                        .foregroundStyle(Color.onBreak)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                        .multilineTextAlignment(.trailing)
                    Text("ELAPSED")
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(1.4)
                        .foregroundStyle(Color.tertiaryText)
                        .lineLimit(1)
                }
                .frame(width: 104, alignment: .trailing)
            }

            // Spacer with minLength keeps a guaranteed gap between
            // rows on the *compact* lock-screen card (where iOS gives
            // the activity a small envelope), and stretches to use the
            // *taller* lock-screen envelope when the system has more
            // room — killing the previous mid-card dead zone.
            Spacer(minLength: 12)

            // Hairline that visually links the two rows so they read
            // as one card, not two stacked floaters.
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)
                .padding(.bottom, 10)

            // ─── BOTTOM ROW ──────────────────────────────────────────
            HStack(alignment: .center, spacing: 10) {
                LiquidStatusPill(status: state.status)

                if !attributes.customerName.isEmpty {
                    Text("·")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.tertiaryText)
                    Text(attributes.customerName)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }

                Spacer(minLength: 8)

                HStack(spacing: 4) {
                    Text("STARTED")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1.0)
                        .foregroundStyle(Color.tertiaryText)
                    Text(attributes.startedAt, style: .time)
                        .font(.system(size: 11, weight: .semibold).monospacedDigit())
                        .foregroundStyle(Color.secondaryText)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
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
