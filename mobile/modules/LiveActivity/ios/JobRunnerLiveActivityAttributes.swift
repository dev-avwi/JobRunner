import ActivityKit
import Foundation

// MIRROR of mobile/targets/JobRunnerLiveActivity/JobRunnerLiveActivityAttributes.swift
//
// ActivityKit matches activities between the host app and the widget extension
// by the qualified type name + Codable shape. Both targets need an identical
// declaration of this struct, so this file is a near-verbatim copy of the
// extension's attributes file. If you change one, change the other —
// otherwise the host app will start an activity the widget extension cannot
// decode, and the activity will fail silently at render time.
//
// The only difference between this file and the extension's: this copy lives
// in the host app (deployment target iOS 16.0) so the types need explicit
// @available(iOS 16.1, *) — the extension target is already 16.1+ and
// doesn't need the marker.
//
// Source of truth: mobile/targets/JobRunnerLiveActivity/JobRunnerLiveActivityAttributes.swift
@available(iOS 16.1, *)
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
