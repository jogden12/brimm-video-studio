// The program inside "BRIMM Spike.app" (spike only: S4 and S5; see ../README.md). It answers two questions and is then thrown away:
// Phase 6 builds the real app again, test first, from what it shows.
//   BRIMM Spike --agent   S4. What the background job's program will do. It starts the node inside this app as its child, on
//                         probe.mjs, which lists the Downloads folder and any Dropbox folder the account has and logs what macOS
//                         answered, and it waits for it. It opens no window. What it says goes to standard output, which the launch
//                         agent sends to its log, with the time on each line.
//   BRIMM Spike           S5, as Finder opens it (or with --login). A window that runs `claude auth login` under a pseudo-terminal,
//                         shows what it prints, opens in the browser the sign-in link it prints (only one to claude.ai, claude.com or
//                         anthropic.com), and has a box and keys for anything it asks. When claude ends, the window asks
//                         `claude auth status --json` whether this account is signed in, and shows only whether and on which plan:
//                         never the email address or the organisation. It also says whether Terminal is running.
import AppKit
import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())

// MARK: - S4: the background job's program

/// One line of the agent's log, with the time.
func agentSays(_ text: String) {
    let stamp = ISO8601DateFormatter().string(from: Date())
    FileHandle.standardOutput.write(Data("\(stamp) BRIMM Spike: \(text)\n".utf8))
}

/// Starts the app's node on probe.mjs, waits for it, and gives back its status. The child has the same standard output and error,
/// so its lines go to the same log.
func runAgent() -> Int32 {
    guard let resources = Bundle.main.resourcePath else {
        agentSays("this program is not inside its app, so it has no node to start.")
        return 2
    }
    let node = resources + "/node/bin/node"
    agentSays("started as \(Bundle.main.executablePath ?? CommandLine.arguments[0]), process \(getpid()), parent \(getppid()), app \(Bundle.main.bundleIdentifier ?? "none").")
    let child = Process()
    child.executableURL = URL(fileURLWithPath: node)
    child.arguments = [resources + "/probe.mjs"]
    child.environment = ["HOME": NSHomeDirectory(), "PATH": "/usr/bin:/bin:/usr/sbin:/sbin", "LANG": "en_US.UTF-8"]
    do {
        try child.run()
    } catch {
        agentSays("node could not be started: \(error.localizedDescription)")
        return 1
    }
    agentSays("node started as process \(child.processIdentifier); waiting for it.")
    child.waitUntilExit()
    agentSays("node ended with status \(child.terminationStatus).")
    return child.terminationStatus
}

// MARK: - S5: signing in to Claude Code with no Terminal

/// Where Claude Code's own installer puts it, and where Studio looks for it (unedited.js findPrograms, install.sh find_claude).
let claudePath = NSHomeDirectory() + "/.local/bin/claude"

/// What claude is run with: this account's home, a PATH with no Homebrew in it, and a terminal it can draw in.
func claudeEnvironment() -> [String: String] {
    let home = NSHomeDirectory()
    var env = ["HOME": home, "PATH": "\(home)/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin", "TERM": "xterm-256color", "LANG": "en_US.UTF-8", "SHELL": "/bin/zsh"]
    let given = ProcessInfo.processInfo.environment
    for key in ["USER", "LOGNAME", "TMPDIR"] {
        if let value = given[key] { env[key] = value }
    }
    return env
}

/// What a program printed in a terminal, made readable: its codes for colours, for the cursor, for titles and for links are taken out,
/// and a line it draws over again is a new line.
func readable(_ raw: String) -> String {
    var text = raw
    text = text.replacingOccurrences(of: "\u{1B}\\][^\u{07}\u{1B}]*(\u{07}|\u{1B}\\\\)", with: "", options: .regularExpression)
    text = text.replacingOccurrences(of: "\u{1B}\\[[0-?]*[ -/]*[@-~]", with: "", options: .regularExpression)
    text = text.replacingOccurrences(of: "\u{1B}[@-Z\\\\-_]", with: "", options: .regularExpression)
    text = text.replacingOccurrences(of: "\r\n", with: "\n")
    text = text.replacingOccurrences(of: "\r", with: "\n")
    return text
}

