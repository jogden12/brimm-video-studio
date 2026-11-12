// SparkleUpdater: the one file that names the updater's own framework. It starts the updater only when a check is first asked for,
// hands a check over to the updater's window, and tells the model, through four closures, when an update is unpacked, when a check
// has ended, when an update was skipped and when its install asks to relaunch, which it always postpones. It decides nothing: the
// model asks Updates.swift. Without the framework, as in a typecheck with no -F, the class has the same members and never starts; a
// real build links the framework, so it can never ship that class. The updater's types are main-actor, and every call here is made
// on the main thread.
#if canImport(Sparkle)
import Foundation
import Sparkle

final class SparkleUpdater: NSObject, SPUUpdaterDelegate {
    /// Called when the updater starts to unpack an update, and when it has unpacked one.
    var onUnpacked: (() -> Void)?
    /// Called when a check, with whatever followed it in the updater's window, has ended.
    var onEnded: (() -> Void)?
    /// Called when the person chose Skip for an update.
    var onSkipped: (() -> Void)?
    /// Called when an update's install asks to relaunch the app, which is postponed until install() is called.
    var onInstallAsked: (() -> Void)?

    /// The channels this build may take, besides the default one.
    private let channels: Set<String>
    private var controller: SPUStandardUpdaterController?
    /// Whether the updater started, once it has been asked to start: nil until then.
    private var started: Bool?
    /// The updater's block that installs and relaunches, kept from the postponed relaunch until install() calls it.
    private var installKept: (() -> Void)?

    init(channels: [String]) {
        self.channels = Set(channels)
        super.init()
    }

    /// Starts the updater the first time, and gives whether that worked, then and every time after.
    func startUpdater() -> Bool {
        if let started { return started }
        let made = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
        controller = made
        do {
            try made.updater.start()
            started = true
        } catch {
            started = false
        }
        return started ?? false
    }

    /// Hands a check over to the updater's own window, which also brings that window to the front while one is open.
    func check() {
        guard started == true, let controller else { return }
        controller.updater.checkForUpdates()
    }

    /// Lets the postponed install go on, once, on the main thread. It does nothing when no install is kept.
    func install() {
        guard let kept = installKept else { return }
        installKept = nil
        if Thread.isMainThread {
            kept()
        } else {
            DispatchQueue.main.async(execute: kept)
        }
    }

    // MARK: The updater's delegate

    func allowedChannels(for updater: SPUUpdater) -> Set<String> { channels }

    func updater(_ updater: SPUUpdater, willExtractUpdate item: SUAppcastItem) { onUnpacked?() }

    func updater(_ updater: SPUUpdater, didExtractUpdate item: SUAppcastItem) { onUnpacked?() }

    func updater(_ updater: SPUUpdater, userDidMake choice: SPUUserUpdateChoice, forUpdate updateItem: SUAppcastItem, state: SPUUserUpdateState) {
        if choice == .skip { onSkipped?() }
    }

    func updater(_ updater: SPUUpdater, didFinishUpdateCycleFor updateCheck: SPUUpdateCheck, error: Error?) { onEnded?() }

    func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem, untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        installKept = installHandler
        onInstallAsked?()
        return true
    }
}
#else
import Foundation

/// The same members without the framework: it never starts, and checks and installs nothing.
final class SparkleUpdater: NSObject {
    var onUnpacked: (() -> Void)?
    var onEnded: (() -> Void)?
    var onSkipped: (() -> Void)?
    var onInstallAsked: (() -> Void)?

    init(channels: [String]) {
        super.init()
    }

    func startUpdater() -> Bool { false }

    func check() {}

    func install() {}
}
#endif
