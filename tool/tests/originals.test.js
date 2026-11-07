// The recordings moved into Original files after the hand-off (Phase 3, L6; design D6). A video kept on this Mac, handed off, owes each recording she
// dropped for it a copy in its episode's Original files/ in Dropbox; the Mac's copy is deleted only once Dropbox's check of that copy has passed and
// Dropbox says it is uploaded (a stand-in gives that flag: no test runs swift). A session's recording never moves. Nothing here runs a real program,
// touches Dropbox or asks launchctl: each test has a root and a home of its own, episodes.js's clone and clock, and a kick stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync as renameSyncSafe, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { acceptRev, layoutOf, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { FOLDER_GONE, LOCK_AGAIN_MS, WAIT_LOOK_FOR_MS, WAIT_LOOK_MS, fileId, pendingKeyOf, readEveryPending, readPendingAt, writePending } from "../filing.js";
import { lockOf, releaseEpisodeLock, takeEpisodeLock } from "../detached.js";
import { episodeFilesFolder, episodeWork, pendingFolder, runsFolder } from "../settings.js";
import { footageCopyPaths, workCopyKey, workCopyLockOf } from "../workcopy.js";
import { planProject } from "../plan-project.js";
import { ORIGINALS_COMMAND, ORIGINALS_PROBLEM, ORIGINALS_RUNNING, ORIGINALS_SESSION, UPLOAD_LOOK_MS, asSession, checkOriginal, listsOriginal, moved, oweForgotten, oweOriginals, originalsOf } from "../originals.js";
import { linksOf } from "../finish.js";
import * as filing from "../filing.js";
import { setup } from "./episodes.js";
import { agentRun, finishRun, localExported, makeLocal } from "./local-world.js";
import { finishedWorld } from "./reels-world.js";
import { on, seeing } from "./checking-world.js";
import { READ as READING, guideWorld } from "./guide-world.js";
import { exportOf, whisper } from "./exports-world.js";

const STUDIO = "Mac Studio";
const MACBOOK = "Jason's MacBook";
export const ID = "e-20261014-3fa9c1";
export const FOLDER = "2026-10-14 Pricing talk (Mac Studio)";
const WRITER = { commit: "c709b57", on: STUDIO };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: STUDIO, at: "2026-10-14T08:00:00-05:00", private: "no" };
const READ = (kind) => ({ kind, model: "m", at: "2026-10-14T08:05:00-05:00", on: STUDIO, account: "a", outcome: "read" });
const OFFERS = { spellings: [], answered: { reading: "2026-10-14T08:05:00-05:00", at: "2026-10-14T08:06:00-05:00", on: STUDIO, applied: [], left: [] } };
const OWN = (stem) => ({
  [`${stem}.mov`]: "the recording",
  [`${stem}.transcript.txt`]: "[0:00] words\n",
  [`${stem}.words.json`]: JSON.stringify({ video: `${stem}.mov`, duration: 42, words: [] }),
  [`${stem}.cut-plan.json`]: JSON.stringify({ version: 1, video: `${stem}.mov` })
});
const FINISHED = (stem) => ({ revision: 1, at: "2026-10-14T13:00:00-05:00", on: STUDIO, handoff: `final/${stem}.brimm-ops.json`, parts: {} });

/** The world of one test: episodes.js' root, home, clock and clone stand-in, on the Mac Studio. */
export function world() {
  const t = setup({ machine: STUDIO });
  t.logFile = join(t.home, "Library", "Logs", "brimm-video.log");
  t.fileLog = () => (existsSync(t.logFile) ? readFileSync(t.logFile, "utf8").split("\n").filter(Boolean) : []);
  // The clock of the checks: it moves only when a test says.
  let at = t.now();
  t.now = () => at;
  t.advance = (ms) => {
    at += ms;
  };
  t.logs = [];
  t.ctx2 = { home: t.home, root: t.root, machine: STUDIO, now: () => t.now(), agentRunning: () => false, kickstart: () => t.kicks.push("kickstart") };
  return t;
}

/** An episode kept on the Mac Studio, handed off (its record 2): its files (`own`) in its video/, listed; `record` laid over the hand-off's. */
export function local(t, { id = ID, name = FOLDER, stem = "Pricing talk", record = {}, own = OWN(stem), on = STUDIO, handoff = true } = {}) {
  const folder = join(t.root, "Episodes", name);
  const video = episodeFilesFolder(t.home, name);
  mkdirSync(join(folder, "record"), { recursive: true });
  const sizes = {};
  for (const [rel, text] of Object.entries(own)) {
    mkdirSync(dirname(join(video, rel)), { recursive: true });
    writeFileSync(join(video, rel), text);
    // A time to the millisecond, which the clone stand-in keeps exactly.
    utimesSync(join(video, rel), new Date(Date.parse("2026-10-14T08:30:00-05:00")), new Date(Date.parse("2026-10-14T08:30:00-05:00")));
    sizes[rel] = Buffer.byteLength(text);
  }
  const made = newEpisode({ id, machine: STUDIO, at: "2026-10-14T09:00:00-05:00", video: { file: `${stem}.mov`, bytes: sizes[`${stem}.mov`] ?? 1, seconds: 42, created: null }, kind: null, writer: WRITER, files: sizes });
  const first = { ...made, rev: 1, ...(on ? { local: { on } } : {}) };
  writeFileSync(recordFile(folder, 1), recordText({ ...first, version: layoutOf(first) }));
  const second = { ...first, rev: 2, kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Pricing talk", placeholder: false }, label: "Video of 14 Oct, 09:00 (Mac Studio)", ...(handoff ? { finished: FINISHED(stem) } : {}), ...record };
  writeFileSync(recordFile(folder, 2), recordText({ ...second, version: layoutOf(second) }));
  return { id, name, folder, video, stem, file: `${stem}.mov`, record: readEpisode(folder).record };
}
export const reread = (found) => readEpisode(found.folder).record;

const SESSION_ID = "e-20261014-bbbbbb";
const SESSION_FOLDER = "2026-10-14 Coaching call Jane Doe (Mac Studio)";
/** A client or group session kept on the Mac Studio, its mark not cleared. */
export const session = (t) => local(t, { id: SESSION_ID, name: SESSION_FOLDER, stem: "Coaching call Jane Doe", record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 14 Oct, 11:00 (Mac Studio)", name: { text: "Session, 2026-10-14", placeholder: false }, session: { marked: "2026-10-14T08:00:00-05:00", on: STUDIO, teachings: null, cleared: null } } });

const PLAN_ID = "e-20261014-4aa9c2";
const PLAN_FOLDER = "2026-10-14 Too many SKUs (Mac Studio)";
/** A part dropped for the plan: its own episode, answered as `as`, kept on `on` (null: in Dropbox, before the switch). */
export function part(t, n, { as = "talking", client, on = STUDIO, match = null } = {}) {
  const stem = `Take ${n}`;
  const name = `2026-10-14 Drop ${n} (Mac Studio)`;
  const folder = join(t.root, "Episodes", name);
  const own = on ? episodeFilesFolder(t.home, name) : folder;
  mkdirSync(join(folder, "record"), { recursive: true });
  const files = OWN(stem);
  const sizes = {};
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(own, rel)), { recursive: true });
    writeFileSync(join(own, rel), text);
    sizes[rel] = Buffer.byteLength(text);
  }
  const partOf = as === "talking" ? { id: PLAN_ID, as, shot: null, client: false } : as === "voiceover" ? { id: PLAN_ID, as, shot: null, client: null } : { id: PLAN_ID, as, shot: 2, client: client ?? false };
  const made = newEpisode({
    id: `e-20261014-a${String(n).repeat(5)}`, machine: STUDIO, at: "2026-10-14T09:00:00-05:00", video: { file: `${stem}.mov`, bytes: sizes[`${stem}.mov`], seconds: 60, created: null }, kind: null, writer: WRITER,
    files: sizes, label: `Video of 14 Oct, 0${n}:00 (Mac Studio)`, fingerprint: `fp${n}`, answer: { state: "needs your answer", guess: "raw", seen: "wide, 1:00", came: "camera", match }
  });
  const next = { ...made, rev: 2, ...(on ? { local: { on } } : {}), answer: { ...made.answer, state: "part", by: STUDIO, on: STUDIO, at: `2026-10-14T09:3${n}:00-05:00`, private: "no" }, partOf };
  writeFileSync(recordFile(folder, 2), recordText({ ...next, version: layoutOf(next) }));
  return { id: next.id, name, folder, video: own, stem, file: `${stem}.mov`, record: readEpisode(folder).record };
}

