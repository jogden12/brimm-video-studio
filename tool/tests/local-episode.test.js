// An episode kept on one Mac (Phase 3, the local working folder; L2, design D2 and D3). The Mac Studio's drop folder is its own (its settings
// hold `dropPath`), so the episodes it files keep their own files on it, in their work folders' video/, and their records say so: `local:
// { on: "Mac Studio" }`, layout 6. Their folders in Dropbox hold their records, and a plan's three files. Jason's MacBook is on a drop folder in
// Dropbox (`drop: "Drop"`) and shares the root: an episode kept on the Mac Studio is listed there as being on the Mac Studio, none of its own
// files is looked for there, and every command that names it says one line and changes nothing.
// The world here (world, kept and KEPT) is for the later tasks of Phase 3 too (L2c and on), which add their tests of a local episode to this
// file: a test file is not imported by another, which would run its tests again there. Nothing here runs a real program or touches Dropbox:
// the root and both homes are a test's own folders, and the programs are episodes.js's stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { COMMAND_NAMES, editMain } from "../edit.js";
import { UNSCOPED } from "../gate.js";
import { layoutOf, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { ON_OTHER_MAC } from "../where.js";
import { highestNumberOf, lastRevision } from "../finish.js";
import { suggestionsFor } from "../suggestions-in-main.js";
import { asFiled } from "../reading.js";
import { askBlocked, versionIn } from "../unedited.js";
import { fingerprintOf } from "../versions.js";
import { writeGuideNotes } from "../guide-note.js";
import { workCopyKey, workCopyPaths } from "../workcopy.js";
import { TEACHINGS_FORMAT } from "../teachings.js";
import { episodeFilesFolder } from "../settings.js";
import { setup, listAll } from "./episodes.js";
import { entry } from "./exports-world.js";
import { reelsFile } from "../reel-candidates.js";
import { cliPath } from "../hyperframes.js";

const STUDIO = "Mac Studio";
const MACBOOK = "Jason's MacBook";
const WRITER = { commit: "c709b57", on: STUDIO };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: STUDIO, at: "2026-10-20T08:00:00-05:00", private: "no" };
const READ = (kind) => ({ kind, model: "m", at: "2026-10-20T08:05:00-05:00", on: STUDIO, account: "a", outcome: "read" });
const OFFERS = { spellings: [], answered: { reading: "2026-10-20T08:05:00-05:00", at: "2026-10-20T08:06:00-05:00", on: STUDIO, applied: [], left: [] } };
/** The files the light import leaves of a recording called `stem`, on the Mac that took it in, with what each holds. */
const OWN = (stem) => ({
  [`${stem}.mov`]: "the recording",
  [`${stem}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.transcript.txt`]: "[0:00] words\n",
  [`${stem}.words.json`]: JSON.stringify({ video: `${stem}.mov`, duration: 42, words: [] }),
  [`${stem}.cut-plan.json`]: JSON.stringify({ version: 1, video: `${stem}.mov` }),
  [`${stem}.rough-cut.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n"
});

/** A world for one test: episodes.js's root, clock and stand-ins, the Mac Studio (`studio`, the deps it runs a command with: a drop folder of its
    own, on the light import, handing off version 2) and Jason's MacBook (`macbook`: the same root, a home of its own, a drop folder in Dropbox). */
function world() {
  const t = setup({ machine: STUDIO });
  const studio = { ...t.ctx.deps, settings: { ...t.ctx.settings, import: "light", handoffVersion: 2, drop: "Drop", dropPath: join(t.home, "BRIMM Video Work", "Drop") } };
  const macbookHome = join(t.dir, "home-macbook");
  const macbook = { ...t.ctx.deps, home: macbookHome, settings: { version: 1, machine: MACBOOK, root: t.root, checkout: "/checkout", import: "light", handoffVersion: 2, drop: "Drop" } };
  return { ...t, studio, macbook, macbookHome };
}

/** An episode kept on the Mac Studio, as the import of a Mac with a drop folder of its own files one: its record (`record` laid over the import's
    first, at the layout it then holds, which `local` makes 6) in its folder in Episodes, and its own files (`own`) in the Mac Studio's video/
    folder for it, listed in the record; `dropbox`, files of its folder in Dropbox (a plan's), listed too. Returns { name, folder, video, record }. */
function kept(t, { id, name, stem = "IMG_0042", own = OWN(stem), dropbox = {}, record = {} }) {
  const folder = join(t.root, "Episodes", name);
  const video = episodeFilesFolder(t.home, name);
  mkdirSync(join(folder, "record"), { recursive: true });
  const sizes = {};
  for (const [dir, files] of [[video, own], [folder, dropbox]]) {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), text);
      sizes[rel] = Buffer.byteLength(text);
    }
  }
  const made = newEpisode({ id, machine: STUDIO, at: "2026-10-20T09:00:00-05:00", video: { file: `${stem}.mov`, bytes: sizes[`${stem}.mov`] ?? 1, seconds: 42, created: null }, kind: null, writer: WRITER, files: sizes });
  const next = { ...made, ...record, rev: 1, local: { on: STUDIO } };
  writeFileSync(recordFile(folder, 1), recordText({ ...next, version: layoutOf(next) }));
  return { name, folder, video, record: readEpisode(folder).record };
}

/** The folder of the session below, which the video held beside it is a version of. */
const SESSION_FOLDER = "2026-10-20 Coaching call Jane Doe (Mac Studio)";

/** The episodes kept on the Mac Studio that the tests here use: a raw video, read and named; a video waiting for her answer; a client or group
    session whose mark is not cleared; a plan, set, with its three files in Dropbox; and a raw video held beside that session (one of its other
    versions is the session, not cleared: edit.js episodeAt's `held`), whose name is a client's and is never said. Each by what it is (`what`),
    how every line names it (`said`: a session and a video held beside one by its label), its short id, and the line `episodes` lists it by
    (`line`). */
const KEPT = {
  raw: {
    what: "a raw video", said: "Pricing talk", short: "3fa9c1", line: "  Pricing talk: an episode of 0:42, in 2026-10-20 IMG_0042 (Mac Studio), id 3fa9c1",
    make: (t) => kept(t, { id: "e-20261020-3fa9c1", name: "2026-10-20 IMG_0042 (Mac Studio)", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Pricing talk", placeholder: false }, label: "Video of 20 Oct, 09:00 (Mac Studio)" } })
  },
  waiting: {
    what: "a video waiting for her answer", said: "Video of 20 Oct, 10:00 (Mac Studio)", short: "aaaaaa", line: "  Video of 20 Oct, 10:00 (Mac Studio): a video waiting for your answer, of 0:42, id aaaaaa",
    make: (t) => kept(t, { id: "e-20261020-aaaaaa", name: "2026-10-20 IMG_0043 (Mac Studio)", stem: "IMG_0043", record: { answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:42", came: "camera", match: null }, label: "Video of 20 Oct, 10:00 (Mac Studio)" } })
  },
  session: {
    what: "a session", said: "Session, 2026-10-20", short: "bbbbbb", line: "  Session, 2026-10-20: a client or group session, of 0:42, id bbbbbb",
    make: (t) => kept(t, {
      id: "e-20261020-bbbbbb", name: SESSION_FOLDER, stem: "Coaching call Jane Doe",
      record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 11:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: { marked: "2026-10-20T08:00:00-05:00", on: STUDIO, teachings: null, cleared: null } }
    })
  },
  plan: {
    what: "a plan", said: "Too many SKUs", short: "cccccc", line: '  "Too many SKUs": planned on 20 October, waiting for its footage (1 shot), id cccccc',
    make: (t) => {
      // The plan's record as `plan new` makes it, but for its files, which kept lists as it puts them in its folder in Dropbox.
      const { files, ...plan } = newPlannedEpisode({ id: "e-20261020-cccccc", machine: STUDIO, at: "2026-10-20T07:00:00-05:00", title: "Too many SKUs", route: "script", voice: null, writer: WRITER });
      const planned = { ...plan.planned, set: "2026-10-20T07:10:00-05:00", shots: [{ n: 1, kind: "talking", what: "Open on the problem, to the camera." }], lines: ["Too many SKUs will sink a small shop."] };
      return kept(t, { id: plan.id, name: "2026-10-20 Too many SKUs (Mac Studio)", own: {}, dropbox: { "video guide.md": "The video guide.\n", "shot list.md": "The shot list.\n", "teleprompter.txt": "Too many SKUs will sink a small shop.\n" }, record: { ...plan, planned } });
    }
  },
  held: {
    what: "a video held beside a session", said: "Video of 20 Oct, 12:00 (Mac Studio)", short: "dddddd", line: "  Video of 20 Oct, 12:00 (Mac Studio): a version of a client or group session, of 0:42, id dddddd",
    make: (t) => {
      // The session it is a version of is made first, when a test has not made it already.
      if (!existsSync(join(t.root, "Episodes", SESSION_FOLDER))) KEPT.session.make(t);
      return kept(t, {
        id: "e-20261020-dddddd", name: "2026-10-20 Jane Doe pricing (Mac Studio)", stem: "Jane Doe pricing",
        record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Jane Doe pricing", placeholder: false }, label: "Video of 20 Oct, 12:00 (Mac Studio)", versionOf: "e-20261020-bbbbbb" }
      });
    }
  }
};

/** The raw video `found` (KEPT.raw's) handed off on the Mac Studio: its hand-off in final/, and its record 2 saying so. */
function handedOff(found) {
  const handoff = "final/Pricing talk.brimm-ops.json";
  mkdirSync(join(found.folder, "final"), { recursive: true });
  writeFileSync(join(found.folder, handoff), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: found.record.id, kind: "raw", name: "Pricing talk" }, main: { file: "Pricing talk.mov" } }));
  writeFileSync(recordFile(found.folder, 2), recordText({ ...found.record, rev: 2, finished: { revision: 1, at: "2026-10-20T13:00:00-05:00", on: STUDIO, handoff, parts: {} } }));
}

/** A video she left alone, not for BRIMM Video Studio (`leave`), kept on the Mac Studio, as `episodes` lists it there. */
const LEFT = {
  line: "  Video of 20 Oct, 13:00 (Mac Studio): a video of 0:42, id eeeeee",
  make: (t) => kept(t, { id: "e-20261020-eeeeee", name: "2026-10-20 IMG_0050 (Mac Studio)", stem: "IMG_0050", record: { answer: { state: "not for brimm-video", guess: "raw", seen: "wide, 0:42", came: "camera", match: null, by: "Sallie Ogden", on: STUDIO, at: "2026-10-20T08:00:00-05:00" }, label: "Video of 20 Oct, 13:00 (Mac Studio)" } })
};

/** Run a command of edit.js on a Mac, by its deps: { code, said, text }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** The homes of the Macs a test runs commands on besides the Mac Studio, by their folders in the world: Jason's MacBook's, and Sallie's laptop's. */
const OTHER_HOMES = ["home-macbook", "home-laptop"];

/** Every file of the world but the other Macs' own homes, whole, by its path: Dropbox (the root) and the Mac Studio's home and work. */
const shared = (w) => Object.fromEntries(listAll(w.dir).filter((rel) => !OTHER_HOMES.some((home) => rel.startsWith(`${home}/`))).map((rel) => [rel, readFileSync(join(w.dir, rel), "utf8")]));

/** Her two skills (studio/SKILL.md and SKILL-open.md), as written. */
const SKILLS = ["SKILL.md", "SKILL-open.md"].map((name) => readFileSync(new URL(`../studio/${name}`, import.meta.url), "utf8"));

/** What each command is given to name the episode in the folder `folder`, as Claude runs it (edit-gate.test.js's ASKED). */
const askedOf = (folder) => ({
  kind: [folder, "finished", "--private", "no"], leave: [folder], which: [folder], read: ["--now", folder, "--kind", "finished", "--rev", "1"],
  workcopy: ["--now", folder], open: [folder], app: [folder], bring: ["--now", folder], name: [folder, "A new name"], title: [folder], reel: ["drop", folder, "1"], reels: [folder, "--no-play"],
  ask: [folder], finish: [folder], show: [folder, "transcript"], resolve: [folder], spell: [folder], graphic: [folder, "ideas"],
  teachings: [folder], principles: [folder], ideas: [folder], free: [folder], refs: ["use", folder, "blue carousel"], plan: [folder],
  footage: [folder, "Too many SKUs", "talking", "--client", "no"], join: ["--now", folder, "--parts", "e-20261020-a11111"]
});
/** The commands that name an episode: every command but those that name none. */
const SCOPED = COMMAND_NAMES.filter((name) => !UNSCOPED.includes(name));
/** The detached runs walked as well as the quick forms of their commands, as each comes in when a quick form starts it (`ask --now`, `finish
    --now`; edit-gate.test.js walks them so): `read`, `workcopy`, `bring` and `join` are walked with --now in askedOf already. */
const DETACHED = (folder) => [["ask", "--now", folder], ["finish", "--now", folder]];
/** The result each detached run the gate ended leaves on this Mac, by its command, with the words `status` names that run by. */
const RESULTS = { ask: "ask", bring: "bring", finish: "finish", join: "making the video from its footage", read: "read", workcopy: "making the video for HyperFrames" };

/** Walk every command that names an episode, and the detached runs, on another Mac (by default the MacBook: `w.macbook`, whose home is
    `w.macbookHome`; a test gives another as `deps` and `home`, a folder of OTHER_HOMES), for the episode kept on the Mac Studio in the folder
    `found.name`: each says `line`, the gate's one line, and ends 1, and runs, starts and writes nothing in Dropbox or on the Mac Studio. On that
    Mac, each detached run leaves its result in the same words, as `status` lists it there, refusing nothing. `what` names the episode in what a
    failure says. */
async function walkOn(w, found, line, what, { deps = w.macbook, home = w.macbookHome } = {}) {
  const before = shared(w);
  for (const argv of [...SCOPED.map((name) => [name, ...askedOf(found.name)[name]]), ...DETACHED(found.name)]) {
    const r = await on(deps, ...argv);
    assert.deepEqual([r.code, r.said], [1, [line]], `${what}: ${argv.join(" ")}`);
    assert.deepEqual([w.started, w.calls, w.opened], [[], [], []], `${what}: ${argv.join(" ")}`);
    assert.deepEqual(shared(w), before, `${what}: ${argv.join(" ")} wrote nothing in Dropbox or on the Mac Studio`);
  }
  // On that Mac, only what each detached run the gate ended leaves: its result, in the same words.
  assert.deepEqual(listAll(home), Object.keys(RESULTS).map((command) => join("BRIMM Video Work", found.name, `${command}.result.json`)), what);
  for (const rel of listAll(home)) assert.deepEqual(JSON.parse(readFileSync(join(home, rel), "utf8")).failed, [line], `${what}: ${rel}`);
  // `status` names no episode to refuse: it lists each of those results, ended and not done, in the gate's words.
  const status = await on(deps, "status");
  assert.equal(status.code, 0, `${what}: ${status.text}`);
  assert.equal(status.said.length, Object.keys(RESULTS).length, `${what}: ${status.text}`);
  for (const run of Object.values(RESULTS)) assert.equal(status.said.filter((said) => said.includes(`: ${run} ended `) && said.endsWith(`Not done: ${line}`)).length, 1, `${what}: ${run}\n${status.text}`);
  assert.deepEqual(shared(w), before, `${what}: status wrote nothing in Dropbox or on the Mac Studio`);
}

describe("an episode kept on the Mac Studio, on another Mac (Jason's MacBook, on a drop folder in Dropbox)", () => {
  it("has every command that names an episode in the walk", () => {
    for (const name of SCOPED) assert.ok(name in askedOf("x"), `${name} names an episode: give it its words, or it is not walked here`);
  });
  for (const episode of Object.values(KEPT)) {
    it(`refuses every command that names ${episode.what} kept there in one line, which names it as every line does, and writes, runs and starts nothing`, async () => {
      const w = world();
      try {
        const found = episode.make(w);
        await walkOn(w, found, ON_OTHER_MAC(episode.said, STUDIO), episode.what);
        assert.deepEqual(readEpisode(found.folder).record, found.record);
        // Nothing of a gated video's file is said, its own name included, by the walk or by `status`.
        if (["waiting", "session", "held"].some((key) => KEPT[key] === episode)) {
          for (const rel of listAll(w.macbookHome)) assert.doesNotMatch(readFileSync(join(w.macbookHome, rel), "utf8"), /IMG_0043|Jane Doe/, rel);
          assert.doesNotMatch((await on(w.macbook, "status")).text, /IMG_0043|Jane Doe/);
        }
      } finally {
        w.done();
      }
    });
  }
  it("is found there by what it is found by here: its name, its label, its ids and its folder", async () => {
    const w = world();
    try {
      for (const episode of Object.values(KEPT)) {
        const found = episode.make(w);
        for (const said of new Set([episode.said, found.record.label, found.record.id, episode.short, found.name].filter(Boolean))) {
          const r = await on(w.macbook, "open", said);
          assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC(episode.said, STUDIO)]], said);
        }
      }
    } finally {
      w.done();
    }
  });
  it("says so with the training gate on there too: a session is on the Mac Studio, whatever this Mac may read", async () => {
    const w = world();
    try {
      const found = KEPT.session.make(w);
      const taught = { ...w.macbook, settings: { ...w.macbook.settings, sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
      for (const name of ["teachings", "principles", "ideas", "finish"]) {
        const r = await on(taught, name, found.name);
        assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC("Session, 2026-10-20", STUDIO)]], name);
      }
    } finally {
      w.done();
    }
  });
  it("is listed by `episodes` as on the Mac Studio, with no file of it called missing and no card for the video waiting for her answer", async () => {
    const w = world();
    try {
      for (const episode of Object.values(KEPT)) episode.make(w);
      const r = await on(w.macbook, "episodes");
      assert.equal(r.code, 0, r.text);
      const ON = "    It is on the Mac Studio. Carry on there.";
      const after = (start) => r.said[r.said.findIndex((line) => line.startsWith(start)) + 1];
      for (const start of Object.values(KEPT).map((episode) => episode.line)) {
        assert.ok(r.said.includes(start), `${start}\n${r.text}`);
        assert.equal(after(start), ON, start);
      }
      assert.equal(r.said.filter((line) => line === ON).length, Object.keys(KEPT).length, r.text);
      assert.doesNotMatch(r.text, /missing|not all here|not the one Studio saved|Card/, r.text);
      assert.doesNotMatch(r.text, /IMG_0043|Jane Doe/, "nothing of a gated video's file is said");
      // Her chat asks no card for the video waiting for her answer: both her skills name the very line said under it, with its Mac as <Mac>
      // (review R1-F1; studio.test.js pins their sentence).
      const under = after(KEPT.waiting.line).trim().replace("the Mac Studio", "<Mac>");
      for (const skill of SKILLS) assert.ok(skill.includes(`A video \`episodes\` lists with "${under}" under it waits for her on that Mac: ask no card for it here`), under);
    } finally {
      w.done();
    }
  });
  it("has the guide say a video and a session kept there are there: on the overview, and asked by name", async () => {
    const w = world();
    try {
      for (const episode of Object.values(KEPT)) episode.make(w);
      for (const episode of Object.values(KEPT)) {
        const r = await on(w.macbook, "guide", episode.said);
        assert.deepEqual([r.code, r.said], [0, [`${episode.said} (${episode.short}): It is on the Mac Studio. Carry on there.`]], episode.said);
      }
      const all = await on(w.macbook, "guide");
      assert.equal(all.said[0], "Your drop folder: Dropbox › The BRIMM DB › BRIMM Video › Drop › Jason's MacBook");
      assert.deepEqual(all.said.slice(2).sort(), Object.values(KEPT).map((episode) => `  ${episode.said} (${episode.short}): It is on the Mac Studio. Carry on there.`).sort(), all.text);
      assert.doesNotMatch(all.text, /waiting for your answer|what's waiting|card/i, "no card is offered on this Mac");
    } finally {
      w.done();
    }
  });
  it("has the guide take her step on the BRIMM Ops page there once a hand-off is written: the page is hers on any Mac", async () => {
    const w = world();
    try {
      handedOff(KEPT.raw.make(w));
      const r = await on(w.macbook, "guide", "Pricing talk");
      assert.equal(r.code, 0, r.text);
      assert.match(r.said[0], /^Pricing talk \(3fa9c1\): On the BRIMM Ops page: Drag the hand-off onto Episodes\./);
      assert.equal(r.said.at(-1), "Step: taken");
    } finally {
      w.done();
    }
  });
  it("is listed by `episodes` with only where it is once the guide's step for it is not there: handed off, left alone, or a session kept to its transcript", async () => {
    // Review R1-F4. The guide gives a video handed off the BRIMM Ops page's steps, hers on any Mac, and a video she left alone and a session whose
    // choice is its transcript only no step at all: `episodes` says where each is, and never "Carry on there.", which is the guide's step alone.
    const w = world();
    try {
      handedOff(KEPT.raw.make(w));
      const session = KEPT.session.make(w);
      writeFileSync(recordFile(session.folder, 2), recordText({ ...session.record, rev: 2, session: { ...session.record.session, teachings: "transcript only" } }));
      LEFT.make(w);
      const r = await on(w.macbook, "episodes");
      assert.equal(r.code, 0, r.text);
      const under = (start) => {
        const at = r.said.indexOf(start);
        assert.ok(at >= 0, `${start}\n${r.text}`);
        return r.said.slice(at + 1, at + 3);
      };
      assert.deepEqual(under(KEPT.raw.line), ["    It is on the Mac Studio.", "    Finished: revision 1, on Mac Studio"], r.text);
      assert.equal(under(KEPT.session.line)[0], "    It is on the Mac Studio.", r.text);
      assert.equal(under(LEFT.line)[0], "    It is on the Mac Studio.", r.text);
      assert.ok(r.said.indexOf("Left alone, not for BRIMM Video Studio:") < r.said.indexOf(LEFT.line), r.text);
      assert.doesNotMatch(r.text, /Carry on there/, r.text);
      // The guide says none of them is on the Mac Studio as a step: the page's step for the one handed off, and nothing of the other two.
      const guide = await on(w.macbook, "guide");
      assert.doesNotMatch(guide.text, /Carry on there|Session, 2026-10-20|Video of 20 Oct, 13:00/, guide.text);
    } finally {
      w.done();
    }
  });
});

