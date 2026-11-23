// The lock's narrow opening for Reel Kit's storyboards (storyboard-opening.js; plan Task 12; spec 2026-11-23, section 4b): her chat may
// publish a page Studio staged in her folder, and open it, and read and answer its comments, and nothing else with the Artifact and
// ArtifactComments tools. Every case is asked of both locks: today's strict guard (studio.js guardDecision) and the open guard
// (open-lock.js openDecision), on a made-up open-lock Mac (open-world.js) whose home holds the registry. The `reelkit storyboard` and
// URL a publish's own result gives, recorded by the PostToolUse hook (studio/published.sh), are run on the made-up episode of phase4.js, with Reel Kit's serve.py stood in for (tests/stand-ins/reel-kit.mjs):
// no test runs the real Artifact tools, Reel Kit's Python or a browser.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, utimesSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CAPABILITIES, NARROW, OPENING_REFUSED, PUBLISH_EXACTLY, STORYBOARDS, isArtifactUrl, openingDecision, pageOf, publishInput, readRegistry,
  STUDIO_PAGES, recordPublished, recordUrl, registryFile, stagePage
} from "../storyboard-opening.js";
import { spawn, spawnSync } from "node:child_process";
import { lockBroken, settingsOf } from "../studio.js";
import { neverCaught, neverDenyRules } from "../never.js";
import { guardDecision, openSettingsOf, studioFolder, writeStudio } from "../studio.js";
import { openDecision } from "../open-lock.js";
import { HELD_REFUSED } from "../held.js";
import { LOCK_CHANGED, lockLoosened } from "../loosened.js";
import { OPS_PAGE } from "../guide.js";
import { gatedIndex, gatedPlaces, realOf } from "../places.js";
import { HELP, editMain } from "../edit.js";
import { kitDir, venvPython } from "../reel-kit.js";
import { EDIT_SAY, notesFile, readNotes, STORYBOARD_SAY } from "../reel-kit-commands.js";
import { entryOf, writeState } from "../reel-kit-project.js";
import { episodeWork } from "../settings.js";
import { FOLDER, ID } from "./episodes.js";
import { episode } from "./phase4.js";
import { ANSWERED, RAW } from "./workcopy-world.js";
import { SESSION, openWorld } from "./open-world.js";

const SLUG = "3fa9c1-reel-2-v1";
const URL_1 = "https://claude.ai/artifact/AbCdEf123456";
const URL_2 = "https://claude.ai/code/artifact/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const FILES = ["fonts/Josefin Sans.ttf", "frames/f001.jpg", "frames/f002.jpg"];
const STAND_IN = fileURLToPath(new URL("./stand-ins/reel-kit.mjs", import.meta.url));

const worlds = [];
after(() => {
  for (const w of worlds) w.done();
});

/** A Reel Kit project's storyboard folder, as storyboard.py writes it: index.html, its frames and fonts, and files.json naming them. */
function storyboardAt(dir, { files = FILES, page = "<!doctype html><title>Know your costs</title><img src=\"frames/f001.jpg\">" } = {}) {
  const sb = join(dir, "storyboard");
  mkdirSync(sb, { recursive: true });
  writeFileSync(join(sb, "index.html"), page);
  for (const rel of files) {
    mkdirSync(dirname(join(sb, rel)), { recursive: true });
    writeFileSync(join(sb, rel), `bytes of ${rel}`);
  }
  writeFileSync(join(sb, "files.json"), JSON.stringify(files, null, 1));
  return sb;
}

/** A made-up open-lock Mac with a storyboard staged in her folder, and both guards' answers to a call there. */
function lockWorld() {
  const w = openWorld();
  worlds.push(w);
  w.project = join(w.dir, "project");
  w.from = storyboardAt(w.project);
  w.ctx = { checkout: w.checkout, node: w.node, folder: w.folder, home: w.home, uid: w.uid, tmp: w.tmp, index: gatedIndex(gatedPlaces(w.facts), [join(realOf(w.root), "Assets")]), allow: w.facts.allow, web: "held", resolve: async () => [], loosened: false, held: false };
  w.stage = (more = {}) => stagePage(w.home, w.folder, { from: w.from, slug: SLUG, kind: "storyboard", episode: ID, title: "Know your costs: storyboard", ...more });
  w.call = (name, input) => ({ session_id: SESSION, transcript_path: join(w.home, ".claude", "projects", "x", `${SESSION}.jsonl`), cwd: w.folder, hook_event_name: "PreToolUse", tool_name: name, tool_input: input });
  /** Each lock's decision: [strict, open]. */
  w.both = async (name, input, more = {}) => [guardDecision(w.call(name, input), { checkout: w.checkout, node: w.node, folder: w.folder }).decision, (await openDecision(w.call(name, input), { ...w.ctx, ...more })).decision];
  return w;
}

/** The publish `reelkit storyboard` prints for the page, with `more` changed. */
const publish = (w, more = {}) => ({ ...publishInput(pageOf(w.home, SLUG)), ...more });
const ALLOW = ["allow", "allow"];
const DENY = ["deny", "deny"];

describe("the narrow opening: what never.json says", () => {
  it("keeps ArtifactData on the never list", async () => {
    assert.equal(neverCaught("ArtifactData"), true);
    assert.ok(neverDenyRules().includes("ArtifactData"));
    const w = lockWorld();
    w.stage();
    for (const input of [{ action: "list" }, { action: "get", url: URL_1, collection: "x", doc_id: "y" }, {}]) assert.deepEqual(await w.both("ArtifactData", input), DENY, JSON.stringify(input));
  });
  it("names the two tools opened narrowly, and the capability a storyboard is published with", () => {
    assert.deepEqual(NARROW, ["Artifact", "ArtifactComments"]);
    assert.deepEqual(CAPABILITIES, { comments: { composer_only: true } });
    const never = JSON.parse(readFileSync(new URL("../studio/never.json", import.meta.url), "utf8"));
    assert.deepEqual(never.narrow, NARROW);
    for (const name of NARROW) assert.ok(!never.tools.includes(name), name);
  });
});

