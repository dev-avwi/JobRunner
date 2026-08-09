import ActivityKit
import ExpoModulesCore
import Foundation

// LiveActivityModule
// ------------------
// Bridges ActivityKit to the JS layer. Owns at most one in-flight
// Activity<JobRunnerLiveActivityAttributes> at a time; starting a new job
// retires the previous one, so JS callers don't need to track activity IDs.
//
// v1 is local-update only — pushType is nil and APNs is not wired up. The
// extension target does not need to change to add APNs later; only this
// module's start() and the server side.
//
// Note on availability: the host app's deployment target is iOS 16.0, but
// ActivityKit requires 16.1 and the `Activity.request(attributes:content:)`
// signature requires 16.2. The Module class itself can't be marked
// @available — Expo's module registry instantiates it unconditionally at
// launch — so `currentActivity` is type-erased to `Any?` and re-cast inside
// @available blocks at each call site.
public class LiveActivityModule: Module {
    private var currentActivity: Any?

    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        OnCreate {
            NSLog("[LA-SWIFT] OnCreate — module instantiated")
            // Reattach to an in-flight activity from a prior app session so
            // update()/end() can target it without JS knowing its ID. The
            // OS keeps activities alive across app launches up to 8h or
            // their staleDate, whichever comes first.
            if #available(iOS 16.2, *) {
                let reattached = Activity<JobRunnerLiveActivityAttributes>.activities.first
                self.currentActivity = reattached
                NSLog("[LA-SWIFT] OnCreate — reattached activity: %@", reattached?.id ?? "none")
            } else {
                NSLog("[LA-SWIFT] OnCreate — running on iOS < 16.2, Live Activities disabled")
            }
        }

        AsyncFunction("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
                NSLog("[LA-SWIFT] areActivitiesEnabled -> %@", enabled ? "YES" : "NO")
                return enabled
            }
            NSLog("[LA-SWIFT] areActivitiesEnabled -> NO (iOS < 16.2)")
            return false
        }

        AsyncFunction("start") { (job: JobPayload) async throws -> String in
            NSLog("[LA-SWIFT] start called — id=%@ address=%@ client=%@", job.id, job.address, job.clientName)

            guard #available(iOS 16.2, *) else {
                NSLog("[LA-SWIFT] start FAILED — iOS < 16.2")
                throw UnsupportedOSException()
            }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                NSLog("[LA-SWIFT] start FAILED — activities not authorized (Settings → app → Live Activities)")
                throw NotAuthorizedException()
            }

            // One activity at a time — end the previous before starting the
            // new one. .immediate so the old one disappears instantly rather
            // than lingering next to the new one.
            if let existing = self.currentActivity as? Activity<JobRunnerLiveActivityAttributes> {
                NSLog("[LA-SWIFT] start — ending existing activity %@ before starting new", existing.id)
                await existing.end(nil, dismissalPolicy: .immediate)
                self.currentActivity = nil
            }

            let attributes = JobRunnerLiveActivityAttributes(
                jobId: job.id,
                address: job.address,
                customerName: job.clientName,
                startedAt: Date()
            )
            let initialState = JobRunnerLiveActivityAttributes.ContentState(status: .inProgress)

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: initialState, staleDate: nil),
                    pushType: nil
                )
                self.currentActivity = activity
                NSLog("[LA-SWIFT] start SUCCESS — activity id=%@", activity.id)
                return activity.id
            } catch {
                NSLog("[LA-SWIFT] start FAILED — Activity.request threw: %@", String(describing: error))
                throw StartFailedException(error.localizedDescription)
            }
        }

        AsyncFunction("update") { (status: String) async throws in
            NSLog("[LA-SWIFT] update called — status=%@", status)

            guard #available(iOS 16.2, *) else {
                NSLog("[LA-SWIFT] update FAILED — iOS < 16.2")
                throw UnsupportedOSException()
            }
            guard let activity = self.currentActivity as? Activity<JobRunnerLiveActivityAttributes> else {
                NSLog("[LA-SWIFT] update FAILED — no active activity")
                throw NoActiveActivityException()
            }
            guard let jobStatus = JobStatus(rawValue: status) else {
                NSLog("[LA-SWIFT] update FAILED — invalid status %@", status)
                throw InvalidStatusException(status)
            }

            let newState = JobRunnerLiveActivityAttributes.ContentState(status: jobStatus)
            await activity.update(.init(state: newState, staleDate: nil))
            NSLog("[LA-SWIFT] update SUCCESS — activity=%@ status=%@", activity.id, status)
        }

        AsyncFunction("end") { () async in
            NSLog("[LA-SWIFT] end called")

            guard #available(iOS 16.2, *) else {
                NSLog("[LA-SWIFT] end — no-op (iOS < 16.2)")
                return
            }
            guard let activity = self.currentActivity as? Activity<JobRunnerLiveActivityAttributes> else {
                NSLog("[LA-SWIFT] end — no-op (no active activity)")
                return
            }

            // Dismiss immediately so the card clears from BOTH the Dynamic
            // Island AND the Lock Screen the moment the timer stops/cancels.
            // Previously this used `.after(now + 30 min)`, which removed the
            // Dynamic Island instantly but left the "completed" card stuck on
            // the Lock Screen for half an hour — users read that as "cancel
            // didn't work".
            let finalState = JobRunnerLiveActivityAttributes.ContentState(status: .completed)
            await activity.end(
                .init(state: finalState, staleDate: nil),
                dismissalPolicy: .immediate
            )
            self.currentActivity = nil
            NSLog("[LA-SWIFT] end SUCCESS — activity=%@ dismissed", activity.id)
        }
    }
}

internal struct JobPayload: Record {
    @Field var id: String = ""
    @Field var address: String = ""
    @Field var clientName: String = ""
}

internal final class UnsupportedOSException: Exception {
    override var reason: String {
        "Live Activities require iOS 16.2 or later."
    }
}

internal final class NotAuthorizedException: Exception {
    override var reason: String {
        "Live Activities are disabled for this app in Settings."
    }
}

internal final class NoActiveActivityException: Exception {
    override var reason: String {
        "No Live Activity is currently running."
    }
}

internal final class StartFailedException: GenericException<String> {
    override var reason: String {
        "Failed to start Live Activity: \(param)"
    }
}

internal final class InvalidStatusException: GenericException<String> {
    override var reason: String {
        "Unknown job status: '\(param)'. Expected one of: in_progress, on_break, completed."
    }
}