/** The episode `found` handed off on the Mac Studio, as `handedOff` does the raw video, but for any kind and name: its hand-off in final/, and the
    record `over` laid over it as its record 2 (which a test may make a conflict of, with conflictedRecord). Returns the record. */
function handedOffAs(found, { name, kind, over = {}, finished = {} }) {
  const handoff = `final/${name}.brimm-ops.json`;
  mkdirSync(join(found.folder, "final"), { recursive: true });
  writeFileSync(join(found.folder, handoff), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: found.record.id, kind, name }, main: { file: `${name}.mov` } }));
  const record = { ...found.record, rev: 2, ...over, finished: { revision: 1, at: "2026-10-20T13:00:00-05:00", on: STUDIO, handoff, parts: {}, ...finished } };
  writeFileSync(recordFile(found.folder, 2), recordText({ ...record, version: layoutOf(record) }));
  return record;
}

describe("a handed-off episode kept on the Mac Studio whose first steps are still the Mac Studio's, seen on another Mac (review R2-F1, R2-F2)", () => {
  const ON_LINE = "    It is on the Mac Studio. Carry on there.";
  const underLine = (r, start) => {
    const at = r.said.indexOf(start);
    assert.ok(at >= 0, `${start}\n${r.text}`);
    return r.said[at + 1];
  };
  it("keeps the Mac Studio's steps first for a handed-off video held beside a session that is not cleared: the guide and `episodes` say Carry on there", async () => {
    const w = world();
    try {
      const found = KEPT.held.make(w);
      handedOffAs(found, { name: "Jane Doe pricing", kind: "raw" });
      const guide = await on(w.macbook, "guide", KEPT.held.said);
      assert.deepEqual([guide.code, guide.said], [0, [`${KEPT.held.said} (${KEPT.held.short}): It is on the Mac Studio. Carry on there.`]], guide.text);
      assert.equal(underLine(await on(w.macbook, "episodes"), KEPT.held.line), ON_LINE);
    } finally {
      w.done();
    }
  });
  it("keeps the Mac Studio's steps first for a handed-off video whose record has a conflicted copy", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      const record = handedOffAs(found, { name: "Pricing talk", kind: "raw" });
      conflictedRecord(found, { inForce: { finished: record.finished }, copy: { finished: record.finished, title: { text: "Another", approved: false } } });
      const guide = await on(w.macbook, "guide", KEPT.raw.said);
      assert.deepEqual([guide.code, guide.said], [0, [`${KEPT.raw.said} (${KEPT.raw.short}): It is on the Mac Studio. Carry on there.`]], guide.text);
      assert.equal(underLine(await on(w.macbook, "episodes"), KEPT.raw.line), ON_LINE);
    } finally {
      w.done();
    }
  });
  it("keeps the Mac Studio's step first for a handed-off session whose record has a conflicted copy: no page step, show and done refused, episodes agrees", async () => {
    const w = world();
    try {
      const found = KEPT.session.make(w);
      const record = handedOffAs(found, { name: "Session, 2026-10-20", kind: "session", over: { session: { ...found.record.session, teachings: "asked" } } });
      conflictedRecord(found, { inForce: { session: record.session, finished: record.finished }, copy: { session: record.session, finished: record.finished, title: { text: "Another", approved: false } } });
      const step = `${KEPT.session.said} (${KEPT.session.short}): It is on the Mac Studio. Carry on there.`;
      const guide = await on(w.macbook, "guide", KEPT.session.said);
      assert.deepEqual([guide.code, guide.said], [0, [step]], guide.text);
      assert.doesNotMatch(guide.text, /BRIMM Ops page|Take the/, guide.text);
      for (const argv of [["guide", KEPT.session.said, "show"], ["guide", KEPT.session.said, "done", "taken"]]) {
        const r = await on(w.macbook, ...argv);
        assert.equal(r.code, 1, argv.join(" ") + r.text);
        assert.match(r.text, /nothing to show|not noted|Nothing/i, argv.join(" ") + r.text);
        assert.deepEqual(w.opened, [], argv.join(" "));
      }
      assert.equal(underLine(await on(w.macbook, "episodes"), KEPT.session.line), ON_LINE);
    } finally {
      w.done();
    }
  });
  it("says only where a session handed off with its teachings is, as the guide gives the BRIMM Ops page's step", async () => {
    const w = world();
    try {
      const found = KEPT.session.make(w);
      handedOffAs(found, { name: "Session, 2026-10-20", kind: "session", over: { session: { ...found.record.session, teachings: "asked" } } });
      const r = await on(w.macbook, "episodes");
      assert.equal(underLine(r, KEPT.session.line), "    It is on the Mac Studio.", r.text);
    } finally {
      w.done();
    }
  });
  it("still says Carry on there for a session whose empty revision is the one handed off", async () => {
    const w = world();
    try {
      const found = KEPT.session.make(w);
      handedOffAs(found, { name: "Session, 2026-10-20", kind: "session", over: { session: { ...found.record.session, teachings: "asked", emptyRevision: 1 } } });
      const r = await on(w.macbook, "episodes");
      assert.equal(underLine(r, KEPT.session.line), ON_LINE, r.text);
    } finally {
      w.done();
    }
  });
});

