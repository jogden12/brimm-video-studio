// What the windows show and do. Every launch runs a status first, and what comes next is asked of nextFromStatus; the setup, the
// repair and the update runs, the apps timer, the guide's PDF, the move to Applications, Uninstall, a check for updates and the
// status window's buttons are here. The decisions themselves are in the Foundation-only files, which node's tests ask: this file
// only calls them and publishes what they give.
import AppKit
import Combine

/// What the window says when the app is in a folder with a colon in its name, where the engine cannot be started. Finder shows a
/// colon in a name as a slash.
let colonRefused = "BRIMM Video Studio cannot run from a folder with a slash or a colon in its name. Move it to your Applications folder, then open it again."

/// What the window says when the guide could not be made into a PDF, before the HTML's path and a full stop.
let guideNotMade = "The Getting Started guide could not be made into a PDF. It is here as a web page:"

/// What the window says when a stand-in build is asked to move itself.
let fakeNeverMoved = "A stand-in build is never moved."

/// What the window says when the moved copy could not be opened.
let movedNotOpened = "BRIMM Video Studio is in your Applications folder now, but it could not be opened from there. Open it from your Applications folder."

/// What the window says when the other copy could not be opened.
let otherNotOpened = "The other copy could not be opened. Open it in Finder, or choose Use this copy instead."

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
    /// True while the move or Uninstall runs off the main thread: the pages then show it and take no click.
    @Published private(set) var working = false
    /// Where a check for updates is, and the line its page shows: busy.js's own line while something is at work.
    @Published private(set) var update: UpdatePhase = .none
    @Published private(set) var updateLine = ""

    /// Called when a quit that waits for a check for updates may go on. The delegate sets it to its reply to AppKit.
    var quitMayGo: (() -> Void)?

    /// Whether this is a stand-in build: a file named FAKE-ENGINE.txt is in the app's Resources.
    let fake: Bool

    /// The Applications folder the move goes into, worked out once.
    let moveFolder: String
    /// Whether the move goes into the home's own Applications folder.
    var movesToHome: Bool { moveFolder != "/Applications" }

    /// The app this copy is, and the home it works for.
    private let app = Bundle.main.bundlePath
    private let home = NSHomeDirectory()

    /// The Getting Started guide's HTML and PDF: in the home's BRIMM Video Work, or, in a stand-in build, in the stand-in's own folder
    /// in the app's temporary folder, where it writes its guide.
    private var guide: (html: String, pdf: String) {
        guidePaths(folder: guideFolder(home: home, fake: fake, temp: NSTemporaryDirectory()))
    }

    /// Each client from its start until its onEnd has come: the client's own callbacks hold it weakly, so it is kept here, or its
    /// run would be lost and the engine would read the closed stdin as a cancel.
    private var clients: [ObjectIdentifier: EngineClient] = [:]
    /// The client of the run now shown, while it runs.
    private var current: EngineClient?
    /// For each PDF being made, what waits for its answer. A second ask for the same PDF waits for the first, which is never doubled.
    private var pdfWaiting: [String: [(Bool) -> Void]] = [:]
    /// A begin the person asked for while the run shown had ended by its events but its client had not yet: it is done, with the
    /// run it chose, when the client has ended.
    private struct BeginAsked {
        let chosen: Run?
    }
    private var beginAsked: BeginAsked?
    /// True once the app has been asked to quit: no run starts after that.
    private var quitting = false
    /// The sentence that the last guide could not be made into a PDF, kept for the screens that follow until a guide is made.
    private var guideNotice: String?
    private var timer: Timer?

    /// The updater. It is made here and started only when a check is first asked for.
    private let updater: SparkleUpdater
    /// The one queue that runs busy.js's updating begin and updating end --look, one at a time, in the order they were asked.
    private let markers = DispatchQueue(label: "com.thebrimm.video-studio.updating")
    /// Whether the last answer of idle-why was idle, when the check began or went on, and when the marker was last asked to be written.
    private var idleBefore = false
    private var began = 0.0
    private var lastMarked = 0.0
    /// Counts each entry into waiting or holding, so that an answer that belongs to an earlier one is never taken.
    private var entry = 0
    /// Whether the entry now may be looked at: from the end of its begin until holding lets go.
    private var mayLook = false
    /// True while an idle-why runs, so that no two run at once.
    private var looking = false
    /// True while a check waits for the cancelled setup run's client to end.
    private var updatesAfterRun = false
    /// True while a quit waits for the check.
    private var quitWaiting = false

    init() {
        fake = FileManager.default.fileExists(atPath: (app as NSString).appendingPathComponent("Contents/Resources/FAKE-ENGINE.txt"))
        moveFolder = moveTarget(home: home, systemWritable: FileManager.default.isWritableFile(atPath: "/Applications"))
        let build = FileManager.default.contents(atPath: (studioFolder(app: app) as NSString).appendingPathComponent("build.json")) ?? Data()
        updater = SparkleUpdater(channels: allowedChannels(build: build))
        let made = Timer(timeInterval: checkEvery, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(made, forMode: .common)
        timer = made

        // What the updater tells. Each is called on the main thread.
        updater.onUnpacked = { [weak self] in
            guard let self, self.update == .offered else { return }
            self.update = .unpacked
        }
        updater.onEnded = { [weak self] in
            guard let self, self.update == .offered else { return }
            self.endCheck()
        }
        updater.onSkipped = { [weak self] in
            guard let self, self.update == .unpacked || self.update == .holding else { return }
            self.endCheck(ended: { [weak self] in self?.replyToQuit() })
        }
        updater.onInstallAsked = { [weak self] in
            guard let self, self.update != .holding else { return }
            self.enterHolding()
        }
    }

    deinit { timer?.invalidate() }

    /// What the status window offers, and nothing on any other screen.
    var offers: [String] {
        guard screen == .status else { return [] }
        let files = FileManager.default
        let guide = self.guide
        return statusOffers(
            next: .status, agentFileThere: files.fileExists(atPath: agentFile(home: home)),
            guideThere: files.fileExists(atPath: guide.html) || files.fileExists(atPath: guide.pdf))
    }

    /// What quitting does now.
    var quit: Quit { quitRule(state) }

    // MARK: The runs

    /// The app is quitting: no run starts from now on.
    func quitAsked() { quitting = true }

    /// Starts with a status, and goes on to what follows it. `chosen` is the run the person asked for. It does nothing while a run
    /// is running, while the move or Uninstall works, or once the app is quitting. When the run shown has ended by its events and its
    /// client has not yet ended, it is done as soon as the client has.
    func begin(chosen: Run?) {
        guard !working, !quitting else { return }
        if current != nil {
            if !state.running { beginAsked = BeginAsked(chosen: chosen) }
            return
        }
        beginAsked = nil
        notice = guideNotice
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
            guard let self, !self.quitting else { return }
            let found = otherCopy(of: self.app, home: self.home) { FileManager.default.fileExists(atPath: $0) }
            switch nextFromStatus(ended, translocated: isTranslocated(self.app), chosen: chosen, other: found != nil) {
            case .move: self.screen = .move
            case .refused: self.screen = .refused
            case .setup: self.startSetup()
            case .repair: self.startRepair()
            case .update: self.startUpdate()
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

    /// The update run, which a copy starts when the Mac was set up by another build. Nothing follows it by itself: its last page
    /// keeps the engine's note until the person chooses Continue, and a run that failed starts again only when the app is opened
    /// again or Repair is chosen.
    func startUpdate() {
        screen = .updating
        start(.update) { _ in }
    }

    /// Starts `run` into a new state: began, then each event, then ended at the client's end, and then `then` with the state made.
    /// A program that cannot be started ends at once, on a fault of its own. With no command line at all, which only a colon in the
    /// app's path gives, the run ends at once too, through `then`, on the colon refusal.
    private func start(_ run: Run, then: @escaping (SetupState) -> Void) {
        guard let command = engineCommand(run: run, app: app) else {
            var refused = SetupState()
            refused.began()
            refused.take(.failure(Failure(code: "colon", message: colonRefused, advice: nil, contact: nil, details: nil)))
            refused.ended()
            state = refused
            then(state)
            return
        }
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
        if updatesAfterRun {
            // Check for Updates was chosen on the setup screen, and the run it cancelled has now ended.
            updatesAfterRun = false
            beginAsked = nil
            if current == nil && !quitting { startWaiting() }
            return
        }
        if let asked = beginAsked {
            beginAsked = nil
            if current == nil { begin(chosen: asked.chosen) }
        }
    }

    /// The apps timer: when the apps question is open and the last check was answered, it asks the engine to check again. Each tick
    /// also does a check for updates' part first, which sends no apps check.
    private func tick() {
        updateTick()
        guard shouldCheck(state), let question = state.question else { return }
        answer(question.id, .apps(.check))
    }

    // MARK: What the person does

    /// Answers the question `id`, which the button was drawn for. It does nothing unless that question is the one open now.
    func answer(_ id: String, _ reply: Reply) {
        guard let current, state.question?.id == id else { return }
        current.answer(id, reply)
        if case .apps(.check) = reply { state.sentCheck() }
    }

    func back() { current?.back() }

    /// Cancels the run while it runs. After a setup that installed, it closes the Done step, and the status window follows, even
    /// when the ended engine's client has not yet ended: the decision is taken from the state.
    func cancel() {
        if screen == .setup, state.done?.outcome == "installed" {
            begin(chosen: nil)
        } else if state.running {
            current?.cancel()
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
        let folder = moveFolder
        let environment = childEnvironment(from: ProcessInfo.processInfo.environment, home: home, app: app)
        // The model is kept until the move has said how it went.
        DispatchQueue.global().async { [self] in
            var said = moveApp(
                from: app, to: folder,
                trash: { path in (try? FileManager.default.trashItem(at: URL(fileURLWithPath: path), resultingItemURL: nil)) != nil },
                idle: { atWorkBeforeMove(app: app) { runToEnd($0, environment: environment) } })
            if said == nil {
                let moved = (folder as NSString).appendingPathComponent("\(appName).app")
                let opened = runToEnd(Command(program: "/usr/bin/open", arguments: ["-n", moved]), environment: ProcessInfo.processInfo.environment)
                if opened.status != 0 { said = movedNotOpened }
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
        guard current == nil, !working, !quitting else { return }
        notice = nil
        startRepair()
    }

    /// Opens the other copy and quits this one. When it cannot be opened, this one stays and says so.
    func openOtherCopy() {
        guard let other else { return }
        NSWorkspace.shared.openApplication(at: URL(fileURLWithPath: other), configuration: NSWorkspace.OpenConfiguration()) { [weak self] opened, _ in
            DispatchQueue.main.async {
                if opened != nil {
                    NSApp.terminate(nil)
                } else {
                    self?.notice = otherNotOpened
                }
            }
        }
    }

    /// Opens the guide's PDF when it is there. Otherwise the HTML is made into the PDF first, and is opened itself if that fails.
    func openGuide() {
        let guide = self.guide
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
                case .removed:
                    // Uninstall's end never covers another screen, nor a run.
                    if screen == .status && current == nil { screen = .removed }
                case .notice(let said): notice = said
                }
            }
        }
    }

    // MARK: A check for updates

    /// Whether Check for Updates may be chosen now: the menu item is enabled by it, and a link is acted on by it.
    var mayCheck: Bool {
        mayCheckForUpdates(screen: screen, quit: quit, failure: state.failure?.code, fake: fake, phase: update)
    }

    /// Check for Updates, from the menu, the status window's button or a link. Where it may not be chosen, a stand-in build says so
    /// and nothing else happens. The updater is started first; on the setup screen the run is cancelled, and the check waits for its
    /// client to end.
    func checkForUpdates() {
        guard mayCheck else {
            if fake { notice = updatesStandIn }
            return
        }
        guard updater.startUpdater() else {
            notice = updatesCannotStart
            return
        }
        if screen == .setup {
            updatesAfterRun = true
            cancel()
            return
        }
        startWaiting()
    }

    /// The updates page, waiting until nothing is at work.
    private func startWaiting() {
        screen = .updates
        enterWaiting()
    }

    /// Not now, shown only while waiting.
    func notNow() {
        guard update == .waiting else { return }
        endCheck()
    }

    /// Show the update window and Install now: the updater's own window, brought to the front.
    func showUpdateWindow() { updater.check() }

    /// Waiting: the look starts again from nothing, and the marker is written.
    private func enterWaiting() {
        update = .waiting
        idleBefore = false
        entered()
    }

    /// Holding the install until nothing is at work: the look starts again from nothing, and the marker is written.
    private func enterHolding() {
        update = .holding
        idleBefore = false
        entered()
    }

    /// The rest of entering waiting or holding. The check begins now with an empty line, updating begin is queued, and the first
    /// look is asked only once that has ended. A begin that did not end with 0 cannot tell.
    private func entered() {
        began = clock
        updateLine = ""
        entry += 1
        let mine = entry
        mayLook = false
        queueBegin { [weak self] status in
            guard let self, mine == self.entry, self.update == .waiting || self.update == .holding else { return }
            self.mayLook = true
            if status != 0 { self.gated(.cannotTell) }
        }
    }

    /// Every way back to the status: the phase is none and its line empty, then the marker is taken away and the job asked to look,
    /// then the status follows, with `said` under it. `ended` is called once the end command has ended.
    private func endCheck(saying said: String? = nil, ended: (() -> Void)? = nil) {
        update = .none
        updateLine = ""
        queueEnd(then: ended)
        begin(chosen: nil)
        if let said { notice = said }
    }

    /// A quit while waiting: the phase is none, the marker is taken away and the job asked to look, and the quit goes on once that
    /// has ended.
    func endForQuit() {
        update = .none
        updateLine = ""
        quitWaiting = true
        queueEnd(then: { [weak self] in self?.replyToQuit() })
    }

    /// A quit from Offered on: it waits on the updates page, holding until nothing is at work. Its reply comes when holding lets go,
    /// or with a skip.
    func holdForQuit() {
        quitWaiting = true
        screen = .updates
        if update != .holding { enterHolding() }
    }

    /// Lets a quit that waits for the check go on.
    private func replyToQuit() {
        guard quitWaiting else { return }
        quitWaiting = false
        quitMayGo?()
    }

    /// A check's part of each tick: waiting too long, the marker's upkeep, and one look at a time while waiting or holding.
    private func updateTick() {
        guard update != .none else { return }
        let at = clock
        if update == .waiting && waitedTooLong(now: at, began: began) {
            endCheck(saying: updatesWaitedTooLong)
            return
        }
        let limited = update == .waiting || update == .offered || update == .unpacked
        if markDue(now: at, lastMarked: lastMarked, began: began, limited: limited) { queueBegin() }
        guard update == .waiting || update == .holding, mayLook, !looking else { return }
        look()
    }

    /// Asks busy.js idle-why, the command Uninstall asks first, off the main thread, and gives its answer to the gate. An answer
    /// that comes after the phase or the entry has changed is not taken.
    private func look() {
        looking = true
        let mine = entry
        let command = uninstallCommands(app: app)[0]
        let environment = childEnvironment(from: ProcessInfo.processInfo.environment, home: home, app: app)
        DispatchQueue.global().async { [weak self] in
            let ran = runToEnd(command, environment: environment)
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.looking = false
                guard mine == self.entry, self.mayLook, self.update == .waiting || self.update == .holding else { return }
                self.gated(gateNext(status: ran.status, out: ran.out, idleBefore: self.idleBefore))
            }
        }
    }

    /// What follows one answer of idle-why while waiting or holding.
    private func gated(_ next: GateNext) {
        switch next {
        case .again:
            idleBefore = true
        case .wait(let line):
            idleBefore = false
            updateLine = line
        case .cannotTell:
            if update == .waiting {
                endCheck(saying: updatesCannotTell)
            } else {
                // While holding the marker stays, and nothing is asked to look.
                idleBefore = false
                updateLine = updatesCannotTell
            }
        case .go:
            if update == .waiting {
                update = .offered
                began = clock
                updater.check()
            } else {
                // Holding lets go once: no look is asked from here on.
                mayLook = false
                queueBegin { [weak self] _ in
                    guard let self, self.update == .holding else { return }
                    self.update = .installing
                    self.updater.install()
                    self.replyToQuit()
                }
            }
        }
    }

    /// Queues busy.js updating begin behind every marker command asked before it. When its turn comes it looks at the phase first,
    /// and is dropped when that is none. `then` is given its status on the main thread.
    private func queueBegin(then: ((Int32) -> Void)? = nil) {
        lastMarked = clock
        let command = updatingCommands(app: app)?.begin
        let environment = childEnvironment(from: ProcessInfo.processInfo.environment, home: home, app: app)
        markers.async { [weak self] in
            let phase: UpdatePhase = DispatchQueue.main.sync { self?.update ?? UpdatePhase.none }
            guard phase != .none else { return }
            let status = command.map { runToEnd($0, environment: environment).status } ?? 127
            DispatchQueue.main.async { then?(status) }
        }
    }

    /// Queues busy.js updating end --look behind every marker command asked before it. `then` is called on the main thread once it
    /// has ended.
    private func queueEnd(then: (() -> Void)? = nil) {
        let command = updatingCommands(app: app)?.end
        let environment = childEnvironment(from: ProcessInfo.processInfo.environment, home: home, app: app)
        markers.async {
            if let command { _ = runToEnd(command, environment: environment) }
            DispatchQueue.main.async { then?() }
        }
    }

    /// The time now, in seconds.
    private var clock: Double { Date().timeIntervalSinceReferenceDate }

    // MARK: The guide

    /// Makes the run's guide into its PDF: its answer is guideMade, a setup's PDF is opened in Preview, and a PDF that could not be
    /// made is told with the HTML's path.
    private func madeGuide(_ guide: Guide, outcome: String) {
        pdf(html: guide.html, pdf: guide.pdf) { [weak self] made in
            guard let self else { return }
            self.guideMade = made
            self.guideNotice = made ? nil : "\(guideNotMade) \(guide.html)."
            if !made {
                self.notice = self.guideNotice
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
