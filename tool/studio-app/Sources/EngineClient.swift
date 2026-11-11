// The engine's client: it starts the engine, reads its events as they come and sends it the answers. stdout is split at line feeds
// only, stderr is read and thrown away, and stdin stays open for the whole run, since closing it is a cancel. It imports only
// Foundation, so studio-check is compiled from it and node's tests drive it.
import Foundation

/// Starts one run of the engine and tells what it says. The callbacks come on the main queue, in the order the lines came, and onEnd
/// comes once, after the last of them, when the process has ended and its stdout has been read to its end. start, answer, back and
/// cancel are called on the main queue. An answer's text is sent and never kept. The client's own callbacks hold it weakly, so its
/// owner must keep it until onEnd has come: a client let go before then loses its run, and the engine reads the closed stdin as a
/// cancel.
final class EngineClient {
    private let command: Command
    private let environment: [String: String]

    /// Each line that is one of the engine's events.
    var onEvent: ((Event) -> Void)?
    /// Each line that is not empty and is none of the engine's events.
    var onUndecoded: (() -> Void)?
    /// The process's status, or 128 plus the signal's number when a signal ended it.
    var onEnd: ((Int32) -> Void)?

    private var process: Process?
    private var input: FileHandle?
    private var started = false
    private var exited = false
    private var exitStatus: Int32 = 0
    private var outputRead = false
    private var finished = false

    init(command: Command, environment: [String: String]) {
        self.command = command
        self.environment = environment
    }

    /// Whether the run has started and its end has not yet been told.
    var isRunning: Bool { started && !finished }

    /// Starts the engine. It throws when the program cannot be started, and then no callback comes.
    func start() throws {
        guard !started else { return }
        // A write to an engine that has gone gives an error, which is passed over, and never a signal that ends the app.
        signal(SIGPIPE, SIG_IGN)

        let child = Process()
        child.executableURL = URL(fileURLWithPath: command.program)
        child.arguments = command.arguments
        child.environment = environment
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()
        child.standardInput = stdin
        child.standardOutput = stdout
        child.standardError = stderr
        child.terminationHandler = { [weak self] ended in
            let status = ended.terminationReason == .uncaughtSignal ? 128 + ended.terminationStatus : ended.terminationStatus
            DispatchQueue.main.async { self?.exitedWith(status) }
        }
        try child.run()
        process = child
        input = stdin.fileHandleForWriting
        started = true

        let reading = stdout.fileHandleForReading
        DispatchQueue(label: "com.thebrimm.video-studio.engine-stdout").async { [weak self] in
            var splitter = LineSplitter()
            EngineClient.readToEnd(reading) { bytes in
                let lines = splitter.feed(bytes)
                if !lines.isEmpty { DispatchQueue.main.async { self?.tell(lines) } }
            }
            let rest = splitter.rest()
            try? reading.close()
            DispatchQueue.main.async {
                self?.tell([rest])
                self?.outputEnded()
            }
        }
        let errors = stderr.fileHandleForReading
        DispatchQueue(label: "com.thebrimm.video-studio.engine-stderr").async {
            EngineClient.readToEnd(errors) { _ in }
            try? errors.close()
        }
    }

    /// Sends the answer `reply` to the question `id`.
    func answer(_ id: String, _ reply: Reply) {
        send(["answer": id, "value": replyValue(reply)])
    }

    /// Asks the engine to go back a step.
    func back() { send(["back": true]) }

    /// Asks the engine to stop the run.
    func cancel() { send(["cancel": true]) }

    // MARK: Inside

    /// Writes `object` as one line of JSON in one write. A write after the engine has ended does nothing, and a write that fails is
    /// passed over: the engine's end is told by onEnd.
    private func send(_ object: [String: Any]) {
        guard started, !exited, !finished, let input,
            let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes])
        else { return }
        try? input.write(contentsOf: data + Data([10]))
    }

    /// Tells each of `lines`: an event, or an undecoded line. Empty lines are passed over.
    private func tell(_ lines: [Data]) {
        for line in lines where !line.isEmpty {
            if let event = decodeEvent(line) {
                onEvent?(event)
            } else {
                onUndecoded?()
            }
        }
    }

    private func exitedWith(_ status: Int32) {
        exited = true
        exitStatus = status
        finishIfDone()
    }

    private func outputEnded() {
        outputRead = true
        finishIfDone()
    }

    /// Tells the end once both the process has ended and its stdout has been read to its end, whichever comes first.
    private func finishIfDone() {
        guard exited, outputRead, !finished else { return }
        finished = true
        try? input?.close()
        input = nil
        process = nil
        onEnd?(exitStatus)
    }

    /// Reads `handle` until its end, giving each piece to `take` as it comes.
    private static func readToEnd(_ handle: FileHandle, _ take: (Data) -> Void) {
        let descriptor = handle.fileDescriptor
        var buffer = [UInt8](repeating: 0, count: 65536)
        while true {
            let count = buffer.withUnsafeMutableBytes { read(descriptor, $0.baseAddress, $0.count) }
            if count > 0 {
                take(Data(buffer[0..<count]))
            } else if count < 0 && errno == EINTR {
                continue
            } else {
                return
            }
        }
    }
}
