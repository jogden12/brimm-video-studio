// studio-check: the tests' way into the app's Swift. `studio-check <command> …` prints one JSON value and a line feed and ends with
// 0, or says why on stderr and ends with 2. Each command is one small function, and the switch at the end names them all: a later
// task adds its own functions and cases and touches no other.
import Foundation
import PDFKit

/// Prints `value` as JSON and ends with 0. A nil prints as null, a Bool as true or false and a String as a JSON string.
func emit(_ value: Any?) -> Never {
    do {
        let data = try JSONSerialization.data(withJSONObject: value ?? NSNull(), options: [.fragmentsAllowed, .sortedKeys, .withoutEscapingSlashes])
        FileHandle.standardOutput.write(data + Data([10]))
        exit(0)
    } catch {
        fail("studio-check could not write its answer as JSON: \(error)")
    }
}

/// Says why on stderr and ends with 2.
func fail(_ why: String) -> Never {
    FileHandle.standardError.write(Data("\(why)\n".utf8))
    exit(2)
}

/// `args`, which must be exactly `count` words long for `command`.
func exactly(_ count: Int, _ args: [String], _ command: String) -> [String] {
    if args.count != count { fail("\(command) takes \(count) words, and was given \(args.count).") }
    return args
}

/// `args`, which must be at least `count` words long for `command`.
func atLeast(_ count: Int, _ args: [String], _ command: String) -> [String] {
    if args.count < count { fail("\(command) takes at least \(count) words, and was given \(args.count).") }
    return args
}

/// The Bool that `word` says: yes or no.
func yesNo(_ word: String) -> Bool {
    switch word {
    case "yes": return true
    case "no": return false
    default: fail("\"\(word)\" is neither yes nor no.")
    }
}

/// The Run that `word` names.
func runOf(_ word: String) -> Run {
    guard let run = Run(rawValue: word) else { fail("\"\(word)\" is not a run the shell starts.") }
    return run
}

/// All of stdin.
func readInput() -> Data { FileHandle.standardInput.readDataToEndOfFile() }

/// A Command as JSON's { program, arguments }, or nil.
func commandValue(_ command: Command?) -> Any? {
    guard let command else { return nil }
    return ["program": command.program, "arguments": command.arguments]
}

// MARK: Core.swift

/// stdin's bytes, fed to a LineSplitter a few at a time: { lines, rest }.
func checkSplit(_ args: [String]) -> Never {
    _ = exactly(0, args, "split")
    let input = readInput()
    var splitter = LineSplitter()
    var lines: [Data] = []
    var at = input.startIndex
    while at < input.endIndex {
        let end = input.index(at, offsetBy: 7, limitedBy: input.endIndex) ?? input.endIndex
        lines += splitter.feed(input.subdata(in: at..<end))
        at = end
    }
    let text = { (data: Data) in String(decoding: data, as: UTF8.self) }
    emit(["lines": lines.map(text), "rest": text(splitter.rest())])
}

func checkEngineCommand(_ args: [String]) -> Never {
    let words = exactly(2, args, "engine-command")
    emit(commandValue(engineCommand(run: runOf(words[0]), app: words[1])))
}

func checkAgentCommand(_ args: [String]) -> Never {
    let words = atLeast(1, args, "agent-command")
    emit(commandValue(agentCommand(rest: Array(words.dropFirst()), app: words[0])))
}

/// stdin is a JSON object of strings: the environment the app was given.
func checkEnvironment(_ args: [String]) -> Never {
    let words = exactly(2, args, "environment")
    guard let from = (try? JSONSerialization.jsonObject(with: readInput())) as? [String: String] else {
        fail("environment reads a JSON object of strings on stdin.")
    }
    emit(childEnvironment(from: from, home: words[0], app: words[1]))
}

func checkLaunch(_ args: [String]) -> Never {
    switch launchOf(args) {
    case .agent(let rest): emit(["agent": rest])
    case .window: emit(["window": true])
    }
}

func checkTranslocated(_ args: [String]) -> Never {
    emit(isTranslocated(exactly(1, args, "translocated")[0]))
}