/** Record 2 of the episode `found` and the conflicted copy Dropbox kept of it from the Mac `by`, as when two Macs wrote that record at once: each
    side is the first record with `inForce` or `copy` laid over it, at the layout it then holds, and with no `local` where that says null. */
function conflictedRecord(found, { inForce = {}, copy = {}, by = STUDIO }) {
  const side = (over) => {
    const { local, ...rest } = { ...found.record, rev: 2, ...over };
    const record = local === null ? rest : { ...rest, local };
    return recordText({ ...record, version: layoutOf(record) });
  };
  writeFileSync(recordFile(found.folder, 2), side(inForce));
  writeFileSync(join(found.folder, `record/0002 (${by}'s conflicted copy 2026-10-20).json`), side(copy));
}

/** The lines `episodes` says of the episodes it lists (between its heading and the disk's). */
const listedLines = (r) => r.said.slice(r.said.indexOf("Episodes, newest first:") + 1, r.said.indexOf("On this Mac:"));

describe("an episode kept on the Mac Studio with a conflicted copy, or a script changed by hand, on another Mac (Jason's MacBook)", () => {
  // Each is sorted out on the Mac Studio, where every command that would do it runs: here every command is refused in the one line, the guide says it
  // is on the Mac Studio, and `episodes` says so under its line and nothing of its conflict or its files, which the Mac Studio says.
  const CASES = [
    { what: "a raw video whose record and its conflicted copy are both kept there", episode: "raw", make: (found) => conflictedRecord(found, {}) },
    { what: "a raw video whose conflicted copy alone is kept there", episode: "raw", make: (found) => conflictedRecord(found, { inForce: { local: null } }) },
    { what: "a raw video whose record in force alone is kept there", episode: "raw", make: (found) => conflictedRecord(found, { copy: { local: null } }) },
    // A copy is read as it is, never through episode.js faultFor, so a damaged or hand-edited one may hold a `local` that names no Mac: it says
    // the episode is kept on no Mac, this one included, and lets nothing through here (edit.js keptOn; review R1-F6).
    { what: "a raw video whose conflicted copy's `local` names no Mac", episode: "raw", make: (found) => conflictedRecord(found, { copy: { local: {} } }) },
    { what: "a raw video whose conflicted copy's `local` names an empty Mac", episode: "raw", make: (found) => conflictedRecord(found, { copy: { local: { on: "" } } }) },
    { what: "a video waiting for her answer whose record and its conflicted copy are both kept there", episode: "waiting", make: (found) => conflictedRecord(found, {}) },
    { what: "a plan whose script in Dropbox has a conflicted copy", episode: "plan", make: (found) => writeFileSync(join(found.folder, "teleprompter (Mac Studio's conflicted copy 2026-10-20).txt"), "Too many SKUs sink a shop.\n") },
    { what: "a plan whose script in Dropbox was changed by hand", episode: "plan", make: (found) => writeFileSync(join(found.folder, "teleprompter.txt"), "Too many SKUs will sink a small shop, and fast.\n") }
  ];
  for (const c of CASES) {
    it(`says that ${c.what} is on the Mac Studio, in the one line of every command, the guide's step and \`episodes\`, and nothing of its conflict or its files`, async () => {
      const w = world();
      try {
        const episode = KEPT[c.episode];
        const found = episode.make(w);
        c.make(found);
        await walkOn(w, found, ON_OTHER_MAC(episode.said, STUDIO), c.what);
        const guide = await on(w.macbook, "guide", episode.said);
        assert.deepEqual([guide.code, guide.said], [0, [`${episode.said} (${episode.short}): It is on the Mac Studio. Carry on there.`]], c.what);
        const listed = await on(w.macbook, "episodes");
        assert.equal(listed.code, 0, listed.text);
        assert.deepEqual(listedLines(listed), [episode.line, "    It is on the Mac Studio. Carry on there."], `${c.what}\n${listed.text}`);
      } finally {
        w.done();
      }
    });
  }
  it("leaves out a plan she dropped there whose record has a conflicted copy, as the guide does, while the Mac Studio lists its conflict", async () => {
    // Review R1-F5. A dropped plan is archived: the guide passes it over on either Mac by its record in force, and `episodes` leaves an archived
    // episode out. The Mac Studio still lists its folder and conflict, to be sorted out there; here nothing of it is said.
    const w = world();
    try {
      const found = KEPT.plan.make(w);
      conflictedRecord(found, { inForce: { archived: { at: "2026-10-20T10:00:00-05:00" } }, copy: { archived: { at: "2026-10-20T10:00:01-05:00" } } });
      const listed = await on(w.macbook, "episodes");
      assert.equal(listed.code, 0, listed.text);
      assert.ok(listed.said.includes("No episodes yet."), listed.text);
      assert.doesNotMatch(listed.text, /Too many SKUs|cccccc|It is on/, listed.text);
      const guide = await on(w.macbook, "guide");
      assert.equal(guide.code, 0, guide.text);
      assert.doesNotMatch(guide.text, /Too many SKUs|cccccc/, guide.text);
      const there = await on(w.studio, "episodes");
      assert.deepEqual(listedLines(there), ["  2026-10-20 Too many SKUs (Mac Studio)", `    Dropbox has kept a conflicted copy in this episode: record/0002 (Mac Studio's conflicted copy 2026-10-20).json. Two Macs changed the same file before Dropbox could bring one change across, and which to keep is for a person to say. Nothing is changed until one is kept. Say "sort out the conflict".`], there.text);
    } finally {
      w.done();
    }
  });
});

