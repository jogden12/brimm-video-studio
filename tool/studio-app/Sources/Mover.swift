// The move to Applications: the app copies itself into an Applications folder, takes the quarantine flag off the copy, and puts it
// in place of an older copy. It imports only Foundation, so studio-check is compiled from it.
import Foundation

/// What the window says when the move fails.
let moveFailed = "BRIMM Video Studio could not be moved to your Applications folder. Drag it there in Finder, then open it again."

/// Runs `program` with `arguments`, its output and error passed over, and says whether it ended with 0.
private func ranCleanly(_ program: String, _ arguments: [String]) -> Bool {
    let child = Process()
    child.executableURL = URL(fileURLWithPath: program)
    child.arguments = arguments
    child.standardOutput = FileHandle.nullDevice
    child.standardError = FileHandle.nullDevice
    do {
        try child.run()
    } catch {
        return false
    }
    child.waitUntilExit()
    return child.terminationReason == .exit && child.terminationStatus == 0
}

/// What the window says after the line busy.js gave, when this Mac is at work and an older copy is not replaced.
let movedNothingAtWork = "Nothing was moved: try again when it is done."

/// What the window says when busy.js refused and said nothing, and an older copy is not replaced.
let cannotTellMove = "BRIMM Video Studio could not tell whether it is at work, so nothing was moved."

/// Whether this Mac is at work, asked of the copy at `app` before an older copy is replaced: `run` starts that copy's own busy.js
/// idle-why (Uninstall's first command). Status 0 gives nil. Any other status gives its first line, of stdout or else of stderr,
/// and `movedNothingAtWork`, or `cannotTellMove` when it printed nothing.
func atWorkBeforeMove(app: String, run: (Command) -> (status: Int32, out: String, err: String)) -> String? {
    let asked = run(uninstallCommands(app: app)[0])
    if asked.status == 0 { return nil }
    guard let line = firstLine(asked.out) ?? firstLine(asked.err) else { return cannotTellMove }
    return "\(line) \(movedNothingAtWork)"
}

/// Whether something is at `path`, a link that leads nowhere included: the link itself is looked at, never followed.
private func somethingAt(_ path: String) -> Bool {
    var status = stat()
    return lstat(path, &status) == 0
}

/// Moves the app at `app` into `folder` as BRIMM Video Studio.app: it makes `folder` when it is not there, copies the app with
/// ditto to a hidden `.moving` copy beside the destination, and takes the quarantine flag off that copy. When something is already
/// at the destination, `idle` is asked whether this Mac is at work (nil when it is not, else the sentence to show), and only then is
/// the older copy given to `trash` and the copy renamed onto the destination. It gives nil, or the sentence to show when a step
/// failed or `idle` said one, and then no `.moving` copy is left and nothing was trashed or renamed. The app it was copied from is
/// left where it is.
func moveApp(from app: String, to folder: String, trash: (String) -> Bool, idle: () -> String?) -> String? {
    let files = FileManager.default
    let destination = (folder as NSString).appendingPathComponent("\(appName).app")
    let moving = (folder as NSString).appendingPathComponent(".\(appName).app.moving")

    // A copy left by an earlier move that stopped part way is taken away first, so that ditto never merges into it.
    try? files.removeItem(atPath: moving)
    var said: String? = moveFailed
    let moved: Bool = {
        guard (try? files.createDirectory(atPath: folder, withIntermediateDirectories: true)) != nil else { return false }
        guard ranCleanly("/usr/bin/ditto", [app, moving]) else { return false }
        guard ranCleanly("/usr/bin/xattr", ["-dr", "com.apple.quarantine", moving]) else { return false }
        if somethingAt(destination) {
            if let busy = idle() {
                said = busy
                return false
            }
            if !trash(destination) { return false }
        }
        return (try? files.moveItem(atPath: moving, toPath: destination)) != nil
    }()
    if moved { return nil }
    try? files.removeItem(atPath: moving)
    return said
}
