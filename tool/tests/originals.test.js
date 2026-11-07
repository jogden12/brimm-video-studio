// The recordings moved into Original files after the hand-off (Phase 3, L6; design D6). A video kept on this Mac, handed off, owes each recording she
// dropped for it a copy in its episode's Original files/ in Dropbox; the Mac's copy is deleted only once Dropbox's check of that copy has passed and
// Dropbox says it is uploaded (a stand-in gives that flag: no test runs swift). A session's recording never moves. Nothing here runs a real program,
// touches Dropbox or asks launchctl: each test has a root and a home of its own, episodes.js's clone and clock, and a kick stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { acceptRev, layoutOf, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { FOLDER_GONE, LOCK_AGAIN_MS, WAIT_LOOK_FOR_MS, WAIT_LOOK_MS, fileId, pendingKeyOf, readEveryPending, readPendingAt, writePending } from "../filing.js";
import { lockOf, releaseEpisodeLock, takeEpisodeLock } from "../detached.js";
import { episodeFilesFolder, episodeWork, pendingFolder, runsFolder } from "../settings.js";
import { ORIGINALS_COMMAND, ORIGINALS_PROBLEM, ORIGINALS_RUNNING, ORIGINALS_SESSION, UPLOAD_LOOK_MS, asSession, checkOriginal, listsOriginal, moved, oweForgotten, oweOriginals, originalsOf } from "../originals.js";
import { linksOf } from "../finish.js";
import { setup } from "./episodes.js";

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
  t.log = () => (existsSync(t.logFile) ? readFileSync(t.logFile, "utf8").split("\n").filter(Boolean) : []);
  t.ctx2 = { home: t.home, root: t.root, machine: STUDIO, now: t.now, agentRunning: () => false, kickstart: () => t.kicks.push("kickstart") };
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
  const planned = { ...plan.planned, set: "2026-10-14T07:10:00-05:00", shots: [{ n: 1, kind: "talking", what: "Open on the problem." }], lines: ["Too many SKUs."], filmed: { at: "2026-10-14T10:00:00-05:00", parts: parts.map((p) => p.id) } };
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