describe("a plan whose record and its conflicted copy say it is kept on two Macs", () => {
  // The first footage answered for the plan on each Mac at once, each marking it kept on itself (L4): record 2 says the Mac Studio, and the copy
  // Dropbox kept of it says Jason's MacBook. Either Mac sorts the conflict out (`resolve`), as on any episode with a conflicted copy, and every
  // other command is refused there by the conflict itself; a Mac neither names refuses every command in the one line.
  const split = (w) => {
    const found = KEPT.plan.make(w);
    conflictedRecord(found, { copy: { local: { on: MACBOOK }, writer: { ...WRITER, on: MACBOOK } }, by: MACBOOK });
    return found;
  };
  /** Every file of Dropbox (the root), whole, by its path. */
  const inDropbox = (w) => Object.fromEntries(listAll(w.root).map((rel) => [rel, readFileSync(join(w.root, rel), "utf8")]));
  /** What a command says of the plan on a Mac one of its records names, when the gate lets it through for a plan: the conflict's words. */
  const CONFLICT = `2026-10-20 Too many SKUs (Mac Studio): Dropbox has kept a conflicted copy in this episode: record/0002 (Jason's MacBook's conflicted copy 2026-10-20).json. Two Macs changed the same file before Dropbox could bring one change across, and which to keep is for a person to say. Nothing is changed until one is kept. Say "sort out the conflict".`;
  /** The commands but `resolve` that the gate lets through for a plan (gate.test.js): each is refused by the conflict itself. */
  const THROUGH = ["plan", "name", "app", "join"];
  for (const [mac, deps] of [["the Mac Studio", (w) => w.studio], ["Jason's MacBook", (w) => w.macbook]]) {
    it(`has ${mac}, which one of them names, sort the conflict out, refuse the commands a plan lets through by the conflict and every other command, never as on another Mac, and say so in the guide and \`episodes\``, async () => {
      const w = world();
      try {
        const found = split(w);
        const before = inDropbox(w);
        const resolved = await on(deps(w), "resolve", "Too many SKUs");
        assert.equal(resolved.code, 0, resolved.text);
        assert.match(resolved.text, /^Dropbox kept two versions of record\/0002\.json in Too many SKUs:/, resolved.text);
        assert.match(resolved.text, /Say which to keep: A or B\.$/, resolved.text);
        // The commands a plan lets through are refused by the conflict, in its words; every other by what the gate says of a plan; none as on
        // another Mac.
        for (const argv of [...SCOPED.filter((name) => name !== "resolve").map((name) => [name, ...askedOf(found.name)[name]]), ...DETACHED(found.name)]) {
          const r = await on(deps(w), ...argv);
          if (THROUGH.includes(argv[0])) assert.deepEqual([r.code, r.said], [1, [CONFLICT]], argv.join(" "));
          else assert.equal(r.code, 1, `${argv.join(" ")}: ${r.text}`);
          assert.doesNotMatch(r.text, / is on (the Mac Studio|Jason's MacBook)/, argv.join(" "));
          assert.deepEqual([w.started, w.calls, w.opened], [[], [], []], argv.join(" "));
        }
        assert.deepEqual(inDropbox(w), before, "nothing was written in Dropbox");
        // Found by its title too, as any episode with a conflicted copy is on its own Mac: named by its folder, with the conflict's words.
        const named = await on(deps(w), "plan", "Too many SKUs");
        assert.deepEqual([named.code, named.said], [1, [CONFLICT]]);
        const guide = await on(deps(w), "guide", "Too many SKUs");
        assert.deepEqual([guide.code, guide.said], [0, ['Too many SKUs (cccccc): Dropbox kept two copies of a change to it. Say "sort out the conflict".']]);
        const listed = await on(deps(w), "episodes");
        assert.deepEqual(listedLines(listed), ["  2026-10-20 Too many SKUs (Mac Studio)", `    ${CONFLICT.slice(CONFLICT.indexOf("Dropbox has kept"))}`], listed.text);
      } finally {
        w.done();
      }
    });
  }
  // A plan before its join keeps no file on a Mac (its three files are in Dropbox), so either side may be kept on either Mac: the side kept says
  // which Mac carries on with it, and the other Mac then refuses it in the one line.
  for (const [mac, deps, side, keeper, other] of [
    ["Jason's MacBook", (w) => w.macbook, "A", STUDIO, MACBOOK],
    ["Jason's MacBook", (w) => w.macbook, "B", MACBOOK, STUDIO],
    ["the Mac Studio", (w) => w.studio, "A", STUDIO, MACBOOK],
    ["the Mac Studio", (w) => w.studio, "B", MACBOOK, STUDIO]
  ]) {
    it(`is kept on one Mac again once she keeps a side on ${mac}: keeping ${side}, the side that says ${keeper}, leaves it to ${keeper}`, async () => {
      const w = world();
      try {
        const found = split(w);
        assert.equal((await on(deps(w), "resolve", "Too many SKUs")).code, 0);
        const kept = await on(deps(w), "resolve", "Too many SKUs", "--keep", side);
        assert.equal(kept.code, 0, kept.text);
        assert.equal(readEpisode(found.folder).record.local.on, keeper);
        const macOf = { [STUDIO]: w.studio, [MACBOOK]: w.macbook };
        const there = await on(macOf[other], "plan", "Too many SKUs");
        assert.deepEqual([there.code, there.said], [1, [ON_OTHER_MAC("Too many SKUs", keeper)]]);
        const here = await on(macOf[keeper], "plan", "Too many SKUs");
        assert.equal(here.code, 0, here.text);
      } finally {
        w.done();
      }
    });
  }
  it("has a Mac neither names (Sallie's laptop) refuse every command in the one line, naming the Mac its record in force keeps it on, and write nothing", async () => {
    const w = world();
    try {
      const found = split(w);
      const home = join(w.dir, "home-laptop");
      const laptop = { ...w.macbook, home, settings: { ...w.macbook.settings, machine: "Sallie's laptop" } };
      await walkOn(w, found, ON_OTHER_MAC("Too many SKUs", STUDIO), "a plan kept on two Macs, on Sallie's laptop", { deps: laptop, home });
      for (const argv of [["resolve", "Too many SKUs"], ["plan", "Too many SKUs"], ["open", "cccccc"]]) {
        const r = await on(laptop, ...argv);
        assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC("Too many SKUs", STUDIO)]], argv.join(" "));
      }
      const guide = await on(laptop, "guide", "Too many SKUs");
      assert.deepEqual(guide.said, ["Too many SKUs (cccccc): It is on the Mac Studio. Carry on there."]);
    } finally {
      w.done();
    }
  });
});