/** A plan that made its video from `parts`, handed off; kept on the Mac Studio unless `on` is null (a plan from before the switch). */
export function planMade(t, parts, { on = STUDIO } = {}) {
  const folder = join(t.root, "Episodes", PLAN_FOLDER);
  const video = episodeFilesFolder(t.home, PLAN_FOLDER);
  mkdirSync(join(folder, "record"), { recursive: true });
  const joined = "the joined video";
  const own = on ? video : folder;
  mkdirSync(own, { recursive: true });
  writeFileSync(join(own, "Too many SKUs.mov"), joined);
  const { files: _files, ...plan } = newPlannedEpisode({ id: PLAN_ID, machine: STUDIO, at: "2026-10-14T07:00:00-05:00", title: "Too many SKUs", route: "script", voice: null, writer: WRITER });
  const planned = { ...plan.planned, set: "2026-10-14T07:10:00-05:00", shots: [{ n: 1, kind: "talking", what: "Open on the problem." }, { n: 2, kind: "b-roll", what: "Sallie at her desk." }], lines: ["Too many SKUs."], filmed: { at: "2026-10-14T10:00:00-05:00", parts: parts.map((p) => p.id) } };
  const next = {
    ...plan, rev: 1, planned, kind: "raw", video: { file: "Too many SKUs.mov", bytes: Buffer.byteLength(joined), seconds: 120, recorded: "2026-10-14", recordedFrom: "import" },
    files: { "Too many SKUs.mov": Buffer.byteLength(joined) }, answer: ANSWERED, finished: FINISHED("Too many SKUs"), ...(on ? { local: { on } } : {})
  };
  writeFileSync(recordFile(folder, 1), recordText({ ...next, version: layoutOf(next) }));
  return { id: PLAN_ID, name: PLAN_FOLDER, folder, video, file: "Too many SKUs.mov", record: readEpisode(folder).record };
}

const pendingOf = (t, id = ID) => readPendingAt(t.home, `original/${id}.json`);

describe("L6: the owe", () => {
  it("M1: a raw video kept on this Mac is owed at its hand-off, and the agent asked once", () => {
    const t = world();
    const found = local(t);
    assert.deepEqual(oweOriginals(t.ctx2, found), { owed: [ID] });
    assert.deepEqual(pendingOf(t), { version: 1, kind: "original", id: ID, name: FOLDER, folder: found.folder, root: t.root, machine: STUDIO, of: { id: ID, name: FOLDER }, file: "Pricing talk.mov", owed: true, entries: [], work: null, lastCopy: t.now() });
    assert.deepEqual(t.kicks, ["kickstart"]);
    t.done();
    const u = world();
    const other = local(u);
    oweOriginals(u.ctx2, other, { ask: false });
    assert.deepEqual(u.kicks, []);
    assert.ok(pendingOf(u));
    u.done();
  });

  it("M2: owing again changes nothing; a recording already moved is owed no more", () => {
    const t = world();
    const found = local(t);
    oweOriginals(t.ctx2, found);
    const text = readFileSync(join(pendingFolder(t.home), `original/${ID}.json`), "utf8");
    t.kicks.length = 0;
    assert.deepEqual(oweOriginals(t.ctx2, found), { owed: [] });
    assert.equal(readFileSync(join(pendingFolder(t.home), `original/${ID}.json`), "utf8"), text);
    assert.deepEqual(t.kicks, []);
    t.done();
    const u = world();
    const a = local(u, { record: { local: { on: STUDIO, original: { file: "Pricing talk.mov", bytes: 13, mtimeMs: 1000 } } } });
    assert.deepEqual(oweOriginals(u.ctx2, a), { owed: [] });
    u.done();
    const v = world();
    const b = local(v);
    writeFileSync(recordFile(b.folder, 3), recordText({ ...reread(b), rev: 3, files: { ...reread(b).files, "Original files/Pricing talk.mov": 13 } }));
    assert.deepEqual(oweOriginals(v.ctx2, { ...b, record: reread(b) }), { owed: [] });
    v.done();
  });

  it("M3: a video made from a plan owes each of its parts kept on this Mac, a client's included, and not its own video", () => {
    const t = world();
    const a = part(t, 1, { as: "talking" });
    const b = part(t, 2, { as: "b-roll", client: true });
    const c = part(t, 3, { as: "voiceover" });
    const away = part(t, 4, { as: "screen", on: MACBOOK });
    const dropbox = part(t, 5, { as: "b-roll", on: null });
    const plan = planMade(t, [a, b, c, away, dropbox]);
    const out = oweOriginals(t.ctx2, plan);
    assert.deepEqual(out.owed.sort(), [a.id, b.id, c.id].sort());
    for (const one of [a, b, c]) {
      const p = pendingOf(t, one.id);
      assert.deepEqual([p.name, p.folder, p.of, p.file], [one.name, one.folder, { id: PLAN_ID, name: PLAN_FOLDER }, one.file]);
    }
    assert.equal(pendingOf(t, PLAN_ID), null);
    assert.equal(pendingOf(t, away.id), null);
    assert.equal(pendingOf(t, dropbox.id), null);
    t.done();
  });

  it("M4: an old plan's part dropped after the switch is owed, and an old record owes nothing", () => {
    const t = world();
    const a = part(t, 1, { as: "talking" });
    const old = part(t, 2, { as: "b-roll", on: null });
    const plan = planMade(t, [a, old], { on: null });
    assert.deepEqual(oweOriginals(t.ctx2, plan), { owed: [a.id] });
    t.done();
    const u = world();
    const raw = local(u, { on: null });
    assert.deepEqual(oweOriginals(u.ctx2, raw), { owed: [] });
    assert.equal(existsSync(join(pendingFolder(u.home), "original")), false);
    assert.deepEqual(u.kicks, []);
    u.done();
  });

  it("M5: a session's recording is never owed", () => {
    const t = world();
    const s = session(t);
    assert.deepEqual(oweOriginals(t.ctx2, s), { owed: [] });
    const held = local(t, { id: "e-20261014-dddddd", name: "2026-10-14 Jane Doe pricing (Mac Studio)", stem: "Jane Doe pricing", record: { versionOf: SESSION_ID } });
    assert.deepEqual(oweOriginals(t.ctx2, held), { owed: [] });
    t.done();
    const u = world();
    const sess = session(u);
    const p = part(u, 1, { as: "talking", match: SESSION_ID });
    const q = part(u, 2, { as: "b-roll" });
    const plan = planMade(u, [p, q]);
    assert.deepEqual(oweOriginals(u.ctx2, plan), { owed: [q.id] });
    assert.equal(existsSync(sess.folder), true);
    u.done();
  });
});