describe("the narrow opening: publishing a staged page, in both locks", () => {
  it("allows a first publish of a staged storyboard with its files and the comments capability", async () => {
    const w = lockWorld();
    const staged = w.stage();
    assert.equal(staged.stage, join(realOf(w.folder), STORYBOARDS, SLUG, "v1"));
    assert.equal(staged.file, join(staged.stage, "index.html"));
    assert.deepEqual(staged.files, FILES);
    const input = publish(w);
    assert.deepEqual(input, {
      file_path: staged.file, files: Object.fromEntries(FILES.map((rel) => [rel, join(staged.stage, rel)])), capabilities: CAPABILITIES,
      title: "Know your costs: storyboard", description: "A Reel Kit storyboard for The BRIMM.", icon: "film"
    });
    assert.deepEqual(await w.both("Artifact", input), ALLOW);
    assert.deepEqual(await w.both("Artifact", { ...input, action: "publish" }), ALLOW);
    // Sources relative to a root that is the stage itself; the files left out; the optional words left out.
    assert.deepEqual(await w.both("Artifact", { ...input, root: staged.stage, files: Object.fromEntries(FILES.map((rel) => [rel, rel])) }), ALLOW);
    assert.deepEqual(await w.both("Artifact", { ...input, files: Object.fromEntries(FILES.map((rel) => [rel, { from: join(staged.stage, rel) }])) }), ALLOW);
    const { title, description, icon, files, ...bare } = input;
    assert.deepEqual(await w.both("Artifact", bare), ALLOW);
  });
  it("allows a later version only to the URL recorded for it", async () => {
    const w = lockWorld();
    w.stage();
    assert.equal(recordUrl(w.home, SLUG, URL_1), "");
    const first = publish(w);
    assert.equal(first.url, URL_1);
    assert.deepEqual(await w.both("Artifact", first), ALLOW);
    assert.deepEqual(await w.both("Artifact", { ...first, url: `${URL_1}/` }), ALLOW);
    const { url, ...none } = first;
    assert.deepEqual(await w.both("Artifact", none), DENY, "a page with a URL is not published as a new one");
    // The next version: a new stage, the same URL; the old stage is no longer the page's.
    writeFileSync(join(w.from, "frames", "f001.jpg"), "the second version's frame");
    const second = w.stage();
    assert.equal(second.stage, join(realOf(w.folder), STORYBOARDS, SLUG, "v2"));
    assert.deepEqual(await w.both("Artifact", publish(w)), ALLOW);
    assert.equal(publish(w).url, URL_1);
    assert.deepEqual(await w.both("Artifact", first), DENY, "the old version's stage");
    assert.deepEqual(await w.both("Artifact", { ...publish(w), url: URL_2 }), DENY);
  });
  it("stages nothing new when the storyboard has not changed", () => {
    const w = lockWorld();
    const one = w.stage();
    const again = w.stage();
    assert.equal(again.stage, one.stage);
    assert.ok(!existsSync(join(realOf(w.folder), STORYBOARDS, SLUG, "v2")));
  });
  it("refuses a publish to any URL not recorded, the kept BRIMM Ops page's among them", async () => {
    const w = lockWorld();
    w.stage();
    for (const url of [OPS_PAGE, URL_1, URL_2, "https://claude.ai/artifact/other"]) assert.deepEqual(await w.both("Artifact", publish(w, { url })), DENY, url);
    recordUrl(w.home, SLUG, URL_1);
    for (const url of [OPS_PAGE, URL_2, `${URL_1}x`, "http://claude.ai/artifact/AbCdEf123456", URL_1.toLowerCase()]) assert.deepEqual(await w.both("Artifact", publish(w, { url })), DENY, url);
  });
  it("refuses read, list, delete, pin, assets and sharing", async () => {
    const w = lockWorld();
    w.stage();
    recordUrl(w.home, SLUG, URL_1);
    const p = publish(w);
    const refused = [
      { action: "list" }, { action: "list", scope: "shared" }, { action: "list", scope: "all" }, { action: "list", url: URL_1, scope: "assets" },
      { action: "read", url: URL_1 }, { action: "read", url: OPS_PAGE }, { action: "read", url: URL_1, path: "index.html" },
      { action: "delete", url: URL_1 }, { action: "pin", url: URL_1 }, { action: "unpin", url: URL_1 }, { action: "open", url: OPS_PAGE }, { action: "open", url: URL_2 }, { action: "open" },
      { action: "quickstart", intent: "document" }, { action: "quickstart", intent: "other" }, { action: "quickstart", intent: "other", design_systems: true },
      { action: "quickstart", intent: "other", design_systems: false, title: "x" }, { action: "something new", url: URL_1 },
      { ...p, pin: true }, { ...p, force: true }, { ...p, asset: true }, { ...p, asset_ids: ["0".repeat(32)] }, { ...p, from_url: OPS_PAGE }, { ...p, file_paths: [p.file_path] },
      { ...p, type_url: "https://claude.ai/artifact/type" }, { ...p, contract: "latest" }, { ...p, overwrite_unread: ["index.html"] }, { ...p, auto_open: "at_create" },
      { ...p, favicon: "x" }, { ...p, capabilities: { comments: { composer_only: true }, db: {} } }, { ...p, capabilities: {} }, { ...p, capabilities: { comments: {} } },
      { ...p, title: "Another title" }, { ...p, description: "Session words" }, { ...p, label: "v1" }, { ...p, icon: "chart" }, { ...p, somethingNew: 1 },
      { ...p, files: { ...p.files, "frames/f001.jpg": { artifact: OPS_PAGE, path: "data.json" } } }, { ...p, files: { ...p.files, "frames/f001.jpg": null } },
      { ...p, files: { ...p.files, "frames/f001.jpg": { from: p.files["frames/f001.jpg"], contentType: "text/html" } } }
    ];
    for (const input of refused) assert.deepEqual(await w.both("Artifact", input), DENY, JSON.stringify(input));
    // Opening a recorded page, and the read-only quickstart the tool asks for before a new page, are allowed.
    assert.deepEqual(await w.both("Artifact", { action: "open", url: URL_1 }), ALLOW);
    assert.deepEqual(await w.both("Artifact", { action: "open", url: `${URL_1}/` }), ALLOW);
    assert.deepEqual(await w.both("Artifact", { action: "quickstart", intent: "other", design_systems: false }), ALLOW);
    // A refusal says so in plain words, and a publish of a staged page changed says to publish it as printed.
    assert.equal(guardDecision(w.call("Artifact", { action: "list" }), { checkout: w.checkout, node: w.node, folder: w.folder }).reason, OPENING_REFUSED);
    assert.equal(OPENING_REFUSED, "That is not something this folder does with pages. Ask Jason.");
    assert.equal((await openDecision(w.call("Artifact", { ...p, title: "x" }), w.ctx)).reason, PUBLISH_EXACTLY);
  });
  it("refuses ArtifactComments on a URL not recorded, and watch on any", async () => {
    const w = lockWorld();
    w.stage();
    recordUrl(w.home, SLUG, URL_1);
    for (const url of [OPS_PAGE, URL_2, undefined]) {
      for (const input of [{ action: "read", url }, { action: "reply", url, thread_id: "t1", text: "On it." }, { action: "resolve", url, thread_id: "t1" }]) assert.deepEqual(await w.both("ArtifactComments", input), DENY, JSON.stringify(input));
    }
    for (const input of [{ action: "watch", url: URL_1 }, { action: "watch", url: URL_1, on: true }, { action: "watch", url: URL_1, on: false }, { action: "watch" }, { url: URL_1 }, {}]) assert.deepEqual(await w.both("ArtifactComments", input), DENY, JSON.stringify(input));
    for (const input of [{ action: "read", url: URL_1 }, { action: "read", url: `${URL_1}/`, thread_id: "t1" }, { action: "read", url: URL_1, cursor: "c2" }, { action: "resolve", url: URL_1, thread_id: "t1" }, { action: "reply", url: URL_1, thread_id: "t1", text: "On it." }]) assert.deepEqual(await w.both("ArtifactComments", input), ALLOW, JSON.stringify(input));
    for (const input of [{ action: "read", url: URL_1, replies: true }, { action: "resolve", url: URL_1 }, { action: "read", url: URL_1, thread_id: 7 }]) assert.deepEqual(await w.both("ArtifactComments", input), DENY, JSON.stringify(input));
    // A thread or a cursor is an id, never words.
    for (const id of ["", "a b", "t1\nmore", "x".repeat(129), "../t", "t1;", "théo"]) {
      for (const input of [{ action: "read", url: URL_1, thread_id: id }, { action: "read", url: URL_1, cursor: id }, { action: "resolve", url: URL_1, thread_id: id }, { action: "reply", url: URL_1, thread_id: id, text: "On it." }]) assert.deepEqual(await w.both("ArtifactComments", input), DENY, JSON.stringify(input));
    }
    assert.deepEqual(await w.both("ArtifactComments", { action: "read", url: URL_1, thread_id: "A-b_9".padEnd(128, "z"), cursor: "c_2-X" }), ALLOW);
  });
  it("refuses a reply that is not exactly On it.", async () => {
    const w = lockWorld();
    w.stage();
    recordUrl(w.home, SLUG, URL_1);
    for (const text of ["On it", "On it. ", "on it.", "On it.\nAnd the client's name is", "Done.", "", undefined]) assert.deepEqual(await w.both("ArtifactComments", { action: "reply", url: URL_1, thread_id: "t1", text }), DENY, JSON.stringify(text));
    assert.deepEqual(await w.both("ArtifactComments", { action: "reply", url: URL_1, text: "On it." }), DENY, "no thread");
    assert.deepEqual(await w.both("ArtifactComments", { action: "reply", url: URL_1, thread_id: "t1", text: "On it.", acknowledge_duplicate: true }), DENY);
  });
});

