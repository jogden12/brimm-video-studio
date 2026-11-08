// Says whether Dropbox reports a file as uploaded, so that originals.js deletes the Mac's copy of a recording only once Dropbox has its copy.
//
//   swift uploaded.swift <file>
//
// Prints one JSON document and nothing else: {"uploaded": true}, {"uploaded": false}, or {"uploaded": null} when Foundation gives no value
// (a file outside Dropbox). It reads ubiquitousItemIsUploadedKey, as the by-hand check P3-0 did on the Mac Studio.
// Given no file, or a path where no file is, it prints nothing, says why in one line on standard error, and ends with 1.
//
// It only reads. It runs only on a Mac, and nothing leaves the machine.
import Foundation

func stop(_ why: String) -> Never {
  FileHandle.standardError.write((why + "\n").data(using: .utf8)!)
  exit(1)
}

guard CommandLine.arguments.count == 2 else { stop("Give it one file: swift uploaded.swift <file>") }
let path = CommandLine.arguments[1]
guard FileManager.default.fileExists(atPath: path) else { stop("There is no file at that path.") }
let url = URL(fileURLWithPath: path)
let flag = try? url.resourceValues(forKeys: [.ubiquitousItemIsUploadedKey]).ubiquitousItemIsUploaded
if let known = flag { print("{\"uploaded\": \(known ? "true" : "false")}") } else { print("{\"uploaded\": null}") }
