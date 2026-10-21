// `resolve` (phase 1b): when two Macs changed one file of an episode before Dropbox brought either change across, Dropbox
// keeps both, one as a conflicted copy, and every command stops. resolve shows the two sides, keeps the one a person picks,
// and sets the other aside in history/, never deleting anything before its copy there is whole. Nothing touches Dropbox:
// the root is made for each test, and the clone is a stand-in.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { conflictedCopies, readEpisode, recordFile, recordText } from "../episode.js";
import { setup, episodeFor, reread, otherMac, listAll, EDITED, FOLDER } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, text }, with what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}
const RECORD_COPY = "record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json";
const TIMELINE = "edit/main.v2.mac-studio.fcpxml";
const TIMELINE_COPY = "edit/main.v2.mac-studio (Sallie's laptop's conflicted copy 2026-10-20).fcpxml";
/** Show the conflict, as her session does first, and then keep `side`. */
async function keep(deps, side) {
  await on(deps, "resolve", FOLDER);
  return on(deps, "resolve", FOLDER, "--keep", side);
}
const history = (found) => (existsSync(join(found.folder, "history")) ? readdirSync(join(found.folder, "history")).sort() : []);
/** Text as a regular expression takes it, letter for letter. */
const literally = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** What a command but resolve says, first and whole, of the episode with the record's conflicted copy: episodeFor's refusal. */
const CONFLICT_REFUSAL = new RegExp(`^${literally(FOLDER)}: Dropbox has kept a conflicted copy in this episode: ${literally(RECORD_COPY)}\\. .*Say "sort out the conflict"\\.$`, "s");
/** Every file in an episode's folder, at any depth, with what it holds: a command that refuses leaves them all as they were. */
const filesOf = (found) => Object.fromEntries(listAll(found.folder).map((rel) => [rel, readFileSync(join(found.folder, rel), "utf8")]));

/** Both Macs wrote record 2 of the episode: this Mac named it "Test A", hers "Test B" and dropped Reel 1, and Dropbox kept hers
    as a conflicted copy. */
function recordConflict(t, more = {}) {
  const found = episodeFor(t, more);
  const first = readEpisode(found.folder).record;
  writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, name: { text: "Test A", placeholder: false }, writer: { commit: "c709b57", on: "Mac Studio" } }));
  writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...first, rev: 2, name: { text: "Test B", placeholder: false }, editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
  return found;
}
/** A timeline the record lists, and a conflicted copy of it Dropbox kept beside it. */
function timelineConflict(t) {
  const found = episodeFor(t);
  const first = readEpisode(found.folder).record;
  mkdirSync(join(found.folder, "edit"), { recursive: true });
  writeFileSync(join(found.folder, "edit", "main.v2.mac-studio.fcpxml"), "<fcpxml>A</fcpxml>\n");
  writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [TIMELINE]: 19 }, writer: { commit: "c709b57", on: "Mac Studio" } }));
  writeFileSync(join(found.folder, TIMELINE_COPY), "<fcpxml>B, longer</fcpxml>\n");
  return found;
}