describe("an episode kept on the Mac Studio, on the Mac Studio", () => {
  it("is listed by `episodes` with no line of where it is, its files looked for in its video/ folder there, and the card of the video waiting for her answer", async () => {
    const w = world();
    try {
      for (const episode of Object.values(KEPT)) episode.make(w);
      const r = await on(w.studio, "episodes");
      assert.equal(r.code, 0, r.text);
      assert.doesNotMatch(r.text, /It is on|missing|not all here|not the one Studio saved/, r.text);
      assert.ok(r.said.includes("  Pricing talk: an episode of 0:42, in 2026-10-20 IMG_0042 (Mac Studio), id 3fa9c1"), r.text);
      assert.ok(r.said.some((line) => line.startsWith("    Card: ")), r.text);
    } finally {
      w.done();
    }
  });
  it("says a file of it that is not whole in its video/ folder there, whatever its folder in Dropbox holds", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      const words = join(found.video, "IMG_0042.words.json");
      // A whole copy of the words in its folder in Dropbox is not the file: the record keeps that on the Mac Studio.
      writeFileSync(join(found.folder, "IMG_0042.words.json"), readFileSync(words));
      writeFileSync(words, "");
      const r = await on(w.studio, "episodes");
      const told = r.said.filter((line) => line.startsWith("    A file of this video"));
      assert.equal(told.length, 1, r.text);
      assert.match(told[0], /: IMG_0042\.words\.json\./);
    } finally {
      w.done();
    }
  });
  it("has the guide say its steps there as for any episode: the video waiting for her answer is waiting for it", async () => {
    const w = world();
    try {
      KEPT.waiting.make(w);
      const r = await on(w.studio, "guide", KEPT.waiting.said);
      assert.deepEqual([r.code, r.said], [0, [`${KEPT.waiting.said} (aaaaaa): It is waiting for your answer. Say "what's waiting?" to see its card.`]]);
    } finally {
      w.done();
    }
  });
  it("shows a plan kept there as a plan: `plan \"<title>\"` says it as it says the same plan at layout 5", async () => {
    const w = world();
    try {
      const found = KEPT.plan.make(w);
      assert.equal(found.record.version, 6);
      const r = await on(w.studio, "plan", "Too many SKUs");
      assert.equal(r.code, 0, r.text);
      const { local, ...dropbox } = found.record;
      writeFileSync(recordFile(found.folder, 2), recordText({ ...dropbox, rev: 2, version: 5 }));
      const same = await on(w.studio, "plan", "Too many SKUs");
      assert.deepEqual(r.said, same.said);
      assert.ok(r.said.length > 0 && !r.text.includes("waiting for its answer"), r.text);
    } finally {
      w.done();
    }
  });
});

