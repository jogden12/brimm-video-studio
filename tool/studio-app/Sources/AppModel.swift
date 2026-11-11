// What the windows show and do. Every launch runs a status first, and what comes next is asked of nextFromStatus; the setup and the
// repair runs, the apps timer, the guide's PDF, the move to Applications, Uninstall and the status window's buttons are here. The
// decisions themselves are in the Foundation-only files, which node's tests ask: this file only calls them and publishes what they give.
import AppKit
import Combine

/// The page the window shows.
enum Screen {
    case checking, move, refused, setup, repairing, twoCopies, status, removed
}

/// What the window says when the app is in a folder with a colon in its name, where the engine cannot be started.
let colonRefused = "BRIMM Video Studio cannot run from a folder with a colon in its name. Move it to your Applications folder, then open it again."

/// What the window says when the guide could not be made into a PDF, before the HTML's path and a full stop.
let guideNotMade = "The Getting Started guide could not be made into a PDF. It is here as a web page:"

/// What the window says when Check for Updates is chosen, until Phase 7 replaces checkForUpdates's body.
let noUpdatesYet = "Updates are not part of this build yet."

/// What the window says when a stand-in build is asked to move itself.
let fakeNeverMoved = "A stand-in build is never moved."

/// Uninstall's own function, named here so that the model's uninstall() does not hide it.
private func stopBackgroundJob(app: String, fake: Bool, environment: [String: String]) -> Uninstalled {
    uninstall(app: app, fake: fake) { runToEnd($0, environment: environment) }
}

/// The windows' model. It is made, used and changed on the main thread only.
final class AppModel: ObservableObject {
    @Published private(set) var screen: Screen = .checking
    /// What the engine's events of the run now shown have made.
    @Published private(set) var state = SetupState()
    /// One line under the buttons.
    @Published var notice: String?
    /// The other copy's path, when there are two copies.
    @Published private(set) var other: String?
    /// Whether the last guide the engine wrote was made into a PDF, or nil while none has been asked for since the run began.
    @Published private(set) var guideMade: Bool?

    /// Whether this is a stand-in build: a file named FAKE-ENGINE.txt is in the app's Resources.
    let fake: Bool

    /// The app this copy is, and the home it works for.
    private let app = Bundle.main.bundlePath
    private let home = NSHomeDirectory()

    /// Each client from its start until its onEnd has come: the client's own callbacks hold it weakly, so it is kept here, or its
    /// run would be lost and the engine would read the closed stdin as a cancel.
    private var clients: [ObjectIdentifier: EngineClient] = [:]
    /// The client of the run now shown, while it runs.
    private var current: EngineClient?
    /// For each PDF being made, what waits for its answer. A second ask for the same PDF waits for the first, which is never doubled.
    private var pdfWaiting: [String: [(Bool) -> Void]] = [:]
    /// True while the move or Uninstall runs off the main thread.
    private var working = false
    private var timer: Timer?

