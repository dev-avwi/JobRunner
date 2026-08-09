import SwiftUI
import WidgetKit

// The widget bundle is the entry point for an iOS app extension that contains
// widgets and/or live activities. Even if we only ship one widget, the
// bundle must exist and be annotated @main.
@main
struct JobRunnerLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        JobRunnerLiveActivity()
    }
}