describe("the narrow opening: paths that try to leave the staged page (Review Focus 2), in both locks", () => {
  it("refuses a file_path that climbs out of the stage", async () => {
    const w = lockWorld();
    const { stage } = w.stage();
    mkdirSync(join(w.folder, "Pictures"), { recursive: true });
    writeFileSync(join(w.folder, "Pictures", "index.html"), "not staged");
    for (const file_path of [`${stage}/../v1/index.html`, `${stage}/frames/../index.html`, `${stage}/./index.html`, `${stage}//index.html`, join(stage, "..", "..", "..", "Pictures", "index.html"),
      join(w.folder, "Pictures", "index.html"), `${STORYBOARDS}/${SLUG}/v1/index.html`, "index.html", "~/BRIMM Video Studio/Storyboards/x/v1/index.html", join(stage, "frames", "f001.jpg"), join(w.from, "index.html"), undefined, 7]) {
      assert.deepEqual(await w.both("Artifact", publish(w, { file_path })), DENY, String(file_path));
    }
  });
  it("refuses a files source that is a link out", async () => {
    const w = lockWorld();
    const { stage } = w.stage();
    const p = publish(w);
    // A link in her folder to a staged file; a link to a file outside; a source outside her folder; a root above the stage.
    symlinkSync(join(stage, "frames", "f001.jpg"), join(w.folder, "frame.jpg"));
    writeFileSync(join(w.home, "secret.txt"), "not for a page");
    symlinkSync(join(w.home, "secret.txt"), join(w.folder, "out.jpg"));
    const bad = [
      { "frames/f001.jpg": join(w.folder, "frame.jpg") }, { "frames/f001.jpg": join(w.folder, "out.jpg") }, { "frames/f001.jpg": join(w.home, "secret.txt") },
      { "frames/f001.jpg": `${stage}/frames/../frames/f001.jpg` }, { "frames/f001.jpg": join(stage, "frames", "f002.jpg") }, { "frames/f001.jpg": join(w.from, "frames", "f001.jpg") }
    ];
    for (const change of bad) assert.deepEqual(await w.both("Artifact", { ...p, files: { ...p.files, ...change } }), DENY, JSON.stringify(change));
    const rel = Object.fromEntries(FILES.map((r) => [r, r]));
    for (const root of [dirname(stage), w.folder, join(stage, "frames"), `${stage}/`, "Storyboards"]) assert.deepEqual(await w.both("Artifact", { ...p, root, files: rel }), DENY, root);
    // Relative sources without the stage as their root; a list in place of the map; a file missing, or one added.
    assert.deepEqual(await w.both("Artifact", { ...p, files: rel }), DENY, "relative with no root");
    assert.deepEqual(await w.both("Artifact", { ...p, files: FILES.map((path) => ({ path: join(stage, path) })) }), DENY, "a list");
    const { ["frames/f002.jpg"]: gone, ...less } = p.files;
    assert.deepEqual(await w.both("Artifact", { ...p, files: less }), DENY, "a file left out");
    assert.deepEqual(await w.both("Artifact", { ...p, files: { ...p.files, "secret.txt": join(w.home, "secret.txt") } }), DENY, "a file added");
    assert.deepEqual(await w.both("Artifact", { ...p, files: { ...p.files, "index.html": p.file_path } }), DENY, "the page among its files");
  });
  it("refuses a staged file replaced by a link", async () => {
    const w = lockWorld();
    const { stage } = w.stage();
    writeFileSync(join(w.home, "secret.txt"), "bytes of frames/f001.jpg");
    unlinkSync(join(stage, "frames", "f001.jpg"));
    symlinkSync(join(w.home, "secret.txt"), join(stage, "frames", "f001.jpg"));
    assert.deepEqual(await w.both("Artifact", publish(w)), DENY);
    const { files, ...bare } = publish(w);
    assert.deepEqual(await w.both("Artifact", bare), DENY, "every staged file is checked, named or not");
  });
  it("refuses a staged folder replaced by a link, a staged file edited or replaced, and the page itself replaced", async () => {
    const cases = [
      ["a folder made a link", (stage, w) => { renameSync(join(stage, "frames"), join(w.home, "frames")); symlinkSync(join(w.home, "frames"), join(stage, "frames")); }],
      ["a file edited in place", (stage) => writeFileSync(join(stage, "frames", "f002.jpg"), "bytes of frames/f00X.jpg")],
      ["a file replaced by another", (stage) => { rmSync(join(stage, "frames", "f002.jpg")); writeFileSync(join(stage, "frames", "f002.jpg"), "bytes of frames/f002.jpg"); }],
      ["the page made a link", (stage, w) => { writeFileSync(join(w.home, "page.html"), "x"); rmSync(join(stage, "index.html")); symlinkSync(join(w.home, "page.html"), join(stage, "index.html")); }],
      ["the stage made a link", (stage, w) => { renameSync(stage, join(w.home, "v1")); symlinkSync(join(w.home, "v1"), stage); }],
      ["a file taken away", (stage) => rmSync(join(stage, "fonts", "Josefin Sans.ttf"))]
    ];
    for (const [what, change] of cases) {
      const w = lockWorld();
      const { stage } = w.stage();
      const p = publish(w);
      assert.deepEqual(await w.both("Artifact", p), ALLOW, what);
      change(stage, w);
      assert.deepEqual(await w.both("Artifact", p), DENY, what);
    }
  });
  it("refuses every call when the registry cannot be read whole as Studio's, or its page is not in her folder", async () => {
    const w = lockWorld();
    w.stage();
    recordUrl(w.home, SLUG, URL_1);
    const p = publish(w);
    const kept = readFileSync(registryFile(w.home), "utf8");
    for (const [what, make] of [
      ["not JSON", () => writeFileSync(registryFile(w.home), "{")],
      ["no pages", () => writeFileSync(registryFile(w.home), "{}")],
      ["a link", () => { writeFileSync(join(w.home, "elsewhere.json"), kept); rmSync(registryFile(w.home)); symlinkSync(join(w.home, "elsewhere.json"), registryFile(w.home)); }],
      ["a page outside her folder", () => {
        const registry = JSON.parse(kept);
        const outside = join(w.home, "Outside");
        renameSync(dirname(registry.pages[0].stage), outside);
        registry.pages[0].stage = join(outside, "v1");
        registry.pages[0].file = join(outside, "v1", "index.html");
        writeFileSync(registryFile(w.home), JSON.stringify(registry));
      }]
    ]) {
      make();
      assert.deepEqual(await w.both("ArtifactComments", { action: "read", url: URL_1 }), DENY, what);
      assert.deepEqual(await w.both("Artifact", what === "a page outside her folder" ? { ...p, file_path: join(w.home, "Outside", "v1", "index.html"), files: undefined } : p), DENY, what);
      rmSync(registryFile(w.home), { force: true });
      writeFileSync(registryFile(w.home), kept);
    }
    rmSync(registryFile(w.home));
    assert.deepEqual(readRegistry(w.home), { pages: [] });
    assert.deepEqual(await w.both("Artifact", p), DENY, "no registry");
  });
});

