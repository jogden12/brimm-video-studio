// Finds the faces in a folder of stills from a video, so that reframe.js can place a vertical crop on the speaker.
//
//   swift faces.swift <folder of .jpg stills>
//
// Prints one JSON document and nothing else: [{"file": "0001.jpg", "faces": [{"x": 0.41, "y": 0.22, "w": 0.18, "h": 0.3}]}],
// the files in name order. A box is in fractions of the picture, measured from its top left corner. An empty folder prints [].
// When the folder cannot be read it prints nothing, says why in one line on standard error, and ends with 1.
//
// It uses Apple's Vision framework, so it runs only on a Mac. Nothing leaves the machine.
// It has only been tried on a blank frame so far, never on a real face: no box it prints has been checked against one.
// The tests give it only stills with no face in them, so no test covers a box either. They would still pass with every box
// upside down, measured from the bottom left as Vision measures it.
import Foundation
import Vision

func stop(_ why: String) -> Never {
  FileHandle.standardError.write((why + "\n").data(using: .utf8)!)
  exit(1)
}

guard CommandLine.arguments.count == 2 else { stop("Give it one folder of .jpg stills: swift faces.swift <folder>") }
let folder = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
guard let names = try? FileManager.default.contentsOfDirectory(atPath: folder.path) else { stop("The folder of stills could not be read: \(folder.path)") }

var stills: [[String: Any]] = []
for name in names.filter({ $0.lowercased().hasSuffix(".jpg") }).sorted() {
  let request = VNDetectFaceRectanglesRequest()
  // A still that cannot be read is one with no face in it.
  try? VNImageRequestHandler(url: folder.appendingPathComponent(name)).perform([request])
  let faces = (request.results ?? []).map { face -> [String: Double] in
    // Vision measures a box from the bottom left of the picture. Here it is measured from the top left.
    let box = face.boundingBox
    return ["x": box.minX, "y": 1 - box.maxY, "w": box.width, "h": box.height]
  }
  stills.append(["file": name, "faces": faces])
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: stills, options: [.sortedKeys]))