/** The deps of a check: the log (and `once`, which says a line once) collect in `t.logs`; the notices in `t.notices`; the flag is a stand-in. */
export function depsOf(t, over = {}) {
  const said = new Set();
  return {
    episode: { root: t.root, machine: STUDIO, home: t.home, checkout: "/checkout" }, commit: "c709b57",
    log: (line) => t.logs.push(line), notify: (text) => t.notices.push(text), clock: () => t.now(), alive: (pid) => pid === process.pid,
    once: (line) => {
      if (said.has(line)) return;
      said.add(line);
      t.logs.push(line);
    },
    clone: t.ctx.deps.clone, sameDisk: () => true, isWhole: () => true, uploaded: (path) => (existsSync(path) ? true : null), onlineOnly: () => true, ...over
  };
}
/** The pending of a recording, read again, and checked. */
export const look = (t, deps, id = ID) => checkOriginal(readPendingAt(t.home, `original/${id}.json`), deps);
/** A recording owed and moved: the Mac's copy is cloned into Original files, listed, and the pending is waiting for its check. */
function moveIt(t, found, deps = depsOf(t)) {
  oweOriginals(t.ctx2, found);
  look(t, deps, found.id);
  return deps;
}
const RECORDING = "the recording";
const FILE = "Pricing talk.mov";
const originalOf = (found) => join(found.folder, "Original files", found.file);
const SHOWN = "Pricing talk";
const MOVED = `${SHOWN}: its recording is copied into Original files in Dropbox. It leaves this Mac once Dropbox has it uploaded.`;
const TAKEN = `${SHOWN}: Dropbox has its copy in Original files uploaded, so the recording is taken off this Mac.`;
const count = (t, line) => t.logs.filter((l) => l === line).length;
const textOf = (...parts) => readFileSync(join(...parts), "utf8");
const sessionRecord = (found, over = {}) => ({ ...reread(found), kind: "session", answer: { ...ANSWERED, private: "yes" }, name: { text: "Session, 2026-10-14", placeholder: false }, session: { marked: "2026-10-14T08:00:00-05:00", on: STUDIO, teachings: null, cleared: null }, ...over });
const writeRecord = (found, rev, record) => writeFileSync(recordFile(found.folder, rev), recordText({ ...record, rev, version: layoutOf(record) }));