func checkMoveTarget(_ args: [String]) -> Never {
    let words = exactly(2, args, "move-target")
    emit(moveTarget(home: words[0], systemWritable: yesNo(words[1])))
}

/// The words after the app and the home are the paths that exist.
func checkOtherCopy(_ args: [String]) -> Never {
    let words = atLeast(2, args, "other-copy")
    let there = Set(words.dropFirst(2))
    emit(otherCopy(of: words[0], home: words[1], exists: { there.contains($0) }))
}

func checkAgentFile(_ args: [String]) -> Never {
    emit(agentFile(home: exactly(1, args, "agent-file")[0]))
}

func checkGuidePaths(_ args: [String]) -> Never {
    let paths = guidePaths(home: exactly(1, args, "guide-paths")[0])
    emit(["html": paths.html, "pdf": paths.pdf])
}

func checkURL(_ args: [String]) -> Never {
    emit(urlAction(exactly(1, args, "url")[0]))
}

func checkNames(_ args: [String]) -> Never {
    _ = exactly(0, args, "names")
    emit([
        "appName": appName, "agentLabel": agentLabel, "guideName": guideName, "workFolderName": workFolderName,
        "crashMessage": crashMessage, "crashAdvice": crashAdvice, "checkEvery": checkEvery,
    ])
}

/// next <translocated yes|no> <needs: setup|repair|nothing|none> <failed yes|no> <chosen: setup|repair|none> <other yes|no>.
func checkNext(_ args: [String]) -> Never {
    let words = exactly(5, args, "next")
    let needs: String?
    switch words[1] {
    case "setup", "repair", "nothing": needs = words[1]
    case "none": needs = nil
    default: fail("\"\(words[1])\" is not setup, repair, nothing or none.")
    }
    let chosen: Run?
    switch words[3] {
    case "setup", "repair": chosen = runOf(words[3])
    case "none": chosen = nil
    default: fail("\"\(words[3])\" is not setup, repair or none.")
    }
    emit(nextStep(translocated: yesNo(words[0]), needs: needs, failed: yesNo(words[2]), chosen: chosen, other: yesNo(words[4])).rawValue)
}

// MARK: State.swift

/// `value`, or JSON's null for a nil.
func orNull(_ value: Any?) -> Any { value ?? NSNull() }

func stepValue(_ s: StepEvent) -> [String: Any] { ["id": s.id, "n": s.n, "of": s.of, "title": s.title, "body": s.body] }

func questionValue(_ q: Question) -> [String: Any] {
    [
        "id": q.id, "kind": q.kind.rawValue, "prompt": q.prompt, "warning": orNull(q.warning), "fault": orNull(q.fault), "ok": orNull(q.ok),
        "suggested": orNull(q.suggested), "words": orNull(q.words), "purpose": orNull(q.purpose),
        "options": q.options.map { ["value": $0.value, "label": $0.label, "detail": orNull($0.detail)] },
        "apps": q.apps.map { ["id": $0.id, "name": $0.name, "here": $0.here, "link": orNull($0.link), "note": orNull($0.note), "action": orNull($0.action)] },
        "link": orNull(q.link), "paste": q.paste,
    ]
}

func barValue(_ b: Bar) -> [String: Any] {
    ["part": b.part, "label": b.label, "done": b.done, "total": orNull(b.total), "state": b.state, "detail": orNull(b.detail)]
}

func summaryValue(_ s: Summary) -> [String: Any] {
    ["id": s.id, "ok": s.ok, "lines": s.lines.map { ["label": $0.label, "value": $0.value] }, "details": orNull(s.details), "needs": orNull(s.needs)]
}

func doneValue(_ d: Done) -> [String: Any] {
    let guide: Any? = d.guide.map { ["html": $0.html, "pdf": $0.pdf] }
    return ["outcome": d.outcome, "summary": d.summary, "studio": d.studio, "guide": orNull(guide), "notes": d.notes]
}

func failureValue(_ f: Failure) -> [String: Any] {
    ["code": f.code, "message": f.message, "advice": orNull(f.advice), "contact": orNull(f.contact), "details": orNull(f.details)]
}

