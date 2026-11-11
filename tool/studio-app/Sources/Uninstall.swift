// Uninstall: the app asks busy.js whether this Mac is at work, and only when it is not runs install.sh --remove, which stops both
// launch agents and deletes their files and leaves the folders, the settings and the model. It imports only Foundation, so
// studio-check is compiled from it.
import Foundation

/// What Uninstall gave: the background job was removed, or a sentence to show.
enum Uninstalled: Equatable {
    case removed
    case notice(String)
}

/// What the window says when busy.js refused and said nothing.
let cannotTell = "BRIMM Video Studio could not tell whether it is at work, so nothing was stopped."

/// What the window says when install.sh --remove failed.
let notStopped = "BRIMM Video Studio could not stop its background job. Open it again and choose Repair."

/// Uninstall's two command lines, both from inside the app: busy.js idle-why, then install.sh --remove, which takes neither
/// --tools nor --app.
func uninstallCommands(app: String) -> [Command] {
    let tool = (studioFolder(app: app) as NSString).appendingPathComponent("tool")
    return [
        Command(program: (toolsFolder(app: app) as NSString).appendingPathComponent("node"), arguments: [(tool as NSString).appendingPathComponent("busy.js"), "idle-why"]),
        Command(program: "/bin/zsh", arguments: [(tool as NSString).appendingPathComponent("install.sh"), "--remove"]),
    ]
}

/// The first line of `text` with no blank around it, or nil when there is none.
private func firstLine(_ text: String) -> String? {
    let line = text.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: "\n", maxSplits: 1).first.map(String.init)
    let trimmed = line?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? nil : trimmed
}

/// Uninstall for the app at `app`. A stand-in build (`fake`) runs nothing and gives .removed. Otherwise `run` starts busy.js
/// idle-why: any status but 0 gives its first line of stdout, else of stderr, else `cannotTell`, and nothing is stopped. Then it
/// starts install.sh --remove: 0 gives .removed, anything else `notStopped`.
func uninstall(app: String, fake: Bool, run: (Command) -> (status: Int32, out: String, err: String)) -> Uninstalled {
    if fake { return .removed }
    let commands = uninstallCommands(app: app)
    let asked = run(commands[0])
    if asked.status != 0 {
        return .notice(firstLine(asked.out) ?? firstLine(asked.err) ?? cannotTell)
    }
    return run(commands[1]).status == 0 ? .removed : .notice(notStopped)
}
