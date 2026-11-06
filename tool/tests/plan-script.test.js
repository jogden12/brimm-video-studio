// `plan "<title>" script` (review changes R5): her script opens as a read-only copy in this Mac's work folder, so that a mark-up in TextEdit can never
// change the plan; changes come through the chat, which saves them with `plan … set`. A script file edited by hand is said in its own plain line, not
// as "Not right". No test runs a real program: TextEdit is the stand-in of tests/episodes.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain } from "../edit.js";
import { readEpisode } from "../episode.js";
import { teleprompterText } from "../sentences.js";
import { fileSafe } from "../names.js";
import { workFolder, episodeWork } from "../settings.js";
import { SHOWN_MARKER } from "../reveal.js";
import { scriptHandEdited } from "../plan-script.js";
import { localDay } from "../shared/text.js";
import { setup } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
const depsOf = (t, over = {}) => ({ ...t.ctx.deps, rand: () => 0.25, ...over });
const TITLE = "Too many SKUs";
const folderName = (t) => `${localDay(new Date(t.now()))} ${fileSafe(TITLE)} (Mac Studio)`;
const folderOf = (t) => join(t.root, "Episodes", folderName(t));
const recordOf = (t) => readEpisode(folderOf(t)).record;
const LINES = ["Most shops carry too many products.", "Cut half of them and watch what sells."];
/** A plan with its package saved. */
async function made(t) {
  assert.equal((await on(depsOf(t), "plan", "new", TITLE)).code, 0);
  const r = await on(depsOf(t), "plan", TITLE, "set", ...LINES.flatMap((line) => ["--line", line]));
  assert.equal(r.code, 0, r.text);
}
const shownDir = (t) => join(episodeWork(t.home, folderName(t)), "shown");
const copiesIn = (t) => readdirSync(shownDir(t)).filter((n) => n !== SHOWN_MARKER);
const COPY_SAID = `Opened the script for "${TITLE}" in TextEdit. It is a copy to read. To change it, tell me the change here.`;
const OUTSIDE = `The script file of "${TITLE}" was changed outside the chat. Tell me the changes you want and I will save them to the plan.`;

