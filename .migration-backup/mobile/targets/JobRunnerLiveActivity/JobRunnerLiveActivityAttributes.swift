import ActivityKit
import Foundation

// ActivityAttributes describe the data the Live Activity uses. Apple splits
// these into two parts:
//
//   - Top-level fields (jobId, address, customerName, startedAt) are FIXED
//     for the activity's lifetime. They cannot be changed once start()
//     is called. Put anything immutable here.
//
//   - ContentState fields CAN be updated during the activity via
//     Activity.update(...). Put anything that changes (status, ETA, etc.)
//     here.
//
// IMPORTANT: This struct's field names and types MUST stay in sync with the
// `Job` payload the JS side sends through the Expo module bridge. If you
// rename a field here, rename it in the TS side too — otherwise the JSON
// decoding from JS will silently fail and the activity won't start.
public struct JobRunnerLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var status: JobStatus

        public init(status: JobStatus) {
            self.status = status
        }
    }

    public let jobId: String
    public let address: String
    public let customerName: String
    public let startedAt: Date

    public init(jobId: String, address: String, customerName: String, startedAt: Date) {
        self.jobId = jobId
        self.address = address
        self.customerName = customerName
        self.startedAt = startedAt
    }
}

public enum JobStatus: String, Codable, Hashable {
    case inProgress = "in_progress"
    case onBreak = "on_break"
    case completed = "completed"
}
