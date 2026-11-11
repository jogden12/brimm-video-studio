// The engine's six events as the shell reads them, and the window's state made from them. It imports only Foundation, so
// studio-check is compiled from it and node's tests ask it what a run's events make.
import Foundation

// MARK: The events

/// A question's kind. The window draws a question by its kind, never by its id.
enum Kind: String {
    case confirm, text, choice, folder, apps
    case signIn = "sign-in"
}

struct StepEvent {
    let id: String
    let n: Int
    let of: Int
    let title: String
    let body: [String]
}

struct Option {
    let value: String
    let label: String
    let detail: String?
}

struct AppRow {
    let id: String
    let name: String
    let here: Bool
    let link: String?
    let note: String?
    let action: String?
}

struct Question {
    let id: String
    let kind: Kind
    let prompt: String
    let warning: String?
    let fault: String?
    let ok: String?
    let suggested: String?
    let words: String?
    let purpose: String?
    let options: [Option]
    let apps: [AppRow]
    let link: String?
    let paste: Bool
}

struct Bar {
    let part: String
    let label: String
    let done: Int
    let total: Int?
    let state: String
    let detail: String?
}

struct Line {
    let label: String
    let value: String
}

struct Summary {
    let id: String
    let ok: Bool
    let lines: [Line]
    let details: String?
    let needs: String?
}

struct Guide {
    let html: String
    let pdf: String
}

struct Done {
    let outcome: String
    let summary: String
    let studio: String
    let guide: Guide?
    let notes: [String]
}

struct Failure {
    let code: String
    let message: String
    let advice: String?
    let contact: String?
    let details: String?
}

enum Event {
    case step(StepEvent)
    case question(Question)
    case progress(Bar)
    case summary(Summary)
    case done(Done)
    case failure(Failure)
}

// MARK: Reading an event

/// A JSON object's fields, read by type. Each read gives nil for a field that is missing or of another type.
private struct Fields {
    let object: [String: Any]

    func string(_ name: String) -> String? { object[name] as? String }

    /// A JSON true or false, never a number.
    func bool(_ name: String) -> Bool? {
        guard let number = object[name] as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return nil }
        return number.boolValue
    }

    /// A JSON whole number, never a true or false or a fraction.
    func int(_ name: String) -> Int? {
        guard let number = object[name] as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let value = number.doubleValue
        guard value == value.rounded(), abs(value) < 1e15 else { return nil }
        return Int(value)
    }

    func strings(_ name: String) -> [String]? { object[name] as? [String] }

    /// A list of objects, each read by `read`; nil when the field is not a list or any of its items cannot be read.
    func list<T>(_ name: String, _ read: (Fields) -> T?) -> [T]? {
        guard let items = object[name] as? [Any] else { return nil }
        var made: [T] = []
        for item in items {
            guard let fields = item as? [String: Any], let one = read(Fields(object: fields)) else { return nil }
            made.append(one)
        }
        return made
    }

    /// Whether the field is missing or JSON's null.
    func isAbsent(_ name: String) -> Bool { object[name] == nil || object[name] is NSNull }
}

private func readStep(_ f: Fields) -> StepEvent? {
    guard let id = f.string("id"), let n = f.int("n"), let of = f.int("of"), let title = f.string("title"), let body = f.strings("body")
    else { return nil }
    return StepEvent(id: id, n: n, of: of, title: title, body: body)
}

private func readOption(_ f: Fields) -> Option? {
    guard let value = f.string("value"), let label = f.string("label") else { return nil }
    return Option(value: value, label: label, detail: f.string("detail"))
}

private func readApp(_ f: Fields) -> AppRow? {
    guard let id = f.string("id"), let name = f.string("name"), let here = f.bool("here") else { return nil }
    return AppRow(id: id, name: name, here: here, link: f.string("link"), note: f.string("note"), action: f.string("action"))
}

/// A question, or nil when it lacks a field its kind must have.
private func readQuestion(_ f: Fields) -> Question? {
    guard let id = f.string("id"), let word = f.string("kind"), let kind = Kind(rawValue: word), let prompt = f.string("prompt") else { return nil }
    var options: [Option] = []
    var apps: [AppRow] = []
    switch kind {
    case .confirm:
        guard f.string("ok") != nil else { return nil }
    case .text:
        guard f.string("suggested") != nil else { return nil }
    case .choice:
        guard let read = f.list("options", readOption), !read.isEmpty else { return nil }
        options = read
    case .folder:
        guard f.string("suggested") != nil, f.string("words") != nil, f.string("purpose") != nil else { return nil }
    case .apps:
        guard let read = f.list("apps", readApp) else { return nil }
        apps = read
    case .signIn:
        guard f.bool("paste") == true else { return nil }
    }
    return Question(
        id: id, kind: kind, prompt: prompt, warning: f.string("warning"), fault: f.string("fault"), ok: f.string("ok"),
        suggested: f.string("suggested"), words: f.string("words"), purpose: f.string("purpose"), options: options, apps: apps,
        link: f.string("link"), paste: f.bool("paste") ?? false)
}

/// A bar. Its total is null while the engine does not know it.
private func readBar(_ f: Fields) -> Bar? {
    guard let part = f.string("part"), let label = f.string("label"), let done = f.int("done"), let state = f.string("state") else { return nil }
    let total = f.int("total")
    guard total != nil || f.isAbsent("total") else { return nil }
    return Bar(part: part, label: label, done: done, total: total, state: state, detail: f.string("detail"))
}

