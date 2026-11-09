// The program inside "Sparkle Spike.app" (spike only: S7; see ../README.md). It answers one question and is then thrown away:
// Phase 7 builds the app's updates again, test first, from what it shows.
//   A window that names the app's version and build, and one word from its Info.plist (BRIMMSpikeWord: "first" in build 1,
//   "second" in build 2), so that an update is plain to see.
//   A "Check for Updates…" item in the app's menu, wired to Sparkle's own SPUStandardUpdaterController, as Sparkle's documentation
//   sets one up in code. Sparkle reads everything else from the Info.plist: the feed (SUFeedURL), the public half of the signing key
//   (SUPublicEDKey), and automatic checks, automatic installs and the system profile, all off.
//   On every launch it lists the Downloads folder, so that macOS asks for it once, naming the app, in build 1; if what was allowed
//   survives the update, build 2 lists it without asking.
import AppKit
import Sparkle

/// A string from the app's own Info.plist, or a question mark.
func info(_ key: String) -> String {
    Bundle.main.object(forInfoDictionaryKey: key) as? String ?? "?"
}

/// Lists the Downloads folder, and says what macOS answered and how long it held the call: a long time means its box was up.
func downloadsLine() -> String {
    let downloads = NSHomeDirectory() + "/Downloads"
    let start = Date()
    let took = { Int(Date().timeIntervalSince(start) * 1000) }
    do {
        let entries = try FileManager.default.contentsOfDirectory(atPath: downloads)
        return "Downloads: listed, \(entries.count) entries, after \(took()) ms."
    } catch {
        let told = error as NSError
        let under = (told.userInfo[NSUnderlyingErrorKey] as? NSError).map { " (\($0.domain) \($0.code))" } ?? ""
        return "Downloads: not listed: \(told.localizedDescription)\(under), after \(took()) ms."
    }
}

/// The menu bar: the app's own menu, with Check for Updates… and Quit. Check for Updates… has Sparkle's controller as its target, as
/// Sparkle's documentation wires it, which also greys it out while Sparkle cannot check.
func makeMainMenu(updates: SPUStandardUpdaterController) -> NSMenu {
    let main = NSMenu()
    let appItem = NSMenuItem()
    let appMenu = NSMenu(title: "Sparkle Spike")
    let check = NSMenuItem(title: "Check for Updates…", action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)), keyEquivalent: "")
    check.target = updates
    appMenu.addItem(check)
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(NSMenuItem(title: "Quit Sparkle Spike", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
    appItem.submenu = appMenu
    main.addItem(appItem)
    return main
}

final class Delegate: NSObject, NSApplicationDelegate {
    /// Sparkle's own controller, started as the app starts, held for as long as the app runs.
    let updates = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
    var window: NSWindow?
    let downloads = NSTextField(wrappingLabelWithString: "Downloads: listing…")

    func applicationWillFinishLaunching(_ notification: Notification) { NSApp.mainMenu = makeMainMenu(updates: updates) }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if #available(macOS 14.0, *) {
            NSApp.activate()
        } else {
            NSApp.activate(ignoringOtherApps: true)
        }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 560, height: 260), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Sparkle Spike"

        let version = NSTextField(labelWithString: "Sparkle Spike \(info("CFBundleShortVersionString")) (\(info("CFBundleVersion")))")
        version.font = NSFont.boldSystemFont(ofSize: 22)
        let word = NSTextField(labelWithString: info("BRIMMSpikeWord"))
        word.font = NSFont.systemFont(ofSize: 40, weight: .semibold)
        let feed = NSTextField(wrappingLabelWithString: "Updates from: \(info("SUFeedURL"))")
        let hint = NSTextField(wrappingLabelWithString: "To look for an update, choose Sparkle Spike › Check for Updates… in the menu bar.")

        let stack = NSStackView(views: [version, word, feed, downloads, hint])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.edgeInsets = NSEdgeInsets(top: 20, left: 20, bottom: 20, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        for view in [feed, downloads, hint] as [NSView] {
            view.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -40).isActive = true
        }
        let content = NSView()
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor), stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            stack.topAnchor.constraint(equalTo: content.topAnchor), stack.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])
        window.contentView = content
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window

        // Listed away from the main thread: the call waits while macOS's box is up, and the window stays drawn meanwhile.
        DispatchQueue.global(qos: .userInitiated).async {
            let line = downloadsLine()
            DispatchQueue.main.async { self.downloads.stringValue = line }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
