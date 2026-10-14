// The progress panel: a small window that floats above the others, in the top right corner, with a bar for each run of the
// unedited-video tool on this Mac. It shows the video, the step the run is at, how far it has got and how long is left, as
// the run's own file in the folder says it (progress.js writes them). The tool starts it when a run begins a video, and never
// waits for it. It reads the folder once a second, and a file whose process has gone is ignored. It closes itself a few
// seconds after the last run has ended. Closing it by hand closes only the window: the runs go on, and the next video a run
// begins opens it again.
//
//   swift progress.swift <folder>            show the panel
//   swift progress.swift --print <folder>    print what it would show, as JSON, and end. For the tests
//
// It uses AppKit, so it runs only on a Mac. Nothing leaves the machine.
import AppKit

func stop(_ why: String) -> Never {
  FileHandle.standardError.write((why + "\n").data(using: .utf8)!)
  exit(1)
}

/** One run as the panel shows it. */
struct Row {
  let video: String
  let detail: String
  let percent: Double?
  let started: Double
}

/** Is the process `pid` still going? Signal 0 asks without sending anything. */
func alive(_ pid: Int32) -> Bool {
  return pid > 0 && (kill(pid, 0) == 0 || errno == EPERM)
}

/** When this Mac last started, in milliseconds since 1970. A process's number in a file written before then may now belong to
    another program. 0 when it cannot be told, and then every file counts as written since. */
func bootedAt() -> Double {
  var boot = timeval()
  var size = MemoryLayout<timeval>.stride
  var mib: [Int32] = [CTL_KERN, KERN_BOOTTIME]
  guard sysctl(&mib, 2, &boot, &size, nil, 0) == 0 else { return 0 }
  return Double(boot.tv_sec) * 1000 + Double(boot.tv_usec) / 1000
}

/** The runs in the folder whose processes are still going, oldest first. A file that cannot be read is not a run, and nor is
    one last written before this Mac last started. */
func rows(in folder: URL) -> [Row] {
  let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
  let booted = bootedAt()
  var found: [Row] = []
  for name in names where name.hasSuffix(".json") {
    guard let data = try? Data(contentsOf: folder.appendingPathComponent(name)),
      let run = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      (run["version"] as? Int) == 1,
      ((run["updated"] as? NSNumber)?.doubleValue ?? 0) >= booted,
      let pid = (run["pid"] as? NSNumber)?.int32Value, alive(pid),
      let video = run["video"] as? String,
      let detail = run["detail"] as? String
    else { continue }
    found.append(Row(video: video, detail: detail, percent: (run["percent"] as? NSNumber)?.doubleValue, started: (run["started"] as? NSNumber)?.doubleValue ?? 0))
  }
  return found.sorted { $0.started < $1.started }
}

let args = Array(CommandLine.arguments.dropFirst())
if args.count == 2 && args[0] == "--print" {
  let shown = rows(in: URL(fileURLWithPath: args[1], isDirectory: true)).map { row -> [String: Any] in
    var out: [String: Any] = ["video": row.video, "detail": row.detail]
    if let percent = row.percent { out["percent"] = percent }
    return out
  }
  FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: shown, options: [.sortedKeys]))
  exit(0)
}
guard args.count == 1 else { stop("Give it the folder of progress files: swift progress.swift <folder>") }
let folder = URL(fileURLWithPath: args[0], isDirectory: true)

