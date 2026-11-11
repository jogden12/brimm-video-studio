// The Getting Started guide's HTML printed to a PDF of US Letter pages. The page is loaded into a web view in a window that is never
// shown, and printed to a file with runModal on that window. The print is never started with run(): without a shown window it does not
// return, and it writes to the file without end. WKWebView.createPDF is not used either, since it gives one sheet as tall as the page.
import AppKit
import WebKit

/// The most time a PDF may take, in seconds, counted from the call to makePDF.
let pdfTimeLimit: TimeInterval = 30

/// The most bytes the half-made PDF may hold before the job is ended.
let pdfSizeLimit = 50 * 1024 * 1024

/// How often the watchdog looks at the clock and at the half-made file, in seconds.
private let pdfWatchEvery: TimeInterval = 0.25

/// A US Letter page, in points.
private let letterPage = NSSize(width: 612, height: 792)

/// The printers at work, each kept here until it has said whether its PDF was made.
private var printers: [GuidePrinter] = []

/// Prints the page at `html` to a PDF at `pdf`. It is called on the main thread, and `done` comes on the main thread, once: true when
/// the PDF is there. The PDF is first written to `<pdf>.part` and renamed onto its name, so a half-made file never has the PDF's name
/// and an older PDF is replaced. A failure leaves no part file, and nothing is thrown.
func makePDF(html: URL, pdf: URL, done: @escaping (Bool) -> Void) {
    let printer = GuidePrinter(html: html, pdf: pdf, done: done)
    printers.append(printer)
    printer.start()
}

/// One PDF's job: the window and web view it is printed from, the watchdog, and the answer still to give.
private final class GuidePrinter: NSObject, WKNavigationDelegate {
    let html: URL
    let pdf: URL
    let part: URL
    let window: NSWindow
    let web: WKWebView
    let began = Date()
    var done: ((Bool) -> Void)?
    var watchdog: Timer?
    /// True from the start of the print until it has said it has ended. A job ended while it is true stays in `printers`, so the
    /// print's late answer still finds it and removes the part file the print may have gone on to write.
    var printing = false

    init(html: URL, pdf: URL, done: @escaping (Bool) -> Void) {
        self.html = html
        self.pdf = pdf
        part = pdf.deletingLastPathComponent().appendingPathComponent(pdf.lastPathComponent + ".part")
        self.done = done
        let frame = NSRect(origin: .zero, size: letterPage)
        web = WKWebView(frame: frame, configuration: WKWebViewConfiguration())
        window = NSWindow(contentRect: frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.contentView = web
        super.init()
        web.navigationDelegate = self
    }

    /// Starts the watchdog and loads the page, with read access to its own folder only.
    func start() {
        try? FileManager.default.removeItem(at: part)
        let timer = Timer(timeInterval: pdfWatchEvery, repeats: true) { [weak self] _ in self?.watch() }
        RunLoop.main.add(timer, forMode: .common)
        watchdog = timer
        web.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
    }

    /// Ends the job when it has taken too long, or when the half-made file has grown too big.
    func watch() {
        let size = (try? FileManager.default.attributesOfItem(atPath: part.path)[.size] as? Int) ?? 0
        if Date().timeIntervalSince(began) > pdfTimeLimit || size > pdfSizeLimit { finish(false) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard done != nil else { return }
        let info = NSPrintInfo()
        info.paperSize = letterPage
        info.topMargin = 0
        info.bottomMargin = 0
        info.leftMargin = 0
        info.rightMargin = 0
        info.isHorizontallyCentered = false
        info.isVerticallyCentered = false
        info.jobDisposition = .save
        info.dictionary()[NSPrintInfo.AttributeKey.jobSavingURL] = part
        let operation = web.printOperation(with: info)
        operation.showsPrintPanel = false
        operation.showsProgressPanel = false
        operation.view?.frame = NSRect(origin: .zero, size: letterPage)
        printing = true
        operation.runModal(for: window, delegate: self, didRun: #selector(printed(_:success:contextInfo:)), contextInfo: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(false) }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(false) }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { finish(false) }

    /// The print's end: the part file is renamed onto the PDF's name when the print says it worked and the file is there. The print
    /// may say so from a thread of its own, so the rest is done on the main thread, where the window is closed and `done` is given.
    /// When the job was already ended (the watchdog), the print may have written the part file after it was removed: it is removed
    /// again here, and the job is let go.
    @objc func printed(_ operation: NSPrintOperation, success: Bool, contextInfo: UnsafeMutableRawPointer?) {
        DispatchQueue.main.async { [self] in
            printing = false
            guard done != nil else {
                try? FileManager.default.removeItem(at: part)
                printers.removeAll { $0 === self }
                return
            }
            let made = success && FileManager.default.fileExists(atPath: part.path) && rename(part.path, pdf.path) == 0
            finish(made)
        }
    }

    /// Gives the answer, once: it stops the watchdog, closes the window, removes any part file and lets the job go, unless its print
    /// has not yet ended, when `printed` lets it go.
    func finish(_ made: Bool) {
        guard let done else { return }
        self.done = nil
        watchdog?.invalidate()
        watchdog = nil
        web.stopLoading()
        window.close()
        try? FileManager.default.removeItem(at: part)
        if !printing { printers.removeAll { $0 === self } }
        done(made)
    }
}