describe("resolve", () => {
  it("shows both sides of a record's conflict in plain words, against the record as it is now, and changes nothing", async () => {
    const t = setup();
    const found = recordConflict(t);
    const before = readdirSync(join(found.folder, "record")).sort();
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(r.code, 0, r.text);
    for (const line of ["Dropbox kept two versions of record/0002.json in Test A:", "A: the record in force (record 2, written on Mac Studio)", "B: the copy written on Sallie's laptop", '  Name: A: "Test A"; B: "Test B"', "  Who has it open: A: nobody; B: Sallie's laptop"]) assert.ok(r.text.includes(line), `${line}\n---\n${r.text}`);
    assert.match(r.text, /\nSay which to keep: A or B\.$/);
    assert.deepEqual([readdirSync(join(found.folder, "record")).sort(), history(found)], [before, []]);
    t.done();
  });
  it("keeps A: sets the copy aside in history/, leaves no conflicted copy, and the episode reads again", async () => {
    const t = setup();
    const found = recordConflict(t);
    const b = readFileSync(join(found.folder, RECORD_COPY), "utf8");
    const r = await keep(t.ctx.deps, "A");
    assert.deepEqual([r.code, r.text], [0, "Kept A of record/0002.json. The other is set aside in history/."]);
    assert.deepEqual(conflictedCopies(found.folder), []);
    assert.equal(readEpisode(found.folder).record.name.text, "Test A");
    const kept = history(found);
    assert.equal(kept.length, 1);
    assert.ok(kept[0].endsWith(" 0002 (Sallie's laptop's conflicted copy 2026-10-20).json"), kept[0]);
    assert.equal(readFileSync(join(found.folder, "history", kept[0]), "utf8"), b);
    t.done();
  });
  it("keeps B of a record: writes B's content as the next record, keeps A's file, and sets both aside", async () => {
    const t = setup();
    const found = recordConflict(t);
    const r = await keep(t.ctx.deps, "b");
    assert.equal(r.code, 0, r.text);
    const now = readEpisode(found.folder).record;
    assert.deepEqual([now.rev, now.name.text, now.editing.by, now.writer.on], [3, "Test B", "Sallie's laptop", "Mac Studio"]);
    assert.ok(existsSync(recordFile(found.folder, 2)));
    const kept = history(found);
    assert.equal(kept.length, 2);
    assert.equal(JSON.parse(readFileSync(join(found.folder, "history", kept.find((n) => n.endsWith(" 0002.json"))), "utf8")).name.text, "Test A");
    assert.deepEqual(conflictedCopies(found.folder), []);
    t.done();
  });
  it("keeps B of a timeline: sets A aside whole, puts B in its place, and lists its size in the record", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const shown = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(shown.code, 0);
    assert.match(shown.text, new RegExp(`A: ${TIMELINE}, 19 bytes, `));
    // Each side names where it came from, and the record says whose size it lists (the P2 check, R7).
    assert.match(shown.text, new RegExp(`A: ${TIMELINE}, 19 bytes, written .*, the version Dropbox kept under the file's own name\\n`));
    assert.match(shown.text, /\nB: the copy from Sallie's laptop, 27 bytes, /);
    assert.match(shown.text, /\nThe record in force lists A's size for it\.\n/);
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.deepEqual([r.code, r.text], [0, `Kept B of ${TIMELINE}. The other is set aside in history/.`]);
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>B, longer</fcpxml>\n");
    const now = readEpisode(found.folder).record;
    assert.deepEqual([now.rev, now.files[TIMELINE]], [3, 27]);
    assert.deepEqual([conflictedCopies(found.folder), history(found).length], [[], 2]);
    assert.equal(readFileSync(join(found.folder, "history", history(found).find((n) => n.endsWith(" main.v2.mac-studio.fcpxml"))), "utf8"), "<fcpxml>A</fcpxml>\n");
    t.done();
  });
  it("deletes nothing when a copy set aside is not whole there, and says so", async () => {
    const t = setup();
    const found = recordConflict(t);
    t.ctx.deps.clone = (from, to) => writeFileSync(to, "short");
    const r = await keep(t.ctx.deps, "A");
    assert.equal(r.code, 1);
    assert.match(r.text, /could not be set aside in history\/ \(.*\)\. Nothing was deleted\. Say "sort out the conflict" again in a minute, or ask Jason\.$/);
    assert.deepEqual(conflictedCopies(found.folder), [RECORD_COPY]);
    t.done();
  });
  it("deletes nothing and replaces nothing when setting A aside fails while keeping B of a timeline", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => (to.includes("/history/") ? writeFileSync(to, "short") : clone(from, to));
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 1);
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>A</fcpxml>\n");
    assert.deepEqual(conflictedCopies(found.folder), [TIMELINE_COPY]);
    t.done();
  });
  it("replaces nothing when the record cannot be written, as when the other Mac wrote one meanwhile", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.includes("/history/") && !existsSync(recordFile(found.folder, 3))) writeFileSync(recordFile(found.folder, 3), recordText({ ...readEpisode(found.folder, { pastCopies: true }).record, rev: 3 }));
    };
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 1);
    assert.match(r.text, /^Nothing was written, and nothing deleted: /);
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>A</fcpxml>\n");
    assert.deepEqual(conflictedCopies(found.folder), [TIMELINE_COPY]);
    t.done();
  });
  it("puts A back, and the record as it was, when B cannot be put in its place", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const clone = t.ctx.deps.clone;
    let failed = false;
    t.ctx.deps.clone = (from, to) => {
      if (to === join(found.folder, TIMELINE) && !failed) {
        failed = true;
        throw new Error("cp: clonefile failed");
      }
      clone(from, to);
    };
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 1);
    assert.match(r.text, new RegExp(`^B could not be put in place of ${TIMELINE.replace(/\./g, "\\.")}: .* A is back as it was, and nothing was deleted\\.$`));
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>A</fcpxml>\n");
    assert.equal(readEpisode(found.folder, { pastCopies: true }).record.files[TIMELINE], 19);
    assert.deepEqual(conflictedCopies(found.folder), [TIMELINE_COPY]);
    t.done();
  });
  it("keeps the record's sizes in step with the side kept, its hand-over list included", async () => {
    const t = setup();
    const found = timelineConflict(t);
    // The record lists the copy's size (the Mac whose version became the copy wrote it last), and the hand-over listed it too.
    const second = readEpisode(found.folder, { pastCopies: true }).record;
    writeFileSync(recordFile(found.folder, 3), recordText({ ...second, rev: 3, files: { ...second.files, [TIMELINE]: 27 }, released: { at: "2026-10-20T14:30:00-05:00", by: "Mac Studio", files: { [TIMELINE]: 27 }, answers: {} } }));
    assert.equal((await keep(t.ctx.deps, "A")).code, 0);
    const now = readEpisode(found.folder).record;
    assert.deepEqual([now.files[TIMELINE], now.released.files[TIMELINE]], [19, 19]);
    assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
    t.done();
  });
  it("takes the record's copy first, and keeping B of it is written while another copy is still there, which comes next", async () => {
    const t = setup();
    const found = recordConflict(t);
    writeFileSync(join(found.folder, "reels.json"), "[1]\n");
    writeFileSync(join(found.folder, "reels (Sallie's laptop's conflicted copy 2026-10-20).json"), "[1, 2]\n");
    assert.match((await on(t.ctx.deps, "resolve", FOLDER)).text, /^Dropbox kept two versions of record\/0002\.json/);
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 0, r.text);
    assert.equal(readEpisode(found.folder, { pastCopies: true }).record.name.text, "Test B");
    const next = await on(t.ctx.deps, "resolve", FOLDER);
    assert.match(next.text, /^Dropbox kept two versions of reels\.json/);
    t.done();
  });
  it("with a timeline's copy and a record's, takes the record first, and keeping B of each keeps both", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const second = readEpisode(found.folder, { pastCopies: true }).record;
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...second, name: { text: "Test B", placeholder: false }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    assert.match((await on(t.ctx.deps, "resolve", FOLDER)).text, /^Dropbox kept two versions of record\/0002\.json/);
    const keptRecord = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(keptRecord.code, 0, keptRecord.text);
    const keptTimeline = await keep(t.ctx.deps, "B");
    assert.equal(keptTimeline.code, 0, keptTimeline.text);
    const now = readEpisode(found.folder).record;
    assert.deepEqual([now.name.text, now.files[TIMELINE], readFileSync(join(found.folder, TIMELINE), "utf8")], ["Test B", 27, "<fcpxml>B, longer</fcpxml>\n"]);
    assert.deepEqual(conflictedCopies(found.folder), []);
    t.done();
  });
  it("keeps B of a file whose own name has brackets in that file's place, and leaves no stray file", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    const file = "final/Leadership (part 2) main v5 3fa9c1.mov";
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, file), "<A/>");
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [file]: 4 } }));
    writeFileSync(join(found.folder, "final", "Leadership (part 2) main v5 3fa9c1 (Sallie's laptop's conflicted copy 2026-10-20).mov"), "<B, longer/>");
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(readdirSync(join(found.folder, "final")), ["Leadership (part 2) main v5 3fa9c1.mov"]);
    assert.equal(readFileSync(join(found.folder, file), "utf8"), "<B, longer/>");
    assert.equal(readEpisode(found.folder).record.files[file], 12);
    t.done();
  });
  it("keeps B of a numbered second copy in the file's own place", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const numbered = "edit/main.v2.mac-studio (Sallie's laptop's conflicted copy 2026-10-20) (1).fcpxml";
    writeFileSync(join(found.folder, numbered), readFileSync(join(found.folder, TIMELINE_COPY)));
    rmSync(join(found.folder, TIMELINE_COPY));
    const r = await keep(t.ctx.deps, "B");
    assert.deepEqual([r.code, r.text], [0, `Kept B of ${TIMELINE}. The other is set aside in history/.`]);
    assert.deepEqual(readdirSync(join(found.folder, "edit")), ["main.v2.mac-studio.fcpxml"]);
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>B, longer</fcpxml>\n");
    t.done();
  });
  it("refuses to keep A of a file that is not there", async () => {
    const t = setup();
    const found = timelineConflict(t);
    rmSync(join(found.folder, TIMELINE));
    const r = await keep(t.ctx.deps, "A");
    assert.deepEqual([r.code, r.text], [1, `A, ${TIMELINE}, is not there, so it cannot be kept. Say B, or ask Jason.`]);
    assert.deepEqual(conflictedCopies(found.folder), [TIMELINE_COPY]);
    t.done();
  });
  it("says there is no conflict when there is none, and asks for A or B", async () => {
    const t = setup();
    episodeFor(t);
    assert.deepEqual(await on(t.ctx.deps, "resolve", FOLDER), { code: 0, text: "There is no conflict in Pricing talk." });
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "C");
    assert.equal(r.code, 2);
    t.done();
  });
  it("is named in what every other command says of a conflict", async () => {
    const t = setup();
    recordConflict(t);
    const r = await on(t.ctx.deps, "open", FOLDER);
    assert.equal(r.code, 1);
    assert.match(r.text, /Say "sort out the conflict"\.$/);
    t.done();
  });
  it("finds an episode with a conflicted copy by its own name, and shows the conflict", async () => {
    const t = setup();
    // The episode was named "Know your costs", which never renames its folder (Pricing talk), and the Mac Studio, editing it,
    // pushed its Reels; then both Macs wrote record 2.
    const found = episodeFor(t, { record: { ...EDITED, name: { text: "Know your costs", placeholder: false }, editing: { by: "Mac Studio", since: "2026-10-20T13:00:00-05:00" } } });
    const first = readEpisode(found.folder).record;
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, title: { text: "Studio title", from: "person", approved: true }, writer: { commit: "c709b57", on: "Mac Studio" } }));
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...first, rev: 2, editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    for (const said of ["know your costs", "3fa9c1"]) {
      const shown = await on(t.ctx.deps, "resolve", said);
      assert.equal(shown.code, 0, `${said}\n---\n${shown.text}`);
      for (const line of ["Dropbox kept two versions of record/0002.json in Know your costs:", "A: the record in force (record 2, written on Mac Studio)", "B: the copy written on Sallie's laptop"]) assert.ok(shown.text.includes(line), `${said}: ${line}\n---\n${shown.text}`);
    }
    // Every other command finds it too, and refuses it at once, as episodeFor does, naming the conflict: not later, when it
    // comes to write, and with nothing written into the episode before then.
    const before = filesOf(found);
    for (const argv of [["open", "know your costs"], ["push", "know your costs", "reel", "1", "--no-hand-edits"]]) {
      const r = await on(t.ctx.deps, ...argv);
      assert.equal(r.code, 1, argv.join(" "));
      assert.match(r.text, CONFLICT_REFUSAL, argv.join(" "));
      assert.deepEqual(filesOf(found), before, argv.join(" "));
    }
    t.done();
  });
  it("finds it by the name given on the Mac whose rename became the copy, as the guide's conflict step makes one", async () => {
    const t = setup();
    // The Mac Studio called it "Test A", and that record is in force; her laptop called it "Test B", and hers is the copy.
    const found = recordConflict(t);
    // Both Macs find it by either name: the copy is the same on both once Dropbox has brought it across.
    const macs = [["Mac Studio", t.ctx.deps], ["Sallie's laptop", otherMac(t).deps]];
    for (const [mac, deps] of macs) {
      for (const said of ["test b", "Test A"]) {
        const shown = await on(deps, "resolve", said);
        assert.equal(shown.code, 0, `${mac}, ${said}\n---\n${shown.text}`);
        for (const line of ["Dropbox kept two versions of record/0002.json in Test A:", '  Name: A: "Test A"; B: "Test B"']) assert.ok(shown.text.includes(line), `${mac}, ${said}: ${line}\n---\n${shown.text}`);
      }
    }
    // Found by the copy's name, it is still refused by every other command, at once, and nothing is written.
    const before = filesOf(found);
    for (const [mac, deps] of macs) {
      const opened = await on(deps, "open", "test b");
      assert.equal(opened.code, 1, mac);
      assert.match(opened.text, CONFLICT_REFUSAL, mac);
      assert.deepEqual(filesOf(found), before, mac);
    }
    t.done();
  });
  it("names a copy's Mac by episode.js's one list of Dropbox's forms, and spells none of them itself (the review of the plan, P11 and P19)", () => {
    const text = readFileSync(new URL("../edit.js", import.meta.url), "utf8");
    assert.match(text, /^import \{[^}]*\bconflictedBy\b[^}]*\} from "\.\/episode\.js";$/m);
    // No regular expression in edit.js spells Dropbox's words, so what the guide's conflict step learns goes into
    // CONFLICT_FORMS alone, and resolve still names the Mac.
    assert.deepEqual(text.split("\n").filter((line) => /conflicted copy[^"`\n]*\/[dgimsuvy]*[.;,)]/.test(line)), []);
  });
  it("names the Mac of a copy whose name has a curly apostrophe, as the File Provider may write it (the review's #27-1)", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const curly = "edit/main.v2.mac-studio (Sallie’s laptop’s conflicted copy 2026-10-20).fcpxml";
    writeFileSync(join(found.folder, curly), readFileSync(join(found.folder, TIMELINE_COPY)));
    rmSync(join(found.folder, TIMELINE_COPY));
    const shown = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(shown.code, 0, shown.text);
    assert.match(shown.text, new RegExp(`A: ${literally(TIMELINE)}, 19 bytes, written .*, the version Dropbox kept under the file's own name\\n`));
    assert.match(shown.text, /\nB: the copy from Sallie’s laptop, 27 bytes, /);
    t.done();
  });
});

