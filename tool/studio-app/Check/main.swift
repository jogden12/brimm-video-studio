// studio-check: the tests' way into the app's Swift. `studio-check <command> …` prints one JSON value and a line feed and ends with
// 0, or says why on stderr and ends with 2. Each command is one small function, and the switch at the end names them all: a later
// task adds its own functions and cases and touches no other.
import Foundation

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

// MARK: Agent.swift

/// agent <app> <arguments…>: the background job itself. It prints nothing and ends with what runAgent gives back.
func checkAgent(_ args: [String]) -> Never {
    let words = atLeast(1, args, "agent")
    exit(runAgent(rest: Array(words.dropFirst()), app: words[0]))
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
case "agent": checkAgent(rest)
default: fail("studio-check does not know the command \"\(command)\".")
}