describe("the narrow opening: what each lock does around it", () => {
  it("lets her chat Read the staged files first, as the Artifact tool asks, in both locks", async () => {
    const w = lockWorld();
    const { stage } = w.stage();
    for (const rel of ["index.html", ...FILES]) {
      assert.equal(guardDecision(w.call("Read", { file_path: join(stage, rel) }), { checkout: w.checkout, node: w.node, folder: w.folder }).decision, "pass", rel);
      assert.equal((await openDecision(w.call("Read", { file_path: join(stage, rel) }), w.ctx)).decision, "allow", rel);
    }
  });
  it("refuses the opening to a chat that holds a session's words, and asks today's guard while the lock is loosened", async () => {
    const w = lockWorld();
    w.stage();
    recordUrl(w.home, SLUG, URL_1);
    const p = publish(w);
    assert.deepEqual(await openDecision(w.call("Artifact", p), { ...w.ctx, held: true }), { decision: "deny", reason: HELD_REFUSED });
    assert.deepEqual(await openDecision(w.call("ArtifactComments", { action: "read", url: URL_1 }), { ...w.ctx, held: true }), { decision: "deny", reason: HELD_REFUSED });
    assert.deepEqual(await openDecision(w.call("Artifact", p), { ...w.ctx, held: true, loosened: true }), { decision: "deny", reason: LOCK_CHANGED });
    assert.equal((await openDecision(w.call("Artifact", p), { ...w.ctx, loosened: true })).decision, "allow");
    assert.deepEqual(await openDecision(w.call("Artifact", { action: "list" }), { ...w.ctx, loosened: true }), { decision: "deny", reason: LOCK_CHANGED });
  });
  it("leaves the open lock's settings with no deny rule for the two tools, and keeps ArtifactData's", () => {
    const w = lockWorld();
    const { deny } = openSettingsOf({ checkout: w.checkout, node: w.node, folder: w.folder, facts: w.facts }).permissions;
    for (const name of NARROW) assert.ok(!deny.includes(name), name);
    assert.ok(deny.includes("ArtifactData"));
  });
  it("does not take a Storyboards folder in her folder for a loosened strict lock", () => {
    const w = openWorld();
    worlds.push(w);
    const home = join(w.dir, "strict home");
    mkdirSync(home, { recursive: true });
    const folder = writeStudio(home, { checkout: w.checkout, node: "/opt/homebrew/bin/node" });
    const deps = { cwd: folder, env: {}, managedDir: join(w.dir, "managed"), managedPrefs: join(w.dir, "managed-preferences"), user: "sallie" };
    assert.deepEqual(lockLoosened({ home, checkout: w.checkout, deps }), []);
    storyboardAt(join(w.dir, "p2"));
    stagePage(home, folder, { from: join(w.dir, "p2", "storyboard"), slug: SLUG, kind: "storyboard", episode: ID, title: "x" });
    assert.ok(lstatSync(join(folder, STORYBOARDS, SLUG, "v1", "index.html")).isFile());
    assert.deepEqual(lockLoosened({ home, checkout: w.checkout, deps }), []);
  });
});

