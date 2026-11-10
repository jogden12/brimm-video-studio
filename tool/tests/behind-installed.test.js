// `behind` on an installed Mac (Phase 3, Task 3): the update feed is read in place of git, and her folder and the toolchain are
// told in the app's words ("choose Repair"). The feed is a stand-in, git is never reached, and every program `behind` runs is written down.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, LOCK_CHANGED } from "../edit.js";
import { PIN } from "../hyperframes.js";
import { ASKING_MS, accessLine, writeAccess } from "../access.js";
import { dropWords } from "../guide.js";
import { dropFolderOf, readSettings, writeSettings } from "../settings.js";
import { writeStudio } from "../studio.js";
import { UPDATE_EVERY_MS, updateCheckFile } from "../update-check.js";
import { setup } from "./episodes.js";

const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
const NEWER = "A newer BRIMM Video Studio is ready: 1.5.0 (this Mac has 1.4.2).";
const NEWEST = "This Mac has the newest BRIMM Video Studio.";
const OFFLINE = "Could not check for a newer BRIMM Video Studio. Is this Mac offline?";
const NODE = "/opt/homebrew/bin/node";
const NOW = Date.parse("2026-11-09T10:00:00-06:00");

const item = ({ build, version }) => `<item><title>Version ${version}</title><sparkle:version>${build}</sparkle:version><sparkle:shortVersionString>${version}</sparkle:shortVersionString><enclosure url="https://updates.example.invalid/s.zip" length="1" type="application/octet-stream" sparkle:edSignature="x"/></item>`;
const appcast = (...items) => `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>BRIMM Video Studio</title>${items.map(item).join("")}</channel></rss>`;
/** A fetch stand-in: answers text as a 200 or an Error by rejecting; keeps its calls. */
const feed = (answer) => {
  const calls = [];
  return { calls, fetch: async (url, init) => { calls.push({ url, init }); if (answer instanceof Error) throw answer; return { ok: true, status: 200, text: async () => answer }; } };
};
const NEWER_FEED = () => feed(appcast({ build: 150, version: "1.5.0" }));
const NEWEST_FEED = () => feed(appcast({ build: 142, version: "1.4.2" }));

/** `behind` on the made-up Mac `t` as an installed Mac, the feed being `fetch`, and every program it runs written down. */
async function on(t, fetch, more = {}) {
  const said = [];
  const runs = [];
  const code = await editMain(["behind"], { ...t.ctx.deps, build: INSTALLED, fetch, now: () => NOW, run: async (cmd, args) => { runs.push([cmd, ...args]); return { code: 0, stderr: "" }; }, say: (x) => said.push(x), ...more });
  return { code, said, runs };
}
/** git finds `n` changes there that this checkout has not. */
const behindBy = (n) => {
  let calls = 0;
  return async () => (++calls === 1 ? { code: 0, stderr: "" } : { code: 0, stderr: "", stdout: `${n}\n` });
};

describe("behind: on an installed Mac", () => {
  it("says a newer one is ready, and runs no git", async () => {
    const t = setup();
    const f = NEWER_FEED();
    const r = await on(t, f.fetch);
    assert.deepEqual([r.code, r.said], [0, [NEWER]]);
    assert.deepEqual(r.runs, []);
    assert.equal(f.calls[0].url, INSTALLED.feed);
    t.done();
  });
  it("says this Mac has the newest one", async () => {
    const t = setup();
    const r = await on(t, NEWEST_FEED().fetch);
    assert.deepEqual([r.code, r.said], [0, [NEWEST]]);
    t.done();
  });
  it("says it could not check when the feed cannot be reached", async () => {
    const t = setup();
    const r = await on(t, feed(new Error("offline")).fetch);
    assert.deepEqual([r.code, r.said, r.runs], [0, [OFFLINE], []]);
    t.done();
  });
  it("asks the feed at most once a day, as the clock goes", async () => {
    const t = setup();
    const f = NEWEST_FEED();
    await on(t, f.fetch);
    await on(t, f.fetch);
    assert.equal(f.calls.length, 1);
    await on(t, f.fetch, { now: () => NOW + UPDATE_EVERY_MS });
    assert.equal(f.calls.length, 2);
    assert.equal(JSON.parse(readFileSync(updateCheckFile(t.home), "utf8")).feed, INSTALLED.feed);
    t.done();
  });
  it("says its build file cannot be read, and checks nothing, when it is broken", async () => {
    const t = setup();
    const f = NEWER_FEED();
    const r = await on(t, f.fetch, { build: { ...INSTALLED, broken: true, feed: "" } });
    assert.deepEqual(r.said, ["This Mac's BRIMM Video Studio cannot read its own build file. Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid."]);
    assert.deepEqual([f.calls.length, r.runs], [0, []]);
    t.done();
  });
  it("says the folder for Claude is out of date in the app's words, naming no command", async () => {
    const t = setup();
    const folder = writeStudio(t.home, { checkout: "/checkout", node: NODE });
    const skill = join(folder, ".claude", "skills", "brimm-edit", "SKILL.md");
    writeFileSync(skill, readFileSync(skill, "utf8").replace(/\| "Show me the Reels".*\n/, ""));
    const r = await on(t, NEWEST_FEED().fetch);
    assert.deepEqual(r.said, [NEWEST, "The folder for Claude on this Mac is out of date: an older BRIMM Video Studio wrote it. Open BRIMM Video Studio and choose Repair when it suits, then start a new chat."]);
    assert.ok(!r.said.some((x) => /settings\.js|install\.sh|Jason/.test(x)));
    t.done();
  });
  it("says the toolchain is not the pin in the app's words", async () => {
    const t = setup();
    writeSettings(t.home, { app: "hyperframes" });
    const r = await on(t, NEWEST_FEED().fetch);
    assert.deepEqual(r.said, [NEWEST, `HyperFrames' command line on this Mac is not the one Studio needs. Open BRIMM Video Studio and choose Repair when it suits. (Studio is pinned to version ${PIN.version}, and this Mac has none.)`]);
    t.done();
  });
  it("still refuses first when the lock is loosened, and asks the feed nothing", async () => {
    const t = setup();
    const folder = writeStudio(t.home, { checkout: "/checkout", node: NODE });
    writeFileSync(join(folder, ".claude", "settings.local.json"), "{}");
    const f = NEWER_FEED();
    const r = await on(t, f.fetch);
    assert.equal(r.said[0], LOCK_CHANGED);
    assert.deepEqual([r.code, f.calls.length, r.runs], [1, 0, []]);
    t.done();
  });
});