describe("resolve, when keeping a side here could lose a change", () => {
  const needsJason = "A conflict needs Jason: tell him the episode's name.";
  it("names the records written after the copy, and keeps neither side", async () => {
    const t = setup();
    const found = recordConflict(t);
    // Her Mac wrote record 3 on top of its own record 2, which became the copy.
    const copy = JSON.parse(readFileSync(join(found.folder, RECORD_COPY), "utf8"));
    writeFileSync(recordFile(found.folder, 3), recordText({ ...copy, rev: 3, name: { text: "Her name", placeholder: false } }));
    const shown = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(shown.code, 0);
    assert.ok(shown.text.includes("Records were written after it: record 3, on Sallie's laptop."), shown.text);
    assert.ok(shown.text.endsWith(needsJason), shown.text);
    for (const side of ["A", "B"]) {
      const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", side);
      assert.equal(r.code, 1);
      assert.ok(r.text.endsWith(needsJason), r.text);
    }
    assert.deepEqual([readdirSync(join(found.folder, "record")).length, history(found)], [4, []]);
    t.done();
  });
  it("waits for the record of the copy's number when it is not here yet, and writes nothing", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...first, rev: 2, name: { text: "Test B", placeholder: false }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 1);
    assert.ok(r.text.includes('Dropbox is still bringing record/0002.json over to this Mac; say "sort out the conflict" again when it is done.'), r.text);
    assert.deepEqual(readdirSync(join(found.folder, "record")).sort(), ["0001.json", RECORD_COPY.slice(7)].sort());
    t.done();
  });
});

