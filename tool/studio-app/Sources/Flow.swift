// The shell's decisions around a run: the value each answer sends, the screen that follows a status, when the apps question is
// asked to check again, when quitting is allowed, and what the status window offers. It imports only Foundation, so studio-check is
// compiled from it and node's tests ask it each answer.
import Foundation

// MARK: The answers

/// The answers to an apps question: check again, go on, or one of the actions an app's row carries.
enum AppsReply: String {
    case check
    case proceed = "continue"
    case installClaudeCode = "install-claude-code"
    case signIn = "sign-in"
}

/// An answer to the open question, one for each kind.
enum Reply {
    case confirm
    case text(String)
    case choice(String)
    case folder(String)
    case apps(AppsReply)
    case signIn(code: String?)
}

/// The JSON value the engine is sent for `reply`. A sign-in's code is sent without the white space around it, and a code that is
/// then empty is sent as no code at all.
func replyValue(_ reply: Reply) -> Any {
    switch reply {
    case .confirm: return true
    case .text(let value), .choice(let value), .folder(let value): return value
    case .apps(let value): return value.rawValue
    case .signIn(let code):
        let trimmed = code?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let value: [String: String] = trimmed.isEmpty ? [:] : ["code": trimmed]
        return value
    }
}

// MARK: What follows a status

/// The screen that follows a status run whose events made `state`. The run failed when it ended with an error, or with no done.
func nextFromStatus(_ state: SetupState, translocated: Bool, chosen: Run?, other: Bool) -> Next {
    nextStep(
        translocated: translocated, needs: state.status?.needs, failed: state.failure != nil || state.done == nil, chosen: chosen, other: other)
}

// MARK: The apps question

/// Whether the shell should ask the apps question to check again: the run goes on, the apps question is open, and the last check
/// was answered.
func shouldCheck(_ state: SetupState) -> Bool {
    state.running && state.question?.kind == .apps && !state.awaitingCheck
}

// MARK: Quitting

/// What quitting does: ends the app now, cancels the run first, or waits for the installer, which is never stopped.
enum Quit: String {
    case now, cancel, wait
}

func quitRule(_ state: SetupState) -> Quit {
    if state.installing { return .wait }
    if state.running { return .cancel }
    return .now
}

// MARK: The status window

/// What the status window offers after `next`: for a Mac that is set up, updates, Repair, the guide when there is one, and
/// Uninstall when the launch agent's file is there. Every other screen is offered nothing.
func statusOffers(next: Next, agentFileThere: Bool, guideThere: Bool) -> [String] {
    guard next == .status else { return [] }
    var offers = ["updates", "repair"]
    if guideThere { offers.append("guide") }
    if agentFileThere { offers.append("uninstall") }
    return offers
}