describe("staging a page", () => {
  it("copies only the files files.json names, each a regular file, and registers each one's size, identity and hash", () => {
    const w = lockWorld();
    writeFileSync(join(w.from, "notes.json"), "[]");
    writeFileSync(join(w.from, "frames", "f999.jpg"), "not named");
    const staged = w.stage();
    assert.ok(!existsSync(join(staged.stage, "notes.json")) && !existsSync(join(staged.stage, "frames", "f999.jpg")) && !existsSync(join(staged.stage, "files.json")));
    const page = pageOf(w.home, SLUG);
    assert.deepEqual(Object.keys(page).sort(), ["description", "episode", "file", "files", "icon", "id", "kind", "slug", "stage", "title", "url", "version"]);
    assert.equal(page.url, null);
    assert.deepEqual(page.files.map((f) => f.rel), ["index.html", ...FILES]);
    for (const f of page.files) {
      const at = lstatSync(join(staged.stage, f.rel), { bigint: true });
      assert.deepEqual([f.size, f.dev, f.ino], [Number(at.size), String(at.dev), String(at.ino)], f.rel);
      assert.match(f.sha256, /^[0-9a-f]{64}$/);
    }
    assert.equal(registryFile(w.home), join(w.home, "Library", "Application Support", "BRIMM Video", "storyboards.json"));
  });
  it("refuses a name that climbs, is absolute, starts with a dot or is not a page's file, and a link or a folder in the source, and stages nothing", () => {
    const names = [["../x.jpg"], ["/etc/x.jpg"], ["frames/../../x.jpg"], [".claude/settings.json"], ["CLAUDE.md"], ["frames/.hidden.jpg"], ["a.jpg", "A.jpg"], ["frames"], ["x.html"], ["notes.json"], "not a list", [7]];
    for (const files of names) {
      const w = lockWorld();
      writeFileSync(join(w.from, "files.json"), JSON.stringify(files));
      assert.throws(() => w.stage(), undefined, JSON.stringify(files));
      assert.ok(!existsSync(join(w.folder, STORYBOARDS, SLUG, "v1")), JSON.stringify(files));
      assert.equal(pageOf(w.home, SLUG), null);
    }
    for (const [what, make] of [
      ["a named file that is a link", (w) => { rmSync(join(w.from, "frames", "f001.jpg")); writeFileSync(join(w.home, "secret.txt"), "x"); symlinkSync(join(w.home, "secret.txt"), join(w.from, "frames", "f001.jpg")); }],
      ["a folder on the way that is a link", (w) => { renameSync(join(w.from, "frames"), join(w.home, "frames")); symlinkSync(join(w.home, "frames"), join(w.from, "frames")); }],
      ["the page a link", (w) => { writeFileSync(join(w.home, "p.html"), "x"); rmSync(join(w.from, "index.html")); symlinkSync(join(w.home, "p.html"), join(w.from, "index.html")); }],
      ["the storyboard folder a link", (w) => { renameSync(w.from, join(w.home, "sb")); symlinkSync(join(w.home, "sb"), w.from); }],
      ["files.json a link", (w) => { writeFileSync(join(w.home, "f.json"), JSON.stringify(FILES)); rmSync(join(w.from, "files.json")); symlinkSync(join(w.home, "f.json"), join(w.from, "files.json")); }],
      ["a named file missing", (w) => rmSync(join(w.from, "frames", "f002.jpg"))],
      ["Storyboards a link out of her folder", (w) => { mkdirSync(join(w.home, "Elsewhere")); symlinkSync(join(w.home, "Elsewhere"), join(w.folder, STORYBOARDS)); }]
    ]) {
      const w = lockWorld();
      make(w);
      assert.throws(() => w.stage(), undefined, what);
      assert.equal(pageOf(w.home, SLUG), null, what);
      assert.ok(!existsSync(join(w.home, "Elsewhere", SLUG)), what);
    }
  });
});

describe("a page's URL", () => {
  it("records a page's URL once and never changes it", () => {
    const w = lockWorld();
    assert.equal(recordUrl(w.home, SLUG, URL_1), "none", "no page staged yet");
    w.stage();
    for (const bad of ["http://claude.ai/artifact/x", "https://claude.ai/artifact/", "https://claude.ai/artifact/a/b", "https://claude.ai.evil/artifact/x", "https://claude.ai/code/artifact/not-a-uuid", "https://claude.ai/chat/abc", " https://claude.ai/artifact/x", 7]) {
      assert.equal(recordUrl(w.home, SLUG, bad), "url", String(bad));
      assert.equal(isArtifactUrl(bad), false, String(bad));
    }
    assert.ok(isArtifactUrl(URL_1) && isArtifactUrl(URL_2) && isArtifactUrl(`${URL_1}/`));
    assert.equal(recordUrl(w.home, SLUG, OPS_PAGE, { refused: [OPS_PAGE] }), "kept");
    // Studio's own pages are never a storyboard's, whatever `refused` is given: the kept BRIMM Ops page, her guide, the By-Hand pages.
    assert.ok(STUDIO_PAGES.some((id) => OPS_PAGE.endsWith(`/${id}`)));
    for (const id of ["GCUQPLnSFWZe3VghyaKNtX", "Vu5JmADhftiEsPz4KYN4e4", "TmFpCY7GfR1KWw9hcftzrT", "VQVsatRKKwwYpzKW3GZPdA"]) {
      assert.ok(STUDIO_PAGES.includes(id), id);
      for (const url of [`https://claude.ai/artifact/${id}`, `https://claude.ai/artifact/${id}/`, `https://claude.ai/artifact/${id.toLowerCase()}`]) assert.equal(recordUrl(w.home, SLUG, url), "kept", url);
    }
    assert.equal(recordUrl(w.home, SLUG, `${URL_1}/`), "");
    assert.equal(pageOf(w.home, SLUG).url, URL_1);
    assert.equal(recordUrl(w.home, SLUG, URL_1), "same");
    assert.equal(recordUrl(w.home, SLUG, URL_2), "changed");
    assert.equal(pageOf(w.home, SLUG).url, URL_1);
    // A later version keeps it.
    writeFileSync(join(w.from, "frames", "f002.jpg"), "v2");
    w.stage();
    assert.equal(pageOf(w.home, SLUG).url, URL_1);
    // Another page may not take a URL already another's.
    storyboardAt(join(w.dir, "other"));
    stagePage(w.home, w.folder, { from: join(w.dir, "other", "storyboard"), slug: "3fa9c1-main-v1", kind: "storyboard", episode: ID, title: "x" });
    assert.equal(recordUrl(w.home, "3fa9c1-main-v1", URL_1), "other");
  });
});

// --- The URL, from the publish's own result (the PostToolUse hook) ---

/** The PostToolUse hook's input for an Artifact call `input`, its result holding `url` somewhere inside it. */
const posted = (input, given = {}) => ({
  session_id: SESSION, hook_event_name: "PostToolUse", tool_name: "Artifact", tool_input: input,
  tool_response: Object.hasOwn(given, "response") ? given.response : { content: [{ type: "text", text: `Published. Your page is at ${given.url} (private).` }], meta: { again: `${given.url}/` } }
});
const PUBLISHED_SH = fileURLToPath(new URL("../studio/published.sh", import.meta.url));
const OPENING = new URL("../storyboard-opening.js", import.meta.url).href;
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/** Run `code` in a node of its own, with storyboard-opening.js as `m`: what it printed, once it ends. */
function runner(w, code) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", `import * as m from ${JSON.stringify(OPENING)};\n${code}`], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => (code === 0 ? done(out) : fail(new Error(err))));
  });
}

