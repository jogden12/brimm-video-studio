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

/// Moves the app at `app` into `folder` as BRIMM Video Studio.app: it makes `folder` when it is not there, copies the app with
/// ditto to a hidden `.moving` copy beside the destination, takes the quarantine flag off that copy, gives an older copy at the
/// destination to `trash`, and renames the copy onto the destination. It gives nil, or the sentence to show when a step failed, and
/// then no `.moving` copy is left. The app it was copied from is left where it is.
func moveApp(from app: String, to folder: String, trash: (String) -> Bool) -> String? {
    let files = FileManager.default
    let destination = (folder as NSString).appendingPathComponent("\(appName).app")
    let moving = (folder as NSString).appendingPathComponent(".\(appName).app.moving")

    // A copy left by an earlier move that stopped part way is taken away first, so that ditto never merges into it.
    try? files.removeItem(atPath: moving)
    let moved: Bool = {
        guard (try? files.createDirectory(atPath: folder, withIntermediateDirectories: true)) != nil else { return false }
        guard ranCleanly("/usr/bin/ditto", [app, moving]) else { return false }
        guard ranCleanly("/usr/bin/xattr", ["-dr", "com.apple.quarantine", moving]) else { return false }
        if files.fileExists(atPath: destination) && !trash(destination) { return false }
        return (try? files.moveItem(atPath: moving, toPath: destination)) != nil
    }()
    if moved { return nil }
    try? files.removeItem(atPath: moving)
    return moveFailed
}