/// The state as the tests read it, with `undecoded`, the number of lines that were no event. A later task adds its own keys here.
func stateValue(_ s: SetupState, undecoded: Int) -> [String: Any] {
    [
        "rows": s.rows.map { ["id": $0.id, "title": $0.title, "mark": $0.mark.rawValue] },
        "step": orNull(s.step.map(stepValue)), "question": orNull(s.question.map(questionValue)), "bars": s.bars.map(barValue),
        "review": orNull(s.review.map(summaryValue)), "result": orNull(s.result.map(summaryValue)), "status": orNull(s.status.map(summaryValue)),
        "done": orNull(s.done.map(doneValue)), "failure": orNull(s.failure.map(failureValue)),
        "running": s.running, "installing": s.installing, "awaitingCheck": s.awaitingCheck, "undecoded": undecoded,
        "quit": quitRule(s).rawValue, "shouldCheck": shouldCheck(s),
    ]
}

/// The lines of stdin, split as the shell splits the engine's output. Empty lines are passed over.
func inputLines() -> [Data] {
    var splitter = LineSplitter()
    let lines = splitter.feed(readInput()) + [splitter.rest()]
    return lines.filter { !$0.isEmpty }
}

/// The line on the state command's stdin that stands for the shell sending a check at that point.
let sentCheckLine = Data("sent-check".utf8)

/// state [--idle] [--sent-check] [--ended]: stdin is the engine's lines, one event each. A line that is exactly `sent-check` is
/// the shell sending a check there, and is not counted as undecoded.
func checkState(_ args: [String]) -> Never {
    let known = ["--idle", "--sent-check", "--ended"]
    for word in args where !known.contains(word) { fail("state does not know \"\(word)\".") }
    var state = SetupState()
    if !args.contains("--idle") { state.began() }
    var undecoded = 0
    for line in inputLines() {
        if line == sentCheckLine {
            state.sentCheck()
        } else if let event = decodeEvent(line) {
            state.take(event)
        } else {
            undecoded += 1
        }
    }
    if args.contains("--sent-check") { state.sentCheck() }
    if args.contains("--ended") { state.ended() }
    emit(stateValue(state, undecoded: undecoded))
}

func checkSteps(_ args: [String]) -> Never {
    let word = exactly(1, args, "steps")[0]
    guard let of = Int(word) else { fail("\"\(word)\" is not a number of steps.") }
    emit(stepList(of: of).map { ["id": $0.id, "title": $0.title] })
}

// MARK: Flow.swift

/// reply <kind> [<text>]: the line the shell sends for an answer of `kind` to a question whose id is "q". `confirm` takes no text;
/// `text`, `choice`, `folder` and `apps` take one; `sign-in` takes a code or none.
func checkReply(_ args: [String]) -> Never {
    let words = atLeast(1, args, "reply")
    let kind = words[0]
    let reply: Reply
    switch kind {
    case "confirm":
        _ = exactly(1, words, "reply confirm")
        reply = .confirm
    case "text": reply = .text(exactly(2, words, "reply text")[1])
    case "choice": reply = .choice(exactly(2, words, "reply choice")[1])
    case "folder": reply = .folder(exactly(2, words, "reply folder")[1])
    case "apps":
        let word = exactly(2, words, "reply apps")[1]
        guard let value = AppsReply(rawValue: word) else { fail("\"\(word)\" is not an answer to the apps question.") }
        reply = .apps(value)
    case "sign-in":
        if words.count > 2 { fail("reply sign-in takes at most 2 words, and was given \(words.count).") }
        reply = .signIn(code: words.count == 2 ? words[1] : nil)
    default: fail("\"\(kind)\" is not a question's kind.")
    }
    emit(["answer": "q", "value": replyValue(reply)])
}