private func readSummary(_ f: Fields) -> Summary? {
    let line = { (l: Fields) -> Line? in
        guard let label = l.string("label"), let value = l.string("value") else { return nil }
        return Line(label: label, value: value)
    }
    guard let id = f.string("id"), let ok = f.bool("ok"), let lines = f.list("lines", line) else { return nil }
    return Summary(id: id, ok: ok, lines: lines, details: f.string("details"), needs: f.string("needs"))
}

/// A done. Its guide is null when the run wrote none.
private func readDone(_ f: Fields) -> Done? {
    guard let outcome = f.string("outcome"), let summary = f.string("summary"), let studio = f.string("studio"), let notes = f.strings("notes")
    else { return nil }
    var guide: Guide? = nil
    if !f.isAbsent("guide") {
        guard let given = f.object["guide"] as? [String: Any], let html = given["html"] as? String, let pdf = given["pdf"] as? String else { return nil }
        guide = Guide(html: html, pdf: pdf)
    }
    return Done(outcome: outcome, summary: summary, studio: studio, guide: guide, notes: notes)
}

private func readFailure(_ f: Fields) -> Failure? {
    guard let code = f.string("code"), let message = f.string("message") else { return nil }
    return Failure(code: code, message: message, advice: f.string("advice"), contact: f.string("contact"), details: f.string("details"))
}

/// The event one of the engine's lines holds; nil for a line that is not one of the six, has a question kind the shell does not
/// know, or lacks a field its kind must have.
func decodeEvent(_ line: Data) -> Event? {
    guard let object = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any], let name = object["event"] as? String else { return nil }
    let f = Fields(object: object)
    switch name {
    case "step": return readStep(f).map { .step($0) }
    case "question": return readQuestion(f).map { .question($0) }
    case "progress": return readBar(f).map { .progress($0) }
    case "summary": return readSummary(f).map { .summary($0) }
    case "done": return readDone(f).map { .done($0) }
    case "error": return readFailure(f).map { .failure($0) }
    default: return nil
    }
}

// MARK: The steps

/// The engine's own titles for its steps.
private let stepTitles: [String: String] = [
    "welcome": "Welcome", "name": "This Mac's name", "apps": "Apps", "dropbox": "BRIMM Video in Dropbox", "folders": "Folders",
    "permissions": "Permissions", "review": "Review", "install": "Install", "done": "Done",
]

/// The steps of a run of `of` steps: a fresh setup's nine, a setup's six on a Mac that has settings, or a repair's two. Any other
/// number gives none, and the rows are then the steps seen so far.
func stepList(of: Int) -> [(id: String, title: String)] {
    let ids: [String]
    switch of {
    case 9: ids = ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review", "install", "done"]
    case 6: ids = ["welcome", "apps", "permissions", "review", "install", "done"]
    case 2: ids = ["install", "done"]
    default: ids = []
    }
    return ids.map { (id: $0, title: stepTitles[$0] ?? $0) }
}

// MARK: The window's state

/// One row of the list of steps beside the window's page.
struct StepRow {
    let id: String
    let title: String
    var mark: Mark

    enum Mark: String {
        case waiting, current, done
    }
}

/// What the window shows, made from the engine's events one at a time.
struct SetupState {
    private(set) var rows: [StepRow] = []
    private(set) var step: StepEvent? = nil
    private(set) var question: Question? = nil
    private(set) var bars: [Bar] = []
    private(set) var review: Summary? = nil
    private(set) var result: Summary? = nil
    private(set) var status: Summary? = nil
    private(set) var done: Done? = nil
    private(set) var failure: Failure? = nil
    private(set) var running = false
    private(set) var installing = false
    private(set) var awaitingCheck = false

    /// Whether the rows were made at the first step, and whether they are a list the shell knows.
    private var rowsMade = false
    private var rowsKnown = false

    init() {}

    /// The engine was started.
    mutating func began() { running = true }

    /// The shell asked the apps question to check again, and waits for the question that answers it.
    mutating func sentCheck() { awaitingCheck = true }

    /// The engine's process ended. Without a done or an error first, it ended on a fault of its own.
    mutating func ended() {
        if done == nil && failure == nil {
            failure = Failure(code: "engine", message: crashMessage, advice: crashAdvice, contact: nil, details: nil)
        }
        running = false
        installing = false
    }

    mutating func take(_ event: Event) {
        switch event {
        case .step(let given):
            takeStep(given)
        case .question(let given):
            question = given
            if given.kind == .apps { awaitingCheck = false }
        case .progress(let given):
            if let at = bars.firstIndex(where: { $0.part == given.part }) {
                bars[at] = given
            } else {
                bars.append(given)
            }
        case .summary(let given):
            switch given.id {
            case "review": review = given
            case "setup": result = given
            case "status": status = given
            default: break
            }
        case .done(let given):
            done = given
            question = nil
            running = false
            installing = false
            if given.outcome != "cancelled" {
                for i in rows.indices { rows[i].mark = .done }
            }
        case .failure(let given):
            failure = given
            question = nil
            running = false
            installing = false
        }
    }

    private mutating func takeStep(_ given: StepEvent) {
        step = given
        question = nil
        review = nil
        if given.id == "install" { installing = true }
        if !rowsMade {
            rowsMade = true
            rows = stepList(of: given.of).map { StepRow(id: $0.id, title: $0.title, mark: .waiting) }
            rowsKnown = !rows.isEmpty
        }
        let at: Int
        if rowsKnown {
            at = given.n - 1
        } else if let seen = rows.firstIndex(where: { $0.id == given.id }) {
            at = seen
        } else {
            rows.append(StepRow(id: given.id, title: given.title, mark: .waiting))
            at = rows.count - 1
        }
        for i in rows.indices { rows[i].mark = i < at ? .done : i == at ? .current : .waiting }
    }
}
