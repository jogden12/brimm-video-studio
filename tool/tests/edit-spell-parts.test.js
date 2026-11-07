// `spell` and what it says is still old, by how each part was made (found on 2 November 2026, checking her guide; the fix pass of the same day).
// After a finish `spell` said "until it is shown in Final Cut, Shared and finished again" of every part, though a part made from a
// HyperFrames export is changed by exporting it again from HyperFrames and saying "hand it off". Each part is told by how the record says it
// was made:
// - `project` is a part made from a HyperFrames export (finish.js writes it on those, and `export` or `noHandEdits` on a part taken
//   from Final Cut), the main video of a raw video or of an iPhone clip edited in the app, or a raw video's Reel. The captions drawn into its
//   picture are not changed by a spelling (architecture 4.8: it is not pushed into a project), so she is told to ask the assistant in
//   HyperFrames to fix them, then export and hand it off; its final transcripts are made again with the spellings by the next export;
// - `export` or `noHandEdits` is a part made through Final Cut, in the words it always had;
// - `import` on the main part is a video her editor finished, or an iPhone clip handed off as it is: `spell` makes its hand-off again
//   from the import's captions each time (finishFinished), so its main video keeps nothing and none is named. Its Reels are HyperFrames',
//   and are told as a raw video's are, but for the words that hand them off ("hand off the Reels"), except a Reel whose captions keep a
//   spelling, whom finish-reels.js keepOldWords tells.
// The first part of the message goes by the episode too: an episode edited in HyperFrames (finishWay says "hyperframes") and never shown in
// Final Cut (no push, a rendered rough cut is none) is not sent to Final Cut, nor told "in every timeline's captions".
// A Reel project that no finish has taken yet (the record's `finished.parts` has no part for its key) is told once, after every sentence about
// parts, at the end of the line that says the spelling was saved (2 November 2026; architecture 4.8: a spelling is not pushed into a project):
// "Reel 3 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then
// export it." ("Reel 1 and Reel 3 are not handed off yet. If they show …, … then export each.") "Then export it" is right whether or not she has
// exported the Reel already, as she may have when she sees a misspelling: the export she has keeps the old spelling in its captions. It is not
// said where the reply asks the assistant to fix any caption already drawn, which covers every project; where a finished video's hand-off comes
// out as it was; where no spelling changed (an answer to Claude's offers that applies none); and where nothing is saved (a refusal, a hand-off
// that could not be written).
// Every test runs through `edit.js spell`, in the made-up worlds of the other tests, with stand-ins for ffprobe, ffmpeg, the transcriber
// and open; each text is written out in full. The records of a finish that took parts both ways, of parts that say nothing of how they were
// made, and of an episode shown in Final Cut, are a real one with its entries changed, as the other way of working would leave them.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KEPT } from "../app.js";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { recordFile, recordText } from "../episode.js";
import { PIN } from "../hyperframes.js";
import { episodeWork, writeSettings } from "../settings.js";
import { EDITED, EXPORTED, FOLDER, PROJECT, askedFor, episodeFor, reread, setup } from "./episodes.js";
import { EPISODE } from "./phase4.js";
import { AT, READING, REEL1, SPELLINGS, entry, exportOf, fw, world } from "./exports-world.js";
import { HANDOFF_REL, finishedWorld } from "./reels-world.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
const text = (found, rel) => readFileSync(join(found.folder, rel), "utf8");
/** The final captions of a part of an export, by its key: the file of its video with `.srt` for its ending. */
const srtOf = (found, key) => reread(found).finished.parts[key].file.replace(/\.mp4$/, ".srt");

