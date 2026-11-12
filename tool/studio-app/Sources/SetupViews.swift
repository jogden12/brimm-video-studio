// The setup, repair and update screen: the steps down the left, and on the right the step, the review, the open question, the bars
// and the ending. A question is drawn by its kind, never by its id, and every answer goes through the model's answer with a Reply.
import AppKit
import SwiftUI

/// The brand's colours (tool/brand/brand.md). The window uses the system font, since the brand's typefaces are web fonts.
enum Brand {
    /// Headings and the main button.
    static let navy = Color(red: 0x1F / 255, green: 0x2D / 255, blue: 0x42 / 255)
    /// The side list's background.
    static let mist = Color(red: 0xE8 / 255, green: 0xE3 / 255, blue: 0xDA / 255)
    /// The window's background.
    static let smoke = Color(red: 0xF8 / 255, green: 0xF7 / 255, blue: 0xF5 / 255)
    /// Quiet text.
    static let fog = Color(red: 0x5C / 255, green: 0x6D / 255, blue: 0x7E / 255)
}

/// The main button: white words on navy.
struct MainButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .foregroundColor(.white)
            .background(RoundedRectangle(cornerRadius: 6).fill(Brand.navy.opacity(configuration.isPressed ? 0.8 : 1)))
    }
}

/// A heading in navy.
struct Heading: View {
    let text: String

    var body: some View {
        Text(text).font(.title2.weight(.semibold)).foregroundColor(Brand.navy)
    }
}

/// A summary's lines as two columns, the label in fog.
struct SummaryLines: View {
    let lines: [Line]

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
            ForEach(lines.indices, id: \.self) { at in
                GridRow {
                    Text(lines[at].label).foregroundColor(Brand.fog)
                    Text(lines[at].value).textSelection(.enabled)
                }
            }
        }
    }
}

/// A `Details` disclosure holding `text` in a scrolling, fixed-width box.
struct DetailsBox: View {
    let text: String

    var body: some View {
        DisclosureGroup("Details") {
            ScrollView {
                Text(text)
                    .font(.system(.footnote, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
            }
            .frame(height: 150)
            .background(Color.white)
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Brand.fog.opacity(0.4)))
        }
    }
}

/// A failure: its message, its advice, whom to write to, its details, and Repair when it may be repaired, then Close.
struct FailureView: View {
    @ObservedObject var model: AppModel
    let failure: Failure
    /// Whether Repair may be offered at all: the refused screen offers only Close.
    let offersRepair: Bool

    /// The codes a repair cannot help.
    private static let notRepaired: Set<String> = ["dev", "settings", "arguments"]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(failure.message).foregroundColor(.red)
            if let advice = failure.advice { Text(advice) }
            if let contact = failure.contact { Text("For help, write to \(contact).") }
            if let details = failure.details { DetailsBox(text: details) }
            HStack {
                if offersRepair && !FailureView.notRepaired.contains(failure.code) {
                    Button("Repair") { model.begin(chosen: .repair) }.buttonStyle(MainButtonStyle())
                }
                Button("Close") { NSApp.terminate(nil) }
            }
        }
    }
}

/// The list of steps beside the page, each with its mark.
struct StepList: View {
    let rows: [StepRow]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(rows.indices, id: \.self) { at in
                HStack(spacing: 8) {
                    mark(rows[at].mark).frame(width: 14)
                    Text(rows[at].title)
                        .foregroundColor(rows[at].mark == .waiting ? Brand.fog : Brand.navy)
                        .fontWeight(rows[at].mark == .current ? .semibold : .regular)
                }
            }
            Spacer()
        }
        .padding(16)
        .frame(width: 190, alignment: .leading)
        .frame(maxHeight: .infinity)
        .background(Brand.mist)
    }

    @ViewBuilder
    private func mark(_ mark: StepRow.Mark) -> some View {
        switch mark {
        case .done: Image(systemName: "checkmark").foregroundColor(Brand.navy)
        case .current: Image(systemName: "circle.fill").font(.system(size: 9)).foregroundColor(Brand.navy)
        case .waiting: Image(systemName: "circle").font(.system(size: 9)).foregroundColor(Brand.fog)
        }
    }
}

/// One line of the progress: its label and detail, and a mark or a bar. Only a line that is running draws a bar, measured when it has
/// a total; one that is done has a tick, skipped a dash and failed a cross, and one that is waiting has only its label and detail.
struct BarView: View {
    let bar: Bar

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                switch bar.state {
                case "done": Image(systemName: "checkmark").foregroundColor(Brand.navy)
                case "skipped": Image(systemName: "minus").foregroundColor(Brand.fog)
                case "failed": Image(systemName: "xmark").foregroundColor(.red)
                default: EmptyView()
                }
                Text(bar.label)
            }
            if bar.state == "running" {
                if let total = bar.total {
                    ProgressView(value: Double(min(bar.done, total)), total: Double(max(total, 1)))
                } else {
                    ProgressView().progressViewStyle(.linear)
                }
            }
            if let detail = bar.detail { Text(detail).font(.callout).foregroundColor(Brand.fog) }
        }
    }
}