// One panel at a time: the number of its process is kept in panel.pid, and a second panel ends at once.
let pidFile = folder.appendingPathComponent("panel.pid")
let pidFileWritten = ((try? FileManager.default.attributesOfItem(atPath: pidFile.path))?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
if let text = try? String(contentsOf: pidFile, encoding: .utf8), let other = Int32(text.trimmingCharacters(in: .whitespacesAndNewlines)), other != getpid(), alive(other), pidFileWritten * 1000 >= bootedAt() {
  exit(0)
}
try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
try? String(getpid()).write(to: pidFile, atomically: true, encoding: .utf8)

/** End the panel, and take its number away when it is this panel's. */
func quit() -> Never {
  if let text = try? String(contentsOf: pidFile, encoding: .utf8), Int32(text.trimmingCharacters(in: .whitespacesAndNewlines)) == getpid() {
    try? FileManager.default.removeItem(at: pidFile)
  }
  exit(0)
}

/** The window, and what it shows. Everything in it is done on the main thread, as AppKit asks. */
@MainActor
final class Panel: NSObject, NSWindowDelegate {
  let width: CGFloat = 380
  let window: NSPanel
  let stack = NSStackView()
  /** The views of each run shown: its video, its bar, and the line under it. */
  var rowViews: [(title: NSTextField, bar: NSProgressIndicator, detail: NSTextField)] = []
  var shown = false
  var lastSeen = Date()

  override init() {
    window = NSPanel(contentRect: NSRect(x: 0, y: 0, width: width, height: 80), styleMask: [.titled, .closable, .utilityWindow, .nonactivatingPanel], backing: .buffered, defer: false)
    super.init()
    window.title = "BRIMM video"
    window.level = .floating
    window.isFloatingPanel = true
    window.hidesOnDeactivate = false
    window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    stack.orientation = .vertical
    stack.alignment = .leading
    stack.spacing = 12
    stack.edgeInsets = NSEdgeInsets(top: 12, left: 14, bottom: 14, right: 14)
    window.contentView = stack
    window.delegate = self
  }

  /** Closing the window ends the panel. The runs go on. */
  func windowWillClose(_ notification: Notification) { quit() }

  func makeRow() -> (title: NSTextField, bar: NSProgressIndicator, detail: NSTextField) {
    let title = NSTextField(labelWithString: "")
    title.font = .boldSystemFont(ofSize: 13)
    title.lineBreakMode = .byTruncatingMiddle
    let bar = NSProgressIndicator()
    bar.style = .bar
    bar.minValue = 0
    bar.maxValue = 100
    bar.isIndeterminate = true
    bar.startAnimation(nil)
    let detail = NSTextField(labelWithString: "")
    detail.font = .systemFont(ofSize: 11)
    detail.textColor = .secondaryLabelColor
    detail.lineBreakMode = .byWordWrapping
    detail.maximumNumberOfLines = 2
    for view in [title, bar, detail] as [NSView] { view.widthAnchor.constraint(equalToConstant: width - 28).isActive = true }
    let column = NSStackView(views: [title, bar, detail])
    column.orientation = .vertical
    column.alignment = .leading
    column.spacing = 4
    stack.addArrangedSubview(column)
    return (title, bar, detail)
  }

  /** A bar that moves with no number while a step says nothing of how far it has got, and fills as it does. */
  func setBar(_ bar: NSProgressIndicator, _ percent: Double?) {
    if let percent = percent {
      if bar.isIndeterminate {
        bar.stopAnimation(nil)
        bar.isIndeterminate = false
      }
      bar.doubleValue = percent
    } else if !bar.isIndeterminate {
      bar.isIndeterminate = true
      bar.startAnimation(nil)
    }
  }

  /** Read the folder, show what it says, and end a few seconds after the last run has gone: 5 once something was shown, and
      60 when nothing ever was, as when a run ended before the panel was ready. */
  func refresh() {
    let found = rows(in: folder)
    if found.isEmpty {
      if Date().timeIntervalSince(lastSeen) > (shown ? 5 : 60) { quit() }
      return
    }
    lastSeen = Date()
    if rowViews.count != found.count {
      for view in stack.arrangedSubviews { view.removeFromSuperview() }
      rowViews = found.map { _ in makeRow() }
    }
    for (row, views) in zip(found, rowViews) {
      views.title.stringValue = row.video
      views.detail.stringValue = row.detail
      setBar(views.bar, row.percent)
    }
    let top = window.frame.maxY
    window.setContentSize(stack.fittingSize)
    if shown {
      window.setFrameTopLeftPoint(NSPoint(x: window.frame.minX, y: top))
    } else {
      if let screen = NSScreen.main?.visibleFrame {
        window.setFrameTopLeftPoint(NSPoint(x: screen.maxX - window.frame.width - 20, y: screen.maxY - 20))
      }
      window.orderFrontRegardless()
      shown = true
    }
  }

  /** Read the folder now, and then once a second. */
  func start() {
    refresh()
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.refresh() }
    }
  }
}

// The script's own lines run on the main thread, which is where AppKit is to be used.
MainActor.assumeIsolated {
  let app = NSApplication.shared
  // No icon in the Dock and no menu: it is only a panel.
  app.setActivationPolicy(.accessory)
  let panel = Panel()
  panel.start()
  app.run()
}