/** The made-up raw video of exports-world.js with Reel 1 made too, from times she gave, and both Reels picked. */
const THREE = () => ({
  app: { toolchain: PIN.version, projects: [entry("main"), entry("reel 1", { fromSuggestion: null }), entry("reel 2")] },
  reels: [{ ...EPISODE.record.reels[0], status: "picked" }, EPISODE.record.reels[1]]
});
/** A raw video with a project for each of `keys` and an export of each, not yet finished. */
function rawExported(keys = ["main", "reel 2"]) {
  const w = fw({ projects: keys, ...(keys.includes("reel 1") ? { over: THREE() } : {}) });
  for (const key of keys) exportOf(w, key);
  return w;
}
/** A raw video finished from HyperFrames' exports of `keys`: every part is HyperFrames', as finish leaves it. */
async function rawFinished(keys = ["main", "reel 2"]) {
  const w = rawExported(keys);
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
  const found = { ...w.found, record: reread(w.found) };
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { ...w, found };
}
/** An iPhone clip, answered, whose spellings are answered, with its main project opened in HyperFrames and exported. */
function clipExported() {
  const w = world({
    kind: "short video",
    projects: ["main"],
    over: { version: 4, reels: [], offers: { spellings: SPELLINGS, answered: { reading: READING.at, at: AT, on: "Mac Studio", applied: ["Ogdin"], left: ["pricing"] } }, reading: READING, spellings: [["Ogdin", "Ogden"]], app: { toolchain: PIN.version, projects: [entry("main")] } }
  });
  exportOf(w, "main");
  return w;
}
/** The same clip finished from its export. */
async function clipFinished() {
  const w = clipExported();
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
  const found = { ...w.found, record: reread(w.found) };
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { ...w, found };
}
/** The made-up edit as a finish of the Final Cut days left it: the record says each part was made through Final Cut (an `export` for the main
    video and Reel 1, "no hand edits" for Reel 2). Nothing finishes that way now, so the made-up edit is finished from exports in Downloads
    (as finish.test.js does) and its record is then written as the old finish wrote it: no project in any part. */
async function finalCutFinished() {
  const t = setup();
  const given = episodeFor(t, { record: EDITED });
  for (const name of Object.values(EXPORTED)) t.exported(name, 2000);
  const result = await finishNow(t.ctx, askedFor(t, given));
  assert.equal(result.ok, true, result.failed.join(" "));
  const found = { ...given, record: reread(given) };
  remake(found, (parts) => Object.fromEntries(Object.entries(parts).map(([key, { project: _project, ...part }]) => [key, key === "reel 2" ? { ...part, noHandEdits: true } : { ...part, export: `final/${PROJECT[key]}.fcpxmld` }])));
  return { t, found: { ...found, record: reread(given) } };
}
/** A video her editor finished, its Reels `projects` made in HyperFrames and handed off by `finish … reels`, and a project made as well for each of
    `left`, which that hand-off leaves out, as it does a Reel that is not exported yet. The record lists the projects in the order given. */
async function reelsFinished(projects = ["reel 2"], left = []) {
  const w = await finishedWorld({ projects: [...projects, ...left] });
  for (const key of projects) exportOf(w, key);
  if (projects.length) {
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true, ...(left.length ? { without: left } : {}) }), 0, w.t.said());
    const result = await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) });
    assert.equal(result.ok, true, result.failed.join(" "));
  }
  return { ...w, found: { ...w.found, record: reread(w.found) } };
}
/** The record written again with `change` laid over what it was, as a command of her chat would leave it. */
function rewrite(found, change) {
  const now = reread(found);
  writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, ...change(now) }));
}
/** The record written again with its parts changed, as one made by another way of finishing would leave them. */
const remake = (found, change) => rewrite(found, (now) => ({ finished: { ...now.finished, parts: change(now.finished.parts) } }));
/** The main video shown in Final Cut once: a push, as `push` records one. */
const shownInFinalCut = (found) => rewrite(found, (now) => ({ main: { ...now.main, pushed: [...(now.main.pushed || []), { v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project: PROJECT.main }] } }));
/** The import's rough cut, rendered and not shown in Final Cut: the version 0 a reading lists. */
const roughCut = (found) => rewrite(found, (now) => ({ main: { ...now.main, pushed: [...(now.main.pushed || []), { v: 0, how: "render", at: AT, on: "Mac Studio", file: "renders/main.v0.mp4", opened: AT }] } }));
/** What the record says of how each part was made. */
const madeOf = (found) => Object.fromEntries(Object.entries(reread(found).finished.parts).map(([key, part]) => [key, ["project", "export", "noHandEdits", "import"].filter((fact) => fact in part)]));
/** A raw video finished from HyperFrames' exports of `keys`, with a project made for each of `left` as well and left out of that finish, as
    a Reel that is not exported yet is. */