describe("the URL a storyboard's first publish gives, recorded by the hook", () => {
  it("records the URL the result of a publish of a staged page gives, the one artifact it names, however often", () => {
    const w = lockWorld();
    w.stage();
    assert.equal(recordPublished(w.home, posted(publish(w), { url: URL_1 }), { folder: w.folder }), "");
    assert.equal(pageOf(w.home, SLUG).url, URL_1);
    // Also a result that is only a string, or holds the URL deep in a list, with a slash after it.
    const v = lockWorld();
    v.stage();
    assert.equal(recordPublished(v.home, posted(publish(v), { response: [{ a: { b: [`see ${URL_2}/.`] } }] }), { folder: v.folder }), "");
    assert.equal(pageOf(v.home, SLUG).url, URL_2);
    const u = lockWorld();
    u.stage();
    assert.equal(recordPublished(u.home, posted({ ...publish(u), action: "publish" }, { response: URL_1 }), { folder: u.folder }), "");
    assert.equal(pageOf(u.home, SLUG).url, URL_1);
  });
  it("records nothing for a publish of anything else", () => {
    const w = lockWorld();
    w.stage();
    const p = publish(w);
    const { title, ...untitled } = p;
    for (const [what, input] of [
      ["another title", { ...p, title: "x" }], ["the title left out", untitled], ["the root form", { ...p, root: dirname(p.file_path), files: Object.fromEntries(Object.keys(p.files).map((r) => [r, r])) }],
      ["another file", { ...p, file_path: join(w.folder, "Pictures", "index.html") }], ["a url given", { ...p, url: URL_2 }], ["another action", { action: "open", url: URL_1 }], ["no input", undefined]
    ]) assert.equal(recordPublished(w.home, posted(input, { url: URL_1 }), { folder: w.folder }), "input", what);
    for (const [what, call] of [["another tool", { ...posted(p, { url: URL_1 }), tool_name: "ArtifactComments" }], ["another event", { ...posted(p, { url: URL_1 }), hook_event_name: "PreToolUse" }], ["not an object", "x"]]) {
      assert.equal(recordPublished(w.home, call, { folder: w.folder }), "input", what);
    }
    // Her folder must hold the page.
    assert.equal(recordPublished(w.home, posted(p, { url: URL_1 }), { folder: join(w.home, "Elsewhere") }), "input");
    assert.equal(pageOf(w.home, SLUG).url, null);
  });
  it("records nothing for a result with no URL of an artifact's shape, or one of Studio's own pages", () => {
    const w = lockWorld();
    w.stage();
    const p = publish(w);
    for (const response of [{}, "Published.", { url: "https://example.com/artifact/x" }, { url: "https://claude.ai/chat/abc" }, `${" ".repeat(70 * 1024)}${URL_1}`, null, 7]) {
      assert.equal(recordPublished(w.home, posted(p, { response }), { folder: w.folder }), "no url", JSON.stringify(response)?.slice(0, 60));
    }
    assert.equal(recordPublished(w.home, posted(p, { response: { text: OPS_PAGE } }), { folder: w.folder }), "kept");
    assert.equal(recordPublished(w.home, posted(p, { response: { text: "https://claude.ai/artifact/Vu5JmADhftiEsPz4KYN4e4" } }), { folder: w.folder }), "kept");
    assert.equal(pageOf(w.home, SLUG).url, null);
  });
  it("never changes a URL once recorded: a second publish's result is let go", () => {
    const w = lockWorld();
    w.stage();
    assert.equal(recordPublished(w.home, posted(publish(w), { url: URL_1 }), { folder: w.folder }), "");
    // The next publish names the URL (publishInput gives it now), so it is no first publish; and one without it is no longer the page's.
    assert.equal(recordPublished(w.home, posted(publish(w), { url: URL_2 }), { folder: w.folder }), "input");
    const { url, ...first } = publish(w);
    assert.equal(recordPublished(w.home, posted(first, { url: URL_2 }), { folder: w.folder }), "input");
    assert.equal(pageOf(w.home, SLUG).url, URL_1);
  });
  it("runs as Claude Code runs it, in exec form, never blocking, and logs what it let go", () => {
    const w = lockWorld();
    w.stage();
    const run = (input, node = process.execPath) => spawnSync("/bin/sh", [PUBLISHED_SH, node, w.folder], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8" });
    for (const [input, node] of [["not json", process.execPath], [JSON.stringify(posted(publish(w), { response: {} })), process.execPath], [JSON.stringify(posted(publish(w), { url: URL_1 })), "/nonexistent/node"]]) {
      const ran = run(input, node);
      assert.deepEqual([ran.status, ran.stdout], [0, ""], input.slice(0, 40));
    }
    assert.equal(pageOf(w.home, SLUG).url, null);
    assert.match(readFileSync(join(w.home, "Library", "Application Support", "BRIMM Video", "storyboards.log"), "utf8"), /no url/);
    const ran = run(posted(publish(w), { url: URL_1 }));
    assert.deepEqual([ran.status, ran.stdout], [0, ""]);
    assert.equal(pageOf(w.home, SLUG).url, URL_1);
  });
  it("is in both locks' settings, after an Artifact call, and the open lock takes it as part of its shape", () => {
    const w = lockWorld();
    const hook = { matcher: "Artifact", hooks: [{ type: "command", command: "/bin/sh", args: [`${w.checkout}/tool/studio/published.sh`, w.node, w.folder] }] };
    assert.deepEqual(settingsOf({ checkout: w.checkout, node: w.node, folder: w.folder }).hooks.PostToolUse, [hook]);
    const open = openSettingsOf({ checkout: w.checkout, node: w.node, folder: w.folder, facts: w.facts });
    assert.deepEqual(open.hooks.PostToolUse.map((e) => e.matcher), ["AskUserQuestion", "Artifact"]);
    assert.deepEqual(open.hooks.PostToolUse[1], hook);
    const args = { checkout: w.checkout, folder: w.folder, lock: "open", facts: w.facts, node: w.node };
    assert.deepEqual(lockBroken(JSON.parse(JSON.stringify(open)), args), []);
    const without = JSON.parse(JSON.stringify(open));
    without.hooks.PostToolUse.pop();
    assert.deepEqual(lockBroken(without, args), ["published"]);
    const twice = JSON.parse(JSON.stringify(open));
    twice.hooks.PostToolUse.push(hook);
    assert.ok(lockBroken(twice, args).includes("other-hooks"));
    // The strict lock's check looks only at the guard: its folder without the hook is only out of date.
    const strict = settingsOf({ checkout: w.checkout, node: w.node, folder: w.folder });
    delete strict.hooks.PostToolUse;
    assert.deepEqual(lockBroken(strict, { checkout: w.checkout, folder: w.folder }), []);
  });
  it("loses neither a URL nor a staged version when the two write the registry at once, and waits for the registry's lock", () => {
    const w = lockWorld();
    w.stage();
    const lock = `${registryFile(w.home)}.lock`;
    // A lock a run that is gone left: taken over.
    writeFileSync(lock, JSON.stringify({ pid: 999999, at: 0 }));
    assert.equal(recordUrl(w.home, SLUG, URL_1), "");
    assert.ok(!existsSync(lock));
    // A lock a live run holds: the write waits, then gives up, changing nothing.
    const v = lockWorld();
    v.stage();
    writeFileSync(`${registryFile(v.home)}.lock`, JSON.stringify({ pid: process.pid, at: Date.now() }));
    assert.equal(recordUrl(v.home, SLUG, URL_1, { lockWaitMs: 200 }), "unread");
    assert.equal(pageOf(v.home, SLUG).url, null);
    rmSync(`${registryFile(v.home)}.lock`);
    // An empty lock is one being made (its holder has not written it yet): held while young, taken over once old.
    const y = lockWorld();
    y.stage();
    const empty = `${registryFile(y.home)}.lock`;
    writeFileSync(empty, "");
    assert.equal(recordUrl(y.home, SLUG, URL_1, { lockWaitMs: 100 }), "unread");
    utimesSync(empty, new Date(Date.now() - 60000), new Date(Date.now() - 60000));
    assert.equal(recordUrl(y.home, SLUG, URL_1), "");
  });
  it("stages under the registry's lock from the version it picks to the page it writes: a URL recorded meanwhile waits and is kept, and the same storyboard staged twice at once is one version", async () => {
    const x = lockWorld();
    x.stage();
    writeFileSync(join(x.from, "frames", "f001.jpg"), "v2");
    let child;
    const staged = stagePage(x.home, x.folder, { from: x.from, slug: SLUG, kind: "storyboard", episode: ID, title: "Know your costs: storyboard", beforeWrite: () => { child = runner(x, `console.log(m.recordUrl(${JSON.stringify(x.home)}, ${JSON.stringify(SLUG)}, ${JSON.stringify(URL_2)}, { lockWaitMs: 10000 }));`); pause(300); } });
    assert.equal(staged.version, 2);
    assert.equal((await child).trim(), "");
    assert.equal(pageOf(x.home, SLUG).url, URL_2);
    assert.equal(pageOf(x.home, SLUG).version, 2);
    // Two stagings of one new storyboard at once: the second finds the first's and stages nothing new.
    const z = lockWorld();
    const stageIt = `const s = m.stagePage(${JSON.stringify(z.home)}, ${JSON.stringify(z.folder)}, { from: ${JSON.stringify(z.from)}, slug: ${JSON.stringify(SLUG)}, kind: "storyboard", episode: "e", title: "t", beforeWrite: () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300) }); console.log(s.stage);`;
    const both = await Promise.all([runner(z, stageIt), runner(z, stageIt)]);
    assert.equal(both[0].trim(), both[1].trim());
    assert.ok(!existsSync(join(realOf(z.folder), STORYBOARDS, SLUG, "v2")));
    assert.equal(pageOf(z.home, SLUG).version, 1);
  });
  it("records nothing when the result names two artifacts, even one her chat put in the title, or is larger than it looks through", () => {
    const w = lockWorld();
    w.stage();
    const p = publish(w);
    for (const response of [
      { content: [{ text: "https://claude.ai/artifact/AnotherOfHers" }, { text: `Published at ${URL_1}` }] },
      { input: { title: `see ${URL_2}` }, url: URL_1 },
      [URL_1, `${URL_1}/`, URL_2],
      { text: `${URL_1} ${"x".repeat(70 * 1024)}` }
    ]) assert.equal(recordPublished(w.home, posted(p, { response }), { folder: w.folder }), "no url", JSON.stringify(response).slice(0, 80));
    assert.equal(pageOf(w.home, SLUG).url, null);
  });
  it("never stages a title that names a link: the page is called Storyboard", async () => {
    for (const title of ["https://claude.ai/artifact/AnotherOfHers", "see claude.ai/artifact/x", "Costs: ftp://x", "CLAUDE.AI pricing"]) {
      const w = lockWorld();
      w.stage({ title });
      assert.equal(pageOf(w.home, SLUG).title, "Storyboard", title);
      assert.equal(publish(w).title, "Storyboard", title);
    }
    const w = lockWorld();
    w.stage({ title: "Know your costs: storyboard" });
    assert.equal(pageOf(w.home, SLUG).title, "Know your costs: storyboard");
  });
});

// --- Her words: reelkit storyboard ---

const done = [];
after(() => {
  for (const t of done) t.done();
});
const NAME_2 = "Pricing- what to charge- reel 2 3fa9c1 Reel Kit v1";
/** Nothing she reads holds a path, a flag or the name of a command; the lines for Claude are marked as such. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|reelkit|\.json\b/;
const FOR_CLAUDE = "For Claude: ";

/** The made-up episode with a Reel Kit edit of Reel 2 at its storyboard, and Reel Kit's kit and Python on this Mac: Python a small script
    that runs the stand-in of Reel Kit's scripts, `scenario` baked in. */
function edited({ state = "storyboard", scenario = "" } = {}) {
  const project = entryOf({ key: "reel 2", name: NAME_2, mode: "lofi", version: 1, at: "2026-11-23T10:00:00-06:00", machine: "Mac Studio", fromSuggestion: 2, from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" }, workingCopy: { bytes: 11, seconds: 7.907, fps: 30 } });
  const { t, found } = episode({ ...RAW, answer: { ...ANSWERED, seen: "wide, 0:23, no retakes" }, version: 4, app: { toolchain: "0.8.208", projects: [project] } });
  done.push(t);
  mkdirSync(join(kitDir(t.home), "pipeline"), { recursive: true });
  writeFileSync(join(kitDir(t.home), "pipeline", "new.py"), "# made up\n");
  mkdirSync(join(kitDir(t.home), "storyboard"), { recursive: true });
  writeFileSync(join(kitDir(t.home), "storyboard", "serve.py"), "# made up\n");
  mkdirSync(dirname(venvPython(t.home)), { recursive: true });
  const log = join(t.dir, "reel-kit.log");
  writeFileSync(venvPython(t.home), `#!/bin/sh\nREEL_KIT_STANDIN='${scenario}' REEL_KIT_STANDIN_LOG='${log}' exec '${process.execPath}' '${STAND_IN}' "$@"\n`);
  chmodSync(venvPython(t.home), 0o755);
  const dir = join(episodeWork(t.home, FOLDER), NAME_2);
  storyboardAt(dir);
  writeState(dir, { slug: SLUG, key: "reel 2", mode: "lofi", version: 1, title: "Know your costs", name: NAME_2, state, step: "storyboard" });
  mkdirSync(studioFolder(t.home), { recursive: true });
  // A process runs while it can be signalled: this one, and the local page's stand-in.
  t.ctx.deps.alive = (pid) => running(pid);
  const opened = [];
  return { t, found, dir, log, opened, reelKit: { open: (url) => opened.push(url), serveWaitMs: 5000 } };
}
async function reelkit(w, words) {
  const said = [];
  const code = await editMain(["reelkit", ...words], { ...w.t.ctx.deps, reelKit: w.reelKit, say: (line) => said.push(line) });
  return { code, said };
}
const hers = (said) => said.filter((line) => !line.startsWith(FOR_CLAUDE));
const publishOf = (said) => JSON.parse(said.find((line) => line.startsWith(`${FOR_CLAUDE}publish`)).replace(/^[^{]*/, ""));

describe("reelkit storyboard", () => {
  it("stages the newest storyboard and prints, for her chat, the exact publish to make; then its URL is recorded once and later versions go to it", async () => {
    const w = edited();
    const r = await reelkit(w, ["storyboard", FOLDER, SLUG]);
    assert.equal(r.code, 0, r.said.join("\n"));
    const input = publishOf(r.said);
    assert.deepEqual(input, publishInput(pageOf(w.t.home, SLUG)));
    assert.equal(input.file_path, join(realOf(studioFolder(w.t.home)), STORYBOARDS, SLUG, "v1", "index.html"));
    assert.equal(input.url, undefined);
    assert.deepEqual(input.capabilities, CAPABILITIES);
    assert.deepEqual(hers(r.said), [STORYBOARD_SAY.first("Reel 2 (lo-fi, version 1)")]);
    for (const line of hers(r.said)) assert.doesNotMatch(line, PLAIN, line);
    assert.ok(!r.said.some((line) => line.includes("published")), "no word for her chat to record the link: the hook does");
    // Both locks let that very publish through.
    const strict = guardDecision({ tool_name: "Artifact", tool_input: input }, { checkout: "/checkout", node: "/opt/homebrew/bin/node", folder: studioFolder(w.t.home) });
    assert.equal(strict.decision, "allow");

    // The first URL, recorded by the hook from the publish's own result; her chat has no word for it any more.
    assert.equal(recordPublished(w.t.home, posted(input, { url: URL_1 }), { folder: studioFolder(w.t.home) }), "");
    assert.equal(recordPublished(w.t.home, posted(input, { url: URL_2 }), { folder: studioFolder(w.t.home) }), "input", "the page has its URL: no first publish");
    assert.equal(pageOf(w.t.home, SLUG).url, URL_1);
    const gone = await reelkit(w, ["published", FOLDER, SLUG, URL_1]);
    assert.deepEqual([gone.code, gone.said], [2, [HELP]]);

    // The next version: staged as v2, published to the same URL.
    writeFileSync(join(w.dir, "storyboard", "frames", "f001.jpg"), "v2's frame");
    const again = await reelkit(w, ["storyboard", FOLDER, SLUG]);
    assert.equal(again.code, 0, again.said.join("\n"));
    const second = publishOf(again.said);
    assert.equal(second.url, URL_1);
    assert.equal(second.file_path, join(realOf(studioFolder(w.t.home)), STORYBOARDS, SLUG, "v2", "index.html"));
    assert.deepEqual(hers(again.said), [STORYBOARD_SAY.again("Reel 2 (lo-fi, version 1)")]);
    assert.ok(!again.said.some((line) => line.includes("published")));
  });
  it("shows no storyboard while the edit is being made, and none of an edit it does not know", async () => {
    const w = edited({ state: "working" });
    writeState(w.dir, { slug: SLUG, key: "reel 2", mode: "lofi", version: 1, title: "Know your costs", name: NAME_2, state: "working", step: "build", pid: process.pid });
    let r = await reelkit(w, ["storyboard", FOLDER, SLUG]);
    assert.deepEqual([r.code, r.said], [1, [EDIT_SAY.busy]]);
    assert.equal(pageOf(w.t.home, SLUG), null);
    r = await reelkit(w, ["storyboard", FOLDER, "3fa9c1-reel-9-v1"]);
    assert.deepEqual([r.code, r.said], [1, [EDIT_SAY.noSuchEdit]]);
    r = await reelkit(w, ["storyboard", FOLDER]);
    assert.deepEqual([r.code, r.said], [2, [HELP]]);
  });
  it("gives the page no title her chat wrote a link into", async () => {
    const w = edited();
    writeState(w.dir, { slug: SLUG, key: "reel 2", mode: "lofi", version: 1, title: "https://claude.ai/artifact/AnotherOfHers", name: NAME_2, state: "storyboard", step: "storyboard" });
    const r = await reelkit(w, ["storyboard", FOLDER, SLUG]);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.equal(publishOf(r.said).title, "Storyboard");
    assert.ok(!r.said.some((line) => line.includes("AnotherOfHers")));
  });
  it("says so in one line when the storyboard can't be made ready, and stages nothing", async () => {
    const w = edited();
    writeFileSync(join(w.dir, "storyboard", "files.json"), JSON.stringify(["../../secret.txt"]));
    const r = await reelkit(w, ["storyboard", FOLDER, SLUG]);
    assert.deepEqual([r.code, r.said], [1, [STORYBOARD_SAY.notStaged]]);
    assert.equal(pageOf(w.t.home, SLUG), null);
  });
  it("serves the local page on 127.0.0.1 only, and its go reads as a go", async () => {
    const w = edited({ scenario: "go" });
    const r = await reelkit(w, ["storyboard", FOLDER, SLUG, "local"]);
    assert.equal(r.code, 0, r.said.join("\n"));
    assert.deepEqual(r.said, [STORYBOARD_SAY.local, STORYBOARD_SAY.localHow]);
    assert.equal(STORYBOARD_SAY.local, "Your storyboard is open on this Mac.");
    for (const line of r.said) assert.doesNotMatch(line, PLAIN, line);
    assert.deepEqual(w.opened, ["http://127.0.0.1:8765/"]);
    const runs = readFileSync(w.log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(runs.map((run) => [run.script, run.folder, run.args, run.isolated]), [["serve.py", "storyboard", [w.dir, "--port", "8765"], true]]);
    assert.equal(runs[0].env.HF_HUB_OFFLINE, "1");
    // Its "Looks good: render it" lands in Reel Kit's notes file as a go: no change for revise, and status says to say go.
    await waitFor(() => (readNotes(w.dir) ?? []).some((n) => n.beat === "all" && n.text === "go"));
    const revise = await reelkit(w, ["revise", FOLDER, SLUG]);
    assert.deepEqual([revise.code, revise.said], [1, [EDIT_SAY.noNotes]]);
    const status = await reelkit(w, ["status", FOLDER]);
    assert.deepEqual(status.said, [`Reel 2 (lo-fi, version 1): ${EDIT_SAY.pageGo}`]);
    // One local page at a time: a second start stops the first.
    const first = JSON.parse(readFileSync(join(w.t.home, "Library", "Application Support", "BRIMM Video", "storyboard-local.json"), "utf8")).pid;
    const again = await reelkit(w, ["storyboard", FOLDER, SLUG, "local"]);
    assert.equal(again.code, 0, again.said.join("\n"));
    const second = JSON.parse(readFileSync(join(w.t.home, "Library", "Application Support", "BRIMM Video", "storyboard-local.json"), "utf8")).pid;
    assert.notEqual(first, second);
    await waitFor(() => !running(first));
    process.kill(second, "SIGTERM");
  });
  it("says when the local page couldn't be opened, and opens no browser", async () => {
    const w = edited({ scenario: "fail" });
    const r = await reelkit(w, ["storyboard", FOLDER, SLUG, "local"]);
    assert.deepEqual([r.code, r.said], [1, [STORYBOARD_SAY.localFailed]]);
    assert.deepEqual(w.opened, []);
  });
});

function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function waitFor(test) {
  for (let i = 0; i < 500; i++) {
    if (test()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("waited too long");
}
