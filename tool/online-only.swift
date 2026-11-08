// Asks Dropbox to make a file online-only, so that this Mac's disk space for it comes back once originals.js has deleted the Mac's own copy of a recording.
//
//   swift online-only.swift <file>
//
// Prints one JSON document and nothing else: {"onlineOnly": true}, or {"onlineOnly": false, "error": "<NSError domain and code>"}, and ends with 0.
// It calls FileManager.default.evictUbiquitousItem(at:). Given no file, or a path where no file is, it prints nothing, says why in one line on standard
// error, and ends with 1.
//
// It touches nothing but whether this Mac keeps the file's data: Dropbox keeps the file. It runs only on a Mac, and nothing leaves the machine.
import Foundation

func stop(_ why: String) -> Never {
  FileHandle.standardError.write((why + "\n").data(using: .utf8)!)
  exit(1)
}

guard CommandLine.arguments.count == 2 else { stop("Give it one file: swift online-only.swift <file>") }
let path = CommandLine.arguments[1]
guard FileManager.default.fileExists(atPath: path) else { stop("There is no file at that path.") }
let url = URL(fileURLWithPath: path)
do {
  try FileManager.default.evictUbiquitousItem(at: url)
  print("{\"onlineOnly\": true}")
} catch let error as NSError {
  print("{\"onlineOnly\": false, \"error\": \"\(error.domain) \(error.code)\"}")
}