async function rawLeaving(keys = ["main", "reel 2"], left = ["reel 3"]) {
  const all = [...keys, ...left];
  const w = fw({ projects: all, over: { app: { toolchain: PIN.version, projects: all.map((key) => entry(key, key === "reel 3" ? { fromSuggestion: null } : {})) } } });
  for (const key of keys) exportOf(w, key);
  assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true, ...(left.length ? { without: left } : {}) }), 0, w.t.said());
  const found = { ...w.found, record: reread(w.found) };
  const result = await finishNow(w.t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { ...w, found };
}
/** The record written again with a project added to the app's for each of `keys`, opened and never exported: a Reel `app … reel N` made, which
    no finish has taken. `over` changes what each project says (its state, for one kept for an earlier kind). */
const addReelProjects = (found, keys, over = {}) => rewrite(found, (now) => ({ app: { toolchain: PIN.version, ...now.app, projects: [...(now.app?.projects ?? []), ...keys.map((key) => entry(key, { fromSuggestion: null, name: `Pricing talk ${key}`, ...over }))] } }));
/** A video her editor finished and Claude has read, offering "Sallie" as "Sally": its offers are not answered, its hand-off is not written, and
    it has a project for Reel 2 made in HyperFrames. `handoffVersion` is the version this Mac hands off. */
const offered = (handoffVersion = 2) => finishedWorld({ projects: ["reel 2"], handoff: false, handoffVersion, over: { reading: { ...READING, kind: "finished" }, offers: { spellings: [{ heard: "Sallie", spelled: "Sally", why: "It is her name." }] } } });
/** This Mac set to hand off `version` of the hand-off. */
function hands(w, version) {
  writeSettings(w.t.home, { handoffVersion: version });
  w.t.ctx.settings = { ...w.t.ctx.settings, handoffVersion: version };
}

describe("spell, after a finish: the record says how each part was made", () => {
  it("says project for a part made from a HyperFrames export, export or noHandEdits for a part taken from Final Cut, and import for a finished video's main part", async () => {
    const raw = await rawFinished();
    assert.deepEqual(madeOf(raw.found), { main: ["project"], "reel 2": ["project"] });
    raw.t.done();
    const clip = await clipFinished();
    assert.deepEqual(madeOf(clip.found), { main: ["project"] });
    clip.t.done();
    const fc = await finalCutFinished();
    assert.deepEqual(madeOf(fc.found), { main: ["export"], "reel 1": ["export"], "reel 2": ["noHandEdits"] });
    fc.t.done();
    const finished = await reelsFinished();
    assert.deepEqual(madeOf(finished.found), { main: ["noHandEdits", "import"], "reel 2": ["project"] });
    finished.t.done();
  });
});