/// The first sign-in link in what claude printed, read before the terminal's codes are taken out (a link may be inside one): only a
/// link to claude.ai, claude.com or anthropic.com, or a place in one of them, is taken.
func signInLink(in raw: String) -> URL? {
    guard let pattern = try? NSRegularExpression(pattern: "https://[^\\s\u{07}\u{1B}\"'<>]+") else { return nil }
    for match in pattern.matches(in: raw, range: NSRange(raw.startIndex..., in: raw)) {
        guard let range = Range(match.range, in: raw) else { continue }
        var text = String(raw[range])
        while let last = text.last, ".,;:)]".contains(last) { text.removeLast() }
        guard let url = URL(string: text), let host = url.host?.lowercased() else { continue }
        if ["claude.ai", "claude.com", "anthropic.com"].contains(where: { host == $0 || host.hasSuffix("." + $0) }) { return url }
    }
    return nil
}

/// `claude auth login` under a pseudo-terminal. Everything the child needs is made before the fork: after it, the child calls only
/// execve and _exit.
final class SignIn {
    private(set) var master: Int32 = -1
    private(set) var pid: pid_t = 0
    private var raw = Data()
    private var reader: DispatchSourceRead?
    private var watcher: DispatchSourceProcess?
    private var ended = false
    var changed: (_ raw: String) -> Void = { _ in }
    var finished: (_ status: Int32) -> Void = { _ in }

    /// Starts claude with these arguments. Gives back why it could not, or nil.
    func start(_ args: [String]) -> String? {
        guard FileManager.default.isExecutableFile(atPath: claudePath) else {
            return "Claude Code is not in ~/.local/bin, where its own installer puts it."
        }
        let all = [claudePath] + args
        let env = claudeEnvironment().map { "\($0.key)=\($0.value)" }
        let cArgs = UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>.allocate(capacity: all.count + 1)
        for (i, a) in all.enumerated() { cArgs[i] = strdup(a) }
        cArgs[all.count] = nil
        let cEnv = UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>.allocate(capacity: env.count + 1)
        for (i, e) in env.enumerated() { cEnv[i] = strdup(e) }
        cEnv[env.count] = nil
        // A wide terminal, so that a long link is never broken across lines.
        var size = winsize(ws_row: 50, ws_col: 400, ws_xpixel: 0, ws_ypixel: 0)
        var fd: Int32 = -1
        let child = forkpty(&fd, nil, nil, &size)
        if child == 0 {
            execve(cArgs[0], cArgs, cEnv)
            _exit(127)
        }
        for i in 0..<all.count { free(cArgs[i]) }
        cArgs.deallocate()
        for i in 0..<env.count { free(cEnv[i]) }
        cEnv.deallocate()
        if child < 0 { return "The pseudo-terminal could not be made: \(String(cString: strerror(errno)))." }
        master = fd
        pid = child

        let reader = DispatchSource.makeReadSource(fileDescriptor: fd, queue: .main)
        reader.setEventHandler { [weak self] in
            guard let self = self else { return }
            var buffer = [UInt8](repeating: 0, count: 16384)
            let n = read(self.master, &buffer, buffer.count)
            if n > 0 {
                self.raw.append(contentsOf: buffer[0..<n])
                self.changed(String(decoding: self.raw, as: UTF8.self))
            } else {
                // The program has ended: its side of the terminal is closed (EIO), or there is nothing more.
                reader.cancel()
            }
        }
        reader.setCancelHandler { [weak self] in
            guard let self = self else { return }
            if self.master >= 0 { close(self.master) }
            self.master = -1
        }
        reader.resume()
        self.reader = reader

        let watcher = DispatchSource.makeProcessSource(identifier: child, eventMask: .exit, queue: .main)
        watcher.setEventHandler { [weak self] in self?.reap() }
        watcher.resume()
        self.watcher = watcher
        // In case it ended before the watcher was there.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.reapIfEnded() }
        return nil
    }