describe("L6: the move", () => {
  it("M6: the move clones the recording into Original files and lists it, and the Mac keeps its copy", () => {
    const t = world();
    const found = local(t);
    const before = reread(found);
    oweOriginals(t.ctx2, found);
    const deps = depsOf(t);
    look(t, deps);
    const to = originalOf(found);
    assert.equal(textOf(to), RECORDING);
    assert.equal(statSync(to).mtimeMs, statSync(join(found.video, FILE)).mtimeMs);
    assert.deepEqual(t.clones.find(([, dest]) => dest === to), [join(found.video, FILE), to]);
    const now = reread(found);
    const { rev, writer, files, local: place, ...rest } = now;
    const { rev: r0, writer: w0, files: f0, local: l0, ...rest0 } = before;
    assert.deepEqual(rest, rest0);
    assert.equal(rev, before.rev + 1);
    assert.deepEqual(files, { ...before.files, "Original files/Pricing talk.mov": 13 });
    assert.deepEqual(place, { on: STUDIO, original: { file: FILE, bytes: 13, mtimeMs: statSync(join(found.video, FILE)).mtimeMs } });
    const p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.owed, p.rev, p.entries, p.macCopy, p.lastCopy], [false, before.rev + 1, [{ from: join(found.video, FILE), to, bytes: 13 }], fileId(join(found.video, FILE)), t.now()]);
    assert.deepEqual(["problem", "nextLook", "lookUntil"].map((k) => p[k]), [undefined, undefined, undefined]);
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(count(t, MOVED), 1);
    assert.deepEqual(existsSync(runsFolder(t.home)) ? readdirSync(runsFolder(t.home)).filter((n) => n.startsWith("originals-")) : [], []);
    assert.equal(existsSync(lockOf(t.home, FOLDER)), false);
    t.done();
  });

  it("M7: a run at work puts the move off", () => {
    const t = world();
    const found = local(t);
    oweOriginals(t.ctx2, found);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(t.home, FOLDER), "read", () => true).taken, true);
    const deps = depsOf(t);
    look(t, deps);
    look(t, deps);
    assert.equal(existsSync(originalOf(found)), false);
    assert.equal(reread(found).rev, 2);
    const p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.owed, p.nextLook], [true, t.now() + LOCK_AGAIN_MS]);
    assert.equal(count(t, `${SHOWN}: its recording waits for the run at work on it to end.`), 1);
    t.done();
  });

  it("M8: a record write refused takes the clone away, and waits", () => {
    const t = world();
    const found = local(t);
    oweOriginals(t.ctx2, found);
    const deps = depsOf(t, { clone: (from, to) => { if (to.endsWith("0003.json")) throw new Error("refused"); return t.ctx.deps.clone(from, to); } });
    look(t, deps);
    assert.equal(existsSync(originalOf(found)), false);
    assert.equal(reread(found).rev, 2);
    const p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.owed, Number.isFinite(p.nextLook), Number.isFinite(p.lookUntil)], [true, true, true]);
    assert.equal(t.logs.filter((l) => l.startsWith(`${SHOWN}: its copy in Original files could not be listed in its record`)).length, 1);
    assert.equal(existsSync(lockOf(t.home, FOLDER)), false);
    t.done();
  });

  it("M9: a move stopped after its clone is made again with no second clone", () => {
    const t = world();
    const found = local(t);
    mkdirSync(join(found.folder, "Original files"), { recursive: true });
    copyFileSync(join(found.video, FILE), originalOf(found));
    oweOriginals(t.ctx2, found);
    look(t, depsOf(t));
    assert.equal(reread(found).files["Original files/Pricing talk.mov"], 13);
    assert.equal(t.clones.some(([from]) => from === join(found.video, FILE)), false);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).owed, false);
    t.done();
  });

  it("M10: another file at its name in Original files is a problem, told once", () => {
    const t = world();
    const found = local(t);
    mkdirSync(join(found.folder, "Original files"), { recursive: true });
    writeFileSync(originalOf(found), "the recordinG");
    oweOriginals(t.ctx2, found);
    const deps = depsOf(t);
    look(t, deps);
    look(t, deps);
    assert.equal(reread(found).rev, 2);
    assert.deepEqual(t.notices, [ORIGINALS_PROBLEM(SHOWN)]);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).problem, "Original files in Dropbox holds another file of its name.");
    assert.equal(existsSync(join(found.video, FILE)), true);
    t.done();
  });

  it("M11: a held finish's lost record is put back first, and its number is never taken", () => {
    for (const workCopy of [true, false]) {
      const t = world();
      const found = local(t);
      const rec3 = { ...reread(found), rev: 3, finished: { ...FINISHED("Pricing talk"), revision: 2 } };
      const work = join(t.dir, "work", "final-1");
      const from = join(work, "r", "0003.json");
      if (workCopy) {
        mkdirSync(dirname(from), { recursive: true });
        writeFileSync(from, recordText(rec3));
      }
      writePending(t.home, { version: 1, kind: "final", id: ID, name: FOLDER, folder: found.folder, root: t.root, machine: STUDIO, revision: 2, rev: 3, entries: [], took: [], work, lastCopy: t.now(), copied: true, record: { from, to: recordFile(found.folder, 3), bytes: Buffer.byteLength(recordText(rec3)) } });
      oweOriginals(t.ctx2, found);
      const deps = depsOf(t);
      look(t, deps);
      if (workCopy) {
        assert.equal(textOf(recordFile(found.folder, 3)), recordText(rec3));
        assert.equal(reread(found).rev, 4);
        assert.ok(reread(found).local.original);
      } else {
        assert.equal(reread(found).rev, 2);
        assert.equal(existsSync(originalOf(found)), false);
        assert.equal(readPendingAt(t.home, `original/${ID}.json`).owed, true);
        assert.equal(t.logs.filter((l) => l.includes("the episode's record cannot be read now")).length, 1);
      }
      t.done();
    }
  });

  it("M12: a change Dropbox undid waits for her command; the move's own does not", () => {
    const t = world();
    const found = local(t);
    acceptRev(t.home, ID, 3);
    oweOriginals(t.ctx2, found);
    look(t, depsOf(t));
    assert.equal(existsSync(originalOf(found)), false);
    assert.equal(reread(found).rev, 2);
    assert.equal(t.logs.filter((l) => l === `${SHOWN}: its recording waits: Dropbox undid this Mac's last change to it, which the next command on it says first. It is looked at again later.`).length, 1);
    assert.ok(readPendingAt(t.home, `original/${ID}.json`).nextLook);
    writePending(t.home, { ...readPendingAt(t.home, `original/${ID}.json`), rev: 3 });
    look(t, depsOf(t));
    assert.equal(reread(found).rev, 3);
    assert.ok(existsSync(originalOf(found)));
    t.done();
  });

  it("M13: a stopped writer's mark is settled before the move writes", () => {
    const t = world();
    const found = local(t, { record: { files: { ...Object.fromEntries(Object.entries(OWN("Pricing talk")).map(([k, v]) => [k, Buffer.byteLength(v)])), "final/x.srt": 5 } } });
    const entry = { from: join(t.dir, "work", "x.srt"), to: join(found.folder, "final", "x.srt"), bytes: 5 };
    writePending(t.home, { version: 1, kind: "final", id: ID, name: FOLDER, folder: found.folder, root: t.root, machine: STUDIO, revision: 2, rev: 3, entries: [entry], took: [], work: null, lastCopy: t.now(), reading: { pid: 999999, at: t.now(), to: [entry.to], nonce: "n", rev: 3 } });
    oweOriginals(t.ctx2, found);
    look(t, depsOf(t));
    const settled = readPendingAt(t.home, `final/${ID}-2.json`);
    assert.equal(settled.reading, undefined);
    assert.equal(settled.entries.length, 1);
    assert.equal(reread(found).rev, 3);
    t.done();
  });

  it("M14: a recording gone from the Mac is put away", () => {
    const t = world();
    const found = local(t);
    oweOriginals(t.ctx2, found);
    rmSync(join(found.video, FILE));
    look(t, depsOf(t));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(existsSync(join(found.folder, "Original files")), false);
    assert.equal(reread(found).rev, 2);
    assert.equal(count(t, `${SHOWN}: its recording is no longer on this Mac, so nothing is copied or taken off.`), 1);
    t.done();
  });

  it("M15: a gone folder is put away with a short notice; Episodes renamed away waits", () => {
    const t = world();
    const found = local(t);
    oweOriginals(t.ctx2, found);
    renameSyncSafe(found.folder, `${found.folder}.away`);
    look(t, depsOf(t));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.deepEqual(t.notices, [FOLDER_GONE("an episode (3fa9c1)")]);
    assert.equal(existsSync(join(found.video, FILE)), true);
    t.done();
    const u = world();
    const other = local(u);
    oweOriginals(u.ctx2, other);
    const episodes = join(u.root, "Episodes");
    renameSyncSafe(episodes, `${episodes}.away`);
    try {
      look(u, depsOf(u));
    } finally {
      renameSyncSafe(`${episodes}.away`, episodes);
    }
    const p = readPendingAt(u.home, `original/${ID}.json`);
    assert.deepEqual([p.owed, p.nextLook, Number.isFinite(p.lookUntil)], [true, u.now() + WAIT_LOOK_MS, true]);
    u.done();
  });
});

