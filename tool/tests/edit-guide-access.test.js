// The guide and `episodes` say the import's line when the import cannot look (access-notice design, part 3, items 2 to 4; plan A5): the line
// under the drop folder's, a video this Mac's import cannot take is "blocked" with the step line instead of "arriving", and `guide wait`
// answers at once. The launch agent's pid and node are stand-ins; every Mac here is made up in a temp home.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { accessLine, stepLine, writeAccess } from "../access.js";
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

describe("guide: the import's line and a blocked video", () => {
  const kinds = [
    ["refused", "refused", { switchName: "its switches" }],
    ["locked", "locked", {}],
    ["error", "error", {}]
  ];
  for (const [name, state] of kinds) {
    it(`${name} in the drop folder: the line under the drop folder's, the video's step is the line, and guide wait answers at once`, async () => {
      const t = setup();
      video(t, "Mine.mov");
      OTHER(t);
      note(t, { drop: place(t, state, dropOf(t)) });
      const line = accessLine({ kind: state, place: "drop", code: state === "error" ? "EIO" : "" }, { placeWords: words(t), switchName: "its switches" });
      const r = await on(light(t), "guide");
      assert.equal(r.said[0].startsWith("Your drop folder:"), true);
      assert.equal(r.said[1], line);
      assert.equal(r.said[2], "Under way:");
      assert.ok(r.said.includes(BLOCKED(line)), r.said.join("\n"));
      assert.ok(r.said.some((l) => l.includes("It is in the drop folder of Sallie's laptop")), r.said.join("\n"));
      assert.ok(!r.said.includes(AIRDROP));
      t.done();
    });
    it(`${name} in the drop folder: guide wait answers at once`, async () => {
      const t = setup();
      video(t, "Mine.mov");
      note(t, { drop: place(t, state, dropOf(t)) });
      const r = await on(light(t), "guide");
      const waited = await on(light(t, { wait: () => assert.fail("guide wait must answer at once") }), "guide", "wait");
      assert.deepEqual(waited.said, r.said);
      t.done();
    });
  }
  it("asking blocks the same way", async () => {
    const t = setup();
    video(t, "Mine.mov");
    note(t, {}, { looking: { place: "drop", pid: 4242, at: t.now() - 61000 } });
    const line = accessLine({ kind: "asking", place: "drop" }, { placeWords: words(t) });
    const r = await on(light(t, { agentPid: () => 4242 }), "guide");
    assert.equal(r.said[1], line);
    assert.ok(r.said.includes(BLOCKED(line)), r.said.join("\n"));
    t.done();
  });
  it("an episodes refusal blocks the drop folder's videos too, and takes the 'Nothing is under way' lines away", async () => {
    const t = setup();
    note(t, { drop: place(t, "ok", dropOf(t)), episodes: place(t, "refused", t.ctx.episodes) });
    const r = await on(light(t), "guide");
    assert.equal(r.said.length, 2, r.said.join("\n"));
    assert.ok(r.said[1].includes("BRIMM Video"), r.said[1]);
    assert.ok(!r.said.includes(NOTHING_UNDER_WAY));
    video(t, "Mine.mov");
    const again = await on(light(t), "guide");
    assert.ok(again.said.includes(BLOCKED(r.said[1])), again.said.join("\n"));
    t.done();
  });
  it("unseen changes only the unseen video's step", async () => {
    const t = setup();
    const old = video(t, "Old.mov");
    const clock = () => statSync(old).ctimeMs + 4 * 60000;
    // a second, newer video the import has not been late with
    const fresh = video(t, "Fresh.mov");
    const later = statSync(fresh).ctimeMs;
    const deps = light(t, { now: () => Math.max(clock(), later + 1000) });
    const r = await on(deps, "guide");
    const step = stepLine({ kind: "unseen", videos: ["Old.mov"] });
    assert.ok(r.said.some((l) => l.endsWith(step)), r.said.join("\n"));
    assert.ok(!r.said.includes(NOTHING_UNDER_WAY));
    t.done();
  });
  it("a new node says nothing in the guide and in episodes", async () => {
    const t = setup();
    video(t, "Mine.mov");
    note(t, { drop: place(t, "ok", dropOf(t)) });
    const deps = light(t, { agentNode: () => "/opt/homebrew/Cellar/node/25.1.0/bin/node" });
    const r = await on(deps, "guide");
    assert.deepEqual(r.said.slice(2), ['  A video of 5 bytes: It is coming into your drop folder. Wait for the "Ready" notice.']);
    const e = await on(deps, "episodes");
    assert.ok(!e.said.some((l) => l.includes("node was updated")), e.said.join("\n"));
    t.done();
  });
  it("a Downloads finding blocks nothing in the guide, and the overview still says 'Nothing is under way' and the AirDrop line", async () => {
    const t = setup();
    note(t, { downloads: place(t, "refused", downloadsFolder(t.home)) });
    const deps = light(t, { settings: { ...light(t).settings, dropPath: join(t.dir, "local", "Drop") } });
    mkdirSync(dropOf({ ...t, ctx: { ...t.ctx } }) && join(t.dir, "local", "Drop"), { recursive: true });
    const r = await on(deps, "guide");
    assert.ok(r.said.includes(NOTHING_UNDER_WAY), r.said.join("\n"));
    assert.ok(r.said.includes(AIRDROP), r.said.join("\n"));
    const e = await on(deps, "episodes");
    assert.equal(e.said.filter((l) => l.includes("Downloads")).length, 1, e.said.join("\n"));
    t.done();
  });
});

describe("episodes: the import's line once, right after her chat's own and before 'Imports:'", () => {
  it("says it once, before 'On this Mac:'", async () => {
    const t = setup();
    video(t, "Mine.mov");
    note(t, { drop: place(t, "refused", dropOf(t)) });
    const line = accessLine({ kind: "refused", place: "drop", code: "EPERM" }, { placeWords: words(t), switchName: "its switches" });
    const r = await on(light(t), "episodes");
    assert.equal(r.said.filter((l) => l === line).length, 1, r.said.join("\n"));
    assert.ok(r.said.indexOf(line) < r.said.indexOf("On this Mac:"));
    const imports = r.said.indexOf("Imports:");
    if (imports >= 0) assert.ok(r.said.indexOf(line) < imports);
    t.done();
  });
  it("says nothing for a world with no finding", async () => {
    const t = setup();
    const r = await on(light(t), "episodes");
    assert.ok(!r.said.some((l) => l.includes("does not let the import")));
    t.done();
  });
});