/// What is typed into a question's fields. SwiftUI's @State is a macro in the Command Line Tools' SDK, whose plugin they lack, so
/// a view's own state is kept in an object of its own.
final class Typed: ObservableObject {
    @Published var text: String
    @Published var code = ""

    init(text: String) { self.text = text }
}

/// The open question, drawn by its kind. Each button sends a Reply through the model, with the id of the question it was drawn for,
/// so that a click on a question that has since gone sends nothing.
struct QuestionView: View {
    @ObservedObject var model: AppModel
    let question: Question

    /// Made afresh for each new question, so the text field starts at the suggestion each time.
    @StateObject private var typed: Typed

    init(model: AppModel, question: Question) {
        self.model = model
        self.question = question
        _typed = StateObject(wrappedValue: Typed(text: question.suggested ?? ""))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(question.prompt)
            fields
            if let warning = question.warning {
                Label(warning, systemImage: "exclamationmark.triangle").foregroundColor(Brand.fog)
            }
            if let fault = question.fault { Text(fault).foregroundColor(.red) }
            buttons
        }
    }

    /// What the person reads or types before the buttons.
    @ViewBuilder
    private var fields: some View {
        switch question.kind {
        case .text:
            TextField("", text: $typed.text).textFieldStyle(.roundedBorder).frame(maxWidth: 360)
        case .folder:
            if let words = question.words { Text(words).foregroundColor(Brand.fog).textSelection(.enabled) }
        case .apps:
            VStack(alignment: .leading, spacing: 8) {
                ForEach(question.apps, id: \.id) { row in appRow(row) }
            }
        case .signIn:
            TextField("Code", text: $typed.code).textFieldStyle(.roundedBorder).frame(maxWidth: 360)
        case .confirm, .choice:
            EmptyView()
        }
    }

    @ViewBuilder
    private var buttons: some View {
        switch question.kind {
        case .confirm:
            Button(question.ok ?? "Continue") { model.answer(question.id, .confirm) }.buttonStyle(MainButtonStyle())
        case .text:
            Button("Continue") { model.answer(question.id, .text(typed.text)) }.buttonStyle(MainButtonStyle())
        case .choice:
            VStack(alignment: .leading, spacing: 10) {
                ForEach(question.options, id: \.value) { option in
                    VStack(alignment: .leading, spacing: 2) {
                        Button(option.label) { model.answer(question.id, .choice(option.value)) }
                        if let detail = option.detail { Text(detail).font(.callout).foregroundColor(Brand.fog) }
                    }
                }
            }
        case .folder:
            HStack {
                Button("Use this folder") { model.answer(question.id, .folder(question.suggested ?? "")) }.buttonStyle(MainButtonStyle())
                Button("Choose another folder…") { chooseFolder() }
            }
        case .apps:
            Button("Continue") { model.answer(question.id, .apps(.proceed)) }.buttonStyle(MainButtonStyle())
        case .signIn:
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    if let link = question.link {
                        Button("Open the sign-in page") { openLink(link) }
                    }
                    Button("Continue") {
                        let sent = typed.code
                        typed.code = ""
                        model.answer(question.id, .signIn(code: sent))
                    }
                    .buttonStyle(MainButtonStyle())
                    .disabled(typed.code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Button("I signed in in the browser") { model.answer(question.id, .signIn(code: nil)) }
            }
        }
    }

    /// One app's row: a tick when it is here, its note, its download link and the action it carries.
    private func appRow(_ row: AppRow) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: row.here ? "checkmark.circle.fill" : "circle")
                .foregroundColor(row.here ? Brand.navy : Brand.fog)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.name)
                if let note = row.note { Text(note).font(.callout).foregroundColor(Brand.fog) }
            }
            Spacer()
            if let link = row.link {
                Button("Download") { openLink(link) }
            }
            switch row.action.flatMap(AppsReply.init(rawValue:)) {
            case .installClaudeCode: Button("Install Claude Code") { model.answer(question.id, .apps(.installClaudeCode)) }
            case .signIn: Button("Sign in") { model.answer(question.id, .apps(.signIn)) }
            default: EmptyView()
            }
        }
    }

    private func openLink(_ link: String) {
        if let url = URL(string: link) { NSWorkspace.shared.open(url) }
    }

    /// Asks for a folder, starting at the suggested one, and sends the folder picked.
    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        if let suggested = question.suggested { panel.directoryURL = URL(fileURLWithPath: suggested, isDirectory: true) }
        if panel.runModal() == .OK, let picked = panel.url {
            model.answer(question.id, .folder(picked.path))
        }
    }
}

