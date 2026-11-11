// The shell's pure decisions: the engine's lines, the engine's and the background job's command lines, the app's paths, and which
// screen comes next. It imports only Foundation, so studio-check is compiled from it and node's tests ask it each answer.
import Foundation

// MARK: The shell's fixed names

let appName = "BRIMM Video Studio"
let agentLabel = "com.thebrimm.unedited"
let guideName = "BRIMM Video Studio Getting Started"
let workFolderName = "BRIMM Video Work"

/// What the window says when the engine ends without a done or an error event: the engine's own last-resort words.
let crashMessage = "BRIMM Video Studio's setup stopped on a fault of its own."
let crashAdvice = "Open BRIMM Video Studio and choose Repair."

/// What the refused screen, which offers no Repair, advises for a failure of code `engine`: install.sh's DAMAGED.
let damagedAdvice = "This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair."

/// The time, in seconds, between one of the shell's checks and the next.
let checkEvery = 3.0

/// `path` with `parts` after it, each joined with one slash.
private func joined(_ path: String, _ parts: String...) -> String {
    parts.reduce(path) { ($0 as NSString).appendingPathComponent($1) }
}

// MARK: Lines

/// Splits the engine's stdout into lines. A line ends at byte 10 only, so U+2028, U+2029 and U+0085 stay inside it; one byte 13
/// just before the 10 is dropped. Bytes after the last 10 wait here until more come, and `rest()` gives them at the end.
struct LineSplitter {
    private var waiting: [UInt8] = []

    init() {}

    /// The whole lines that `bytes` completes, without their line ends. An empty line is given as empty data.
    mutating func feed(_ bytes: Data) -> [Data] {
        waiting.append(contentsOf: bytes)
        var lines: [Data] = []
        var start = 0
        while let end = waiting[start...].firstIndex(of: 10) {
            var last = end
            if last > start && waiting[last - 1] == 13 { last -= 1 }
            lines.append(Data(waiting[start..<last]))
            start = end + 1
        }
        waiting.removeFirst(start)
        return lines
    }

    /// The bytes after the last line feed, which are then no longer kept.
    mutating func rest() -> Data {
        let left = Data(waiting)
        waiting = []
        return left
    }
}

// MARK: Command lines

/// The engine runs the shell starts. It never starts `update`: that is Phase 7's.
enum Run: String {
    case setup, repair, status
}

struct Command {
    let program: String
    let arguments: [String]
}

/// The folder of the node the app carries.
func toolsFolder(app: String) -> String { joined(app, "Contents", "Resources", "node", "bin") }

/// The copy of Studio the app carries.
func studioFolder(app: String) -> String { joined(app, "Contents", "Resources", "Studio") }

/// The engine's command line for `run`, always from inside the app; nil when `app` is not absolute or holds a colon, which
/// would break the PATH the engine is given.
func engineCommand(run: Run, app: String) -> Command? {
    guard app.hasPrefix("/"), !app.contains(":") else { return nil }
    let tools = toolsFolder(app: app)
    return Command(
        program: joined(tools, "node"),
        arguments: [
            joined(studioFolder(app: app), "tool", "setup", "engine.js"),
            "--run", run.rawValue, "--app", app, "--tools", tools, "--protocol", "1",
        ])
}

/// The environment the engine and the background job are given, built from scratch so that nothing stray, such as NODE_OPTIONS,
/// reaches node.
func childEnvironment(from: [String: String], home: String, app: String) -> [String: String] {
    var made = ["HOME": home, "LANG": "en_US.UTF-8", "PATH": "\(toolsFolder(app: app)):/usr/bin:/bin:/usr/sbin:/sbin"]
    for name in ["USER", "LOGNAME", "TMPDIR"] {
        if let value = from[name] { made[name] = value }
    }
    return made
}

/// How the app was started: as the background job, when its first argument is `--agent`, or as the window.
enum Launch: Equatable {
    case agent([String])
    case window
}

/// What the app's arguments, its own program's name left out, ask for.
func launchOf(_ arguments: [String]) -> Launch {
    guard arguments.first == "--agent" else { return .window }
    return .agent(Array(arguments.dropFirst()))
}

/// The background job's command line: the app's node with the app's unedited.js and then `rest`.
func agentCommand(rest: [String], app: String) -> Command {
    Command(program: joined(toolsFolder(app: app), "node"), arguments: [joined(studioFolder(app: app), "tool", "unedited.js")] + rest)
}

// MARK: Where the app is

/// Whether macOS runs this copy from a translocated, read-only place.
func isTranslocated(_ path: String) -> Bool { path.contains("/AppTranslocation/") }

/// The Applications folder the app moves itself into: /Applications when it can be written to, else the home's own.
func moveTarget(home: String, systemWritable: Bool) -> String {
    systemWritable ? "/Applications" : joined(home, "Applications")
}

/// The copy of the app in /Applications or in the home's Applications that exists and is not `app` itself; nil when neither is.
func otherCopy(of app: String, home: String, exists: (String) -> Bool) -> String? {
    let bundle = "\(appName).app"
    let me = app.count > 1 && app.hasSuffix("/") ? String(app.dropLast()) : app
    return [joined("/Applications", bundle), joined(home, "Applications", bundle)].first { $0 != me && exists($0) }
}

/// The background job's launch agent file.
func agentFile(home: String) -> String { joined(home, "Library", "LaunchAgents", "\(agentLabel).plist") }

/// The folder that holds the Getting Started guide: the home's BRIMM Video Work, or, in a stand-in build, the stand-in's own folder
/// in `temp`, the app's temporary folder, where it writes its guide.
func guideFolder(home: String, fake: Bool, temp: String) -> String {
    fake ? joined(temp, "brimm-fake-engine") : joined(home, workFolderName)
}

/// The Getting Started guide in `folder`, and where the shell prints its PDF beside it.
func guidePaths(folder: String) -> (html: String, pdf: String) {
    (joined(folder, "\(guideName).html"), joined(folder, "\(guideName).pdf"))
}

/// Where the setup writes the Getting Started guide, and where the shell prints its PDF.
func guidePaths(home: String) -> (html: String, pdf: String) {
    guidePaths(folder: joined(home, workFolderName))
}

// MARK: What comes next

enum Next: String {
    case move, refused, setup, repair, twoCopies, status
}

/// The screen that follows a status. `needs` is the status's own word ("setup", "repair" or "nothing"), `failed` says the status
/// run ended with an error, `chosen` is the run the person asked for, and `other` says another copy of the app is there.
func nextStep(translocated: Bool, needs: String?, failed: Bool, chosen: Run?, other: Bool) -> Next {
    if translocated { return .move }
    if failed { return .refused }
    switch needs {
    case "setup": return .setup
    case "repair": return other ? .twoCopies : .repair
    case "nothing": return chosen == .repair ? .repair : .status
    default: return .refused
    }
}

// MARK: Links

/// The action a link to the app asks for: "check-for-updates" for brimm-video-studio://check-for-updates in any letter case, else nil.
func urlAction(_ url: String) -> String? {
    guard let parts = URLComponents(string: url),
        parts.scheme?.lowercased() == "brimm-video-studio",
        parts.host?.lowercased() == "check-for-updates"
    else { return nil }
    return "check-for-updates"
}
