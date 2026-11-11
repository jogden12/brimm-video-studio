// The app's program. With --agent it is the background job, and nothing of AppKit is touched; otherwise it is the window.
import AppKit

switch launchOf(Array(CommandLine.arguments.dropFirst())) {
case .agent(let rest):
    exit(runAgent(rest: rest, app: Bundle.main.bundlePath))
case .window:
    let application = NSApplication.shared
    let delegate = AppDelegate()
    application.delegate = delegate
    application.setActivationPolicy(.regular)
    // The application holds its delegate weakly, so the delegate is kept for as long as the app runs.
    withExtendedLifetime(delegate) { application.run() }
}
