// "Choose a Folder.app", the helper inside "Move to Studio.app": it shows macOS's own folder chooser and reports the folder picked.
// It is an app, started through LaunchServices (`open`), so that macOS brings it in front with the keyboard.
//   First way:  <message> <start folder> <result file> <process id>
//     It writes <result file>.part, then renames it to <result file>: "path\n<whole path>\n", "cancel\n", or "linebreak\n" when the
//     path holds a line break. It ends 0 once the file is written, and 2 (one line on stderr) when it cannot be written. It ends
//     with the process whose id it is given: 2 if that process is already gone.
//   Second way: <message> <start folder>
//     It prints the whole path and ends 0; Cancel ends 1; a path with a line break ends 3 with one line.
// Either way, fewer than two arguments, or a start folder that is not there, ends 2 with one line on stderr and opens no window.
import AppKit
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(2)
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count >= 2 else { fail("Choose a Folder needs a message and a start folder.") }
let message = arguments[0]
var isFolder: ObjCBool = false
guard FileManager.default.fileExists(atPath: arguments[1], isDirectory: &isFolder), isFolder.boolValue else {
    fail("The start folder is not there: \(arguments[1])")
}
let startFolder = URL(fileURLWithPath: arguments[1], isDirectory: true)
let firstWay = arguments.count >= 4
let resultFile = firstWay ? arguments[2] : ""

// The move's process id: when it goes (Control-C, a closed Terminal window), so does the chooser. The source is on a queue of its own:
// the main queue is held by the panel while it is open.
var watched: DispatchSourceProcess?
if firstWay {
    guard let pid = Int32(arguments[3]), pid > 0 else { fail("The process id is not a number: \(arguments[3])") }
    let source = DispatchSource.makeProcessSource(identifier: pid, eventMask: .exit, queue: DispatchQueue(label: "choose-folder.watch"))
    source.setEventHandler { fail("The process that asked for the folder has ended.") }
    source.resume()
    watched = source
    if kill(pid, 0) != 0 && errno == ESRCH { fail("The process that asked for the folder is gone.") }
}

/// Whether a path holds a line break. Unicode scalars, not Characters: "\r\n" is one Character, and would pass a Character check.
func holdsLineBreak(_ path: String) -> Bool {
    return path.unicodeScalars.contains { $0 == "\n" || $0 == "\r" }
}

/// What the panel gave back, as the first way's file holds it.
func finish(chosen: URL?) -> Never {
    let path = chosen?.path
    if firstWay {
        var text = "cancel\n"
        if let path = path { text = holdsLineBreak(path) ? "linebreak\n" : "path\n\(path)\n" }
        let part = resultFile + ".part"
        do {
            try text.write(toFile: part, atomically: false, encoding: .utf8)
        } catch {
            fail("The result could not be written: \(resultFile)")
        }
        if rename(part, resultFile) != 0 { fail("The result could not be put in place: \(resultFile)") }
        exit(0)
    }
    guard let path = path else { exit(1) }
    if holdsLineBreak(path) {
        FileHandle.standardError.write(Data("The folder's path holds a line break.\n".utf8))
        exit(3)
    }
    print(path)
    exit(0)
}

func showPanel() {
    NSApp.applicationIconImage = NSWorkspace.shared.icon(for: .folder)
    if #available(macOS 14.0, *) {
        NSApp.activate()
    } else {
        NSApp.activate(ignoringOtherApps: true)
    }
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.allowsMultipleSelection = false
    panel.canCreateDirectories = true
    panel.resolvesAliases = true
    panel.prompt = "Use This Folder"
    panel.message = message
    panel.directoryURL = startFolder
    panel.level = .modalPanel
    panel.hidesOnDeactivate = false
    panel.collectionBehavior.insert(.moveToActiveSpace)
    // These run inside the modal session, once it is up (common modes include the modal one).
    let front = Timer(timeInterval: 0.05, repeats: false) { _ in panel.orderFrontRegardless() }
    let attention = Timer(timeInterval: 0.5, repeats: false) { _ in
        if !NSApp.isActive { NSApp.requestUserAttention(.criticalRequest) }
    }
    RunLoop.main.add(front, forMode: .common)
    RunLoop.main.add(attention, forMode: .common)
    let response = panel.runModal()
    finish(chosen: response == .OK ? panel.url : nil)
}

final class Delegate: NSObject, NSApplicationDelegate {
    // Only schedules the panel and returns, so the launch's open event is answered at once. runModal is never called before
    // NSApp.run(), or in here: LaunchServices could time out (-1712) while the panel is still up.
    func applicationDidFinishLaunching(_ notification: Notification) {
        DispatchQueue.main.async { showPanel() }
    }
    // Arguments are read from CommandLine.arguments, never taken as files to open.
    func application(_ application: NSApplication, open urls: [URL]) {}
    func application(_ sender: NSApplication, openFiles filenames: [String]) {
        sender.reply(toOpenOrPrint: .success)
    }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
withExtendedLifetime(watched) {}