/// The end of a setup: its summary, the notes and the buttons that follow, or that it was stopped. The end of an update shows the
/// done step's body and every note, as they came, with Continue alone, which goes on to the status: the note stays until it is read.
struct DoneView: View {
    @ObservedObject var model: AppModel
    let done: Done

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if done.outcome == "updated" {
                if let step = model.state.step {
                    ForEach(step.body.indices, id: \.self) { at in Text(step.body[at]) }
                }
                notes
                Button("Continue") { model.begin(chosen: nil) }.buttonStyle(MainButtonStyle())
            } else {
                if done.outcome == "cancelled" {
                    Text("Setup was stopped.")
                    notes
                } else {
                    if let result = model.state.result { SummaryLines(lines: result.lines) }
                    notes
                    if let notice = model.notice { Text(notice).foregroundColor(Brand.fog) }
                    // One under another, so that each keeps its whole title.
                    VStack(alignment: .leading, spacing: 8) {
                        Button("Copy setup summary") { model.copySummary() }.fixedSize()
                        Button("Open Getting Started guide") { model.openGuide() }.fixedSize()
                        Button("Open your BRIMM Video Studio folder in Claude") { model.openClaude() }.fixedSize()
                    }
                }
                Button("Close") { close() }.buttonStyle(MainButtonStyle())
            }
        }
    }

    private var notes: some View {
        ForEach(done.notes.indices, id: \.self) { at in Text(done.notes[at]) }
    }

    /// After a setup that installed, Close goes on to the status window; after any other ending it closes the app.
    private func close() {
        if done.outcome == "installed" {
            model.cancel()
        } else {
            NSApp.terminate(nil)
        }
    }
}

/// The setup, repair and update screen. Its page shows its top whenever the step or the open question changes, and when the run
/// ends, so that a page taller than the window opens at its heading. A run that failed is headed as stopped, without the step's own
/// words: the fault is not about that step, and the list beside the page still shows where it stopped.
struct SetupPage: View {
    @ObservedObject var model: AppModel

    /// The mark at the top of the page, which the page is scrolled to.
    private static let top = "top"

    var body: some View {
        let state = model.state
        HStack(spacing: 0) {
            StepList(rows: state.rows)
            ScrollViewReader { reader in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        // The mark at the page's top, taking no room.
                        Color.clear.frame(height: 0).id(SetupPage.top)
                        VStack(alignment: .leading, spacing: 16) {
                            if state.failure != nil && state.done == nil {
                                Heading(text: stoppedHeading)
                            } else if model.screen == .updating {
                                // The update has its own heading over the bars. At its end DoneView shows the done step's body.
                                Heading(text: updateHeading)
                                if state.done == nil, let step = state.step {
                                    ForEach(step.body.indices, id: \.self) { at in Text(step.body[at]) }
                                }
                            } else if let step = state.step {
                                Heading(text: step.title)
                                ForEach(step.body.indices, id: \.self) { at in Text(step.body[at]) }
                            }
                            if let review = state.review {
                                SummaryLines(lines: review.lines)
                                if let details = review.details { DetailsBox(text: details) }
                            }
                            if let question = state.question {
                                QuestionView(model: model, question: question).id(questionKey(question, step: state.step))
                            }
                            // At Done every line is finished, and the summary says so; on a failure they stay.
                            if !state.bars.isEmpty && state.done == nil {
                                VStack(alignment: .leading, spacing: 10) {
                                    ForEach(state.bars, id: \.part) { bar in BarView(bar: bar) }
                                }
                            }
                            if let done = state.done {
                                DoneView(model: model, done: done)
                            } else if let failure = state.failure {
                                FailureView(model: model, failure: failure, offersRepair: true)
                            }
                            if state.running {
                                HStack {
                                    if !state.installing { Button("Back") { model.back() } }
                                    Button("Cancel") { model.cancel() }.disabled(state.installing)
                                }
                            }
                            if state.done == nil, let notice = model.notice { Text(notice).foregroundColor(Brand.fog) }
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .onAppear { showTop(reader) }
                .onChange(of: pageKey(state)) { _ in showTop(reader) }
            }
        }
    }

    /// The heading of a run that stopped on a failure, by the screen it ran on.
    private var stoppedHeading: String {
        switch model.screen {
        case .updating: return updateStopped
        case .repairing: return "Repair stopped"
        default: return "Setup stopped"
        }
    }

    /// Scrolls the page to its top, now and again once the page has been laid out, since the first content is laid out after it
    /// appears.
    private func showTop(_ reader: ScrollViewProxy) {
        reader.scrollTo(SetupPage.top, anchor: .top)
        DispatchQueue.main.async { reader.scrollTo(SetupPage.top, anchor: .top) }
    }

    /// What changes when the page should show its top again: the step, the open question (as questionKey tells one from the next,
    /// so the apps question asked again by its timer is the same), and whether the run is still running.
    private func pageKey(_ state: SetupState) -> String {
        [
            state.step.map { "\($0.n) \($0.title)" } ?? "", state.question.map { questionKey($0, step: state.step) } ?? "",
            state.running ? "running" : "ended",
        ].joined(separator: "\u{1}")
    }

    /// What tells one question from the next for the view's own state, such as a field's text, made without the question's id: a
    /// new step, kind, prompt or suggestion starts the view afresh, and the same question asked again keeps what was typed.
    private func questionKey(_ question: Question, step: StepEvent?) -> String {
        [String(step?.n ?? 0), question.kind.rawValue, question.prompt, question.suggested ?? ""].joined(separator: "\u{0}")
    }
}
