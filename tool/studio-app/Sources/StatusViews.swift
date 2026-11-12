// The window's one view, which switches on the model's screen, and every screen but setup, repair and update: checking, the move to
// Applications, two copies, the status window and its Uninstall, removed, refused, and Check for Updates.
import AppKit
import SwiftUI

/// The window's one view.
struct RootView: View {
    @ObservedObject var model: AppModel

    var body: some View {
        Group {
            switch model.screen {
            case .checking: CheckingPage()
            case .move: MovePage(model: model)
            case .refused: RefusedPage(model: model)
            case .setup, .repairing, .updating: SetupPage(model: model)
            case .twoCopies: TwoCopiesPage(model: model)
            case .status: StatusPage(model: model)
            case .removed: RemovedPage(model: model)
            case .updates: UpdatesPage(model: model)
            }
        }
        .frame(width: 760, height: 560)
        .background(Brand.smoke)
    }
}

/// A page of its own: its words from the top left, with room around them.
struct Page<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) { content }
                .padding(32)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// A small spinner and what is being done, while the move or Uninstall works.
struct Working: View {
    let text: String

    var body: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text(text).foregroundColor(Brand.fog)
        }
    }
}

struct CheckingPage: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Looking at this Mac…").foregroundColor(Brand.fog)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct MovePage: View {
    @ObservedObject var model: AppModel

    var body: some View {
        Page {
            Heading(text: "Move BRIMM Video Studio to your Applications folder")
            Text(
                "BRIMM Video Studio is running from the place it was downloaded to, and macOS keeps it apart there. It needs to be in your Applications folder before it can set up this Mac."
            )
            if model.movesToHome {
                Text("It goes in the Applications folder in your home folder, which needs no administrator's password.")
            }
            Button("Move to Applications") { model.moveToApplications() }.buttonStyle(MainButtonStyle()).disabled(model.working)
            if model.working { Working(text: "Moving BRIMM Video Studio…") }
            if let notice = model.notice { Text(notice).foregroundColor(Brand.fog) }
        }
    }
}

struct TwoCopiesPage: View {
    @ObservedObject var model: AppModel

    var body: some View {
        Page {
            Text(
                "There are two copies of BRIMM Video Studio on this Mac: this one, and one at \(model.other ?? ""). This Mac was not set up from this one."
            )
            HStack {
                Button("Open the other copy") { model.openOtherCopy() }.buttonStyle(MainButtonStyle())
                Button("Use this copy instead") { model.useThisCopy() }
            }
            Text("Put the copy you do not use in the Trash.").foregroundColor(Brand.fog)
            if let notice = model.notice { Text(notice).foregroundColor(Brand.fog) }
        }
    }
}

/// Whether Uninstall's sheet is shown. SwiftUI's @State is a macro the Command Line Tools cannot expand, so it is an object.
final class Asking: ObservableObject {
    @Published var shown = false
}

struct StatusPage: View {
    @ObservedObject var model: AppModel
    @StateObject private var asking = Asking()

    var body: some View {
        let offers = model.offers
        Page {
            if model.fake {
                Text("This build's setup is a stand-in: it changes nothing on this Mac.").foregroundColor(Brand.fog)
            }
            if let status = model.state.status { SummaryLines(lines: status.lines) }
            // Uninstall is offered exactly when the launch agent's file is there, so its absence says the file is not.
            if !offers.contains("uninstall") {
                Text("Background job: not on this Mac. Choose Repair to start it.")
            }
            HStack {
                ForEach(offers, id: \.self) { offer in button(offer) }
            }
            .disabled(model.working)
            if model.working { Working(text: "Stopping the background job…") }
            if let notice = model.notice { Text(notice).foregroundColor(Brand.fog) }
        }
        .sheet(isPresented: $asking.shown) {
            UninstallSheet(model: model, asking: asking)
        }
    }

    @ViewBuilder
    private func button(_ offer: String) -> some View {
        switch offer {
        case "updates": Button("Check for Updates…") { model.checkForUpdates() }
        case "repair": Button("Repair") { model.begin(chosen: .repair) }
        case "guide": Button("Open Getting Started guide") { model.openGuide() }
        case "uninstall": Button("Uninstall…") { asking.shown = true }
        default: EmptyView()
        }
    }
}

/// Uninstall asks first.
struct UninstallSheet: View {
    @ObservedObject var model: AppModel
    @ObservedObject var asking: Asking

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Stop BRIMM Video Studio on this Mac?").font(.headline).foregroundColor(Brand.navy)
            Text(
                "The background job that watches for new videos is taken away. Your videos, your folders, this Mac's settings and the transcription model stay. To finish, put BRIMM Video Studio in the Trash."
            )
            .fixedSize(horizontal: false, vertical: true)
            HStack {
                Spacer()
                Button("Cancel") { asking.shown = false }.keyboardShortcut(.cancelAction)
                Button("Stop it") {
                    asking.shown = false
                    model.uninstall()
                }
                .buttonStyle(MainButtonStyle())
            }
        }
        .padding(24)
        .frame(width: 440)
    }
}

/// After Uninstall: what it did, Repair to start the background job again, and Close. A stand-in build says first that it changed
/// nothing.
struct RemovedPage: View {
    @ObservedObject var model: AppModel

    var body: some View {
        Page {
            if model.fake {
                Text("This build's setup is a stand-in: it changes nothing on this Mac.").foregroundColor(Brand.fog)
            }
            Text("BRIMM Video Studio no longer watches for new videos on this Mac. To start it again, open it and choose Repair.")
            HStack {
                Button("Repair") { model.begin(chosen: .repair) }
                Button("Close") { NSApp.terminate(nil) }.buttonStyle(MainButtonStyle())
            }
        }
    }
}

/// A Mac the app will not set up: the failure, with only Close. A status that ended without saying what this Mac needs is shown
/// with the engine's own last-resort words. Since this screen offers no Repair, a failure of code `engine` (the shell's own crash
/// failure, or the engine's catch-all) is shown with the advice to download the app again, never with an advice to choose Repair.
struct RefusedPage: View {
    @ObservedObject var model: AppModel

    var body: some View {
        let given = model.state.failure ?? Failure(code: "engine", message: crashMessage, advice: crashAdvice, contact: nil, details: nil)
        let shown =
            given.code == "engine"
            ? Failure(code: given.code, message: given.message, advice: damagedAdvice, contact: given.contact, details: given.details) : given
        Page {
            FailureView(model: model, failure: shown, offersRepair: false)
        }
    }
}

/// Check for Updates: what the check is doing, by its phase. While waiting, busy.js's line and Not now; once the update's own window
/// has the check, a button that brings that window to the front.
struct UpdatesPage: View {
    @ObservedObject var model: AppModel

    var body: some View {
        Page {
            Heading(text: updatesHeading)
            switch model.update {
            case .waiting:
                Text(updatesWaiting)
                if !model.updateLine.isEmpty { Text(model.updateLine).foregroundColor(Brand.fog) }
                Button(updatesNotNow) { model.notNow() }
            case .offered:
                Text(updatesOffered)
                Button(updatesShowWindow) { model.showUpdateWindow() }
            case .unpacked:
                Text(updatesUnpacked)
                Button(updatesInstallNow) { model.showUpdateWindow() }.buttonStyle(MainButtonStyle())
            case .holding, .installing:
                Text(updatesHolding)
                if !model.updateLine.isEmpty { Text(model.updateLine).foregroundColor(Brand.fog) }
            case .none:
                EmptyView()
            }
        }
    }
}