describe("behind: in a git checkout", () => {
  it("says what it always said, and asks no feed", async () => {
    const t = setup();
    const f = NEWER_FEED();
    const said = [];
    const code = await editMain(["behind"], { ...t.ctx.deps, build: { mode: "dev" }, fetch: f.fetch, run: behindBy(3), say: (x) => said.push(x) });
    assert.deepEqual([code, said], [0, ["Jason has a newer BRIMM Video Studio (3 changes). Ask him to update this Mac when it suits."]]);
    assert.equal(f.calls.length, 0);
    t.done();
  });
});

describe("behind: on an installed Mac, a new node", () => {
  it("says nothing of a new node, and asks no plutil", async () => {
    const t = setup();
    writeSettings(t.home, { dropPath: join(t.home, "Desktop", "Drop") });
    const drop = dropFolderOf(readSettings(t.home).settings, t.home);
    mkdirSync(drop, { recursive: true });
    const OLD = "/opt/homebrew/Cellar/node/25.0.0/bin/node";
    writeAccess(t.home, { version: 1, places: { drop: { state: "ok", code: "", at: t.now(), since: t.now(), folder: drop, node: OLD, okNode: OLD } }, looking: null, told: {} });
    let asked = 0;
    const kicks = [];
    const r = await on(t, NEWEST_FEED().fetch, { agentPid: () => null, agentNode: () => { asked++; return "/opt/homebrew/Cellar/node/25.1.0/bin/node"; }, kickstart: () => kicks.push("kick") });
    assert.deepEqual(r.said, [NEWEST]);
    assert.equal(asked, 0);
    assert.deepEqual(kicks, []);
    t.done();
  });
});

// On an installed Mac macOS's question and System Settings' list name the app, never "node" (review finding 1).
describe("behind: on an installed Mac, what macOS answered the import", () => {
  const APP = "BRIMM Video Studio";
  const wordsOf = (t) => `your drop folder, ${dropWords(readSettings(t.home).settings, "Mac Studio", t.home)}`;
  const dropOf = (t) => dropFolderOf(readSettings(t.home).settings, t.home);

  it("says the box asks about BRIMM Video Studio when a look has waited", async () => {
    const t = setup();
    writeAccess(t.home, { version: 1, places: {}, looking: { place: "drop", pid: 4242, at: NOW - ASKING_MS - 1000 }, told: {} });
    const r = await on(t, NEWEST_FEED().fetch, { agentPid: () => 4242 });
    assert.deepEqual(r.said, [NEWEST, `The import has waited more than a minute to look in ${wordsOf(t)}. If a box on this Mac's screen asks whether "BRIMM Video Studio" may look in it, choose Allow, and the import goes on.`]);
    t.done();
  });

  it("says the switch is under BRIMM Video Studio when the drop folder is refused", async () => {
    const t = setup();
    writeAccess(t.home, { version: 1, places: { drop: { state: "refused", code: "EPERM", at: NOW, since: NOW, folder: dropOf(t), node: NODE } }, looking: null, told: {} });
    const r = await on(t, NEWEST_FEED().fetch);
    assert.deepEqual(r.said, [NEWEST, `This Mac does not let the import look in ${wordsOf(t)}, so the videos you drop wait. In System Settings, under Privacy & Security, Files and Folders, turn on its switches under "BRIMM Video Studio". Then say "look again".`]);
    assert.equal(r.said.at(-1), accessLine({ kind: "refused", place: "drop", code: "EPERM" }, { placeWords: wordsOf(t), switchName: "its switches", name: APP }));
    t.done();
  });
});
