// The program inside "Move to Studio.app": it runs the helper beside it in the bundle's Resources, waits, and ends with the
// helper's status. The helper does the real work (it opens Terminal on the move script); this is native only because code signing
// and Apple's notary service expect a native program.
import Foundation

guard let resources = Bundle.main.resourcePath else { exit(1) }
let helper = Process()
helper.executableURL = URL(fileURLWithPath: "/bin/zsh")
helper.arguments = [resources + "/open-in-terminal.zsh"]
do {
    try helper.run()
} catch {
    exit(1)
}
helper.waitUntilExit()
exit(helper.terminationStatus)
