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
// Every test runs through `edit.js spell`, in the made-up worlds of the other tests, with stand-ins for ffprobe, ffmpeg, the transcriber
// and open; each text is written out in full. The records of a finish that took parts both ways, of parts that say nothing of how they were
// made, and of an episode shown in Final Cut, are a real one with its entries changed, as the other way of working would leave them.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { recordFile, recordText } from "../episode.js";
import { PIN } from "../hyperframes.js";
import { EDITED, FOLDER, PROJECT, episodeFor, reread, setup } from "./episodes.js";
import { EPISODE } from "./phase4.js";
import { AT, READING, REEL1, SPELLINGS, entry, exportOf, fw, world } from "./exports-world.js";
import { finishedWorld } from "./reels-world.js";

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
/** The made-up edit finished through Final Cut, as finish.test.js finishes it: Shared and exported, Reel 2 with no hand edits. */
async function finalCutFinished() {
  const t = setup();
  const given = episodeFor(t, { record: EDITED });
  t.shared(`${PROJECT.main}.mp4`, 2000);
  t.shared(`${PROJECT.main}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 1"]}.mov`, 2000);
  t.shared(`${PROJECT["reel 1"]}.fcpxmld`, 3000);
  t.shared(`${PROJECT["reel 2"]}.mov`, 2000);
  assert.equal(await finishEpisode(t.ctx, given, { yes: true, noHandEdits: ["reel 2"] }), 0);
  const found = { ...given, record: reread(given) };
  const result = await finishNow(t.ctx, found);
  assert.equal(result.ok, true, result.failed.join(" "));
  return { t, found };
}
/** A video her editor finished, its Reels `projects` made in HyperFrames and handed off by `finish … reels`. */
async function reelsFinished(projects = ["reel 2"]) {
  const w = await finishedWorld({ projects });
  for (const key of projects) exportOf(w, key);
  if (projects.length) {
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
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
  it("keeps Final Cut's words for the same video once the main video was shown in Final Cut", async () => {
    const w = rawExported();
    shownInFinalCut(w.found);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. Say "show it in Final Cut" to see it.');
    w.t.done();
  });
  it("keeps Final Cut's words for a raw video with a project for a Reel alone: the record does not say the video is edited in the app", async () => {
    const w = fw({ projects: ["reel 2"] });
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it.');
    w.t.done();
  });
  it("keeps Final Cut's words for a raw video with no project at all", async () => {
    const w = fw({ projects: [] });
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it.');
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
    assert.equal(add.text, '"Sallie" is spelled "Sally" now, in every caption. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again.');
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
    assert.equal(add.text, '"Sallie" is spelled "Sally" now, in every caption. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels".');
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
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every caption. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 2 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand off the Reels".\nReel 1\'s captions keep the old spelling until you export it again from HyperFrames and say "hand off the Reels".');
    w.t.done();
  });
  it("names the Reels together when the spelling reached both", async () => {
    const w = await reelsFinished(["reel 1", "reel 2"]);
    const r = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every caption. The final transcripts are spelled so too, and the hand-off is made again as revision 3: drop it on the BRIMM Ops page again. If Reel 1 and Reel 2 show captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export each again and say "hand off the Reels".');
    w.t.done();
  });
  it("names no Reel when the spelling is not one it holds or has: a word it never had is taken back, and the hand-off comes out as it was", async () => {
    const w = await reelsFinished();
    const same = await on(w.t.ctx.deps, "spell", FOLDER, "add", "Hormozy", "Hormozi");
    assert.equal(same.code, 0, same.text);
    assert.equal(same.text, '"Hormozy" is spelled "Hormozi" now, in every caption. The final transcripts and the hand-off are as they were.');
    const drop = await on(w.t.ctx.deps, "spell", FOLDER, "drop", "Hormozy");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Hormozy" is as the transcriber writes it again. The final transcripts and the hand-off are as they were.');
    w.t.done();
  });
});