    private func reapIfEnded() {
        guard !ended, pid > 0 else { return }
        var status: Int32 = 0
        if waitpid(pid, &status, WNOHANG) == pid { finish(status) } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.reapIfEnded() }
        }
    }

    private func reap() {
        guard !ended else { return }
        var status: Int32 = 0
        if waitpid(pid, &status, 0) == pid { finish(status) }
    }

    /// Its exit status, as a shell would give it: the code it ended with, or 128 and the signal that killed it.
    private func finish(_ status: Int32) {
        ended = true
        watcher?.cancel()
        let code = (status & 0x7f) == 0 ? (status >> 8) & 0xff : 128 + (status & 0x7f)
        // What it printed last is read before the end is said.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in self?.finished(code) }
    }

    /// Types this into claude's terminal.
    func send(_ text: String) {
        guard master >= 0 else { return }
        let bytes = Array(text.utf8)
        _ = bytes.withUnsafeBufferPointer { write(master, $0.baseAddress, $0.count) }
    }

    func stop() {
        if pid > 0 && !ended { kill(pid, SIGTERM) }
    }
}

/// Whether this account's Claude Code is signed in, in a line: from `claude auth status --json`, only `loggedIn` and the plan
/// (`subscriptionType`) and how (`authMethod`). The email address and the organisation are never shown.
func signedInLine() -> String {
    let status = Process()
    status.executableURL = URL(fileURLWithPath: claudePath)
    status.arguments = ["auth", "status", "--json"]
    status.environment = claudeEnvironment()
    let pipe = Pipe()
    status.standardOutput = pipe
    status.standardError = FileHandle.nullDevice
    do {
        try status.run()
    } catch {
        return "claude auth status could not be run: \(error.localizedDescription)"
    }
    let data = pipe.fileHandleForReading.readDataToEndOfFile()
    status.waitUntilExit()
    guard let told = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
        return "claude auth status --json said nothing that could be read."
    }
    let plan = (told["subscriptionType"] as? String).map { " (\($0))" } ?? ""
    let how = (told["authMethod"] as? String).map { ", by \($0)" } ?? ""
    switch told["loggedIn"] as? Bool {
    case true?: return "Signed in: yes\(plan)\(how)."
    case false?: return "Signed in: no."
    default: return "Signed in: claude auth status --json did not say."
    }
}

func terminalLine() -> String {
    let running = !NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Terminal").isEmpty
    return running ? "Terminal: running (it was open already, or something else opened it)." : "Terminal: not running."
}

final class Window: NSObject, NSWindowDelegate {
    let window: NSWindow
    let scroll = NSTextView.scrollableTextView()
    var output: NSTextView { scroll.documentView as! NSTextView }
    let link = NSTextField(labelWithString: "No sign-in link yet.")
    let status = NSTextField(wrappingLabelWithString: "Starting claude auth login…")
    let box = NSTextField()
    let signIn = SignIn()
    var opened: URL?