/// next-from-status <translocated yes|no> <chosen: setup|repair|none> <other yes|no>: stdin is a status run's event lines, and
/// the run then ended.
func checkNextFromStatus(_ args: [String]) -> Never {
    let words = exactly(3, args, "next-from-status")
    let chosen: Run?
    switch words[1] {
    case "setup", "repair": chosen = runOf(words[1])
    case "none": chosen = nil
    default: fail("\"\(words[1])\" is not setup, repair or none.")
    }
    var state = SetupState()
    state.began()
    for line in inputLines() {
        if let event = decodeEvent(line) { state.take(event) }
    }
    state.ended()
    emit(nextFromStatus(state, translocated: yesNo(words[0]), chosen: chosen, other: yesNo(words[2])).rawValue)
}

/// offers <next> <agent file yes|no> <guide yes|no>.
func checkOffers(_ args: [String]) -> Never {
    let words = exactly(3, args, "offers")
    guard let next = Next(rawValue: words[0]) else { fail("\"\(words[0])\" is not a screen that follows a status.") }
    emit(statusOffers(next: next, agentFileThere: yesNo(words[1]), guideThere: yesNo(words[2])))
}

// MARK: Agent.swift

/// agent <app> <arguments…>: the background job itself. It prints nothing and ends with what runAgent gives back.
func checkAgent(_ args: [String]) -> Never {
    let words = atLeast(1, args, "agent")
    exit(runAgent(rest: Array(words.dropFirst()), app: words[0]))
}

// MARK: EngineClient.swift

/// An event as one JSON object: its name as the engine writes it, and its fields as the state command gives them.
func eventValue(_ event: Event) -> [String: Any] {
    let (name, fields): (String, [String: Any])
    switch event {
    case .step(let given): (name, fields) = ("step", stepValue(given))
    case .question(let given): (name, fields) = ("question", questionValue(given))
    case .progress(let given): (name, fields) = ("progress", barValue(given))
    case .summary(let given): (name, fields) = ("summary", summaryValue(given))
    case .done(let given): (name, fields) = ("done", doneValue(given))
    case .failure(let given): (name, fields) = ("error", failureValue(given))
    }
    return fields.merging(["event": name]) { _, named in named }
}

/// Writes `value` as one line of JSON on stdout.
func writeLine(_ value: Any) {
    guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .withoutEscapingSlashes]) else {
        fail("studio-check could not write a line as JSON.")
    }
    FileHandle.standardOutput.write(data + Data([10]))
}

/// One of a drive's answers: a reply command's words, or ["back"] or ["cancel"].
enum DriveAnswer {
    case reply(Reply)
    case back
    case cancel
}

/// The answer that `words` say.
func driveAnswer(_ words: [String]) -> DriveAnswer {
    guard let kind = words.first else { fail("an answer in the answers file is empty.") }
    let text = words.count == 2 ? words[1] : nil
    switch (kind, words.count) {
    case ("back", 1): return .back
    case ("cancel", 1): return .cancel
    case ("confirm", 1): return .reply(.confirm)
    case ("text", 2): return .reply(.text(text!))
    case ("choice", 2): return .reply(.choice(text!))
    case ("folder", 2): return .reply(.folder(text!))
    case ("apps", 2):
        guard let value = AppsReply(rawValue: text!) else { fail("\"\(text!)\" is not an answer to the apps question.") }
        return .reply(.apps(value))
    case ("sign-in", 1), ("sign-in", 2): return .reply(.signIn(code: text))
    default: fail("an answer in the answers file has the wrong kind or the wrong number of words.")
    }
}

/// The answers file's answers, one JSON array of strings a line. Empty lines are passed over.
func driveAnswers(_ path: String) -> [DriveAnswer] {
    guard let data = FileManager.default.contents(atPath: path) else { fail("drive could not read the answers file.") }
    var splitter = LineSplitter()
    let lines = (splitter.feed(data) + [splitter.rest()]).filter { !$0.isEmpty }
    return lines.map { line in
        guard let words = (try? JSONSerialization.jsonObject(with: line)) as? [String] else {
            fail("a line of the answers file is not a JSON array of strings.")
        }
        return driveAnswer(words)
    }
}

/// The client that drive runs, kept here for the whole run.
var driven: EngineClient?