describe("resolve keeps the version she was shown", () => {
  it("keeps nothing, and shows the new one, when another copy came first since", async () => {
    const t = setup();
    const found = timelineConflict(t);
    assert.match((await on(t.ctx.deps, "resolve", FOLDER)).text, /^Dropbox kept two versions of edit\/main\.v2\.mac-studio\.fcpxml/);
    // Dropbox brings in a copy of the record meanwhile, which is sorted out first.
    const second = readEpisode(found.folder, { pastCopies: true }).record;
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...second, name: { text: "Studio name", placeholder: false }, writer: { commit: "c709b57", on: "Mac Studio" } }));
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.match(r.text, /^That is not the version shown last, so nothing was kept\. Here is the one to sort out now:\nDropbox kept two versions of record\/0002\.json/);
    assert.deepEqual(conflictedCopies(found.folder).sort(), [RECORD_COPY, TIMELINE_COPY].sort());
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>A</fcpxml>\n");
    t.done();
  });
  it("shows first when asked to keep a side before seeing it", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.match(r.text, /^That is not the version shown last, so nothing was kept\. Here is the one to sort out now:\nDropbox kept two versions of edit\/main/);
    assert.deepEqual(conflictedCopies(found.folder), [TIMELINE_COPY]);
    assert.equal((await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B")).code, 0);
    t.done();
  });
});

