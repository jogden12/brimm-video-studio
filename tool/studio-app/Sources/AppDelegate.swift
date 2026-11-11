// The app's delegate: the one window, the menu, links to brimm-video-studio://, and quitting, which follows the model's quit rule.
import AppKit
import Combine
import SwiftUI

/// What the window says when quitting waits for the installer.
let setupFinishing = "Setup is finishing. BRIMM Video Studio closes when it is done."

/// The longest quitting waits for a cancelled run to end, in seconds.
let cancelWaitLimit: TimeInterval = 5

/// The menu bar: the app's own menu, an Edit menu, without which a code cannot be pasted into a field, and a Window menu. The Edit
/// menu's targets are nil, so the field that has the focus takes the action.
private func makeMainMenu(updates: NSMenuItem) -> (main: NSMenu, window: NSMenu) {
    let main = NSMenu()

    let appItem = NSMenuItem()
    let appMenu = NSMenu(title: appName)
    appMenu.addItem(
        NSMenuItem(title: "About \(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: ""))
    appMenu.addItem(updates)
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(NSMenuItem(title: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
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

    let windowItem = NSMenuItem()
    let window = NSMenu(title: "Window")
    window.addItem(NSMenuItem(title: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m"))
    window.addItem(NSMenuItem(title: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: ""))
    window.addItem(NSMenuItem.separator())
    window.addItem(NSMenuItem(title: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: ""))
    windowItem.submenu = window
    main.addItem(windowItem)

    return (main, window)
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private let model = AppModel()
    private var window: NSWindow?
    private var watching: [AnyCancellable] = []

    /// Whether the first begin has been called, and whether it has since shown a screen other than checking.
    private var begun = false
    private var shown = false
    /// A check-for-updates link that came before the first screen was shown, kept until it is.
    private var updatesAsked = false

    /// Whether quitting waits for the run to end, and whether it may now end the app whatever the rule says.
    private var quitWhenEnded = false
    private var mayQuit = false
    /// Whether AppKit was told .terminateLater and waits for its reply. A logout, a restart or a shutdown then waits for the run
    /// instead of being cancelled.
    private var replyOwed = false

    func applicationWillFinishLaunching(_ notification: Notification) {
        let updates = NSMenuItem(title: "Check for Updates…", action: #selector(checkForUpdatesChosen(_:)), keyEquivalent: "")
        updates.target = self
        let menus = makeMainMenu(updates: updates)
        NSApp.mainMenu = menus.main
        NSApp.windowsMenu = menus.window

        let made = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 560), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered,
            defer: false)
        made.title = appName
        made.isReleasedWhenClosed = false
        made.backgroundColor = NSColor(Brand.smoke)
        made.contentView = NSHostingView(rootView: RootView(model: model))
        made.setContentSize(NSSize(width: 760, height: 560))
        made.center()
        made.delegate = self
        window = made

        // Each published value comes before it is set, so the value given is the one used, never the model's.
        model.$screen.sink { [weak self] screen in self?.screenChanged(screen) }.store(in: &watching)
        model.$state.sink { [weak self] state in self?.stateChanged(state) }.store(in: &watching)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        front()
        begun = true
        model.begin(chosen: nil)
    }

    // MARK: Links

    /// Each link is taken through urlAction. One that comes before the first screen is shown is kept and acted on then.
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where urlAction(url.absoluteString) == "check-for-updates" {
            if shown {
                checkForUpdates()
            } else {
                updatesAsked = true
            }
        }
    }

    @objc private func checkForUpdatesChosen(_ sender: Any?) { checkForUpdates() }

    /// Brings the window to the front and, on the status screen only, checks for updates.
    private func checkForUpdates() {
        front()
        if model.screen == .status { model.checkForUpdates() }
    }

    private func screenChanged(_ screen: Screen) {
        guard begun, !shown, screen != .checking else { return }
        shown = true
        guard updatesAsked else { return }
        updatesAsked = false
        // The screen is not yet set while its change is told, so the link is acted on once it is.
        DispatchQueue.main.async { [weak self] in self?.checkForUpdates() }
    }

    private func front() {
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: Quitting

    /// Closing the window is quitting, by the same rule.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        NSApp.terminate(nil)
        return false
    }

    /// `now` quits. `cancel` sends a cancel and quits when the run ends, or after five seconds. `wait` says the setup is finishing
    /// and quits when the run ends: the installer is never stopped. In both of those AppKit is told .terminateLater and is answered
    /// when the app may quit, so a logout, a restart or a shutdown waits for the run. While it waits, AppKit runs the main run loop in
    /// its modal panel mode; the engine's events and end, the five seconds and the model's timer all come through the main queue or
    /// the common modes, so they still come. Once a quit has been asked, the model starts no new run.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if mayQuit { return .terminateNow }
        model.quitAsked()
        switch model.quit {
        case .now:
            return .terminateNow
        case .cancel:
            guard !quitWhenEnded else { return .terminateLater }
            quitWhenEnded = true
            replyOwed = true
            model.cancel()
            DispatchQueue.main.asyncAfter(deadline: .now() + cancelWaitLimit) { [weak self] in self?.cancelWaitEnded() }
            return .terminateLater
        case .wait:
            quitWhenEnded = true
            replyOwed = true
            model.notice = setupFinishing
            return .terminateLater
        }
    }

    /// The five seconds after a cancel are up: the app quits, unless the run has since reached the installer, which it then waits for.
    private func cancelWaitEnded() {
        guard quitWhenEnded, !mayQuit else { return }
        if model.quit == .wait {
            model.notice = setupFinishing
            return
        }
        quitNow()
    }

    private func stateChanged(_ state: SetupState) {
        guard quitWhenEnded, !mayQuit, !state.running else { return }
        // The state is not yet set while its change is told, so the app quits once it is.
        DispatchQueue.main.async { [weak self] in self?.quitNow() }
    }

    /// Quits: AppKit is given the reply it waits for, or, when it waits for none, is asked to terminate again.
    private func quitNow() {
        guard !mayQuit else { return }
        mayQuit = true
        if replyOwed {
            replyOwed = false
            NSApp.reply(toApplicationShouldTerminate: true)
        } else {
            NSApp.terminate(nil)
        }
    }
}