describe("L6: sessions", () => {
  it("N1: answered a session between the owe and the move: nothing moves", () => {
    const t = world();
    const found = local(t);
    oweOriginals(t.ctx2, found);
    writeRecord(found, 3, sessionRecord(found));
    look(t, depsOf(t));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(existsSync(join(found.folder, "Original files")), false);
    assert.equal(existsSync(join(found.video, FILE)), true);
    const said = t.logs.filter((l) => l.includes("it is held as a session now"));
    assert.deepEqual(said, ["Video of 14 Oct, 09:00 (Mac Studio) (3fa9c1): it is held as a session now, so its recording stays on this Mac."]);
    assert.ok(!said[0].includes("mov"));
    t.done();
  });

  it("N2: a session after a move stopped before its record: its clone is taken away", () => {
    const t = world();
    const found = local(t);
    mkdirSync(join(found.folder, "Original files"), { recursive: true });
    copyFileSync(join(found.video, FILE), originalOf(found));
    oweOriginals(t.ctx2, found);
    writeRecord(found, 3, sessionRecord(found));
    look(t, depsOf(t));
    assert.equal(existsSync(originalOf(found)), false);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    t.done();
  });

  it("B0-F24 N2 with the clone a placeholder: it is left, and the log says it is there and unlisted", () => {
    const t = world();
    const found = local(t);
    mkdirSync(join(found.folder, "Original files"), { recursive: true });
    copyFileSync(join(found.video, FILE), originalOf(found));
    oweOriginals(t.ctx2, found);
    writeRecord(found, 3, sessionRecord(found));
    look(t, depsOf(t, { isWhole: (path) => path !== originalOf(found) }));
    assert.equal(existsSync(originalOf(found)), true);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(t.logs.filter((l) => l.includes("the record does not list it. Jason removes it by hand")).length, 1, t.logs.join("|"));
    t.done();
  });

  it("B1-F11 the unlisted file beside a session is named by the gate's name, 'a copy of' only when the Mac's copy is alike, and left when the Mac's copy is gone (B1-F18)", () => {
    for (const how of ["alike", "other", "gone"]) {
      const t = world();
      const found = local(t);
      mkdirSync(join(found.folder, "Original files"), { recursive: true });
      if (how === "other") writeFileSync(originalOf(found), "another recording, longer than the Mac's");
      else copyFileSync(join(found.video, FILE), originalOf(found));
      if (how === "gone") rmSync(join(found.video, FILE));
      oweOriginals(t.ctx2, found);
      writeRecord(found, 3, sessionRecord(found));
      look(t, depsOf(t, { isWhole: (path) => how === "alike" ? path !== originalOf(found) : true }));
      assert.equal(existsSync(originalOf(found)), true, how);
      const told = t.logs.filter((l) => l.includes("the record does not list it. Jason removes it by hand"));
      assert.equal(told.length, 1, `${how}: ${t.logs.join("|")}`);
      assert.ok(told[0].startsWith("Video of 14 Oct, 09:00 (Mac Studio)"), told[0]);
      assert.doesNotMatch(told[0], /Pricing talk/);
      assert.match(told[0], how === "other" ? /a file of its recording's name is in Original files/ : /a copy of its recording is in Original files|a file of its recording's name is in Original files/);
      t.done();
    }
  });

  it("N3: a session after the move: nothing in Dropbox changes, and the Mac keeps its copy", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    const listed = reread(found);
    writeRecord(found, 4, sessionRecord(found));
    t.advance(LATE_CHECK_MS);
    const asked = [];
    look(t, depsOf(t, { uploaded: (path) => { asked.push(path); return true; } }));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.equal(reread(found).files["Original files/Pricing talk.mov"], listed.files["Original files/Pricing talk.mov"]);
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(count(t, ORIGINALS_SESSION("Video of 14 Oct, 09:00 (Mac Studio)")), 1);
    assert.deepEqual(asked, []);
    t.done();
  });

  it("N4: so for a video held beside a session", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    local(t, { id: "e-20261014-cccccc", name: "2026-10-14 Later version (Mac Studio)", stem: "Later", record: { kind: "session", versionOf: ID, answer: { ...ANSWERED, private: "yes" }, session: { marked: "2026-10-14T08:00:00-05:00", on: STUDIO, teachings: null, cleared: null } } });
    t.advance(LATE_CHECK_MS);
    const asked = [];
    look(t, depsOf(t, { uploaded: (path) => { asked.push(path); return true; } }));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.equal(count(t, ORIGINALS_SESSION("Video of 14 Oct, 09:00 (Mac Studio)")), 1);
    assert.deepEqual(asked, []);
    t.done();
  });
});

