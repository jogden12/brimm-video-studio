// Updates: every decision of a check for updates, and its sentences. When the check waits, when it goes, when it gives up, what a
// quit does while it is under way, and where Check for Updates may be chosen. It imports only Foundation and names no type of the
// updater's own framework, so studio-check is compiled from it.
import Foundation

/// Where a check for updates is: none, waiting for nothing to be at work, offered to the update's own window, an update unpacked,
/// holding its install until nothing is at work, and installing.
enum UpdatePhase: String {
    case none, waiting, offered, unpacked, holding, installing
}

/// What follows one answer of busy.js idle-why: wait with its line, ask again, go, or give up because it could not be told.
enum GateNext: Equatable {
    case wait(String)
    case again
    case go
    case cannotTell
}

/// busy.js's own line for a Mac it could not look at, its CANNOT_TELL.
let busyCannotTell = "Whether anything is at work on this Mac could not be told."

/// What follows busy.js idle-why's `status` and its stdout `out`. `idleBefore` is whether the answer before it was idle too: only two
/// idle answers in a row go. A status of 1 is busy, with its first line or a line of its own, unless that first line is busy.js's
/// own cannot-tell line. Any other status cannot tell.
func gateNext(status: Int32, out: String, idleBefore: Bool) -> GateNext {
    switch status {
    case 0:
        return idleBefore ? .go : .again
    case 1:
        let line = firstLine(out)
        if line == busyCannotTell { return .cannotTell }
        return .wait(line ?? "Something is at work on this Mac.")
    default:
        return .cannotTell
    }
}

/// What a quit does in a phase: end now, end the check first (take the marker away and ask the job to look), or hold the quit until
/// nothing is at work.
enum UpdateQuit: String {
    case now, end, hold
}

/// The quit rule while a check is under way. From Offered on, the update's own window may install at any quit, so a quit is held until nothing is at work.
func updateQuit(_ phase: UpdatePhase) -> UpdateQuit {
    switch phase {
    case .none, .installing: return .now
    case .waiting: return .end
    case .offered, .unpacked, .holding: return .hold
    }
}

/// Whether Check for Updates may be chosen. `failure` is the code of the run's failure, `colon` for the shell's own refusal of a
/// colon in the app's path, and nil when nothing failed. Never in a stand-in build and never while a check is under way. Otherwise
/// on the status screen, on the setup screen while a run is at a question, on the updating and repairing screens once their run has
/// failed, and on the refused screen unless it is the development Mac or a colon. Every other screen gives false.
func mayCheckForUpdates(screen: Screen, quit: Quit, failure: String?, fake: Bool, phase: UpdatePhase) -> Bool {
    if fake || phase != .none { return false }
    switch screen {
    case .status: return true
    case .setup: return quit == .cancel
    case .updating, .repairing: return quit == .now && failure != nil
    case .refused: return failure != "dev" && failure != "colon"
    default: return false
    }
}

/// Whether a link that asks for a check is kept until the screen after: true on the screens that pass by themselves.
func keepsUpdatesAsk(screen: Screen) -> Bool {
    switch screen {
    case .checking, .repairing, .updating: return true
    default: return false
    }
}

/// How often the marker is written again, and the longest the check holds new work back, in seconds.
let updateMarkEvery = 30.0
let updateMarkLimit = 1800.0

/// Whether the marker is due to be written again at `now`, last written at `lastMarked`. Where it is `limited`, it is written only
/// for half an hour after `began`.
func markDue(now: Double, lastMarked: Double, began: Double, limited: Bool) -> Bool {
    guard now - lastMarked >= updateMarkEvery else { return false }
    return !limited || now - began < updateMarkLimit
}

/// Whether a check that began at `began` has waited half an hour by `now`.
func waitedTooLong(now: Double, began: Double) -> Bool {
    now - began >= updateMarkLimit
}

/// The channels the build may take, from its build.json: the beta channel for a beta build, and none for any other.
func allowedChannels(build: Data) -> [String] {
    guard let object = (try? JSONSerialization.jsonObject(with: build)) as? [String: Any], object["channel"] as? String == "beta" else {
        return []
    }
    return ["beta"]
}

/// busy.js's two command lines for the marker, from inside the app as Uninstall's idle-why is: updating begin, and updating end
/// --look. Nil where the engine's own command line is nil, for an app that is not absolute or holds a colon.
func updatingCommands(app: String) -> (begin: Command, end: Command)? {
    guard engineCommand(run: .status, app: app) != nil else { return nil }
    let node = (toolsFolder(app: app) as NSString).appendingPathComponent("node")
    let busy = (((studioFolder(app: app) as NSString).appendingPathComponent("tool")) as NSString).appendingPathComponent("busy.js")
    return (
        begin: Command(program: node, arguments: [busy, "updating", "begin"]),
        end: Command(program: node, arguments: [busy, "updating", "end", "--look"])
    )
}

// MARK: The sentences

let updatesHeading = "Check for Updates"
let updatesWaiting = "BRIMM Video Studio looks for a newer version once nothing is at work on this Mac. New videos wait in the drop folder until then."
let updatesOffered = "The check for updates is in its own window."
let updatesUnpacked = "The update is ready. It is installed when BRIMM Video Studio closes, or when you choose Install now."
let updatesHolding = "The update is installed once nothing is at work on this Mac."
let updatesCannotTell = "BRIMM Video Studio could not tell whether it is at work, so it did not look for an update."
let updatesWaitedTooLong = "BRIMM Video Studio waited half an hour for the work on this Mac to end, so it did not look for an update. Choose Check for Updates… again later."
let updatesCannotStart = "BRIMM Video Studio could not look for updates. Open it again and choose Check for Updates… once more."
let updatesStandIn = "This build's setup is a stand-in, so it does not look for updates."

// The buttons.
let updatesNotNow = "Not now"
let updatesShowWindow = "Show the update window"
let updatesInstallNow = "Install now"
