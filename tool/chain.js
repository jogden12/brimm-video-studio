// The process chain (design 2026-10-26, section 1, "Modes", and section 6; R26): the Claude Code a check runs under, found by
// walking up from the check's own process with `ps`, and the flags and version it was started with. The guard and `behind` both
// run outside the sandbox, so `ps` sees every process. One `/bin/ps -A -ww -o pid=,ppid=,lstart=,args=` is read per check, with
// LC_ALL=C and nothing else in its environment, so that the start time, `lstart`, is the same 24 letters in any locale; a line whose
// start time is not that gives no row, rather than a wrong one. The Claude Code above is the first process up the chain whose
// executable's name is `claude`, the executable being its arguments before the first " --" (the app's copy lives in a folder with
// a space in its name). Its arguments are split at each " --", so that a value with spaces is kept whole. The app's own copy is
// kept in a folder named for its version, Claude/claude-code/<version>/claude, which is where its version is read from.
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

/** The arguments `ps` is run with: every process, lines as long as they are, and its id, its parent's, its start and its arguments. */
export const PS_ARGS = ["-A", "-ww", "-o", "pid=,ppid=,lstart=,args="];

/** What `/bin/ps` prints of every process, or null when it cannot be run, is refused, or ends with anything but 0. `spawn` is a
    test's stand-in. */
export function readProcesses(spawn = spawnSync) {
  try {
    const ran = spawn("/bin/ps", PS_ARGS, { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 });
    if (!ran || ran.error || ran.status !== 0 || typeof ran.stdout !== "string") return null;
    return ran.stdout;
  } catch (e) {
    return null;
  }
}

/** A row of `ps`'s table: its id, its parent's, the start time of 24 letters and its arguments. */
const ROW = /^\s*(\d+)\s+(\d+)\s+(\S.{23}) (.+)$/;
/** A start time as `ps -o lstart=` gives it with LC_ALL=C: "Mon Oct 26 09:00:00 2026", the day of the month padded with a space. */
const LSTART = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [ \d]\d \d\d:\d\d:\d\d \d{4}$/;

/** `ps`'s table, `text`, as each process by its id: { pid, ppid, start, args }. A line that is not a row, or whose start time is not
    24 letters of that shape, is left out. */
export function processTable(text) {
  const table = new Map();
  for (const line of String(text || "").split("\n")) {
    const row = ROW.exec(line.replace(/\r$/, ""));
    if (!row || !LSTART.test(row[3])) continue;
    const pid = Number(row[1]);
    table.set(pid, { pid, ppid: Number(row[2]), start: row[3], args: row[4] });
  }
  return table;
}

/** The chain of processes from `pid` up, that process first: it stops at pid 1, at a process the table does not list, and where it
    would come back to one it has passed. */
export function chainUp(table, pid) {
  const chain = [];
  const seen = new Set();
  for (let at = pid; table.has(at) && !seen.has(at); at = table.get(at).ppid) {
    seen.add(at);
    chain.push(table.get(at));
    if (at === 1) break;
  }
  return chain;
}

/** A process's arguments, `args`, as its executable (everything before the first " --") and its flags, each { name, value }: split
    at each " --", `--name=value` and `--name value` both giving `value`, and a flag with neither giving null. */
export function argsOf(args) {
  const [exe, ...rest] = String(args).split(" --");
  const flags = rest.map((piece) => {
    const at = piece.search(/[= ]/);
    return at < 0 ? { name: `--${piece}`, value: null } : { name: `--${piece.slice(0, at)}`, value: piece.slice(at + 1) };
  });
  return { exe, flags };
}

/** The first process in `chain` whose executable's name is `claude`, or null when there is none. */
export function claudeAbove(chain) {
  return chain.find((proc) => basename(argsOf(proc.args).exe) === "claude") || null;
}

/** The version of the Claude app's own copy of Claude Code, from the folder its executable, `exe`, is kept in; null for any other. */
export function appVersionOf(exe) {
  const found = /\/claude-code\/(\d+(?:\.\d+)+)\//.exec(String(exe));
  return found ? found[1] : null;
}