describe("L6: the check", () => {
  it("O1: the check deletes the Mac's copy only when whole, listed, uploaded and unchanged", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    const listed = reread(found);
    t.advance(LATE_CHECK_MS);
    const asked = [];
    look(t, depsOf(t, { uploaded: (path) => { asked.push(path); return true; } }));
    assert.equal(existsSync(join(found.video, FILE)), false);
    for (const rel of ["Pricing talk.transcript.txt", "Pricing talk.words.json", "Pricing talk.cut-plan.json"]) assert.equal(existsSync(join(found.video, rel)), true, rel);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.deepEqual(reread(found), listed);
    assert.deepEqual(asked, [originalOf(found)]);
    assert.equal(count(t, TAKEN), 1);
    t.done();
  });

  it("B0-F23 the delete under the lock asks again that the record in force lists the copy: a record Dropbox lost meanwhile keeps the Mac's copy", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    const lostRev = reread(found).rev;
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t, { uploaded: () => { rmSync(recordFile(found.folder, lostRev)); return true; } }));
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).owed, true);
    t.done();
  });

  it("O2: not uploaded yet keeps the Mac's copy", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    const deps = depsOf(t, { uploaded: () => false });
    const first = t.now();
    look(t, deps);
    let p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.nextLook, p.lookUntil], [first + UPLOAD_LOOK_MS, first + WAIT_LOOK_FOR_MS]);
    t.advance(UPLOAD_LOOK_MS);
    look(t, { ...deps, uploaded: () => null });
    p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.nextLook, p.lookUntil], [t.now() + UPLOAD_LOOK_MS, first + WAIT_LOOK_FOR_MS]);
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(t.logs.filter((l) => l.includes("has not uploaded its copy in Original files yet")).length, 1);
    t.advance(UPLOAD_LOOK_MS);
    look(t, depsOf(t));
    assert.equal(existsSync(join(found.video, FILE)), false);
    t.done();
  });

  it("O3: a copy Dropbox lost, cut short, or put back older at its size is put back from the Mac's copy, and its 15 minutes start again", () => {
    for (const [harm, sameSize] of [[(to) => rmSync(to), false], [(to) => writeFileSync(to, "the rec"), false], [(to) => writeFileSync(to, "the recordinG"), true]]) {
      const t = world();
      const found = local(t);
      moveIt(t, found);
      harm(originalOf(found));
      t.advance(LATE_CHECK_MS);
      const asked = [];
      look(t, depsOf(t, { uploaded: (path) => { asked.push(path); return existsSync(path) ? true : null; } }));
      assert.equal(textOf(originalOf(found)), RECORDING);
      assert.equal(readPendingAt(t.home, `original/${ID}.json`).lastCopy, t.now());
      // A copy not there or at another size is put back at once (table J's stat rows), asking Dropbox nothing; a copy at its size is asked about first.
      assert.deepEqual(asked, sameSize ? [originalOf(found)] : []);
      assert.equal(existsSync(join(found.video, FILE)), true);
      assert.equal(t.logs.filter((l) => l.startsWith(`${SHOWN}: its copy in Original files was not whole in Dropbox (`)).length, 1);
      t.done();
    }
  });

  it("O4: a copy that cannot be put back is a problem, told once", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    rmSync(originalOf(found));
    t.advance(LATE_CHECK_MS);
    const failing = depsOf(t, { clone: (from, to) => { if (to === originalOf(found)) throw new Error("no"); return t.ctx.deps.clone(from, to); } });
    look(t, failing);
    look(t, failing);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).problem, "its copy in Original files could not be put back in Dropbox (an error).");
    assert.deepEqual(t.notices, [ORIGINALS_PROBLEM(SHOWN)]);
    assert.equal(existsSync(join(found.video, FILE)), true);
    look(t, depsOf(t));
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).problem, undefined);
    t.done();
  });

  it("O5: the Mac's copy changed since the move is kept, and nothing is put back from it", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    writeFileSync(join(found.video, FILE), "the recordinG");
    utimesSync(join(found.video, FILE), new Date(t.now() + 5000), new Date(t.now() + 5000));
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(count(t, `${SHOWN}: its recording on this Mac changed after it was copied into Original files, so it is kept on this Mac.`), 1);
    t.done();
  });

  it("O6: the Mac's copy gone is no problem", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    rmSync(join(found.video, FILE));
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(count(t, `${SHOWN}: its recording is no longer on this Mac, so nothing is copied or taken off.`), 1);
    assert.deepEqual(t.notices, []);
    t.done();
  });

  it("O7: a run at work puts the delete off", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    mkdirSync(episodeWork(t.home, FOLDER), { recursive: true });
    const lock = takeEpisodeLock(lockOf(t.home, FOLDER), "read", () => true);
    look(t, depsOf(t));
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).nextLook, t.now() + LOCK_AGAIN_MS);
    releaseEpisodeLock(lockOf(t.home, FOLDER), lock.text);
    const work = takeEpisodeLock(workCopyLockOf(t.home, FOLDER), "workcopy", () => true);
    look(t, depsOf(t));
    assert.equal(existsSync(join(found.video, FILE)), true);
    releaseEpisodeLock(workCopyLockOf(t.home, FOLDER), work.text);
    look(t, depsOf(t));
    assert.equal(existsSync(join(found.video, FILE)), false);
    t.done();
  });

  it("O7b: for a part, a run at work on its plan puts the delete off", () => {
    const t = world();
    const a = part(t, 1);
    const plan = planMade(t, [a]);
    oweOriginals(t.ctx2, plan);
    look(t, depsOf(t), a.id);
    t.advance(LATE_CHECK_MS);
    mkdirSync(episodeWork(t.home, plan.name), { recursive: true });
    const work = takeEpisodeLock(workCopyLockOf(t.home, plan.name), "workcopy", () => true);
    look(t, depsOf(t), a.id);
    assert.equal(existsSync(join(a.video, a.file)), true);
    assert.equal(readPendingAt(t.home, `original/${a.id}.json`).nextLook, t.now() + LOCK_AGAIN_MS);
    releaseEpisodeLock(workCopyLockOf(t.home, plan.name), work.text);
    look(t, depsOf(t), a.id);
    assert.equal(existsSync(join(a.video, a.file)), false);
    t.done();
  });

  it("O8: a record that lost the move lists it again, with no second clone", () => {
    const t = world();
    const found = local(t);
    const before = reread(found);
    moveIt(t, found);
    writeRecord(found, 4, { ...before });
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t));
    let p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.owed, p.lastCopy], [true, t.now()]);
    const clones = t.clones.length;
    look(t, depsOf(t));
    assert.equal(reread(found).rev, 5);
    assert.equal(reread(found).files["Original files/Pricing talk.mov"], 13);
    assert.equal(t.clones.slice(clones).some(([from]) => from === join(found.video, FILE)), false);
    p = readPendingAt(t.home, `original/${ID}.json`);
    assert.equal(p.owed, false);
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t));
    assert.equal(existsSync(join(found.video, FILE)), false);
    t.done();
  });

  it("O9: a placeholder copy is taken as whole and not read", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    writeFileSync(originalOf(found), "the recordinG");
    t.advance(LATE_CHECK_MS);
    const asked = [];
    look(t, depsOf(t, { isWhole: (path) => path !== originalOf(found), uploaded: (path) => { asked.push(path); return true; } }));
    assert.deepEqual(asked, [originalOf(found)]);
    assert.equal(existsSync(join(found.video, FILE)), false);
    t.done();
  });

  it("O10: a part's recording is taken off its own video/, and the plan's video stays", () => {
    const t = world();
    const a = part(t, 1);
    const plan = planMade(t, [a]);
    oweOriginals(t.ctx2, plan);
    look(t, depsOf(t), a.id);
    assert.ok(existsSync(join(a.folder, "Original files", a.file)));
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t), a.id);
    assert.equal(existsSync(join(a.video, a.file)), false);
    assert.equal(existsSync(join(plan.video, plan.file)), true);
    t.done();
  });

  it("O11: Episodes away a moment waits, and is looked at again", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    const episodes = join(t.root, "Episodes");
    renameSyncSafe(episodes, `${episodes}.away`);
    try {
      look(t, depsOf(t));
    } finally {
      renameSyncSafe(`${episodes}.away`, episodes);
    }
    const p = readPendingAt(t.home, `original/${ID}.json`);
    assert.deepEqual([p.nextLook, Number.isFinite(p.lookUntil)], [t.now() + WAIT_LOOK_MS, true]);
    assert.equal(existsSync(join(found.video, FILE)), true);
    t.done();
  });
});