    override init() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 780, height: 540), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        super.init()
        window.title = "BRIMM Spike: signing in to Claude Code"
        window.delegate = self
        window.center()

        let heading = NSTextField(wrappingLabelWithString: "This window runs claude auth login with no Terminal, and opens the sign-in link it prints in your browser. Sign in there, then come back here.")
        output.isEditable = false
        output.isSelectable = true
        output.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 260).isActive = true

        link.lineBreakMode = .byTruncatingMiddle
        link.isSelectable = true
        link.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        let again = NSButton(title: "Open the link again", target: self, action: #selector(openAgain))
        let linkRow = NSStackView(views: [link, again])

        box.placeholderString = "Anything claude asks you to type, or paste (Command-V)"
        let sendButton = NSButton(title: "Send", target: self, action: #selector(sendBox))
        sendButton.keyEquivalent = "\r"
        let keys = [("Return", "\r"), ("↑", "\u{1B}[A"), ("↓", "\u{1B}[B"), ("Esc", "\u{1B}")].map { title, sequence -> NSButton in
            let b = NSButton(title: title, target: self, action: #selector(sendKey(_:)))
            b.identifier = NSUserInterfaceItemIdentifier(sequence)
            return b
        }
        let inputRow = NSStackView(views: [box, sendButton] + keys)
        box.setContentHuggingPriority(.defaultLow, for: .horizontal)

        status.font = NSFont.boldSystemFont(ofSize: 13)
        let stack = NSStackView(views: [heading, scroll, linkRow, inputRow, status])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        for view in [scroll, linkRow, inputRow, heading, status] as [NSView] {
            view.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -32).isActive = true
        }
        let content = NSView()
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor), stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            stack.topAnchor.constraint(equalTo: content.topAnchor), stack.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])
        window.contentView = content

        signIn.changed = { [weak self] raw in self?.show(raw) }
        signIn.finished = { [weak self] code in self?.done(code) }
    }

    func start() {
        window.makeKeyAndOrderFront(nil)
        if let why = signIn.start(["auth", "login"]) {
            status.stringValue = "It could not start: \(why)"
        } else {
            status.stringValue = "claude auth login is running (process \(signIn.pid))."
        }
    }

    func show(_ raw: String) {
        output.string = readable(raw)
        output.scrollToEndOfDocument(nil)
        if opened == nil, let url = signInLink(in: raw) {
            opened = url
            link.stringValue = url.absoluteString
            NSWorkspace.shared.open(url)
            status.stringValue = "The sign-in link was opened in your browser. Sign in there, then come back here."
        }
    }

    func done(_ code: Int32) {
        status.stringValue = "claude auth login ended with \(code). \(signedInLine()) \(terminalLine())"
    }

    @objc func openAgain() {
        if let url = opened { NSWorkspace.shared.open(url) }
    }

    @objc func sendBox() {
        signIn.send(box.stringValue + "\r")
        box.stringValue = ""
    }

    @objc func sendKey(_ sender: NSButton) {
        if let sequence = sender.identifier?.rawValue { signIn.send(sequence) }
    }

    func windowWillClose(_ notification: Notification) {
        signIn.stop()
    }
}

/// The menu bar: the app's own menu with Quit, and an Edit menu, without which Command-V and the others do nothing in the box
/// (#50 found that for the folder window). Every target is nil, so the first responder takes the action.
func makeMainMenu() -> NSMenu {
    let main = NSMenu()
    let appItem = NSMenuItem()
    let appMenu = NSMenu(title: "BRIMM Spike")
    appMenu.addItem(NSMenuItem(title: "Quit BRIMM Spike", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    appItem.submenu = appMenu
    main.addItem(appItem)
    let editItem = NSMenuItem()
    let edit = NSMenu(title: "Edit")
    edit.addItem(NSMenuItem(title: "Undo", action: Selector(("undo:")), keyEquivalent: "z"))
    let redo = NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
    redo.keyEquivalentModifierMask = [.command, .shift]
    edit.addItem(redo)
    edit.addItem(NSMenuItem.separator())
    edit.addItem(NSMenuItem(title: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
    edit.addItem(NSMenuItem(title: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
    edit.addItem(NSMenuItem(title: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
    edit.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
    editItem.submenu = edit
    main.addItem(editItem)
    return main
}

final class Delegate: NSObject, NSApplicationDelegate {
    var shown: Window?

    func applicationWillFinishLaunching(_ notification: Notification) { NSApp.mainMenu = makeMainMenu() }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        let window = Window()
        shown = window
        window.start()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) { shown?.signIn.stop() }

    // Arguments are read from CommandLine.arguments, never taken as files to open.
    func application(_ application: NSApplication, open urls: [URL]) {}
}

// MARK: - Which of the two

if arguments.contains("--agent") {
    exit(runAgent())
}
let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