describe("L2c: every reader of an episode kept on the Mac Studio finds its files in video/, on the Mac Studio", () => {
  const NAME = "2026-10-20 IMG_0042 (Mac Studio)";
  /** The raw video of KEPT.raw with more of its own files in video/ (a transcript she reads, Reel suggestions, notes). */
  const withFiles = (w, extra) => {
    const found = KEPT.raw.make(w);
    for (const [rel, text] of Object.entries(extra)) writeFileSync(join(found.video, rel), text);
    return found;
  };
  const REELS = JSON.stringify({ format: "brimm-video reels", version: 2, video: "IMG_0042.mov", by: "import", made: "2026-10-20T08:00:00-05:00", highest: 1, candidates: [{ n: 1, start: 1, end: 9, ranges: [[1, 9]], first: "words", words: "words", why: "A point.", point: "A point.", title: "A", crops: [] }] });
  const NOT_THE_DROPBOX_WAY = /Make available offline|is missing|not whole|not all here|not the one Studio saved|not in the episode's folder|no transcript yet|no list of Reel/i;

  it("`open` claims it and says its notes, with no Make available offline line", async () => {
    const w = world();
    try {
      withFiles(w, { "IMG_0042.edit-notes.txt": "Cut the intro.\nKeep the price talk.\n" });
      const r = await on(w.studio, "open", NAME);
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /Claude's notes, the first lines:\n {2}Cut the intro\./);
      assert.doesNotMatch(r.text, NOT_THE_DROPBOX_WAY, r.text);
      assert.equal(readEpisode(join(w.root, "Episodes", NAME)).record.editing.by, STUDIO);
    } finally {
      w.done();
    }
  });
  it("`app` goes past its files: nothing is called missing, or brought from Dropbox", async () => {
    const w = world();
    try {
      KEPT.raw.make(w);
      mkdirSync(dirname(cliPath(w.home)), { recursive: true });
      writeFileSync(cliPath(w.home), "");
      const r = await on({ ...w.studio, settings: { ...w.studio.settings, app: "hyperframes" } }, "app", NAME);
      assert.match(r.text, /The video for HyperFrames is being made\./, r.text);
      assert.doesNotMatch(r.text, NOT_THE_DROPBOX_WAY, r.text);
      assert.doesNotMatch(r.text, /command line isn't on this Mac/, r.text);
    } finally {
      w.done();
    }
  });
  it("`show … transcript` prints the rough cut's transcript from video/", async () => {
    const w = world();
    try {
      withFiles(w, { "IMG_0042.rough-cut.transcript.txt": "[0:00] the rough cut\n" });
      const r = await on(w.studio, "show", NAME, "transcript");
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /the rough cut/);
    } finally {
      w.done();
    }
  });
  it("`which` opens the recording from video/", async () => {
    const w = world();
    try {
      KEPT.raw.make(w);
      const r = await on(w.studio, "which", NAME);
      assert.equal(r.code, 0, r.text);
      assert.match(JSON.stringify(w.opened), /BRIMM Video Work/);
    } finally {
      w.done();
    }
  });
  it("`reels` lists the suggestions of the reels.json in video/", async () => {
    const w = world();
    try {
      const found = withFiles(w, { "reels.json": REELS });
      writeFileSync(recordFile(found.folder, 2), recordText({ ...found.record, rev: 2, files: { ...found.record.files, "reels.json": Buffer.byteLength(REELS) } }));
      const r = await on(w.studio, "reels", NAME, "--no-play");
      assert.doesNotMatch(r.text, NOT_THE_DROPBOX_WAY, r.text);
    } finally {
      w.done();
    }
  });
  it("`free` and `graphic … ideas` find the words and the cut plan in video/", async () => {
    const w = world();
    try {
      withFiles(w, {});
      const free = await on(w.studio, "free", NAME);
      assert.doesNotMatch(free.text, NOT_THE_DROPBOX_WAY, free.text);
      const ideas = await on(w.studio, "graphic", NAME, "ideas");
      assert.doesNotMatch(ideas.text, /not in the episode's folder|not on this Mac|Dropbox/, ideas.text);
    } finally {
      w.done();
    }
  });
  it("says a kept file that is not whole in video/ in this Mac's words, by its role, on `open` and on `finish`", async () => {
    const w = world();
    try {
      // A raw video with a main project in use in HyperFrames, which `finish` looks into.
      const found = kept(w, { id: "e-20261020-ffffff", name: "2026-10-20 IMG_0060 (Mac Studio)", stem: "IMG_0060", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Pricing talk", placeholder: false }, label: "Video of 20 Oct, 14:00 (Mac Studio)", app: { toolchain: "0.8.208", projects: [entry("main")] } } });
      const hf = { ...w.studio, settings: { ...w.studio.settings, app: "hyperframes" } };
      writeFileSync(join(found.video, "IMG_0060.words.json"), "");
      for (const argv of [["open", found.name], ["finish", found.name]]) {
        const r = await on(hf, ...argv);
        assert.equal(r.code, 1, r.text);
        assert.match(r.text, /Pricing talk's words is not whole on this Mac\. Ask Jason\./, argv[0]);
        assert.doesNotMatch(r.text, /IMG_0042|Dropbox/, `${argv[0]}\n${r.text}`);
      }
    } finally {
      w.done();
    }
  });
});

describe("L2c: numbers, hand-offs and set-asides of an episode kept on the Mac Studio follow the file", () => {
  const TEACHINGS = (n) => JSON.stringify({ format: TEACHINGS_FORMAT, version: 1, made: "2026-10-20T08:00:00-05:00", principles: [{ n }], recurringPrinciples: [], reelIdeas: [], dropped: [], skipped: "", problems: [] });

  it("numbers a local session's next items after the teachings in video/ and in video/history/", () => {
    const w = world();
    try {
      const found = KEPT.session.make(w);
      writeFileSync(join(found.video, "Session, 2026-10-20.principles.json"), TEACHINGS(5));
      mkdirSync(join(found.video, "history"), { recursive: true });
      writeFileSync(join(found.video, "history", "2026-10-20T08-00-00 Session, 2026-10-20.principles.json"), TEACHINGS(9));
      assert.equal(highestNumberOf(w.root, found.record, found.folder, w.home), 9);
      // Without this Mac's home, Dropbox's folder is looked in, as for any episode from before the switch: it holds none.
      assert.equal(highestNumberOf(w.root, found.record, found.folder), 0);
    } finally {
      w.done();
    }
  });
  it("counts a hand-off set aside into Dropbox's history/ for the next revision, and reads no history/ of video/ as a hand-off", () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      mkdirSync(join(found.folder, "history"), { recursive: true });
      const aside = (revision) => JSON.stringify({ format: "brimm-video hand-off", version: 2, revision, video: { id: found.record.id, kind: "raw", name: "Pricing talk" } });
      writeFileSync(join(found.folder, "history", "2026-10-20T13-00-00 Pricing talk.brimm-ops.json"), aside(3));
      assert.equal(lastRevision(join(found.folder, "final"), found.record.id), 3);
      // A hand-off in video/history/ is nothing Studio wrote: it is never listed, and no check reads it.
      mkdirSync(join(found.video, "history"), { recursive: true });
      writeFileSync(join(found.video, "history", "2026-10-20T13-00-00 Pricing talk.brimm-ops.json"), aside(7));
      assert.equal(lastRevision(join(found.folder, "final"), found.record.id), 3);
    } finally {
      w.done();
    }
  });
  it("finds a local raw video's rules' plan in video/history/ for the correction `kind … --again`, and sets the files aside in video/history/, unlisted", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      const plan = JSON.parse(readFileSync(join(found.video, "IMG_0042.cut-plan.json"), "utf8"));
      const rules = JSON.stringify({ ...plan, phrases: [{ text: "hello", start: 0, end: 1, keep: true }], ranges: [] });
      const claudes = JSON.stringify({ ...plan, phrases: [{ text: "hello", start: 0, end: 1, keep: true }], ranges: [], claude: { model: "m" } });
      mkdirSync(join(found.video, "history"), { recursive: true });
      writeFileSync(join(found.video, "history", "2026-10-20T08-05-00 IMG_0042.cut-plan.json"), rules);
      writeFileSync(join(found.video, "IMG_0042.cut-plan.json"), claudes);
      writeFileSync(join(found.video, "IMG_0042.edit-notes.txt"), "Notes.\n");
      const size = (rel) => Buffer.byteLength(readFileSync(join(found.video, rel), "utf8"));
      writeFileSync(recordFile(found.folder, 2), recordText({ ...found.record, rev: 2, files: { ...found.record.files, "IMG_0042.cut-plan.json": size("IMG_0042.cut-plan.json"), "IMG_0042.edit-notes.txt": size("IMG_0042.edit-notes.txt") } }));
      const r = await on(w.studio, "kind", found.name, "raw", "--private", "no", "--again");
      assert.equal(r.code, 0, r.text);
      // The rules' plan is back in its place, the notes are set aside in video/history/, and nothing of video/ is listed in history/.
      assert.equal(readFileSync(join(found.video, "IMG_0042.cut-plan.json"), "utf8"), rules);
      assert.ok(!existsSync(join(found.video, "IMG_0042.edit-notes.txt")), "the notes left video/");
      assert.ok(readdirSync(join(found.video, "history")).some((name) => name.endsWith(" IMG_0042.edit-notes.txt")), "the notes are in video/history/");
      assert.ok(!existsSync(join(found.folder, "history")), "nothing was set aside in Dropbox");
      assert.ok(!Object.keys(readEpisode(found.folder).record.files).some((rel) => rel.startsWith("history/")), "no set-aside of video/ is listed");
    } finally {
      w.done();
    }
  });
});