describe("resolve, as the P2 check found it", () => {
  const needsJason = "A conflict needs Jason: tell him the episode's name.";
  /** Record 2 conflicted, and record 3 written on top of the record of that number (Dropbox paused, two changes each). */
  const laterConflict = (t) => {
    const found = recordConflict(t);
    const two = readEpisode(found.folder, { pastCopies: true }).record;
    writeFileSync(recordFile(found.folder, 3), recordText({ ...two, rev: 3, title: { text: "Studio title", from: "person", approved: true } }));
    return found;
  };
  it("labels the record in force as A, and the record of the copy's number apart, when records were written after it", async () => {
    const t = setup();
    laterConflict(t);
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.ok(r.text.includes("A: the record in force (record 3, written on Mac Studio)"), r.text);
    assert.ok(r.text.includes("(record 2, whose number the copy has, was written on Mac Studio)"), r.text);
    assert.ok(r.text.endsWith(needsJason), r.text);
    t.done();
  });
  it("keeps no side over later records, with or without --over-later-records, which is taken out for now (round 2, C)", async () => {
    const t = setup();
    const found = laterConflict(t);
    await on(t.ctx.deps, "resolve", FOLDER);
    for (const keep of ["A", "B"]) {
      const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", keep, "--over-later-records");
      assert.equal(r.code, 2, r.text);
      const plain = await on(t.ctx.deps, "resolve", FOLDER, "--keep", keep);
      assert.equal(plain.code, 1, plain.text);
      assert.ok(plain.text.endsWith(needsJason), plain.text);
    }
    assert.equal(readEpisode(found.folder, { pastCopies: true }).record.rev, 3);
    assert.equal(conflictedCopies(found.folder).length, 1);
    assert.equal(history(found).length, 0);
    t.done();
  });
  it("shows two sides of a record that differ only in a file's size, and does not call them the same", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const two = readEpisode(found.folder, { pastCopies: true }).record;
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...two, files: { ...two.files, [TIMELINE]: 27 }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.doesNotMatch(r.text, /They hold the same/);
    assert.ok(r.text.includes(`  File ${TIMELINE}: A: 19 bytes; B: 27 bytes`), r.text);
    t.done();
  });
  it("shows two sides of a record that differ only in the session's layers, and does not call them the same", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    // This Mac gave a spelling, and hers a look: neither changes what the rows for a person to read compare.
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, version: 2, rev: 2, spellings: [["Hormozy", "Hormozi"]], writer: { commit: "c709b57", on: "Mac Studio" } }));
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...first, version: 2, rev: 2, main: { ...first.main, preset: { job: "full-episode", captions: "plain", look: "warm" } }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /They hold the same/);
    assert.match(r.text, /\n {2}Spellings: A: .*Hormozi.*; B: none\n/);
    assert.match(r.text, /\n {2}The main video's preset: A: none; B: .*warm.*\n/);
    t.done();
  });
  it("never calls two sides the same when they differ only where no row looks", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    // The same Mac claimed it on each side, a minute apart: who has it open reads the same on both.
    const claimed = (since) => ({ ...first, rev: 2, editing: { by: "Mac Studio", since }, writer: { commit: "c709b57", on: "Mac Studio" } });
    writeFileSync(recordFile(found.folder, 2), recordText(claimed("2026-10-20T14:00:00-05:00")));
    writeFileSync(join(found.folder, RECORD_COPY), recordText(claimed("2026-10-20T14:01:00-05:00")));
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.doesNotMatch(r.text, /They hold the same/);
    assert.match(r.text, /\n {2}The rest of the record: A: as A holds it; B: as B holds it\n/);
    t.done();
  });
  it("shows two sides that each hold one cut, in different places, and does not call them the same", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    const cut = (from, to) => ({ ...first.main, cuts: [{ id: "c1", keep: false, from, to }] });
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, version: 2, rev: 2, main: cut(6.07, 9.638), writer: { commit: "c709b57", on: "Mac Studio" } }));
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...first, version: 2, rev: 2, main: cut(13.583, 16.33), writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    const r = await on(t.ctx.deps, "resolve", FOLDER);
    assert.doesNotMatch(r.text, /They hold the same/);
    assert.match(r.text, /\n {2}The main video's cuts: A: .*6\.07.*; B: .*13\.583.*\n/);
    t.done();
  });
  it("writes a record on every keep, so that two Macs keeping opposite sides at once meet as a conflict of the record", async () => {
    const t = setup();
    const found = timelineConflict(t);
    assert.equal((await keep(t.ctx.deps, "A")).code, 0);
    assert.equal(readEpisode(found.folder).record.rev, 3);
    t.done();
  });
  it("writes a record when A of a record's copy is kept too, though A is the record in force", async () => {
    const t = setup();
    const found = recordConflict(t);
    const r = await keep(t.ctx.deps, "A");
    assert.equal(r.code, 0, r.text);
    const now = readEpisode(found.folder).record;
    assert.deepEqual([now.rev, now.name.text, now.writer.on], [3, "Test A", "Mac Studio"]);
    t.done();
  });
  it("writes no record when the copy already holds what the record in force holds, as when an earlier keep wrote it and its copy could not be deleted", async () => {
    for (const side of ["A", "B"]) {
      const t = setup();
      const found = recordConflict(t);
      // An earlier keep of B wrote record 3 with the copy's content, and the copy was not deleted then.
      const b = JSON.parse(readFileSync(join(found.folder, RECORD_COPY), "utf8"));
      writeFileSync(recordFile(found.folder, 3), recordText({ ...b, rev: 3, writer: { commit: "c709b57", on: "Mac Studio" } }));
      const shown = await on(t.ctx.deps, "resolve", FOLDER);
      assert.ok(shown.text.includes("B is in force already: a keep wrote it, and its copy was not deleted then."), shown.text);
      const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", side);
      assert.equal(r.code, 0, `${side}: ${r.text}`);
      const now = readEpisode(found.folder).record;
      assert.deepEqual([now.rev, now.name.text], [3, "Test B"], side);
      assert.deepEqual(conflictedCopies(found.folder), [], side);
      t.done();
    }
  });
  it("keeps nothing when the version shown was sorted out on the other Mac meanwhile, and says so", async () => {
    const t = setup();
    const found = recordConflict(t);
    const her = otherMac(t);
    await on(t.ctx.deps, "resolve", FOLDER);
    await on(her.deps, "resolve", FOLDER);
    assert.equal((await on(her.deps, "resolve", FOLDER, "--keep", "B")).code, 0);
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "A");
    assert.equal(r.code, 1);
    assert.match(r.text, /^The version shown was sorted out meanwhile, on this Mac or the other, so nothing was kept here\./);
    assert.equal(readEpisode(found.folder).record.name.text, "Test B");
    t.done();
  });
  it("keeps nothing when the copy or A changed since it was shown, and shows them again", async () => {
    const t = setup();
    const found = timelineConflict(t);
    await on(t.ctx.deps, "resolve", FOLDER);
    writeFileSync(join(found.folder, TIMELINE_COPY), "<fcpxml>D, never shown to her</fcpxml>\n");
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.match(r.text, /^That is not the version shown last, so nothing was kept\./);
    assert.equal(readFileSync(join(found.folder, TIMELINE), "utf8"), "<fcpxml>A</fcpxml>\n");
    t.done();
  });
  it("keeps nothing from a show that could not be kept, once A has arrived", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    writeFileSync(join(found.folder, RECORD_COPY), recordText({ ...first, rev: 2, name: { text: "Test B", placeholder: false }, writer: { commit: "c709b57", on: "Sallie's laptop" } }));
    await on(t.ctx.deps, "resolve", FOLDER);
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, title: { text: "Studio title", from: "person", approved: true } }));
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.ok(r.text.includes('Title: A: "Studio title", approved; B: none'), r.text);
    t.done();
  });
  it("names the finish made from the other side when a final/ file is kept from one side", async () => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    const video = "final/Pricing talk main v5 3fa9c1.mov";
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, video), "the Studio's cut");
    writeFileSync(join(found.folder, "final", "Pricing talk main v5 3fa9c1 (Sallie's laptop's conflicted copy 2026-10-20).mov"), "her cut, a little longer");
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, [video]: 24 }, finished: { revision: 2, at: "2026-10-20T15:00:00-05:00", on: "Sallie's laptop", parts: { main: { file: video, bytes: 24 } } } }));
    const shown = await on(t.ctx.deps, "resolve", FOLDER);
    assert.match(shown.text, /\nThe record in force lists B's size for it\.\n/);
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "A");
    assert.equal(r.code, 0, r.text);
    assert.ok(r.text.endsWith(`The record's finish (revision 2, on Sallie's laptop) was made from the other side's version of it: say "finish the episode" again to make the hand-off from this one.`), r.text);
    t.done();
  });
  it("says where each side is, and sets the record back, when B cannot be put in A's place and A cannot be put back", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const clone = t.ctx.deps.clone;
    t.ctx.deps.clone = (from, to) => {
      if (to === join(found.folder, TIMELINE)) throw new Error("cp: clonefile failed");
      clone(from, to);
    };
    const r = await keep(t.ctx.deps, "B");
    assert.equal(r.code, 1);
    const aside = history(found).find((n) => n.endsWith(" main.v2.mac-studio.fcpxml"));
    assert.ok(r.text.includes(`and A could not be put back either. A is whole in history/${aside}, and B is still the copy, ${TIMELINE_COPY}.`), r.text);
    assert.doesNotMatch(r.text, /Nothing was copied/);
    assert.equal(readEpisode(found.folder, { pastCopies: true }).record.files[TIMELINE], 19);
    assert.equal(readFileSync(join(found.folder, "history", aside), "utf8"), "<fcpxml>A</fcpxml>\n");
    t.done();
  });
  it("sets the hand-over list back too when B cannot be put in A's place", async () => {
    const t = setup();
    const found = timelineConflict(t);
    const two = readEpisode(found.folder, { pastCopies: true }).record;
    writeFileSync(recordFile(found.folder, 3), recordText({ ...two, rev: 3, released: { at: "2026-10-20T14:30:00-05:00", by: "Mac Studio", files: { [TIMELINE]: 19 }, answers: {} } }));
    const clone = t.ctx.deps.clone;
    let failed = false;
    t.ctx.deps.clone = (from, to) => {
      if (to === join(found.folder, TIMELINE) && !failed) {
        failed = true;
        throw new Error("cp: clonefile failed");
      }
      clone(from, to);
    };
    assert.equal((await keep(t.ctx.deps, "B")).code, 1);
    const now = readEpisode(found.folder, { pastCopies: true }).record;
    assert.deepEqual([now.files[TIMELINE], now.released.files[TIMELINE]], [19, 19]);
    t.done();
  });
  it("says a keep went through when only the copy's deletion failed, and finishes it next time", async () => {
    const t = setup();
    const found = recordConflict(t);
    await on(t.ctx.deps, "resolve", FOLDER);
    const copyPath = join(found.folder, RECORD_COPY);
    const clone = t.ctx.deps.clone;
    // The copy is held open by a stand-in: a folder of its name cannot be deleted by rmSync without recursive.
    t.ctx.deps.clone = (from, to) => {
      clone(from, to);
      if (to.endsWith("0003.json")) {
        rmSync(copyPath);
        mkdirSync(copyPath);
        writeFileSync(join(copyPath, "held"), "x");
      }
    };
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.match(r.text, /^Kept B of record\/0002\.json: the record is written, but the copy could not be deleted yet \(/);
    assert.equal(readEpisode(found.folder, { pastCopies: true }).record.name.text, "Test B");
    t.done();
  });
  it("refuses a copy of a folder plainly, with no raw error", async () => {
    const t = setup();
    const found = episodeFor(t);
    mkdirSync(join(found.folder, "edit"), { recursive: true });
    mkdirSync(join(found.folder, "edit (Selective Sync Conflict)"));
    const shown = await on(t.ctx.deps, "resolve", FOLDER);
    assert.ok(shown.text.includes(`Dropbox kept a copy of a folder, edit (Selective Sync Conflict), which resolve cannot sort out. ${needsJason}`), shown.text);
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.doesNotMatch(r.text, /ENOTSUP|\/private\//);
    t.done();
  });
  it("keeps the record's own name for a file whose Case Conflict copy names it in another case", (ctx) => {
    const t = setup();
    const found = episodeFor(t);
    const first = readEpisode(found.folder).record;
    mkdirSync(join(found.folder, "final"), { recursive: true });
    writeFileSync(join(found.folder, "final", "talk.srt"), "<A/>");
    if (!existsSync(join(found.folder, "final", "TALK.srt"))) {
      t.done();
      return ctx.skip("this disk tells case apart");
    }
    writeFileSync(recordFile(found.folder, 2), recordText({ ...first, rev: 2, files: { ...first.files, "final/talk.srt": 4 } }));
    writeFileSync(join(found.folder, "final", "Talk (Case Conflict).srt"), "<B, longer/>");
    return (async () => {
      const r = await keep(t.ctx.deps, "B");
      assert.deepEqual([r.code, r.text], [0, "Kept B of final/talk.srt. The other is set aside in history/."]);
      assert.equal(readEpisode(found.folder).record.files["final/talk.srt"], 12);
      assert.equal((await on(t.ctx.deps, "open", FOLDER)).code, 0);
      t.done();
    })();
  });
  it("forgets what it showed once it keeps a side, or finds no conflict, so a new copy of the same name is shown first", async () => {
    const t = setup();
    const found = timelineConflict(t);
    assert.equal((await keep(t.ctx.deps, "B")).code, 0);
    t.ctx.deps.now = () => Date.parse("2026-10-20T15:05:00-05:00");
    writeFileSync(join(found.folder, TIMELINE_COPY), "<fcpxml>C, never shown</fcpxml>\n");
    const r = await on(t.ctx.deps, "resolve", FOLDER, "--keep", "B");
    assert.equal(r.code, 1);
    assert.match(r.text, /^That is not the version shown last/);
    t.done();
  });
});
