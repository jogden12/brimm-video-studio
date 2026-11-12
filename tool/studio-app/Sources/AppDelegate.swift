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

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, NSMenuItemValidation {
    private let model = AppModel()
    private var window: NSWindow?
    private var watching: [AnyCancellable] = []

    /// A check-for-updates link that came on a screen that passes by itself, kept until a screen that does not.
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
        model.quitMayGo = { [weak self] in self?.quitNow() }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        front()
        model.begin(chosen: nil)
    }

    // MARK: Check for Updates

    /// Each link is taken through urlAction. It brings the window to the front, and checks for updates where a check may be chosen.
    /// One that comes on a screen that passes by itself, such as the first status, is kept and acted on at the screen after.
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where urlAction(url.absoluteString) == "check-for-updates" {
            if model.mayCheck {
                front()
                model.checkForUpdates()
            } else if keepsUpdatesAsk(screen: model.screen) {
                updatesAsked = true
            } else {
                front()
            }
        }
    }

    /// The menu's Check for Updates…, enabled only where a check may be chosen.
    @objc private func checkForUpdatesChosen(_ sender: Any?) {
        front()
        model.checkForUpdates()
    }

    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        guard menuItem.action == #selector(checkForUpdatesChosen(_:)) else { return true }
        return model.mayCheck
    }

    private func screenChanged(_ screen: Screen) {
        guard updatesAsked, !keepsUpdatesAsk(screen: screen) else { return }
        updatesAsked = false
        // The screen is not yet set while its change is told, so the link is acted on once it is.
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.front()
            if self.model.mayCheck { self.model.checkForUpdates() }
        }
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
    /// the common modes, so they still come. Once a quit has been asked, the model starts no new run. Where no run holds the quit, a
    /// check for updates is asked: none or installing quits; waiting ends the check first and quits once the marker is taken away;
    /// from Offered on, the quit waits on the updates page until nothing is at work, or until the update is skipped.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if mayQuit { return .terminateNow }
        model.quitAsked()
        switch model.quit {
        case .now:
            // A quit already waits for its reply.
            if replyOwed { return .terminateLater }
            switch updateQuit(model.update) {
            case .now:
                return .terminateNow
            case .end:
                replyOwed = true
                model.endForQuit()
                return .terminateLater
            case .hold:
                replyOwed = true
                front()
                model.holdForQuit()
                return .terminateLater
            }
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