describe("plan … script", () => {
  it("makes a read-only copy in this Mac's work folder, opens it in TextEdit and says it is a copy to read", async () => {
    const t = setup();
    await made(t);
    const r = await on(depsOf(t), "plan", TITLE, "script");
    assert.deepEqual([r.code, r.said], [0, [COPY_SAID]]);
    const names = copiesIn(t);
    assert.equal(names.length, 1, names.join(", "));
    const copy = join(shownDir(t), names[0]);
    assert.ok(copy.startsWith(workFolder(t.home)), "the copy is in this Mac's work folder, never in Dropbox");
    assert.ok(!copy.startsWith(t.root));
    assert.equal(statSync(copy).mode & 0o777, 0o444);
    assert.deepEqual(t.opened[t.opened.length - 1], ["TextEdit", copy]);
    t.done();
  });
  it("holds exactly the plan's own teleprompter text, whatever the file in the plan's folder holds now", async () => {
    const t = setup();
    await made(t);
    appendFileSync(join(folderOf(t), "teleprompter.txt"), "A line she typed in TextEdit.\n");
    await on(depsOf(t), "plan", TITLE, "script");
    assert.equal(readFileSync(join(shownDir(t), copiesIn(t)[0]), "utf8"), teleprompterText(recordOf(t).planned.lines));
    t.done();
  });
  it("replaces the earlier copy when it is opened twice, and writes nothing into the plan's folder or its record", async () => {
    const t = setup();
    await made(t);
    const before = readdirSync(folderOf(t)).sort();
    const rev = recordOf(t).rev;
    await on(depsOf(t), "plan", TITLE, "script");
    const again = await on(depsOf(t), "plan", TITLE, "script");
    assert.deepEqual([again.code, again.said], [0, [COPY_SAID]]);
    assert.equal(copiesIn(t).length, 1);
    assert.deepEqual([readdirSync(folderOf(t)).sort(), recordOf(t).rev], [before, rev]);
    t.done();
  });
  it("says a plan not made yet has no script, in the words plan uses, and opens nothing", async () => {
    const t = setup();
    assert.equal((await on(depsOf(t), "plan", "new", TITLE)).code, 0);
    const r = await on(depsOf(t), "plan", TITLE, "script");
    assert.deepEqual([r.code, r.said, t.opened], [1, [`"${TITLE}" is planned, and its guide, its shot list and its teleprompter script aren't made yet.`], []]);
    t.done();
  });
  it("says a dropped plan was dropped, and a video that is no plan is none", async () => {
    const t = setup();
    await made(t);
    assert.equal((await on(depsOf(t), "plan", TITLE, "drop")).code, 0);
    const r = await on(depsOf(t), "plan", TITLE, "script");
    assert.deepEqual([r.code, r.said, t.opened], [1, [`The plan for "${TITLE}" was dropped.`], []]);
    t.done();
  });
  it("says so, naming no file, when TextEdit cannot be opened", async () => {
    const t = setup();
    await made(t);
    const r = await on(depsOf(t, { openApp: () => { throw new Error("TextEdit could not be opened (no such app)."); } }), "plan", TITLE, "script");
    assert.deepEqual([r.code, r.said], [1, [`"${TITLE}": TextEdit could not be opened (no such app).`]]);
    t.done();
  });
  it("takes no more words and no flag: anything else is the help", async () => {
    const t = setup();
    await made(t);
    for (const more of [["now"], ["--line", "x"]]) assert.equal((await on(depsOf(t), "plan", TITLE, "script", ...more)).code, 2, more.join(" "));
    t.done();
  });
});

describe("a script file changed by hand", () => {
  it("is said by episodes in its own plain line, and not as a file problem", async () => {
    const t = setup();
    await made(t);
    appendFileSync(join(folderOf(t), "teleprompter.txt"), "More.\n");
    const r = await on(depsOf(t), "episodes");
    assert.ok(r.said.includes(`    ${OUTSIDE}`), r.text);
    assert.doesNotMatch(r.text, /A file of this video/);
    t.done();
  });
  it("is told by scriptHandEdited, which is false for a file at its size and for a missing one", async () => {
    const t = setup();
    await made(t);
    const folder = folderOf(t);
    assert.equal(scriptHandEdited(folder, recordOf(t)), false);
    appendFileSync(join(folder, "teleprompter.txt"), "More.\n");
    assert.equal(scriptHandEdited(folder, recordOf(t)), true);
    writeFileSync(join(folder, "teleprompter.txt"), "");
    assert.equal(scriptHandEdited(folder, recordOf(t)), true, "a file made shorter is changed too");
    rmSync(join(folder, "teleprompter.txt"));
    assert.equal(scriptHandEdited(folder, recordOf(t)), false);
    const r = await on(depsOf(t), "episodes");
    assert.ok(r.said.includes("    A file of this video is missing: teleprompter.txt. Dropbox may still be bringing it. Wait a few minutes and ask again. If it is still missing, tell Jason."), r.text);
    assert.ok(!r.text.includes("changed outside the chat"));
    t.done();
  });
  it("leaves another file's problem as a file problem", async () => {
    const t = setup();
    await made(t);
    appendFileSync(join(folderOf(t), "teleprompter.txt"), "More.\n");
    appendFileSync(join(folderOf(t), "video guide.md"), "More.\n");
    const r = await on(depsOf(t), "episodes");
    assert.ok(r.said.includes(`    ${OUTSIDE}`));
    assert.equal(r.said.filter((l) => l.includes("A file of this video")).length, 1, r.text);
    assert.match(r.text, /A file of this video is not the one Studio saved: video guide\.md\./);
    t.done();
  });
});