describe("L2c: a version never spans two Macs", () => {
  /** A video of the MacBook's own, in Dropbox, waiting for her answer: it came by camera, so the answer is a plain one. */
  function waitingOnMacbook(w) {
    const made = kept(w, { id: "e-20261021-777777", name: "2026-10-21 IMG_0070 (Jason's MacBook)", stem: "IMG_0070", record: { answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:42", came: "camera", match: "e-20261020-3fa9c1" }, label: "Video of 21 Oct, 09:00 (Jason's MacBook)" } });
    // Its files are in Dropbox, as a video filed on a Mac with a drop folder there has them: no `local`.
    const { local, ...plain } = made.record;
    for (const rel of Object.keys(OWN("IMG_0070"))) writeFileSync(join(made.folder, rel), readFileSync(join(made.video, rel)));
    writeFileSync(recordFile(made.folder, 2), recordText({ ...plain, rev: 2, version: 5 }));
    return { name: made.name, folder: made.folder };
  }

  it("refuses `kind … --version-of` a video kept on another Mac, in the gate's own line, and writes nothing", async () => {
    const w = world();
    try {
      KEPT.raw.make(w);
      const waiting = waitingOnMacbook(w);
      const before = shared(w);
      const r = await on(w.macbook, "kind", waiting.name, "raw", "--private", "no", "--version-of", "3fa9c1");
      assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC("Pricing talk", STUDIO)]]);
      assert.deepEqual(shared(w), before);
    } finally {
      w.done();
    }
  });
  it("does not offer a video kept on another Mac as the Maybe line of a card", async () => {
    const w = world();
    try {
      KEPT.raw.make(w);
      waitingOnMacbook(w);
      const r = await on(w.macbook, "episodes");
      assert.doesNotMatch(r.text, /Maybe a new version of/, r.text);
      // On the Mac Studio the same video is on this Mac, and is offered.
      const there = await on(w.studio, "episodes");
      assert.match(there.text, /Maybe a new version of: Pricing talk/, there.text);
    } finally {
      w.done();
    }
  });
});

describe("L2c: `resolve … --keep` on the Mac that keeps the episode", () => {
  it("sorts out a conflicted record and checks the files against video/ there, not in Dropbox", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      conflictedRecord(found, { inForce: {}, copy: { name: { text: "Pricing", placeholder: false } } });
      const shownR = await on(w.studio, "resolve", found.name); assert.equal(shownR.code, 0, shownR.text);
      const r = await on(w.studio, "resolve", found.name, "--keep", "A");
      assert.equal(r.code, 0, r.text);
      assert.doesNotMatch(r.text, /not as the record now lists|is missing/, r.text);
      assert.match(r.text, /^Kept A/);
    } finally {
      w.done();
    }
  });
  it("says a kept file short in video/ after the keep in this Mac's words", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      conflictedRecord(found, { inForce: {}, copy: { name: { text: "Pricing", placeholder: false } } });
      writeFileSync(join(found.video, "IMG_0042.words.json"), "");
      const shownR = await on(w.studio, "resolve", found.name); assert.equal(shownR.code, 0, shownR.text);
      const r = await on(w.studio, "resolve", found.name, "--keep", "A");
      assert.match(r.text, /Pricing talk's words is not whole on this Mac\. Ask Jason\./, r.text);
      assert.doesNotMatch(r.text, /IMG_0042|\.\.|Once Dropbox has finished/, r.text);
    } finally {
      w.done();
    }
  });
});

