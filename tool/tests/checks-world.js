// The loop's world for the unit tests of the checks run behind (Phase 3, L5): a home, a BRIMM Video root with Episodes, and a drop
// folder, with pendings of each kind written by hand. Nothing of edit.js is in it. Nothing here touches Dropbox, the real home or a program.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LOCAL_VERSION, acceptRev, newEpisode, recordFile, recordText } from "../episode.js";
import { importEpisodes, takeLateCheckLock, writePending } from "../filing.js";
import { downloadsFolder, episodeFilesFolder, episodeWork, episodesFolder, importingFolder, pendingFolder } from "../settings.js";
import { readStatusesIn } from "../importing.js";
import { fileId } from "../filing.js";

export const MAC = "Mac Studio";
export const ID = "e-20261106-ab0001";
export const NAME = "2026-11-06 Talk (Mac Studio)";
export const LABEL = "Video of 6 Nov, 10:00 (Mac Studio)";
export const L = Date.parse("2026-11-06T10:00:00-06:00");
export const mine = (pid) => pid === process.pid;
export const MP4 = "0123456789";
export const SRT = "1\nHi.\n\n";
export const HANDOFF = '{"revision": 1}\n';

/** A temporary world: `home`, `root` (with Episodes/) and `drop` (empty). */
export function world() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-checks-"));
  const home = join(dir, "home");
  const root = join(dir, "BRIMM Video");
  const drop = join(dir, "Drop");
  for (const d of [home, join(root, "Episodes"), drop]) mkdirSync(d, { recursive: true });
  const statuses = () => readStatusesIn([importingFolder(root)]).map(({ status }) => status);
  return { dir, home, root, drop, statuses, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** The clone a test's rule uses: it copies bytes and times, and throws when a file is at its target. */
export const cloneOf = (from, to) => {
  if (existsSync(to)) throw new Error(`${to} is there already, and a clone never writes over a file.`);
  copyFileSync(from, to);
  const times = statSync(from);
  utimesSync(to, times.atime, times.mtime);
};

/** The deps of a run starting at `at`: the clock moves by what the run waits. */
export function runs(w, at, over = {}) {
  const logs = [];
  const notices = [];
  const waits = [];
  let clock = at;
  const ctl = { now: () => clock, set: (t) => { clock = t; }, add: (ms) => { clock += ms; } };
  const deps = {
    episode: { root: w.root, machine: MAC, home: w.home },
    clock: () => clock,
    wait: async (ms) => { waits.push(ms); if (over.onWait) await over.onWait(ms, ctl); else clock += ms; },
    clone: cloneOf,
    sameDisk: () => true,
    keepAwake: () => {},
    log: (line) => logs.push(line),
    notify: (text) => notices.push(text),
    alive: mine,
    // No test reads this checkout's own build.json: a made-up Mac is a git checkout unless a test says it is installed.
    build: { mode: "dev" },
    ...over,
    checks: { original: null, ...(over.checks || {}) }
  };
  return { deps, logs, notices, waits, now: () => clock, setNow: ctl.set };
}

/** Run the loop on the world's drop folder. */
export async function run(w, at, over = {}) {
  const { importOne, ...rest } = over;
  const r = runs(w, at, rest);
  const results = await importEpisodes(w.drop, r.deps, importOne || (async () => { throw new Error("nothing is waiting"); }));
  return { logs: r.logs, notices: r.notices, waits: r.waits, results, now: r.now };
}

export const liveLock = (w, name, command) => takeLateCheckLock(w.home, name, command, mine);
export function deadLock(w, name, command = "write") {
  mkdirSync(episodeWork(w.home, name), { recursive: true });
  writeFileSync(join(episodeWork(w.home, name), "late-check.lock"), JSON.stringify({ pid: 999999, command, nonce: "dead" }));
}

/** A command's ctx for takeOutOfCheck. */
export const ctxOf = (w, over = {}) => ({ home: w.home, root: w.root, machine: MAC, alive: mine, now: () => L, isWhole: () => true, deps: { clone: cloneOf, sameDisk: () => true }, ...over });

/** A local record of the made-up episode. */
export function recordOf({ id = ID, rev, over = {} }) {
  return {
    ...newEpisode({ id, machine: MAC, at: "2026-11-06T09:00:00-06:00", video: { file: "Talk.mov", bytes: 10, seconds: 120, created: null }, kind: "episode", writer: { commit: "abc1234", on: MAC }, local: { on: MAC } }),
    name: { text: "Talk", placeholder: false },
    files: { "Talk.mov": 10 },
    rev,
    version: LOCAL_VERSION,
    ...over
  };
}

const put = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

/** An import pending (no kind) of a whole file, as filing.test.js' holdCheck writes it. */
export function holdImport(w, video, lastCopy) {
  const id = `e-20261027-${video.slice(0, 1).toLowerCase()}00001`;
  const folder = join(w.root, "Episodes", `2026-10-27 ${video} (Mac Studio)`);
  mkdirSync(join(folder, "record"), { recursive: true });
  const bytes = Buffer.byteLength(`the bytes of ${video}`);
  const record = { ...newEpisode({ id, machine: MAC, at: "2026-10-27T09:00:00-05:00", video: { file: video, bytes, seconds: 120, created: null }, kind: "episode", writer: { commit: "abc1234", on: MAC } }), rev: 1 };
  writeFileSync(recordFile(folder, 1), recordText(record));
  const to = join(folder, `${video}.rough-cut.mp4`);
  writeFileSync(to, "whole");
  const pending = { version: 1, id, name: `2026-10-27 ${video} (Mac Studio)`, folder, video, bytes, seconds: 120, drop: join(w.drop, video), work: join(w.dir, "work", id), entries: [{ from: join(w.dir, "work", id, "cut"), to, bytes: 5 }], lastCopy, root: w.root, machine: MAC, importId: "k3j9x", planTxt: `${video}.cut-plan.txt` };
  writePending(w.home, pending);
  return pending;
}

/** A local import's `record` pending, and what it stands on. */
export function holdRecord(w, at, { id = ID, name = NAME, copied = true, written = false, there = "ours", later = false, workCopy = true, drop = "gone", video = true, problem } = {}) {
  const folder = join(episodesFolder(w.root), name);
  const to = join(folder, "record", "0001.json");
  const work = join(w.dir, "work", `import-${id}`);
  const from = join(work, "record", "1-0001.json");
  const ours = recordText(recordOf({ id, rev: 1 }));
  mkdirSync(folder, { recursive: true });
  if (there === "ours") put(to, ours);
  else if (there === "another") put(to, recordText(recordOf({ id: "e-20261106-cd0002", rev: 1 })));
  else if (there === "unreadable") put(to, "{ half");
  else if (there === "short") put(to, ours.slice(0, 20));
  else mkdirSync(join(folder, "record"), { recursive: true });
  if (later) put(join(folder, "record", "0002.json"), recordText(recordOf({ id, rev: 2 })));
  if (workCopy) put(from, ours);
  else mkdirSync(work, { recursive: true });
  if (written) acceptRev(w.home, id, 1);
  if (video) put(join(episodeFilesFolder(w.home, name), ".import.json"), JSON.stringify({ import: "x", drop: "y" }));
  const dropPath = join(w.dir, "dropped", "Talk.mov");
  let dropFile;
  if (drop === "there") {
    put(dropPath, MP4);
    utimesSync(dropPath, new Date(L - 60000), new Date(L - 60000));
    dropFile = fileId(dropPath);
  } else if (drop === "another") {
    put(dropPath, "other text!");
    dropFile = { ino: 1, size: 10, mtimeMs: L - 60000 };
  } else if (drop === "gone") dropFile = { ino: 1, size: 10, mtimeMs: L - 60000 };
  const pending = {
    version: 1, kind: "record", id, name, folder, root: w.root, machine: MAC, label: LABEL,
    ...(drop === "unknown" ? {} : { drop: dropPath, dropFile }),
    entries: [{ from, to, bytes: Buffer.byteLength(ours) }], work, lastCopy: at,
    ...(copied ? { copied: true } : {}), ...(problem ? { problem } : {})
  };
  writePending(w.home, pending);
  return { pending, key: `record/${id}.json`, folder, to, from, work, dropPath };
}

/** A finish's `final` pending, the episode it stands on (when `episode`), and its work copies. */
export function holdFinal(w, at, { id = ID, name = NAME, revision = 1, copied = true, recordWritten = true, workCopies = true, exported = true, mark = null, problem, episode = true } = {}) {
  const folder = join(episodesFolder(w.root), name);
  const finalDir = join(folder, "final");
  const work = join(w.dir, "work", `final-${id}-${revision}`);
  const exportPath = join(downloadsFolder(w.home), "Talk main.mp4");
  let M = 0;
  if (exported) {
    put(exportPath, MP4);
    utimesSync(exportPath, new Date("2026-11-06T09:50:00-06:00"), new Date("2026-11-06T09:50:00-06:00"));
    M = statSync(exportPath).mtimeMs;
  }
  const rec2 = recordOf({ id, rev: 2, over: { files: { "Talk.mov": 10, "final/Talk main.mp4": 10, "final/Talk main.srt": 7, "final/Talk.brimm-ops.json": 16 }, finished: { revision, at: "2026-11-06T09:59:00-06:00", on: MAC, handoff: "final/Talk.brimm-ops.json", parts: { main: { v: 0, file: "final/Talk main.mp4", bytes: 10, seconds: 12, source: { bytes: 10, mtimeMs: M }, project: "Talk main" } } } } });
  // For an episode already there, the finish's record is the one in the folder: its work copy holds that text.
  const rec2Text = !episode && existsSync(recordFile(folder, 2)) ? readFileSync(recordFile(folder, 2), "utf8") : recordText(rec2);
  const files = { mp4: join(finalDir, "Talk main.mp4"), srt: join(finalDir, "Talk main.srt"), handoff: join(finalDir, "Talk.brimm-ops.json") };
  if (episode) {
    put(recordFile(folder, 1), recordText(recordOf({ id, rev: 1 })));
    if (recordWritten) put(recordFile(folder, 2), recordText(rec2));
    put(files.mp4, MP4);
    put(files.srt, SRT);
    put(files.handoff, HANDOFF);
  }
  const from = (name2) => join(work, name2);
  if (workCopies) {
    put(from("Talk main.mp4"), MP4);
    put(from("Talk main.srt"), SRT);
    put(from("Talk.brimm-ops.json"), HANDOFF);
    put(join(work, "r", "0002.json"), rec2Text);
  }
  const entries = [
    { from: from("Talk main.mp4"), to: files.mp4, bytes: 10 },
    { from: from("Talk main.srt"), to: files.srt, bytes: 7 },
    { from: from("Talk.brimm-ops.json"), to: files.handoff, bytes: 16 }
  ];
  const took = exported ? [{ path: exportPath, snap: { size: 10, mtimeMs: M }, name: "Talk main.mp4", place: "Downloads", key: "main" }] : [];
  const pending = {
    version: 1, kind: "final", id, name, folder, root: w.root, machine: MAC, revision, rev: 2, entries, took, work, lastCopy: at,
    record: { from: join(work, "r", "0002.json"), to: recordFile(folder, 2), bytes: Buffer.byteLength(rec2Text) },
    ...(copied ? { copied: true } : {}), ...(mark ? { reading: mark } : {}), ...(problem ? { problem } : {})
  };
  writePending(w.home, pending);
  const later = (change) => {
    let n = 1;
    while (existsSync(recordFile(folder, n + 1))) n += 1;
    const base = JSON.parse(require_(recordFile(folder, n)));
    put(recordFile(folder, n + 1), recordText({ ...base, ...change(base), rev: n + 1 }));
  };
  return { pending, key: `final/${id}-${revision}.json`, folder, files, work, exportPath, M, later };
}

import { readFileSync } from "node:fs";
const require_ = (file) => readFileSync(file, "utf8");

export { pendingFolder };
