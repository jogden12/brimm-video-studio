// The guide and `episodes` say the import's line when the import cannot look (access-notice design, part 3, items 2 to 4; plan A5): the line
// under the drop folder's, a video this Mac's import cannot take is "blocked" with the step line instead of "arriving", and `guide wait`
// answers at once. The launch agent's pid and node are stand-ins; every Mac here is made up in a temp home.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { importingFolder } from "../settings.js";
import { writeStatusIn } from "../importing.js";
import { watched } from "./watched-fs.js";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { ASKING_MS, UNSEEN_MS, accessLine, placeWordsOf, stepLine, switchFor, writeAccess } from "../access.js";
import { AIRDROP, NOTHING_UNDER_WAY, dropWords } from "../guide.js";
import { dropFolderOf, downloadsFolder } from "../settings.js";
import { setup } from "./episodes.js";

const NODE = "/opt/homebrew/Cellar/node/25.0.0/bin/node";
const light = (t, over = {}) => ({ ...t.ctx.deps, settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, agentPid: () => null, agentNode: () => "", ...over });
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}
const dropOf = (t) => dropFolderOf(light(t).settings, t.home);
const place = (t, state, folder, extra = {}) => ({ state, code: state === "refused" ? "EPERM" : state === "locked" ? "EACCES" : state === "error" ? "EIO" : "", at: t.now(), since: t.now(), folder, node: NODE, ...(state === "ok" ? { okNode: NODE } : {}), ...extra });
const note = (t, places, more = {}) => writeAccess(t.home, { version: 1, places, looking: null, told: {}, ...more });
const words = (t) => `your drop folder, ${dropWords(light(t).settings, "Mac Studio", t.home)}`;
function video(t, name, text = "12345") {
  const file = join(dropOf(t), name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}
const BLOCKED = (line) => `  A video of 5 bytes: ${line}`;
const OTHER = (t) => {
  mkdirSync(join(t.root, "Drop", "Sallie's laptop"), { recursive: true });
  writeFileSync(join(t.root, "Drop", "Sallie's laptop", "Theirs.mov"), "123456789");
};

const ARRIVING = (size) => `  A video of ${size} bytes: It is coming into your drop folder. Wait for the "Ready" notice.`;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** The finding's cases: how the note and the agent stand, and the line it makes (the drop folder's, or Episodes'). */
const CASES = [
  ["refused (drop)", (t) => ({ places: { drop: place(t, "refused", dropOf(t)) } }), () => ({}), (t) => accessLine({ kind: "refused", place: "drop", code: "EPERM" }, { placeWords: words(t), switchName: switchFor(dropOf(t), t.home) })],
  ["locked (drop)", (t) => ({ places: { drop: place(t, "locked", dropOf(t)) } }), () => ({}), (t) => accessLine({ kind: "locked", place: "drop", code: "EACCES" }, { placeWords: words(t) })],
  ["error (drop)", (t) => ({ places: { drop: place(t, "error", dropOf(t)) } }), () => ({}), (t) => accessLine({ kind: "error", place: "drop", code: "EIO" }, { placeWords: words(t) })],
  ["asking (drop)", (t) => ({ places: {}, looking: { place: "drop", pid: 4242, at: t.now() - ASKING_MS - 1000 } }), () => ({ agentPid: () => 4242 }), (t) => accessLine({ kind: "asking", place: "drop" }, { placeWords: words(t) })],
  ["refused (Episodes alone)", (t) => ({ places: { drop: place(t, "ok", dropOf(t)), episodes: place(t, "refused", t.ctx.episodes) } }), () => ({}), (t) => accessLine({ kind: "refused", place: "episodes", code: "EPERM" }, { placeWords: placeWordsOf("episodes", t.ctx.episodes, t.home), switchName: switchFor(t.ctx.episodes, t.home) })]
];
const start = (t, make) => {
  const { places, looking } = make(t);
  note(t, places, looking ? { looking } : {});
};

describe("guide: the import's line and a blocked video", () => {
  for (const [name, make, more, lineOf] of CASES) {
    it(`${name}: the line under the drop folder's, this Mac's video has the line as its step, the other Mac's keeps its own`, async () => {
      const t = setup();
      video(t, "Mine.mov");
      OTHER(t);
      start(t, make);
      const line = lineOf(t);
      const r = await on(light(t, more(t)), "guide");
      assert.ok(r.said[0].startsWith("Your drop folder:"));
      assert.equal(r.said[1], line);
      assert.equal(r.said[2], "Under way:");
      assert.ok(r.said.includes(BLOCKED(line)), r.said.join("\n"));
      assert.ok(r.said.some((l) => l.includes("It is in the drop folder of Sallie's laptop")), r.said.join("\n"));
      t.done();
    });
    it(`${name}: with nothing under way the overview does not tell her to put a video in`, async () => {
      const t = setup();
      start(t, make);
      const r = await on(light(t, more(t)), "guide");
      assert.equal(r.said.length, 2, r.said.join("\n"));
      assert.equal(r.said[1], lineOf(t));
      t.done();
    });
    it(`${name}: guide wait answers at once`, async () => {
      const t = setup();
      video(t, "Mine.mov");
      start(t, make);
      const deps = light(t, more(t));
      const r = await on(deps, "guide");
      const waited = await on({ ...deps, wait: () => assert.fail("guide wait must answer at once") }, "guide", "wait");
      assert.deepEqual(waited.said, r.said);
      t.done();
    });
  }
  it("a blocked video of this Mac answers at once, but another Mac's arriving video is still waited for", async () => {
    const t = setup();
    video(t, "Mine.mov");
    OTHER(t);
    note(t, { drop: place(t, "refused", dropOf(t)) });
    let waits = 0;
    let clock = t.now();
    const deps = light(t, { now: () => clock, wait: async (ms) => { waits += 1; clock += ms; } });
    const r = await on(deps, "guide", "wait");
    assert.ok(waits > 0, "waited for the other Mac's video");
    assert.ok(r.said.includes("Nothing has changed in 120 seconds.") || r.said.some((l) => l.startsWith("Nothing has changed")), r.said.join("\n"));
    t.done();
  });
  it("unseen changes only the unseen video's step: one that is under three minutes old is still arriving", async () => {
    const t = setup();
    const old = video(t, "Old.mov", "12345");
    await sleep(60);
    const fresh = video(t, "Fresh.mov", "1234567");
    const a = statSync(old).ctimeMs;
    const b = statSync(fresh).ctimeMs;
    // `now` is between them: Old has waited a little over UNSEEN_MS, Fresh a little under.
    const deps = light(t, { now: () => (a + b) / 2 + UNSEEN_MS });
    const r = await on(deps, "guide");
    assert.equal(r.said[1], accessLine({ kind: "unseen", videos: ["Old.mov"] }));
    assert.ok(r.said[1].includes("1 video"), r.said[1]);
    assert.ok(r.said.includes(`  A video of 5 bytes: ${stepLine({ kind: "unseen", videos: ["Old.mov"] })}`), r.said.join("\n"));
    assert.ok(r.said.includes(ARRIVING(7)), r.said.join("\n"));
    t.done();
  });
  it("a new node says nothing in the guide and in episodes", async () => {
    const t = setup();
    video(t, "Mine.mov");
    note(t, { drop: place(t, "ok", dropOf(t)) });
    const deps = light(t, { agentNode: () => "/opt/homebrew/Cellar/node/25.1.0/bin/node" });
    const r = await on(deps, "guide");
    assert.deepEqual(r.said.slice(2), [ARRIVING(5)]);
    const e = await on(deps, "episodes");
    assert.ok(!e.said.some((l) => l.includes("node was updated")), e.said.join("\n"));
    t.done();
  });
  it("a Downloads refusal within 24 hours does not hide an unseen video: the guide blocks it with the unseen step", async () => {
    const t = setup();
    const file = video(t, "Old.mov");
    const clock = () => statSync(file).ctimeMs + UNSEEN_MS + 60000;
    note(t, { downloads: place(t, "refused", downloadsFolder(t.home), { at: clock() - 3600000 }) });
    const r = await on(light(t, { now: clock }), "guide");
    assert.equal(r.said[1], accessLine({ kind: "unseen", videos: ["Old.mov"] }));
    assert.ok(r.said.includes(`  A video of 5 bytes: ${stepLine({ kind: "unseen", videos: ["Old.mov"] })}`), r.said.join("\n"));
    t.done();
  });
  it("a Downloads finding blocks no video in the guide, and the overview still says what it said", async () => {
    const t = setup();
    note(t, { downloads: place(t, "refused", downloadsFolder(t.home)) });
    const local = join(t.dir, "local", "Drop");
    mkdirSync(local, { recursive: true });
    const deps = light(t, { settings: { ...light(t).settings, dropPath: local } });
    let r = await on(deps, "guide");
    assert.ok(r.said.includes(NOTHING_UNDER_WAY), r.said.join("\n"));
    assert.ok(r.said.includes(AIRDROP), r.said.join("\n"));
    assert.ok(!r.said.some((l) => l.includes("the Downloads folder")), r.said.join("\n"));
    writeFileSync(join(local, "Mine.mov"), "12345");
    r = await on(deps, "guide");
    assert.deepEqual(r.said.slice(1), ["Under way:", ARRIVING(5)]);
    const e = await on(deps, "episodes");
    assert.equal(e.said.filter((l) => l.includes("the Downloads folder")).length, 1, e.said.join("\n"));
    t.done();
  });
});

describe("episodes: the import's line once, right after her chat's own and before 'Imports:'", () => {
  const shut = (folder) => ({ names: ["readdirSync"], deny: (name, path) => (path === folder ? Object.assign(new Error(`EPERM: operation not permitted, scandir '${path}'`), { code: "EPERM" }) : null) });
  for (const [name, make, more, lineOf] of CASES) {
    it(`${name}: comes right after her chat's own line (it is refused too) and before 'Imports:'`, async () => {
      const t = setup();
      video(t, "Mine.mov");
      start(t, make);
      writeStatusIn(importingFolder(t.root), { version: 1, machine: "Sallie's laptop", pid: 7, import: "k3j9x", video: "Long talk.mov", bytes: 9, seconds: 2400, step: "Importing", at: new Date(t.now()).toISOString() }, (to, text) => writeFileSync(to, text));
      const deps = light(t, more(t));
      const { result: r } = await watched(() => on(deps, "episodes"), shut(dropOf(t)));
      const line = lineOf(t);
      const own = r.said.findIndex((l) => l.startsWith("This Mac does not let BRIMM Video Studio look in your drop folder"));
      assert.ok(own >= 0, r.said.join("\n"));
      assert.equal(r.said.filter((l) => l === line).length, 1, r.said.join("\n"));
      assert.equal(r.said.indexOf(line), own + 1, r.said.join("\n"));
      assert.ok(r.said.indexOf("Imports:") > own + 1, r.said.join("\n"));
      assert.ok(r.said.indexOf("Imports:") < r.said.indexOf("On this Mac:"));
      t.done();
    });
  }
  it("says nothing for a world with no finding", async () => {
    const t = setup();
    const r = await on(light(t), "episodes");
    assert.ok(!r.said.some((l) => l.includes("does not let the import")));
    t.done();
  });
});
