// The setup and repair screen: the steps down the left, and on the right the step, the review, the open question, the bars and the
// ending. A question is drawn by its kind, never by its id, and every answer goes through the model's answer with a Reply.
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

/// One bar: its label and detail, a measured bar with a total, an unmeasured one without while it runs, and a mark at its end.
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
            if let total = bar.total {
                ProgressView(value: Double(min(bar.done, total)), total: Double(max(total, 1)))
            } else if bar.state == "running" {
                ProgressView().progressViewStyle(.linear)
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

/// The open question, drawn by its kind. Each button sends a Reply through the model.
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
            Button(question.ok ?? "") { model.answer(.confirm) }.buttonStyle(MainButtonStyle())
        case .text:
            Button("Continue") { model.answer(.text(typed.text)) }.buttonStyle(MainButtonStyle())
        case .choice:
            VStack(alignment: .leading, spacing: 10) {
                ForEach(question.options, id: \.value) { option in
                    VStack(alignment: .leading, spacing: 2) {
                        Button(option.label) { model.answer(.choice(option.value)) }
                        if let detail = option.detail { Text(detail).font(.callout).foregroundColor(Brand.fog) }
                    }
                }
            }
        case .folder:
            HStack {
                Button("Use this folder") { model.answer(.folder(question.suggested ?? "")) }.buttonStyle(MainButtonStyle())
                Button("Choose another folder…") { chooseFolder() }
            }
        case .apps:
            Button("Continue") { model.answer(.apps(.proceed)) }.buttonStyle(MainButtonStyle())
        case .signIn:
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    if let link = question.link {
                        Button("Open the sign-in page") { openLink(link) }
                    }
                    Button("Continue") {
                        let sent = typed.code
                        typed.code = ""
                        model.answer(.signIn(code: sent))
                    }
                    .buttonStyle(MainButtonStyle())
                }
                Button("I signed in in the browser") { model.answer(.signIn(code: nil)) }
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
            case .installClaudeCode: Button("Install Claude Code") { model.answer(.apps(.installClaudeCode)) }
            case .signIn: Button("Sign in") { model.answer(.apps(.signIn)) }
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
            model.answer(.folder(picked.path))
        }
    }
}

/// The end of a setup: its summary, the notes and the buttons that follow, or that it was stopped.
struct DoneView: View {
    @ObservedObject var model: AppModel
    let done: Done

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if done.outcome == "cancelled" {
                Text("Setup was stopped.")
                notes
            } else {
                if let result = model.state.result { SummaryLines(lines: result.lines) }
                notes
                if let notice = model.notice { Text(notice).foregroundColor(Brand.fog) }
                HStack {
                    Button("Copy setup summary") { model.copySummary() }
                    Button("Open Getting Started guide") { model.openGuide() }
                    Button("Open your BRIMM Video Studio folder in Claude") { model.openClaude() }
                }
            }
            Button("Close") { close() }.buttonStyle(MainButtonStyle())
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

/// The setup and repair screen.
struct SetupPage: View {
    @ObservedObject var model: AppModel

    var body: some View {
        let state = model.state
        HStack(spacing: 0) {
            StepList(rows: state.rows)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let step = state.step {
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
                    if !state.bars.isEmpty {
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
    }

    /// What tells one question from the next for the view's own state, such as a field's text, made without the question's id: a
    /// new step, kind, prompt or suggestion starts the view afresh, and the same question asked again keeps what was typed.
    private func questionKey(_ question: Question, step: StepEvent?) -> String {
        [String(step?.n ?? 0), question.kind.rawValue, question.prompt, question.suggested ?? ""].joined(separator: "\u{0}")
    }
}