    init() {
        fake = FileManager.default.fileExists(atPath: (app as NSString).appendingPathComponent("Contents/Resources/FAKE-ENGINE.txt"))
        let made = Timer(timeInterval: checkEvery, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(made, forMode: .common)
        timer = made
    }

    deinit { timer?.invalidate() }

    /// What the status window offers, and nothing on any other screen.
    var offers: [String] {
        guard screen == .status else { return [] }
        let files = FileManager.default
        let guide = guidePaths(home: home)
        return statusOffers(
            next: .status, agentFileThere: files.fileExists(atPath: agentFile(home: home)),
            guideThere: files.fileExists(atPath: guide.html) || files.fileExists(atPath: guide.pdf))
    }

    /// What quitting does now.
    var quit: Quit { quitRule(state) }

    // MARK: The runs

    /// Starts with a status, and goes on to what follows it. `chosen` is the run the person asked for. It does nothing while a run
    /// is running.
    func begin(chosen: Run?) {
        guard current == nil else { return }
        notice = nil
        other = nil
        if isTranslocated(app) {
            screen = .move
            return
        }
        guard engineCommand(run: .status, app: app) != nil else {
            var refused = SetupState()
            refused.take(.failure(Failure(code: "colon", message: colonRefused, advice: nil, contact: nil, details: nil)))
            state = refused
            screen = .refused
            return
        }
        screen = .checking
        start(.status) { [weak self] ended in
            guard let self else { return }
            let found = otherCopy(of: self.app, home: self.home) { FileManager.default.fileExists(atPath: $0) }
            switch nextFromStatus(ended, translocated: isTranslocated(self.app), chosen: chosen, other: found != nil) {
            case .move: self.screen = .move
            case .refused: self.screen = .refused
            case .setup: self.startSetup()
            case .repair: self.startRepair()
            case .twoCopies:
                self.other = found
                self.screen = .twoCopies
            case .status: self.screen = .status
            }
        }
    }

    private func startSetup() {
        screen = .setup
        start(.setup) { _ in }
    }

    /// A repair that ends repaired goes on to a status, so the status window follows.
    private func startRepair() {
        screen = .repairing
        start(.repair) { [weak self] ended in
            if ended.done?.outcome == "repaired" { self?.begin(chosen: nil) }
        }
    }

    /// Starts `run` into a new state: began, then each event, then ended at the client's end, and then `then` with the state made.
    /// A program that cannot be started ends at once, on a fault of its own.
    private func start(_ run: Run, then: @escaping (SetupState) -> Void) {
        guard let command = engineCommand(run: run, app: app) else { return }
        let client = EngineClient(command: command, environment: childEnvironment(from: ProcessInfo.processInfo.environment, home: home, app: app))
        let id = ObjectIdentifier(client)
        client.onEvent = { [weak self] event in self?.took(event, from: id) }
        client.onEnd = { [weak self] _ in self?.endedRun(id, then: then) }
        var fresh = SetupState()
        fresh.began()
        state = fresh
        guideMade = nil
        do {
            try client.start()
        } catch {
            state.ended()
            then(state)
            return
        }
        clients[id] = client
        current = client
    }

    private func took(_ event: Event, from id: ObjectIdentifier) {
        guard let current, ObjectIdentifier(current) == id else { return }
        state.take(event)
        if case .done(let done) = event, let guide = done.guide { madeGuide(guide, outcome: done.outcome) }
    }

    private func endedRun(_ id: ObjectIdentifier, then: (SetupState) -> Void) {
        clients[id] = nil
        guard let shown = current, ObjectIdentifier(shown) == id else { return }
        current = nil
        state.ended()
        then(state)
    }

    /// The apps timer: when the apps question is open and the last check was answered, it asks the engine to check again.
    private func tick() {
        guard shouldCheck(state), let current, let question = state.question else { return }
        current.answer(question.id, .apps(.check))
        state.sentCheck()
    }

    // MARK: What the person does

    /// Answers the open question.
    func answer(_ reply: Reply) {
        guard let current, let question = state.question else { return }
        current.answer(question.id, reply)
        if case .apps(.check) = reply { state.sentCheck() }
    }

    func back() { current?.back() }

    /// Cancels the run while it runs. After a setup that installed, it closes the Done step, and the status window follows.
    func cancel() {
        if let current {
            current.cancel()
        } else if screen == .setup, state.done?.outcome == "installed" {
            begin(chosen: nil)
        }
    }

    /// Moves this copy into an Applications folder, then opens the moved copy and quits. A sentence back is shown instead.
    func moveToApplications() {
        if fake {
            notice = fakeNeverMoved
            return
        }
        guard !working else { return }
        working = true
        let app = self.app
        let folder = moveTarget(home: home, systemWritable: FileManager.default.isWritableFile(atPath: "/Applications"))
        // The model is kept until the move has said how it went.
        DispatchQueue.global().async { [self] in
            let said = moveApp(from: app, to: folder) { path in
                (try? FileManager.default.trashItem(at: URL(fileURLWithPath: path), resultingItemURL: nil)) != nil
            }
            if said == nil {
                let moved = (folder as NSString).appendingPathComponent("\(appName).app")
                _ = runToEnd(Command(program: "/usr/bin/open", arguments: ["-n", moved]), environment: ProcessInfo.processInfo.environment)
            }
            DispatchQueue.main.async { [self] in
                working = false
                if let said {
                    notice = said
                } else {
                    NSApp.terminate(nil)
                }
            }
        }
    }

    /// Repairs this copy, so that it is the one the Mac runs.
    func useThisCopy() {
        guard current == nil else { return }
        notice = nil
        startRepair()
    }

    /// Opens the other copy and quits this one.
    func openOtherCopy() {
        guard let other else { return }
        NSWorkspace.shared.openApplication(at: URL(fileURLWithPath: other), configuration: NSWorkspace.OpenConfiguration()) { opened, _ in
            if opened != nil { DispatchQueue.main.async { NSApp.terminate(nil) } }
        }
    }

    func checkForUpdates() { notice = noUpdatesYet }

    /// Opens the guide's PDF when it is there. Otherwise the HTML is made into the PDF first, and is opened itself if that fails.
    func openGuide() {
        let guide = guidePaths(home: home)
        let files = FileManager.default
        if files.fileExists(atPath: guide.pdf) {
            NSWorkspace.shared.open(URL(fileURLWithPath: guide.pdf))
        } else if files.fileExists(atPath: guide.html) {
            pdf(html: guide.html, pdf: guide.pdf) { made in
                NSWorkspace.shared.open(URL(fileURLWithPath: made ? guide.pdf : guide.html))
            }
        }
    }

    /// Puts the run's summary onto the pasteboard.
    func copySummary() {
        guard let done = state.done else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(done.summary, forType: .string)
    }

    /// Opens the Claude app, or shows the BRIMM Video Studio folder in Finder when it is in neither Applications folder.
    func openClaude() {
        let places = ["/Applications/Claude.app", (home as NSString).appendingPathComponent("Applications/Claude.app")]
        if let claude = places.first(where: { FileManager.default.fileExists(atPath: $0) }) {
            NSWorkspace.shared.openApplication(at: URL(fileURLWithPath: claude), configuration: NSWorkspace.OpenConfiguration())
        } else if let done = state.done {
            NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: done.studio)])
        }
    }

    /// Stops the background job, after the view's confirm. Off the status screen it does nothing. It runs off the main thread, since
    /// its two programs block, and publishes on the main thread.
    func uninstall() {
        guard screen == .status, !working else { return }
        working = true
        let app = self.app
        let fake = self.fake
        let environment = childEnvironment(from: ProcessInfo.processInfo.environment, home: home, app: app)
        // The model is kept until Uninstall has said how it went.
        DispatchQueue.global().async { [self] in
            let result = stopBackgroundJob(app: app, fake: fake, environment: environment)
            DispatchQueue.main.async { [self] in
                working = false
                switch result {
                case .removed: screen = .removed
                case .notice(let said): notice = said
                }
            }
        }
    }

    // MARK: The guide

    /// Makes the run's guide into its PDF: its answer is guideMade, a setup's PDF is opened in Preview, and a PDF that could not be
    /// made is told with the HTML's path.
    private func madeGuide(_ guide: Guide, outcome: String) {
        pdf(html: guide.html, pdf: guide.pdf) { [weak self] made in
            guard let self else { return }
            self.guideMade = made
            if !made {
                self.notice = "\(guideNotMade) \(guide.html)."
            } else if outcome == "installed" {
                self.openInPreview(guide.pdf)
            }
        }
    }

    /// Makes the PDF at `pdf` from `html`, and gives `done` its answer on the main thread. While an earlier ask for the same PDF has
    /// not been answered, `done` waits for that answer and no second print is started.
    private func pdf(html: String, pdf: String, done: @escaping (Bool) -> Void) {
        if pdfWaiting[pdf] != nil {
            pdfWaiting[pdf]?.append(done)
            return
        }
        pdfWaiting[pdf] = [done]
        makePDF(html: URL(fileURLWithPath: html), pdf: URL(fileURLWithPath: pdf)) { [weak self] made in
            let waiting = self?.pdfWaiting.removeValue(forKey: pdf) ?? []
            waiting.forEach { $0(made) }
        }
    }

    private func openInPreview(_ path: String) {
        let file = URL(fileURLWithPath: path)
        if let preview = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Preview") {
            NSWorkspace.shared.open([file], withApplicationAt: preview, configuration: NSWorkspace.OpenConfiguration())
        } else {
            NSWorkspace.shared.open(file)
        }
    }
}
