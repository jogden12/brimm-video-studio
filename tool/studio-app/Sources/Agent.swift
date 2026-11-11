// The background job: what the app does when launchd starts it with --agent. It starts the node the app carries on unedited.js as
// its child, passes on the signals launchd sends, and ends with node's status. It creates no NSApplication, shows nothing and reads
// no file. It imports only Foundation.
import Foundation

/// The signals the job passes on to node: launchd stops a job with TERM, and a Terminal sends INT and HUP.
private let passedOn: [Int32] = [SIGTERM, SIGINT, SIGHUP]

/// Runs node on unedited.js with `rest` and gives back node's status, or 128 plus the signal's number when a signal ended it. Node
/// has the app's own environment, unchanged, since launchd's plist sets PATH and unedited.js reads XPC_SERVICE_NAME, and the app's
/// own output and error, so its lines go to the log launchd names. It gives back 1, having said why on stderr, when node cannot be
/// started.
func runAgent(rest: [String], app: String) -> Int32 {
    let command = agentCommand(rest: rest, app: app)
    let child = Process()
    child.executableURL = URL(fileURLWithPath: command.program)
    child.arguments = command.arguments

    // Each signal is ignored by the job itself and watched on a queue of its own, before node starts, so that none is lost and
    // none ends the job before node does. Node starts with the default dispositions.
    let queue = DispatchQueue(label: "com.thebrimm.video-studio.agent-signals")
    var sources: [DispatchSourceSignal] = []
    for number in passedOn {
        signal(number, SIG_IGN)
        let source = DispatchSource.makeSignalSource(signal: number, queue: queue)
        source.setEventHandler {
            if child.isRunning { kill(child.processIdentifier, number) }
        }
        source.resume()
        sources.append(source)
    }
    defer { sources.forEach { $0.cancel() } }

    do {
        try child.run()
    } catch {
        // The error's own words usually end with a full stop, and the sentence gives its own.
        var words = error.localizedDescription
        while words.hasSuffix(".") { words.removeLast() }
        FileHandle.standardError.write(Data("BRIMM Video Studio could not start its background job: \(words).\n".utf8))
        return 1
    }
    child.waitUntilExit()
    let status = child.terminationStatus
    return child.terminationReason == .uncaughtSignal ? 128 + status : status
}
