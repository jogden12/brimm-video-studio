// The read-through: it reads one file to its end, a mebibyte at a time, so that Dropbox brings all of it down to this Mac, as it
// does for a file that is there only as a placeholder (dropbox.js readThrough). It takes the place of python3, which only Xcode's
// command line tools bring.
//
//   brimm-read-through <file>
//
// Each program on a Mac has a setting for whether its reads of a file that is not here yet have the file brought down, and one the
// launch agent starts has it off: such a read is refused at once, with "Resource deadlock avoided" (EDEADLK; Apple's TN3150 and the
// getiopolicy_np manual). So it turns the setting on first, for itself alone, with setiopolicy_np:
// IOPOL_TYPE_VFS_MATERIALIZE_DATALESS_FILES (3), IOPOL_SCOPE_PROCESS (0), IOPOL_MATERIALIZE_DATALESS_FILES_ON (2).
// After each read it prints how much of the file it has read, one number to a line, written straight out so that each line
// reaches the tool at once. When the file cannot be read it says why in plain words, in one line on standard error, and ends
// with 1. What it reads is let go: it writes nothing. It runs only on a Mac, and nothing leaves the machine.
import Darwin

func stop(_ why: String) -> Never {
  fputs(why + "\n", stderr)
  exit(1)
}

guard CommandLine.arguments.count == 2 else { stop("Give it one file: brimm-read-through <file>") }
guard setiopolicy_np(3, 0, 2) == 0 else { stop("reads that bring a file down could not be turned on") }
let fd = open(CommandLine.arguments[1], O_RDONLY)
guard fd >= 0 else { stop(String(cString: strerror(errno))) }
var buffer = [UInt8](repeating: 0, count: 1048576)
var total = 0
while true {
  let got = buffer.withUnsafeMutableBytes { read(fd, $0.baseAddress, 1048576) }
  if got == 0 { break }
  if got < 0 {
    let failed = errno
    if failed == EINTR { continue }
    stop(String(cString: strerror(failed)))
  }
  total += got
  let line = "\(total)\n"
  _ = line.withCString { write(1, $0, strlen($0)) }
}
close(fd)
exit(0)