describe("L6: through L5's worlds", () => {
  const CHECKS_ON = { original: checkOriginal };
  const originalPending = (w) => readPendingAt(w.t.home, `original/${ID}.json`);
  const fileOf = (w) => reread(w.found).video.file;

  it("X1: a local finish owes its recording, and its one kick serves both", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const p = originalPending(w);
    assert.deepEqual([p.owed, p.of, p.file, p.kind], [true, { id: ID, name: FOLDER }, fileOf(w), "original"]);
    assert.deepEqual(w.t.kicks, ["kickstart"]);
    w.t.done();
  });

  it("X2: the agent's run moves it at once, and takes it off once Dropbox has it uploaded", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const finalP = filing.readPendingsOf(w.t.home, "final")[0];
    const owed = originalPending(w);
    const own = join(episodeFilesFolder(w.t.home, FOLDER), fileOf(w));
    assert.ok(existsSync(own));
    const r = await agentRun(w, { at: Math.max(finalP.lastCopy, owed.lastCopy) + 1, over: { checks: CHECKS_ON, uploaded: () => true, onlineOnly: () => true } });
    assert.equal(existsSync(own), false, r.logs.join("|"));
    assert.ok(existsSync(join(w.found.folder, "Original files", fileOf(w))));
    assert.equal(reread(w.found).files[`Original files/${fileOf(w)}`] > 0, true);
    assert.equal(originalPending(w), null);
    assert.equal(filing.readPendingsOf(w.t.home, "final").length, 0);
    for (const t of finalP.took) assert.equal(existsSync(t.path), false, t.path);
    w.t.done();
  });

  it("X3: a paused upload is looked at for an hour, and the loop then ends", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    const calls = [];
    const owed = originalPending(w);
    const first = await agentRun(w, { at: owed.lastCopy + 1, over: { checks: CHECKS_ON, uploaded: () => { calls.push(1); return false; } } });
    assert.equal(calls.length, 7, first.logs.join("|"));
    assert.ok(first.waits.every((ms) => ms > 0));
    assert.ok(originalPending(w));
    const p = originalPending(w);
    calls.length = 0;
    await agentRun(w, { at: p.lastCopy + 3 * 60 * 60 * 1000, over: { checks: CHECKS_ON, uploaded: () => { calls.push(1); return false; } } });
    assert.equal(calls.length, 1);
    w.t.done();
  });

  it("X4: a hand-off writer stopped before it owed is owed at the next run's start", async () => {
    const w = await localExported("raw");
    assert.equal(await finishRun(w), 0, w.t.said());
    rmSync(join(pendingFolder(w.t.home), "original", `${ID}.json`));
    const own = join(episodeFilesFolder(w.t.home, FOLDER), fileOf(w));
    const p = filing.readPendingsOf(w.t.home, "final")[0];
    const r = await agentRun(w, { at: p.lastCopy + 1, over: { checks: CHECKS_ON, uploaded: () => false } });
    assert.ok(r.logs.some((l) => l.endsWith("its recording is noted to go into Original files.")), r.logs.join("|"));
    assert.ok(existsSync(join(w.found.folder, "Original files", fileOf(w))));
    assert.ok(existsSync(own));
    w.t.done();
  });

  it("X5: the first hand-off of a finished video from its spellings owes its recording", async () => {
    const w = await finishedWorld({ projects: ["reel 1", "reel 2"], handoff: false, over: { reading: READING("finished"), offers: { spellings: [] } } });
    makeLocal(w);
    const r = await on(seeing(w), "spell", FOLDER, "offers", "all");
    assert.equal(r.code, 0, r.text);
    const p = originalPending(w);
    assert.deepEqual([p.owed, p.of.id], [true, ID]);
    assert.deepEqual(w.t.kicks, ["kickstart"]);
    w.t.done();
  });
});

describe("L6: A9 a plan's footage copy", () => {
  it("A9 is found by the key of its part's recording as it was, after the part is moved off", () => {
    const t = world();
    const a = part(t, 1, { as: "b-roll", client: false });
    const plan = planMade(t, [a]);
    const before = statSync(join(a.video, a.file));
    const paths = footageCopyPaths(t.home, plan.name, 2, workCopyKey({ bytes: before.size, mtimeMs: before.mtimeMs }));
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(paths.video, "the footage");
    writeFileSync(paths.facts, "{}");
    const ctx = { home: t.home, root: t.root, machine: STUDIO };
    const found = { name: plan.name, folder: plan.folder, record: plan.record };
    const footage = () => planProject(ctx, { found, record: plan.record }).footage;
    assert.deepEqual(footage().map((f) => f.from), [paths.video]);
    oweOriginals(t.ctx2, plan);
    look(t, depsOf(t), a.id);
    t.advance(LATE_CHECK_MS);
    look(t, depsOf(t), a.id);
    assert.equal(existsSync(join(a.video, a.file)), false);
    assert.deepEqual(footage().map((f) => f.from), [paths.video]);
    t.done();
  });
});

describe("L6: P2 her command during the move", () => {
  it("P2 is told so, and nothing is written", async () => {
    const w = await guideWorld({ kind: "raw", projects: ["main", "reel 2"], programs: { WHISPER: whisper() } });
    makeLocal(w);
    exportOf(w, "main");
    mkdirSync(episodeWork(w.t.home, FOLDER), { recursive: true });
    assert.equal(takeEpisodeLock(lockOf(w.t.home, FOLDER), "originals", () => true).taken, true);
    const before = reread(w.found).rev;
    const r = await on(seeing(w, { alive: () => true }), "finish", FOLDER);
    assert.ok(r.text.includes('Its recording is being copied into Dropbox. Say "hand it off" again then.'), r.text);
    assert.equal(reread(w.found).rev, before);
    w.t.done();
  });
});