describe("spell, after a finish through Final Cut", () => {
  it("keeps the words it always had: each part is shown in Final Cut, Shared and finished again", async () => {
    const { t } = await finalCutFinished();
    const add = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(add.code, 0, add.text);
    assert.equal(add.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 1 and Reel 2 show captions on screen, they keep the old spelling until each is shown in Final Cut, Shared and finished again.');
    const drop = await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.code, 0, drop.text);
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. Say "show it in Final Cut" to see it. The final transcripts keep "Sallie" as "Sally" until each part is shown in Final Cut, Shared and finished again.');
    t.done();
  });
  it("tells a part whose entry holds none of project, export, no hand edits or import in those words too, as every part was told before", async () => {
    const { t, found } = await finalCutFinished();
    remake(found, (parts) => Object.fromEntries(Object.entries(parts).map(([key, { export: _export, noHandEdits: _no, ...rest }]) => [key, rest])));
    assert.deepEqual(madeOf(found), { main: [], "reel 1": [], "reel 2": [] });
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const drop = await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(drop.text, '"Sallie" is as the transcriber writes it again. Say "show it in Final Cut" to see it. The final transcripts keep "Sallie" as "Sally" until each part is shown in Final Cut, Shared and finished again.');
    t.done();
  });
});

describe("spell, after a finish that took parts both ways", () => {
  /** The made-up edit finished through Final Cut, with Reel 1 then made from a HyperFrames export: its part says its project. */
  async function mixed() {
    const made = await finalCutFinished();
    remake(made.found, (parts) => {
      const { v: _v, export: _export, ...reel } = parts["reel 1"];
      return { ...parts, "reel 1": { ...reel, project: REEL1 } };
    });
    assert.deepEqual(madeOf(made.found), { main: ["export"], "reel 1": ["project"], "reel 2": ["noHandEdits"] });
    return made;
  }
  it("says each Reel's captions on screen by the way it was made, the HyperFrames one first", async () => {
    const { t } = await mixed();
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"Sallie" is spelled "Sally" now, in every timeline\'s captions. Say "show it in Final Cut" to see it. The final transcripts are spelled so too, and the hand-off is made again as revision 2: drop it on the BRIMM Ops page again. If Reel 1 shows captions on screen, they keep the old spelling. Ask the assistant in HyperFrames to fix them, then export it again and say "hand it off". If Reel 2 shows captions on screen, they keep the old spelling until it is shown in Final Cut, Shared and finished again.');
    t.done();
  });
  it("says the final transcripts of the parts that keep a spelling by the way each was made, and not of a part that keeps none", async () => {
    const { t } = await mixed();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    const r = await on(t.ctx.deps, "spell", FOLDER, "drop", "Sallie");
    assert.equal(r.code, 0, r.text);
    // The main video (Final Cut's) and Reel 1 (HyperFrames') hold the spelling; Reel 2's words do not have it.
    assert.equal(r.text, '"Sallie" is as the transcriber writes it again. Say "show it in Final Cut" to see it. The final transcripts of Reel 1 keep "Sallie" as "Sally" until you export it again from HyperFrames and say "hand it off". Those of the main video keep "Sallie" as "Sally" until it is shown in Final Cut, Shared and finished again.');
    t.done();
  });
  it("says Final Cut's words of a part made there when the others, which keep none, were made in HyperFrames", async () => {
    const { t } = await mixed();
    // "talk" is in the main video's words (Final Cut's) alone: Reel 1 (HyperFrames') and Reel 2 do not have it.
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "talk", "chat")).code, 0);
    const r = await on(t.ctx.deps, "spell", FOLDER, "drop", "talk");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, '"talk" is as the transcriber writes it again. Say "show it in Final Cut" to see it. The final transcripts of the main video keep "talk" as "chat" until it is shown in Final Cut, Shared and finished again.');
    t.done();
  });
});
