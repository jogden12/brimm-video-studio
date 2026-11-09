// The program inside "BRIMM Node Spike.app" (spike only: S3; see README.md). It runs the node inside the app with --version and ends
// with node's status. It is native only because code signing and Apple's notary service expect an app's main program to be one; the
// spike itself runs the node from Terminal, in the spare account.
import Foundation

guard let resources = Bundle.main.resourcePath else { exit(1) }
let node = Process()
node.executableURL = URL(fileURLWithPath: resources + "/node/bin/node")
node.arguments = ["--version"]
do {
    try node.run()
} catch {
    exit(1)
}
node.waitUntilExit()
exit(node.terminationStatus)
