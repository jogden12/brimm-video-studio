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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** The episodes kept on the Mac Studio that the tests here use: a raw video, read and named; a video waiting for her answer; a client or group
    session whose mark is not cleared; and a plan, set, with its three files in Dropbox. Each by how every line names it (`said`) and its short id. */
const KEPT = {
  raw: {
    said: "Pricing talk", short: "3fa9c1",
    make: (t) => kept(t, { id: "e-20261020-3fa9c1", name: "2026-10-20 IMG_0042 (Mac Studio)", record: { kind: "raw", answer: ANSWERED, reading: READ("raw"), offers: OFFERS, name: { text: "Pricing talk", placeholder: false }, label: "Video of 20 Oct, 09:00 (Mac Studio)" } })
  },
  waiting: {
    said: "Video of 20 Oct, 10:00 (Mac Studio)", short: "aaaaaa",
    make: (t) => kept(t, { id: "e-20261020-aaaaaa", name: "2026-10-20 IMG_0043 (Mac Studio)", stem: "IMG_0043", record: { answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:42", came: "camera", match: null }, label: "Video of 20 Oct, 10:00 (Mac Studio)" } })
  },
  session: {
    said: "Session, 2026-10-20", short: "bbbbbb",
    make: (t) => kept(t, {
      id: "e-20261020-bbbbbb", name: "2026-10-20 Coaching call Jane Doe (Mac Studio)", stem: "Coaching call Jane Doe",
      record: { kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 20 Oct, 11:00 (Mac Studio)", name: { text: "Session, 2026-10-20", placeholder: false }, session: { marked: "2026-10-20T08:00:00-05:00", on: STUDIO, teachings: null, cleared: null } }
    })
  },
  plan: {
    said: "Too many SKUs", short: "cccccc",
    make: (t) => {
      // The plan's record as `plan new` makes it, but for its files, which kept lists as it puts them in its folder in Dropbox.
      const { files, ...plan } = newPlannedEpisode({ id: "e-20261020-cccccc", machine: STUDIO, at: "2026-10-20T07:00:00-05:00", title: "Too many SKUs", route: "script", voice: null, writer: WRITER });
      const planned = { ...plan.planned, set: "2026-10-20T07:10:00-05:00", shots: [{ n: 1, kind: "talking", what: "Open on the problem, to the camera." }], lines: ["Too many SKUs will sink a small shop."] };
      return kept(t, { id: plan.id, name: "2026-10-20 Too many SKUs (Mac Studio)", own: {}, dropbox: { "video guide.md": "The video guide.\n", "shot list.md": "The shot list.\n", "teleprompter.txt": "Too many SKUs will sink a small shop.\n" }, record: { ...plan, planned } });
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

describe("an episode kept on the Mac Studio, on another Mac (Jason's MacBook, on a drop folder in Dropbox)", () => {
  it("has every command that names an episode in the walk", () => {
    for (const name of SCOPED) assert.ok(name in askedOf("x"), `${name} names an episode: give it its words, or it is not walked here`);
  });
  for (const [what, episode] of Object.entries(KEPT)) {
    it(`refuses every command that names ${what === "raw" ? "a raw video" : what === "waiting" ? "a video waiting for her answer" : what === "session" ? "a session" : "a plan"} kept there in one line, which names it as every line does, and writes, runs and starts nothing`, async () => {
      const w = world();
      try {
        const found = episode.make(w);
        const line = ON_OTHER_MAC(episode.said, STUDIO);
        const before = shared(w);
        for (const name of SCOPED) {
          const r = await on(w.macbook, name, ...askedOf(found.name)[name]);
          assert.deepEqual([r.code, r.said], [1, [line]], `${what}: ${name}`);
          assert.deepEqual([w.started, w.calls], [[], []], `${what}: ${name}`);
          assert.deepEqual(shared(w), before, `${what}: ${name} wrote nothing in Dropbox or on the Mac Studio`);
        }
        // On the MacBook, only what each detached run the gate ended leaves (`read`, `workcopy`, `bring` and `join` are walked with --now): its
        // result, in the same words, as `status` says it.
        assert.deepEqual(listAll(w.macbookHome), ["bring", "join", "read", "workcopy"].map((command) => join("BRIMM Video Work", found.name, `${command}.result.json`)));
        for (const rel of listAll(w.macbookHome)) assert.deepEqual(JSON.parse(readFileSync(join(w.macbookHome, rel), "utf8")).failed, [line], rel);
        assert.deepEqual(readEpisode(found.folder).record, found.record);
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
        for (const said of [episode.said, found.record.id, episode.short, found.name]) {
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
      for (const start of ["  Pricing talk: an episode of 0:42, in 2026-10-20 IMG_0042 (Mac Studio), id 3fa9c1", "  Video of 20 Oct, 10:00 (Mac Studio): a video waiting for your answer, of 0:42, id aaaaaa",
        "  Session, 2026-10-20: a client or group session, of 0:42, id bbbbbb", '  "Too many SKUs": planned on 20 October, waiting for its footage (1 shot), id cccccc']) {
        assert.ok(r.said.includes(start), `${start}\n${r.text}`);
        assert.equal(after(start), ON, start);
      }
      assert.equal(r.said.filter((line) => line === ON).length, 4, r.text);
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