/// drive [--answer-after-end] <answers file> <program> <arguments…>: starts the program through an EngineClient with the checker's
/// own environment and prints each event as a line as it comes. The next answer is sent at each question. At the end it prints
/// { ended, undecoded }; with --answer-after-end it first sends one more answer. The answers themselves are never printed.
func checkDrive(_ args: [String]) -> Never {
    var words = args
    let afterEnd = words.first == "--answer-after-end"
    if afterEnd { words.removeFirst() }
    words = atLeast(2, words, "drive")
    var answers = driveAnswers(words[0])
    let client = EngineClient(command: Command(program: words[1], arguments: Array(words.dropFirst(2))), environment: ProcessInfo.processInfo.environment)
    var undecoded = 0
    var lastQuestion = "q"

    // Sends the next answer, if there is one left, to the question `id`.
    let sendNext = { (id: String) in
        guard !answers.isEmpty else { return }
        switch answers.removeFirst() {
        case .reply(let reply): client.answer(id, reply)
        case .back: client.back()
        case .cancel: client.cancel()
        }
    }
    client.onEvent = { event in
        writeLine(eventValue(event))
        if case .question(let question) = event {
            lastQuestion = question.id
            sendNext(question.id)
        }
    }
    client.onUndecoded = { undecoded += 1 }
    client.onEnd = { status in
        if afterEnd {
            if answers.isEmpty { client.answer(lastQuestion, .confirm) } else { sendNext(lastQuestion) }
        }
        writeLine(["ended": status, "undecoded": undecoded])
        exit(0)
    }
    do {
        try client.start()
    } catch {
        fail("drive could not start \(words[1]): \(error.localizedDescription)")
    }
    driven = client
    dispatchMain()
}

// MARK: GuidePDF.swift

/// pdf <html> <pdf>: prints the page to a PDF through makePDF, with an NSApplication that never shows itself and its main loop, and
/// prints { pages, width, height }, the first page's size in points. It ends with 1 when the PDF was not made, and with 3 when there
/// is no window server to print with.
func checkPDF(_ args: [String]) -> Never {
    let words = exactly(2, args, "pdf")
    guard CGSessionCopyCurrentDictionary() != nil else {
        FileHandle.standardError.write(Data("no window server\n".utf8))
        exit(3)
    }
    let app = NSApplication.shared
    app.setActivationPolicy(.prohibited)
    let pdf = URL(fileURLWithPath: words[1])
    makePDF(html: URL(fileURLWithPath: words[0]), pdf: pdf) { made in
        guard made else {
            FileHandle.standardError.write(Data("the PDF was not made\n".utf8))
            exit(1)
        }
        guard let document = PDFDocument(url: pdf), let page = document.page(at: 0) else {
            FileHandle.standardError.write(Data("the PDF was made but could not be read\n".utf8))
            exit(1)
        }
        let box = page.bounds(for: .mediaBox)
        emit(["pages": document.pageCount, "width": Double(box.width), "height": Double(box.height)])
    }
    app.run()
    exit(1)
}

// MARK: The commands

let arguments = Array(CommandLine.arguments.dropFirst())
guard let command = arguments.first else { fail("studio-check needs a command.") }
let rest = Array(arguments.dropFirst())

switch command {
case "split": checkSplit(rest)
case "engine-command": checkEngineCommand(rest)
case "agent-command": checkAgentCommand(rest)
case "environment": checkEnvironment(rest)
case "launch": checkLaunch(rest)
case "translocated": checkTranslocated(rest)
case "move-target": checkMoveTarget(rest)
case "other-copy": checkOtherCopy(rest)
case "agent-file": checkAgentFile(rest)
case "guide-paths": checkGuidePaths(rest)
case "url": checkURL(rest)
case "names": checkNames(rest)
case "next": checkNext(rest)
case "state": checkState(rest)
case "steps": checkSteps(rest)
case "reply": checkReply(rest)
case "next-from-status": checkNextFromStatus(rest)
case "offers": checkOffers(rest)
case "agent": checkAgent(rest)
case "drive": checkDrive(rest)
case "pdf": checkPDF(rest)
default: fail("studio-check does not know the command \"\(command)\".")
}