describe("spell, after a finish of a raw video edited in HyperFrames", () => {
  it("says the captions on screen of a Reel keep the old spelling, to ask the assistant to fix them, then export it again and hand it off, and names no wide main video", async () => {
    const w = await rawFinished();
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand it off".');
    for (const key of ["main", "reel 2"]) assert.match(text(w.found, srtOf(w.found, key)), /much, Sally\./);
    w.t.done();
  });
  it("says the final transcripts of the parts that keep a spelling taken back keep it until each is exported again from HyperFrames and handed off, and to ask the assistant about the captions drawn", async () => {
    const w = await rawFinished();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const before = text(w.found, srtOf(w.found, "main"));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is as the transcriber writes it again. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally" until you export each again from HyperFrames and say "hand it off".');
    assert.equal(text(w.found, srtOf(w.found, "main")), before, "they are as they were");
    w.t.done();
  });
  it("says it of a spelling changed, too", async () => {
    const w = await rawFinished();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).code, 0);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Salli");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Salli" now. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally" until you export each again from HyperFrames and say "hand it off".');
    w.t.done();
  });
  it("names only the parts that keep the spelling", async () => {
    const w = await rawFinished();
    // "Welcome" is in the main video's words and not in Reel 2's.
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Welcome", "Hello")).code, 0);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Welcome");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Welcome" is as the transcriber writes it again. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video keep "Welcome" as "Hello" until you export it again from HyperFrames and say "hand it off".');
    w.t.done();
  });
  it("says both, the captions on screen first, when a spelling changes the final transcripts and another is kept, and asks the assistant once", async () => {
    const w = await rawFinished();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Welcome", "Hello")).code, 0);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Welcome", "Hallo", "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, 'Spelled now: "Welcome" as "Hallo" and "Sallie" as "Sally". The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand it off". The final transcripts of the main video keep "Welcome" as "Hello" until you export it again from HyperFrames and say "hand it off".');
    w.t.done();
  });
  it("says it after the words that tell the final transcripts do not have the word", async () => {
    const w = await rawFinished();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie")).code, 0);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Hormozy" is spelled "Hormozi" now. The final transcripts do not have "Hormozy", so they are as they were. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally" until you export each again from HyperFrames and say "hand it off".');
    w.t.done();
  });
  it("names the Reels together, and still no wide main video", async () => {
    const w = await rawFinished(["main", "reel 1", "reel 2"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 1 and Reel 2 show captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export each again and say "hand it off".');
    w.t.done();
  });
  it("asks the assistant about any caption already drawn when no part is named for captions on screen: a wide main video alone has none to name", async () => {
    const w = await rawFinished(["main"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
});

describe("spell, on a raw video edited in HyperFrames and not finished yet", () => {
  it("does not send her to Final Cut, nor say every timeline's captions: the final transcripts take the spellings when she hands it off, and the assistant fixes any caption already drawn", async () => {
    const w = rawExported();
    const add = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"Sallie" is spelled "Sally" now. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    const several = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Welcome", "Hello", "add", "talk", "chat");
    assert.equal(several.code, 0, several.text);
    assert.equal(several.text, 'Spelled now: "Welcome" as "Hello" and "talk" as "chat". The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
  it("is edited in the app though its rough cut is rendered: a version 0 rendered is not a push to Final Cut", async () => {
    const w = rawExported();
    roughCut(w.found);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
  it("is edited in the app too when its main video was shown in Final Cut once: the same words, and nothing of Final Cut", async () => {
    const w = rawExported();
    shownInFinalCut(w.found);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
  it("says the plain words for a raw video with a project for a Reel alone, and names that Reel: the record does not say the video is edited in the app", async () => {
    const w = fw({ projects: ["reel 2"] });
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. Reel 2 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    w.t.done();
  });
  it("says the plain words for a raw video with no project at all", async () => {
    const w = fw({ projects: [] });
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now.');
    w.t.done();
  });
});

describe("spell, on an iPhone clip edited in HyperFrames", () => {
  it("does not say every caption before it is finished: the final transcripts take the spellings when she hands it off, and the assistant fixes any caption already drawn", async () => {
    const w = clipExported();
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "pricing", "Pricing");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"pricing" is spelled "Pricing" now. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
  it("says the captions on screen of its main video keep the old spelling, to ask the assistant to fix them, then export it again and hand it off", async () => {
    const w = await clipFinished();
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If the main video shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand it off".');
    w.t.done();
  });
  it("says its final transcripts keep a spelling taken back until it is exported again from HyperFrames and handed off", async () => {
    const w = await clipFinished();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is as the transcriber writes it again. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video keep "Sallie" as "Sally" until you export it again from HyperFrames and say "hand it off".');
    w.t.done();
  });
});

describe("spell, after a finish of a video her editor finished", () => {
  it("names no part, in captions on screen or in the final transcripts, and says nothing of Final Cut, for its main video is made again from the import's captions each time", async () => {
    const w = await reelsFinished([]);
    const add = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again.');
    assert.match(text(w.found, "final/Pricing talk.srt"), /much, Sally\./);
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again.');
    assert.match(text(w.found, "final/Pricing talk.srt"), /much, Sallie\./, "nothing of the taken-back spelling is kept in its final transcripts");
    w.t.done();
  });
  it("says the captions on screen of a Reel keep the old spelling, to ask the assistant to fix them, then export it again and hand off the Reels", async () => {
    const w = await reelsFinished();
    const add = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels".');
    assert.match(text(w.found, "final/Pricing talk.srt"), /much, Sally\./);
    w.t.done();
  });
  it("says a Reel whose captions keep a spelling once, in keepOldWords' words, and not again as captions on screen; its main video does not keep it", async () => {
    const w = await reelsFinished();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. The final transcripts are spelled so too, and the hand-off is made again as revision 4: drop it on the BRIMM Ops page again.\nReel 2\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".');
    assert.match(text(w.found, "final/Pricing talk.srt"), /much, Sallie\./, "its main video does not");
    w.t.done();
  });
  it("says the captions on screen of the Reels the spelling reached, and keepOldWords of a Reel whose captions it could not reach, so that no Reel is told twice", async () => {
    const w = await reelsFinished(["reel 1", "reel 2"]);
    // Reel 1's word times are gone: a spelling cannot be put into its captions.
    rmSync(join(w.found.folder, reread(w.found).finished.parts["reel 1"].words));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels".\nReel 1\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".');
    w.t.done();
  });
  it("names the Reels together when the spelling reached both", async () => {
    const w = await reelsFinished(["reel 1", "reel 2"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 1 and Reel 2 show captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export each again and say "hand off the Reels".');
    w.t.done();
  });
  it("names no Reel when the spelling is not one it holds or has: a word it never had is taken back, and the hand-off comes out as it was", async () => {
    const w = await reelsFinished();
    const same = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi");
    assert.equal(same.code, 0, same.text);
    assert.equal(same.text, '"Hormozy" is spelled "Hormozi" now. The final transcripts and the hand-off are as they were.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Hormozy");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Hormozy" is as the transcriber writes it again. The final transcripts and the hand-off are as they were.');
    w.t.done();
  });
});

// --- A Reel project that no finish has taken yet: its key has no part in `finished.parts` ---

describe("spell, with a Reel project that is not handed off yet: a video her editor finished", () => {
  it("names it once, at the end of the line that says the hand-off is made again, after the Reel the spelling reached", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    assert.deepEqual(Object.keys(reread(w.found).finished.parts), ["main", "reel 2"]);
    assert.deepEqual(reread(w.found).app.projects.map((p) => p.key), ["reel 2", "reel 3"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels". Reel 3 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    assert.match(text(w.found, "final/Pricing talk.srt"), /much, Sally\./);
    w.t.done();
  });
  it("says the same of a Reel she has exported already: \"then export it\" is right when the export she has keeps the old spelling in its captions", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    // Reel 3 is exported, and its export is in Downloads as `finish` would find it, but no finish has taken it: it is not handed off.
    const reel = exportOf(w, "reel 3", { start: [14, 20, 0] });
    const rev = reread(w.found).rev;
    const before = w.t.said();
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true }), 0, w.t.said());
    assert.ok(w.t.said().slice(before.length).includes(`Reel 3: ${reel.name}, from Downloads, exported 2026-10-20 14:20.`), w.t.said());
    assert.deepEqual([Object.keys(reread(w.found).finished.parts), reread(w.found).rev], [["main", "reel 2"], rev], "finish only looked: Reel 3 is not handed off");
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels". Reel 3 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    w.t.done();
  });
  it("names several together, in the order of their numbers and not of the record, in the plural words", async () => {
    // The record lists Reel 3's project before Reel 1's.
    const w = await reelsFinished(["reel 2"], ["reel 3", "reel 1"]);
    assert.deepEqual(reread(w.found).app.projects.map((p) => p.key), ["reel 2", "reel 3", "reel 1"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels". Reel 1 and Reel 3 are not handed off yet. If they show captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export each.');
    w.t.done();
  });
  it("orders the numbers as numbers, Reel 9 before Reel 10, and joins three with a comma and an and", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    addReelProjects(w.found, ["reel 10", "reel 9"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels". Reel 3, Reel 9 and Reel 10 are not handed off yet. If they show captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export each.');
    w.t.done();
  });
  it("names it after a drop too, in front of the line for a Reel whose captions keep the spelling, so that no Reel is told twice", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. The final transcripts are spelled so too, and the hand-off is made again as revision 4: drop it on the BRIMM Ops page again. Reel 3 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.\nReel 2\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".');
    w.t.done();
  });
  it("says nothing of it when the hand-off comes out as it was: its Reels are cut from the import, whose captions do not have the word", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    const add = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"Hormozy" is spelled "Hormozi" now. The final transcripts and the hand-off are as they were.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Hormozy");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Hormozy" is as the transcriber writes it again. The final transcripts and the hand-off are as they were.');
    w.t.done();
  });
  it("names it where the hand-off waits for the video's new reading: it was answered as another kind since", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    rewrite(w.found, (now) => ({ kind: "raw", answer: { ...now.answer, at: "2026-10-21T10:00:00-05:00" } }));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, 'Pricing: what to charge?: spelled. Its hand-off waits for its new reading. Reel 3 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    w.t.done();
  });
  it("never names a project kept for an earlier kind, and names a Reel project that is not", async () => {
    const w = await reelsFinished(["reel 2"]);
    addReelProjects(w.found, ["reel 3"], { state: KEPT });
    const kept = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(kept.code, 0, kept.text);
    assert.equal(kept.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels".');
    addReelProjects(w.found, ["reel 1"]);
    const both = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(both.code, 0, both.text);
    assert.equal(both.text, '"Sallie" is as the transcriber writes it again. The final transcripts are spelled so too, and the hand-off is made again as revision 4: drop it on the BRIMM Ops page again. Reel 1 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.\nReel 2\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".');
    w.t.done();
  });
});

describe("spell, with the project of a Reel she dropped", () => {
  it("never names it: a Reel dropped after its project was made is no part of a finish, and nothing waits for it", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    rewrite(w.found, (now) => ({ reels: now.reels.map((reel) => (reel.n === 3 ? { ...reel, status: "dropped" } : reel)) }));
    assert.deepEqual(reread(w.found).reels.filter((reel) => reel.status === "dropped").map((reel) => reel.n), [3]);
    assert.ok(reread(w.found).app.projects.some((project) => project.key === "reel 3"), "its project is still in the record");
    const dropped = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(dropped.code, 0, dropped.text);
    assert.equal(dropped.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels".');
    addReelProjects(w.found, ["reel 1"]);
    const both = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(both.code, 0, both.text);
    assert.equal(both.text, '"Sallie" is as the transcriber writes it again. The final transcripts are spelled so too, and the hand-off is made again as revision 4: drop it on the BRIMM Ops page again. Reel 1 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.\nReel 2\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".');
    w.t.done();
  });
});

describe("spell, with a Reel project that is not handed off yet: a video her editor finished, before its hand-off is written", () => {
  it("names it at the end of the answer to Claude's offers, which writes the first hand-off", async () => {
    const w = await offered();
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, 'Spelled now: "Sallie" as "Sally". The hand-off is written as revision 1 and shown in Finder: drop it on the BRIMM Ops page. Reel 2 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    assert.equal(reread(w.found).finished.revision, 1);
    w.t.done();
  });
  it("names none for an answer that applies no spelling: no caption keeps an old one", async () => {
    const w = await offered();
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "offers", "none");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, "No spelling applied. The hand-off is written as revision 1 and shown in Finder: drop it on the BRIMM Ops page.");
    assert.equal(reread(w.found).finished.revision, 1);
    w.t.done();
  });
  it("names none where the answer was given before and only the hand-off is written now: no spelling changes", async () => {
    const w = await offered(1);
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "offers", "all")).code, 0);
    hands(w, 2);
    const again = await on(w.t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.equal(again.code, 0, again.text);
    assert.equal(again.text, "The spellings Claude offered for Pricing: what to charge? were answered already. The hand-off is written as revision 1 and shown in Finder: drop it on the BRIMM Ops page.");
    assert.equal(reread(w.found).finished.revision, 1);
    w.t.done();
  });
  it("names it where the hand-off waits for this Mac to hand off version 2, and where the first one is written once it does", async () => {
    const w = await offered(1);
    const answer = await on(w.t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.equal(answer.code, 0, answer.text);
    assert.equal(answer.text, 'Spelled now: "Sallie" as "Sally". The hand-off is written once this Mac hands off version 2: ask Jason. Reel 2 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    const add = await on(w.t.ctx.deps, "spell", FOLDER, "add", "talk", "chat");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"talk" is spelled "chat" now. The hand-off is written once this Mac hands off version 2: ask Jason. Reel 2 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    assert.equal(reread(w.found).finished, null, "nothing is written in final/ yet");
    hands(w, 2);
    const first = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Ogden", "Ogdin");
    assert.equal(first.code, 0, first.text);
    assert.equal(first.text, '"Ogden" is spelled "Ogdin" now. The hand-off is written as revision 1 and shown in Finder: drop it on the BRIMM Ops page. Reel 2 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    w.t.done();
  });
});

describe("spell, with a Reel project that is not handed off yet, when nothing is saved", () => {
  it("says nothing of it in a refusal, writes nothing, and says the refusal as it always did", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    const rev = reread(w.found).rev;
    const odd = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie Ogden", "Sally");
    assert.deepEqual([odd.code, odd.text], [1, '"Sallie Ogden" is not one word. Say the one word as the transcriber writes it.']);
    const none = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Zed");
    assert.deepEqual([none.code, none.text], [1, 'There is no spelling of "Zed".']);
    assert.deepEqual([reread(w.found).rev, reread(w.found).spellings ?? []], [rev, []]);
    w.t.done();
  });
  it("says nothing of it while a finish runs, for an add and a drop", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const rev = reread(w.found).rev;
    mkdirSync(episodeWork(w.t.home, FOLDER), { recursive: true });
    writeFileSync(join(episodeWork(w.t.home, FOLDER), "episode.lock"), JSON.stringify({ pid: 4242, command: "finish" }));
    for (const ask of [["add", "much", "much indeed"], ["drop", "Sallie"]]) {
      const r = await on({ ...w.t.ctx.deps, alive: (pid) => pid === 4242 }, "spell", FOLDER, ...ask);
      assert.deepEqual([r.code, r.text], [1, 'finish is running for this episode. Say "how far is it?", and try again when it is done.'], ask[0]);
    }
    assert.deepEqual([reread(w.found).rev, reread(w.found).spellings], [rev, [["Sallie", "Sally"]]]);
    w.t.done();
  });
  it("says nothing of it while Dropbox is still bringing the hand-off over", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    const rev = reread(w.found).rev;
    w.t.ctx.deps.isWhole = (path) => !path.endsWith(".brimm-ops.json");
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.text], [1, "Dropbox is still bringing the hand-off over: say it again in a minute."]);
    assert.deepEqual([reread(w.found).rev, reread(w.found).spellings ?? []], [rev, []]);
    w.t.done();
  });
  it("says nothing of it when the hand-off could not be written: it is gone, and it holds a Reel a new one would leave out", async () => {
    const w = await reelsFinished(["reel 2"], ["reel 3"]);
    const rev = reread(w.found).rev;
    rmSync(join(w.found.folder, HANDOFF_REL));
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.deepEqual([r.code, r.text], [1, "Pricing: what to charge?'s hand-off is not there or cannot be read, so a new one would leave out the Reels it holds. Nothing was written. Ask Jason."]);
    assert.deepEqual([reread(w.found).rev, reread(w.found).spellings ?? []], [rev, []]);
    w.t.done();
  });
});

describe("spell, with a Reel project that is not handed off yet: a raw video", () => {
  it("names none of them before its first finish when it is edited in HyperFrames: the sentence that asks the assistant to fix any caption already drawn covers every project", async () => {
    const w = rawExported(["main", "reel 1", "reel 2"]);
    const add = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"Sallie" is spelled "Sally" now. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. The final transcripts take the spellings when you hand it off. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
  it("names it at the end of the answer to Claude's offers, after the words that say its hand-off is made when it is finished", async () => {
    const w = fw({ projects: ["reel 2"], over: { reading: { ...READING, kind: "raw" }, offers: { spellings: [{ heard: "Sallie", spelled: "Sally", why: "It is her name." }] } } });
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "offers", "all");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, 'Spelled now: "Sallie" as "Sally". Its hand-off is made when it is finished. Reel 2 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    w.t.done();
  });
  it("names a Reel it has not finished, after the Reel the spelling reached, once it is finished from HyperFrames' exports", async () => {
    const w = await rawLeaving();
    assert.deepEqual(Object.keys(reread(w.found).finished.parts), ["main", "reel 2"]);
    assert.deepEqual(reread(w.found).app.projects.map((p) => p.key), ["main", "reel 2", "reel 3"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand it off". Reel 3 is not handed off yet. If it shows captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export it.');
    w.t.done();
  });
  it("does not name it where the reply asks the assistant to fix any caption already drawn: after a drop, and where the final transcripts do not have the word", async () => {
    const w = await rawLeaving();
    assert.equal((await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally" until you export each again from HyperFrames and say "hand it off".');
    const absent = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi");
    assert.equal(absent.code, 0, absent.text);
    assert.equal(absent.text, '"Hormozy" is spelled "Hormozi" now. The final transcripts do not have "Hormozy", so they are as they were. Ask the assistant in HyperFrames to fix any caption already drawn. The final transcripts of the main video and Reel 2 keep "Sallie" as "Sally" until you export each again from HyperFrames and say "hand it off".');
    w.t.done();
  });
  it("does not name it either where only a wide main video was finished from HyperFrames: no part is named for captions on screen, and the assistant sentence is said", async () => {
    const w = await rawLeaving(["main"], ["reel 3"]);
    assert.deepEqual(Object.keys(reread(w.found).finished.parts), ["main"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. Ask the assistant in HyperFrames to fix any caption already drawn.');
    w.t.done();
  });
});
