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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { COMMAND_NAMES, editMain } from "../edit.js";
import { UNSCOPED } from "../gate.js";
import { layoutOf, newEpisode, newPlannedEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { ON_OTHER_MAC } from "../where.js";
import { episodeFilesFolder } from "../settings.js";
import { setup, listAll } from "./episodes.js";

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

/** Run a command of edit.js on a Mac, by its deps: { code, said, text }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** Every file of the world but the MacBook's own home, whole, by its path: Dropbox (the root) and the Mac Studio's home and work. */
const shared = (w) => Object.fromEntries(listAll(w.dir).filter((rel) => !rel.startsWith("home-macbook/")).map((rel) => [rel, readFileSync(join(w.dir, rel), "utf8")]));

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

/** Walk every command that names an episode, and the detached runs, on the MacBook (`w.macbook`), for the episode kept on the Mac Studio in the
    folder `found.name`: each says `line`, the gate's one line, and ends 1, and runs, starts and writes nothing in Dropbox or on the Mac Studio. On
    the MacBook, each detached run leaves its result in the same words, as `status` lists it there, refusing nothing. `what` names the episode in
    what a failure says. */
async function walkOn(w, found, line, what) {
  const before = shared(w);
  for (const argv of [...SCOPED.map((name) => [name, ...askedOf(found.name)[name]]), ...DETACHED(found.name)]) {
    const r = await on(w.macbook, ...argv);
    assert.deepEqual([r.code, r.said], [1, [line]], `${what}: ${argv.join(" ")}`);
    assert.deepEqual([w.started, w.calls, w.opened], [[], [], []], `${what}: ${argv.join(" ")}`);
    assert.deepEqual(shared(w), before, `${what}: ${argv.join(" ")} wrote nothing in Dropbox or on the Mac Studio`);
  }
  // On the MacBook, only what each detached run the gate ended leaves: its result, in the same words.
  assert.deepEqual(listAll(w.macbookHome), Object.keys(RESULTS).map((command) => join("BRIMM Video Work", found.name, `${command}.result.json`)), what);
  for (const rel of listAll(w.macbookHome)) assert.deepEqual(JSON.parse(readFileSync(join(w.macbookHome, rel), "utf8")).failed, [line], `${what}: ${rel}`);
  // `status` names no episode to refuse: it lists each of those results, ended and not done, in the gate's words.
  const status = await on(w.macbook, "status");
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
      const found = KEPT.raw.make(w);
      const handoff = "final/Pricing talk.brimm-ops.json";
      mkdirSync(join(found.folder, "final"), { recursive: true });
      writeFileSync(join(found.folder, handoff), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: found.record.id, kind: "raw", name: "Pricing talk" }, main: { file: "Pricing talk.mov" } }));
      writeFileSync(recordFile(found.folder, 2), recordText({ ...found.record, rev: 2, finished: { revision: 1, at: "2026-10-20T13:00:00-05:00", on: STUDIO, handoff, parts: {} } }));
      const r = await on(w.macbook, "guide", "Pricing talk");
      assert.equal(r.code, 0, r.text);
      assert.match(r.said[0], /^Pricing talk \(3fa9c1\): On the BRIMM Ops page: Drag the hand-off onto Episodes\./);
      assert.equal(r.said.at(-1), "Step: taken");
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
  for (const [mac, deps] of [["the Mac Studio", (w) => w.studio], ["Jason's MacBook", (w) => w.macbook]]) {
    it(`has ${mac}, which one of them names, sort the conflict out, refuse every other command by the conflict, and say so in the guide and \`episodes\``, async () => {
      const w = world();
      try {
        const found = split(w);
        const before = inDropbox(w);
        const resolved = await on(deps(w), "resolve", "Too many SKUs");
        assert.equal(resolved.code, 0, resolved.text);
        assert.match(resolved.text, /^Dropbox kept two versions of record\/0002\.json in Too many SKUs:/, resolved.text);
        assert.match(resolved.text, /Say which to keep: A or B\.$/, resolved.text);
        // Every other command is refused, by the conflict or by what the gate says of a plan, and never as on another Mac.
        for (const argv of [...SCOPED.filter((name) => name !== "resolve").map((name) => [name, ...askedOf(found.name)[name]]), ...DETACHED(found.name)]) {
          const r = await on(deps(w), ...argv);
          assert.equal(r.code, 1, `${argv.join(" ")}: ${r.text}`);
          assert.doesNotMatch(r.text, / is on (the Mac Studio|Jason's MacBook)/, argv.join(" "));
          assert.deepEqual([w.started, w.calls, w.opened], [[], [], []], argv.join(" "));
        }
        assert.deepEqual(inDropbox(w), before, "nothing was written in Dropbox");
        // Refused as any episode with a conflicted copy is, on its own Mac: by its folder, with the conflict's words.
        const named = await on(deps(w), "plan", "Too many SKUs");
        assert.deepEqual([named.code, named.said], [1, [`2026-10-20 Too many SKUs (Mac Studio): Dropbox has kept a conflicted copy in this episode: record/0002 (Jason's MacBook's conflicted copy 2026-10-20).json. Two Macs changed the same file before Dropbox could bring one change across, and which to keep is for a person to say. Nothing is changed until one is kept. Say "sort out the conflict".`]]);
        const guide = await on(deps(w), "guide", "Too many SKUs");
        assert.deepEqual([guide.code, guide.said], [0, ['Too many SKUs (cccccc): Dropbox kept two copies of a change to it. Say "sort out the conflict".']]);
        const listed = await on(deps(w), "episodes");
        assert.deepEqual(listedLines(listed), ["  2026-10-20 Too many SKUs (Mac Studio)", `    Dropbox has kept a conflicted copy in this episode: record/0002 (Jason's MacBook's conflicted copy 2026-10-20).json. Two Macs changed the same file before Dropbox could bring one change across, and which to keep is for a person to say. Nothing is changed until one is kept. Say "sort out the conflict".`], listed.text);
      } finally {
        w.done();
      }
    });
  }
  it("is kept on one Mac again once she keeps a side: kept on Jason's MacBook, the side that says the Mac Studio leaves it to the Mac Studio", async () => {
    const w = world();
    try {
      const found = split(w);
      assert.equal((await on(w.macbook, "resolve", "Too many SKUs")).code, 0);
      const kept = await on(w.macbook, "resolve", "Too many SKUs", "--keep", "A");
      assert.equal(kept.code, 0, kept.text);
      assert.equal(readEpisode(found.folder).record.local.on, STUDIO);
      const there = await on(w.macbook, "plan", "Too many SKUs");
      assert.deepEqual([there.code, there.said], [1, [ON_OTHER_MAC("Too many SKUs", STUDIO)]]);
      const here = await on(w.studio, "plan", "Too many SKUs");
      assert.equal(here.code, 0, here.text);
    } finally {
      w.done();
    }
  });
  it("has a Mac neither names (Sallie's laptop) refuse every command in the one line, naming the Mac its record in force keeps it on", async () => {
    const w = world();
    try {
      const found = split(w);
      const laptop = { ...w.macbook, home: join(w.dir, "home-laptop"), settings: { ...w.macbook.settings, machine: "Sallie's laptop" } };
      for (const argv of [["resolve", found.name], ["plan", "Too many SKUs"], ["open", found.name]]) {
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