describe("L2c round two: the conversions pinned, and a set of versions that never spans two Macs", () => {
  const NAME = "2026-10-20 IMG_0042 (Mac Studio)";
  /** A kept episode's record as it is in Dropbox for a Mac that keeps its files there: no `local`, its files in its folder. */
  const intoDropbox = (made, stem) => {
    const { local, ...plain } = made.record;
    for (const rel of Object.keys(OWN(stem))) writeFileSync(join(made.folder, rel), readFileSync(join(made.video, rel)));
    writeFileSync(recordFile(made.folder, 2), recordText({ ...plain, rev: 2, version: 5 }));
    return made;
  };

  it("`free` takes away the working copy of a recording that is in video/", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      const raw = statSync(join(found.video, "IMG_0042.mov"));
      const paths = workCopyPaths(w.home, found.name, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
      mkdirSync(paths.dir, { recursive: true });
      writeFileSync(paths.video, "the copy");
      writeFileSync(paths.facts, "{}");
      const r = await on(w.studio, "free", found.name);
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /Took away the video made for HyperFrames for Pricing talk/);
      assert.ok(!existsSync(paths.video), "the copy is gone");
    } finally {
      w.done();
    }
  });
  it("`app … reel` finds the Reel in the reels.json in video/", async () => {
    const w = world();
    try {
      const reels = JSON.stringify(reelsFile({ video: "IMG_0042.mov", by: "read", made: "2026-10-20T08:00:00-05:00", candidates: [{ n: 1, start: 1, end: 9, ranges: [{ start: 1, end: 9 }], seconds: 8, fits: { fits: false, why: "It is short." }, title: "", reason: "It makes one point.", point: "", words: "", phrases: [], preview: null }] }));
      const found = KEPT.raw.make(w);
      writeFileSync(join(found.video, "reels.json"), reels);
      writeFileSync(recordFile(found.folder, 2), recordText({ ...found.record, rev: 2, files: { ...found.record.files, "reels.json": Buffer.byteLength(reels) }, reels: [{ n: 1, status: "candidate", title: "A", from: 1, to: 9, why: "A point." }] }));
      mkdirSync(dirname(cliPath(w.home)), { recursive: true });
      writeFileSync(cliPath(w.home), "");
      const r = await on({ ...w.studio, settings: { ...w.studio.settings, app: "hyperframes" } }, "app", NAME, "reel", "1");
      assert.doesNotMatch(r.text, /no list|cannot be read|not whole|is missing|isn't a Reel|no Reel 1/i, r.text);
    } finally {
      w.done();
    }
  });
  it("suggestionsFor reads the list and the words from video/", () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      const reels = JSON.stringify(reelsFile({ video: "IMG_0042.mov", by: "read", made: "2026-10-20T08:00:00-05:00", candidates: [{ n: 1, start: 1, end: 9, ranges: [{ start: 1, end: 9 }], seconds: 8, fits: { fits: false, why: "It is short." }, title: "", reason: "It makes one point.", point: "", words: "", phrases: [], preview: null }] }));
      writeFileSync(join(found.video, "reels.json"), reels);
      const main = { words: [], seconds: 42, timed: true };
      const ctx = { home: w.home };
      assert.deepEqual(suggestionsFor({ folder: found.folder, record: found.record, main }), { list: [], left: [] }, "in Dropbox's folder there is no list");
      const read = suggestionsFor({ folder: found.folder, record: found.record, ctx, main });
      assert.notDeepEqual(read, { list: [], left: [] }, "with this Mac's home the list in video/ is read");
    } finally {
      w.done();
    }
  });
  it("asFiled and askBlocked look in video/ for a kept episode", () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      assert.equal(asFiled(found.folder, found.record), false, "none of its files is in its folder in Dropbox");
      assert.equal(asFiled(found.folder, found.record, { home: w.home }), true);
      const blocked = askBlocked({ folder: found.folder, record: found.record, root: w.root, home: w.home, machine: STUDIO, now: Date.now() });
      assert.doesNotMatch(String(blocked.why), /no cut plan here|not whole|is missing/, String(blocked.why));
    } finally {
      w.done();
    }
  });
  it("versionIn compares the words of a kept episode, read from its video/, with a new video's", () => {
    const w = world();
    try {
      const said = Array.from({ length: 300 }, (_, i) => `w${(i * 7919) % 6000}`);
      const timed = said.map((word, i) => ({ w: word, start: i * 0.4, end: i * 0.4 + 0.3 }));
      const found = kept(w, { id: "e-20261020-999999", name: "2026-10-20 IMG_0080 (Mac Studio)", stem: "IMG_0080", own: { ...OWN("IMG_0080"), "IMG_0080.words.json": JSON.stringify({ words: timed }) }, record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Talk", placeholder: false }, label: "Video of 20 Oct, 15:00 (Mac Studio)", fingerprint: fingerprintOf(timed) } });
      const mine = { seconds: 42, fingerprint: fingerprintOf(timed), words: timed };
      assert.deepEqual(versionIn(w.root, mine, { home: w.home }), { id: found.record.id, folder: found.folder });
      assert.equal(versionIn(w.root, mine, {}), null, "without this Mac's home its words are looked for in Dropbox, where there are none");
    } finally {
      w.done();
    }
  });
  it("shows the video to post of a kept video from its video/ folder (`guide … show`)", async () => {
    const w = world();
    try {
      const found = kept(w, { id: "e-20261020-a1a1a1", name: "2026-10-20 Launch talk (Mac Studio)", stem: "Launch talk", own: { "Launch talk.mov": "the video she dropped" }, record: { kind: "finished", answer: ANSWERED, reading: READ("finished"), offers: OFFERS, name: { text: "Launch talk", placeholder: false }, label: "Video of 20 Oct, 16:00 (Mac Studio)", finished: { revision: 1, at: "2026-10-20T13:00:00-05:00", on: STUDIO, handoff: "final/Launch talk.brimm-ops.json", parts: {} } } });
      mkdirSync(join(found.folder, "final"), { recursive: true });
      writeFileSync(join(found.folder, "final", "Launch talk.brimm-ops.json"), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: found.record.id, kind: "finished", name: "Launch talk" }, main: { file: "Launch talk.mov" } }));
      writeGuideNotes(w.home, { version: 1, handoffs: { [found.record.id]: { kind: "episode", step: "kit", revision: 1, at: "2026-10-20T14:00:00-05:00" } }, finished: {} });
      const r = await on(w.studio, "guide", "Launch talk", "show");
      assert.deepEqual([r.code, r.said], [0, ["Shown in Finder: the video of Launch talk (a1a1a1), to post."]]);
      assert.ok(JSON.stringify(w.calls).includes(join(found.video, "Launch talk.mov")), JSON.stringify(w.calls));
    } finally {
      w.done();
    }
  });
  it("sets a hand-off aside from final/ into Dropbox's history/, listed, when the kind is corrected, and it counts for the next revision", async () => {
    const w = world();
    try {
      const found = KEPT.raw.make(w);
      handedOff(found);
      const r = await on(w.studio, "kind", found.name, "raw", "--private", "no", "--again");
      assert.equal(r.code, 0, r.text);
      const aside = readdirSync(join(found.folder, "history")).filter((name) => name.endsWith(" Pricing talk.brimm-ops.json"));
      assert.equal(aside.length, 1, "the hand-off is in Dropbox's history/");
      assert.ok(`history/${aside[0]}` in readEpisode(found.folder).record.files, "and the record lists it");
      assert.ok(!existsSync(join(found.folder, "final", "Pricing talk.brimm-ops.json")), "final/ no longer holds it");
      assert.ok(!existsSync(join(found.video, "history", aside[0])), "none is set aside in video/history/");
      assert.equal(lastRevision(join(found.folder, "final"), found.record.id), 1);
    } finally {
      w.done();
    }
  });

  /** Y, a version of X kept on the Mac Studio, and X in Dropbox with no `local`, as Jason's MacBook reads them; and a video of the MacBook's own
      waiting for her answer, that found X's words. */
  function setOfVersions(w) {
    const x = intoDropbox(kept(w, { id: "e-20261020-aaaaaa", name: "2026-10-20 IMG_0090 (Mac Studio)", stem: "IMG_0090", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "First cut", placeholder: false }, label: "Video of 20 Oct, 08:00 (Mac Studio)" } }), "IMG_0090");
    kept(w, { id: "e-20261020-bbbbbb", name: "2026-10-20 IMG_0091 (Mac Studio)", stem: "IMG_0091", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Second cut", placeholder: false }, label: "Video of 20 Oct, 09:00 (Mac Studio)", versionOf: x.record.id } });
    const waiting = kept(w, { id: "e-20261021-777777", name: "2026-10-21 IMG_0070 (Jason's MacBook)", stem: "IMG_0070", record: { answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:42", came: "camera", match: x.record.id }, label: "Video of 21 Oct, 09:00 (Jason's MacBook)" } });
    intoDropbox(waiting, "IMG_0070");
    return { x, waiting };
  }
  it("refuses `kind … --version-of` a video one of whose versions is kept on another Mac, and does not offer it as a Maybe", async () => {
    const w = world();
    try {
      const { x, waiting } = setOfVersions(w);
      const before = shared(w);
      const r = await on(w.macbook, "kind", waiting.name, "raw", "--private", "no", "--version-of", x.record.id);
      assert.deepEqual([r.code, r.said], [1, [ON_OTHER_MAC("First cut", STUDIO)]]);
      assert.deepEqual(shared(w), before);
      const listed = await on(w.macbook, "episodes");
      assert.doesNotMatch(listed.text, /Maybe a new version of/, listed.text);
    } finally {
      w.done();
    }
  });
});