describe("L6: the review's fix round", () => {
  it("F1 a session mark written after the flag was asked and before the delete keeps the Mac's copy", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    const deps = depsOf(t, { uploaded: () => { writeRecord(found, 4, sessionRecord(found)); return true; } });
    look(t, deps);
    assert.equal(existsSync(join(found.video, FILE)), true);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.equal(count(t, ORIGINALS_SESSION("Video of 14 Oct, 09:00 (Mac Studio)")), 1);
    t.done();
  });

  it("F2 a session mark written after the move's gate and before its clone moves nothing", () => {
    const t = world();
    const found = local(t, { record: { files: { ...Object.fromEntries(Object.entries(OWN("Pricing talk")).map(([k, v]) => [k, Buffer.byteLength(v)])), "final/x.srt": 5 } } });
    const entry = { from: join(t.dir, "work", "x.srt"), to: join(found.folder, "final", "x.srt"), bytes: 5 };
    writePending(t.home, { version: 1, kind: "final", id: ID, name: FOLDER, folder: found.folder, root: t.root, machine: STUDIO, revision: 2, rev: 3, entries: [entry], took: [], work: null, lastCopy: t.now(), reading: { pid: 999999, at: t.now(), to: [entry.to], nonce: "n", rev: 3 } });
    oweOriginals(t.ctx2, found);
    let written = false;
    const deps = depsOf(t, { log: (line) => { t.logs.push(line); if (!written) { written = true; writeRecord(found, 3, sessionRecord(found)); } } });
    look(t, deps);
    assert.equal(written, true);
    assert.equal(existsSync(join(found.folder, "Original files")), false);
    assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
    assert.equal(existsSync(join(found.video, FILE)), true);
    t.done();
  });

  it("F3 an unlisted placeholder at the target is a problem, and the Mac's copy stays", () => {
    const t = world();
    const found = local(t);
    mkdirSync(join(found.folder, "Original files"), { recursive: true });
    writeFileSync(originalOf(found), "the recordinG");
    oweOriginals(t.ctx2, found);
    look(t, depsOf(t, { isWhole: (path) => path !== originalOf(found) }));
    assert.equal(readPendingAt(t.home, `original/${ID}.json`).problem, "Original files in Dropbox holds another file of its name.");
    assert.equal(reread(found).rev, 2);
    assert.equal(existsSync(join(found.video, FILE)), true);
    t.done();
  });

  it("F4 an archived video is not owed again at a run's start", () => {
    const t = world();
    const found = local(t, { record: { archived: { at: "2026-10-15T09:00:00-05:00", by: "Sallie Ogden" } } });
    assert.ok(found.record.archived);
    assert.deepEqual(oweForgotten({ episode: { root: t.root, machine: STUDIO, home: t.home }, clock: () => t.now(), log: () => {} }), { owed: [] });
    t.done();
    const u = world();
    local(u);
    assert.deepEqual(oweForgotten({ episode: { root: u.root, machine: STUDIO, home: u.home }, clock: () => u.now(), log: () => {} }).owed, [ID]);
    u.done();
  });

  it("F5 a look that finds the copy not uploaded reads nothing of it", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    const read = [];
    look(t, depsOf(t, { uploaded: () => false, isWhole: (path) => { read.push(path); return true; } }));
    assert.equal(read.includes(originalOf(found)), false);
    // Once it says uploaded, the copy is looked at (put back when it is not whole), and then the Mac's copy goes.
    writeFileSync(originalOf(found), "the recordinG");
    look(t, depsOf(t));
    assert.equal(textOf(originalOf(found)), RECORDING);
    assert.equal(existsSync(join(found.video, FILE)), true);
    t.done();
  });
});


describe("L6b: the copy in Original files made online-only", () => {
  const MADE = `${SHOWN}: its recording in Original files is made online-only.`;
  const COULD = (why) => `${SHOWN}: its recording in Original files could not be made online-only (${why}); it stays on this Mac's disk until Dropbox frees it.`;

  it("the check makes the copy in Original files online-only once the Mac's copy is deleted", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    const asked = [];
    look(t, depsOf(t, { onlineOnly: (path) => { asked.push([path, existsSync(join(found.video, FILE))]); return true; } }));
    assert.deepEqual(asked, [[originalOf(found), false]]);
    assert.equal(count(t, MADE), 1);
    t.done();
  });

  it("it is never asked while the Mac's copy stays", () => {
    for (const over of [{ uploaded: () => false }, { uploaded: () => null }, { isWhole: undefined, short: true }]) {
      const t = world();
      const found = local(t);
      moveIt(t, found);
      t.advance(LATE_CHECK_MS);
      if (over.short) writeFileSync(originalOf(found), "the");
      const asked = [];
      look(t, depsOf(t, { ...over, short: undefined, onlineOnly: (path) => { asked.push(path); return true; } }));
      assert.equal(existsSync(join(found.video, FILE)), true, Object.keys(over).join());
      assert.deepEqual(asked, []);
      t.done();
    }
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    const asked = [];
    look(t, depsOf(t, { uploaded: () => { writeRecord(found, 4, sessionRecord(found)); return true; }, onlineOnly: (path) => { asked.push(path); return true; } }));
    assert.deepEqual(asked, []);
    t.done();
  });

  it("a copy that cannot be made online-only is logged, and the check is still done", () => {
    for (const [onlineOnly, why] of [[() => false, "no answer"], [(path, said) => { said("NSCocoaErrorDomain 256"); return false; }, "NSCocoaErrorDomain 256"], [() => { throw new Error("x"); }, "x"]]) {
      const t = world();
      const found = local(t);
      moveIt(t, found);
      t.advance(LATE_CHECK_MS);
      look(t, depsOf(t, { onlineOnly }));
      assert.equal(existsSync(join(found.video, FILE)), false);
      assert.equal(count(t, COULD(why)), 1);
      assert.equal(readPendingAt(t.home, `original/${ID}.json`), null);
      assert.deepEqual(t.notices, []);
      t.done();
    }
  });

  it("the helper is called after the episode's lock is let go", () => {
    const t = world();
    const found = local(t);
    moveIt(t, found);
    t.advance(LATE_CHECK_MS);
    let free = null;
    look(t, depsOf(t, { onlineOnly: () => {
      const took = takeEpisodeLock(lockOf(t.home, FOLDER), "probe", (pid) => pid === process.pid);
      free = took.taken;
      if (took.taken) releaseEpisodeLock(lockOf(t.home, FOLDER), took.text);
      return true;
    } }));
    assert.equal(free, true);
    assert.equal(count(t, MADE), 1);
    t.done();
  });
});
