// `refs`: the reference folder from Sallie's chat (PR H3; design 2026-11-03, section 7). `refs` says what is in it; `refs look "<name>"` copies a
// picture into Looking/, inside her BRIMM Video Studio folder, for Claude to look at; `refs use "<episode>" "<name>" [reel <n>]` copies a picture
// into the episode's HyperFrames project on this Mac as brimm/references/<file>. edit.js is only the wiring here (references.js is the module).
// Studio only ever READS the folder: a test below proves that every command leaves its names and bytes as they were, with the folder made
// read-only meanwhile. No test runs sips, the app, HyperFrames or Claude: the programs are stand-ins (tests/episodes.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { NOT_SET_UP } from "../app.js";
import { reelStretch } from "../app-reel.js";
import { listReferences } from "../references.js";
import { PIN } from "../hyperframes.js";
import { episodeWork, referencesFolder, workFolder, writeSettings } from "../settings.js";
import { guardDecision, studioFolder } from "../studio.js";
import { reelCopyKey, reelCopyPaths, workCopyKey, workCopyPaths } from "../workcopy.js";
import { FOLDER, NAME, listAll, reread } from "./episodes.js";
import { episode, episodeFiles } from "./phase4.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}
/** Nothing she reads holds a path, a flag or the name of a command: but for the one line that is for Claude, `Picture to look at: <path>`,
    which her skill never repeats to her. That rule wins over the brief's wording of what to say in HyperFrames: it names the picture by its stem. */
const PLAIN = /\/|--|\bnpx\b|\bnode\b|edit\.js|hyperframes\.mjs|\bsips\b/;
const isPlain = (line) => !PLAIN.test(line);
/** A picture's extension, which the words she is told to say never hold. */
const EXTENSION = /\.(?:png|jpe?g|heic|webp|gif|tiff?)\b/i;

const AT = "2026-10-20T15:00:00-05:00";
const ANSWER = { state: "needs your answer", guess: "raw", seen: "wide, 0:23, no retakes", came: "camera" };
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
const RAW = { version: 3, kind: "raw", answer: ANSWERED };
const FINISHED = { ...RAW, kind: "finished" };
const SHORT = { ...RAW, kind: "short video" };
const UNANSWERED_RECORD = { version: 3, kind: null, answer: ANSWER, label: "Video of 20 Oct, 15:00 (Mac Studio)" };
const LEFT_RECORD = { ...UNANSWERED_RECORD, answer: { ...ANSWER, state: "not for brimm-video" } };
const SESSION_RECORD = { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Session, 2026-10-20", session: SESSION_MARK };

const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT_ALONE = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const NO_FOLDER = "There's no reference folder on this Mac yet: ask Jason.";
const EMPTY = "The reference folder is empty. Add screenshots or pictures to References, in the BRIMM Video folder in Dropbox.";
const COMING = "It's still coming down from Dropbox. Say it again in a minute.";
const MAIN_PROJECT = "Pricing- what to charge- main 3fa9c1";
const REEL_PROJECT = "Pricing- what to charge- reel 2 3fa9c1";

/** What the reference folder holds in most tests: three pictures, a video, and a dot file that Finder and Dropbox keep. Each file holds its
    own name, so that a copy of it is told by what is in it. */
const PICTURES = { "blue carousel.png": "BLUE CAROUSEL BYTES", "quote card.jpg": "QUOTE CARD BYTES", "title style.heic": "A HEIC PICTURE", "launch.mov": "A VIDEO", ".DS_Store": "FINDER" };

/** The record of an episode with these projects made on this Mac (layout 4), as the record keeps them. */
const project = (key, name, over = {}) => ({
  key, name, madeAt: "2026-10-19T10:00:00-05:00", on: "Mac Studio", from: { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" },
  workingCopy: { bytes: 3, seconds: 23.423, fps: 30 }, opened: ["2026-10-19T10:05:00-05:00"], handover: false, fromSuggestion: key === "main" ? null : 2, state: "opened", ...over
});
const withProjects = (record, projects) => ({ ...record, version: 4, app: { toolchain: PIN.version, projects } });
/** A project's folder as the app's project has it, in the episode's work folder on this Mac, with a few files of the kinds a project holds. */
function projectFolder(work, name) {
  const dir = join(work, name);
  for (const [path, text] of Object.entries({ "index.html": "<html></html>", "transcript.json": "[]", "CLAUDE.md": "rules", "brimm/facts.json": "{}", "brimm/graphic-cues.json": "{}", "assets/logos/logo.svg": "<svg/>", "media/recording.mp4": "video" })) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

/** The made-up episode, answered as `record` says, with the reference folder holding `pictures` (none when it is false, so that there is no
    folder). `set`: this Mac's settings turn the app on. `projects`: the projects the record lists and the folders are made for. */
function world({ record = RAW, set = true, pictures = PICTURES, programs = {}, projects = [] } = {}) {
  const listed = projects.length ? withProjects(record, projects.map(([key, name, over]) => project(key, name, over))) : record;
  const { t, found } = episode(listed, programs, episodeFiles({ picked: false }));
  if (set) writeSettings(t.home, { app: "hyperframes" });
  const folder = referencesFolder(t.root);
  if (pictures) {
    mkdirSync(folder, { recursive: true });
    for (const [name, bytes] of Object.entries(pictures)) writeFileSync(join(folder, name), bytes);
  }
  const work = episodeWork(t.home, FOLDER);
  // A project made on another Mac has no folder here.
  for (const [, name, over] of projects) if (!over?.on || over.on === "Mac Studio") projectFolder(work, name);
  return { t, found, folder, work, looking: join(studioFolder(t.home), "Looking") };
}
/** Every file of a folder at any depth with its size, its time and what it holds, and the folders' own times: what "unchanged" means. */
function snapshotOf(dir) {
  const out = {};
  const walk = (at) => {
    out[at.slice(dir.length) || "/"] = [statSync(at).mtimeMs];
    for (const name of readdirSync(at).sort()) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else out[path.slice(dir.length)] = [statSync(path).size, statSync(path).mtimeMs, createHash("sha1").update(readFileSync(path)).digest("hex")];
    }
  };
  walk(dir);
  return out;
}
/** Make a folder and everything in it read-only while `work` runs, so that a write into it fails where it is tried, and give it back after. */
async function readOnly(dir, work) {
  const all = [];
  const walk = (at) => {
    all.push(at);
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else all.push(path);
    }
  };
  walk(dir);
  for (const path of all.reverse()) chmodSync(path, statSync(path).isDirectory() ? 0o555 : 0o444);
  try {
    return await work();
  } finally {
    for (const path of all.reverse()) chmodSync(path, statSync(path).isDirectory() ? 0o755 : 0o644);
  }
}
/** The success line of `refs use`: the picture is named by its stem, with no folder and no extension, in both sentences; `of` is "" for the
    main video and "Reel 2 of " for a Reel. */
const DONE = (stem, of = "") => `The ${stem} is in the HyperFrames project for ${of}${NAME}. In HyperFrames, say "Use the ${stem} picture as the style for the graphics".`;

describe("refs: the command", () => {
  it("is one of edit.js's commands, with its three usages in the help", () => {
    assert.ok(COMMAND_NAMES.includes("refs"));
    const usages = HELP.split("\n").filter((line) => line.startsWith("  node edit.js refs"));
    assert.deepEqual(usages.map((line) => line.split(/ {2,}/)[1]), ["node edit.js refs", 'node edit.js refs look "<name>"', 'node edit.js refs use "<episode>" "<name>" [reel <n>]']);
  });
  it("says the help, and ends with 2, for words it does not take, and writes nothing", async () => {
    const { t, folder, looking } = world({ projects: [["main", MAIN_PROJECT]] });
    const before = snapshotOf(folder);
    for (const rest of [["look"], ["look", ""], ["look", "a", "b"], ["use"], ["use", FOLDER], ["use", FOLDER, "blue carousel", "reel"], ["use", FOLDER, "blue carousel", "reel", "0"], ["list"], ["blue carousel"]]) {
      const r = await on(t.ctx.deps, "refs", ...rest);
      assert.deepEqual([r.code, r.said], [2, [HELP]], rest.join(" "));
    }
    assert.deepEqual([snapshotOf(folder), existsSync(looking), t.started, t.calls.filter((c) => c.cmd === "SIPS")], [before, false, [], []]);
    t.done();
  });
});

describe("refs: the README", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const rows = readme.split("\n").filter((line) => line.startsWith("| `refs"));
  it("has a row for each of its three forms, and a row for the module in the table of files", () => {
    assert.deepEqual(rows.map((row) => row.split(" | ")[0]), ["| `refs`", '| `refs look "<name>"`', '| `refs use "<episode>" "<name>" [reel <n>]`']);
    assert.ok(readme.split("\n").some((line) => line.startsWith("| `tool/references.js` |")));
  });
  it("says in them what the brief says of each: that Studio only reads the folder, the line for Claude, the words to say in HyperFrames, and the gate", () => {
    const [list, look, use] = rows;
    for (const words of ["**Studio only reads the reference folder**", "names no episode"]) assert.ok(list.includes(words), words);
    for (const words of ["Picture to look at: <path>", "never to repeat the path to her", "`Looking/`", "/usr/bin/sips -s format jpeg", "It can't be used: Studio couldn't turn <name> into a picture it can read.", "It's still coming down from Dropbox. Say it again in a minute."]) assert.ok(look.includes(words), words);
    for (const words of ["brimm/references/<file>", 'In HyperFrames, say "Use the blue carousel picture as the style for the graphics".', "as for `app`", "`refs` is in no gate list", 'Open it in HyperFrames first: say "open <name> in HyperFrames".']) assert.ok(use.includes(words), words);
  });
});

describe("refs: what is in the reference folder", () => {
  it("lists the pictures, and then the files that are not pictures, which Studio does not use, and leaves out the dot files", async () => {
    const { t } = world();
    const r = await on(t.ctx.deps, "refs");
    assert.deepEqual([r.code, r.said], [0, [
      "The reference folder has 3 pictures: blue carousel.png, quote card.jpg and title style.heic.",
      "It also holds 1 file that isn't a picture, which Studio doesn't use: launch.mov."
    ]]);
    t.done();
  });
  it("counts one picture and two other files in the right words, the names in order", async () => {
    const { t } = world({ pictures: { "only one.png": "x", "b.pdf": "x", "a.mov": "x" } });
    const r = await on(t.ctx.deps, "refs");
    assert.deepEqual(r.said, ["The reference folder has 1 picture: only one.png.", "It also holds 2 files that aren't pictures, which Studio doesn't use: a.mov and b.pdf."]);
    t.done();
  });
  it("says it has no pictures yet, and what else it holds, when it holds only files that are not pictures", async () => {
    const { t } = world({ pictures: { "launch.mov": "x" } });
    const r = await on(t.ctx.deps, "refs");
    assert.deepEqual([r.code, r.said], [0, ["The reference folder has no pictures yet. Add screenshots or pictures to References, in the BRIMM Video folder in Dropbox.", "It holds 1 file that isn't a picture, which Studio doesn't use: launch.mov."]]);
    t.done();
  });
  it("says it is empty, and where to add pictures, when nothing is in it but dot files", async () => {
    for (const pictures of [{}, { ".DS_Store": "x", ".dropbox": "x" }]) {
      const { t } = world({ pictures });
      const r = await on(t.ctx.deps, "refs");
      assert.deepEqual([r.code, r.said], [0, [EMPTY]], JSON.stringify(pictures));
      t.done();
    }
  });
  it("says there is no reference folder on this Mac yet, and to ask Jason, when there is none, and ends with 1", async () => {
    const { t } = world({ pictures: false });
    const r = await on(t.ctx.deps, "refs");
    assert.deepEqual([r.code, r.said], [1, [NO_FOLDER]]);
    t.done();
  });
  it("names no episode, so that it runs on a Mac whose only video waits for its answer, and says nothing of that video", async () => {
    const { t } = world({ record: UNANSWERED_RECORD });
    const r = await on(t.ctx.deps, "refs");
    assert.equal(r.code, 0);
    assert.ok(!r.text.includes("waiting for its answer") && !r.text.includes(FOLDER) && !r.text.includes("Pricing talk"), r.text);
    for (const line of r.said) assert.ok(isPlain(line), line);
    t.done();
  });
});

describe("refs look", () => {
  it("copies the picture into Looking, in her BRIMM Video Studio folder, made when it is first needed, and says only where it is, for Claude", async () => {
    const { t, looking } = world();
    assert.ok(!existsSync(looking));
    const r = await on(t.ctx.deps, "refs", "look", "blue carousel");
    assert.deepEqual([r.code, r.said], [0, [`Picture to look at: ${join(looking, "blue carousel.png")}`]]);
    assert.equal(looking, join(t.home, "BRIMM Video Studio", "Looking"));
    assert.equal(readFileSync(join(looking, "blue carousel.png"), "utf8"), PICTURES["blue carousel.png"]);
    assert.deepEqual(readdirSync(looking), ["blue carousel.png"]);
    assert.deepEqual(t.calls.filter((c) => c.cmd === "SIPS"), []);
    t.done();
  });
  it("finds the picture by the name she says, as a stem in any case, a part of a stem or the whole name", async () => {
    for (const said of ["Blue Carousel", "carousel", "blue carousel.png", "BLUE CAROUSEL.PNG"]) {
      const { t, looking } = world();
      const r = await on(t.ctx.deps, "refs", "look", said);
      assert.deepEqual([r.code, r.said], [0, [`Picture to look at: ${join(looking, "blue carousel.png")}`]], said);
      t.done();
    }
  });
  it("replaces a picture of the same name, and leaves the others there", async () => {
    const { t, folder, looking } = world();
    await on(t.ctx.deps, "refs", "look", "blue carousel");
    await on(t.ctx.deps, "refs", "look", "quote card");
    writeFileSync(join(folder, "blue carousel.png"), "A NEW SCREENSHOT");
    const r = await on(t.ctx.deps, "refs", "look", "blue carousel");
    assert.equal(r.code, 0);
    assert.deepEqual(readdirSync(looking).sort(), ["blue carousel.png", "quote card.jpg"]);
    assert.equal(readFileSync(join(looking, "blue carousel.png"), "utf8"), "A NEW SCREENSHOT");
    assert.equal(readFileSync(join(looking, "quote card.jpg"), "utf8"), PICTURES["quote card.jpg"]);
    t.done();
  });
  it("prints a path that the guard lets a Read through, which is why the guard needs no change, and one outside her folder it does not", async () => {
    const { t, folder } = world();
    const r = await on(t.ctx.deps, "refs", "look", "blue carousel");
    const path = r.said[0].replace("Picture to look at: ", "");
    const rules = { checkout: "/checkout", node: "node", folder: studioFolder(t.home) };
    assert.deepEqual(guardDecision({ tool_name: "Read", tool_input: { file_path: path }, cwd: studioFolder(t.home) }, rules), { decision: "pass", reason: "" });
    assert.equal(guardDecision({ tool_name: "Read", tool_input: { file_path: join(folder, "blue carousel.png") }, cwd: studioFolder(t.home) }, rules).decision, "deny");
    t.done();
  });
  it("turns a HEIC picture into a JPEG of the same stem with sips, writing the original nowhere and the result beside the other copies", async () => {
    const { t, folder, looking } = world();
    const before = snapshotOf(folder);
    const r = await on(t.ctx.deps, "refs", "look", "title style");
    assert.deepEqual([r.code, r.said], [0, [`Picture to look at: ${join(looking, "title style.jpg")}`]]);
    const [call, ...more] = t.calls.filter((c) => c.cmd === "SIPS");
    assert.equal(more.length, 0);
    assert.deepEqual(call.args.slice(0, 5), ["-s", "format", "jpeg", join(folder, "title style.heic"), "--out"]);
    // It is told where to write, never over the original and never in the reference folder: a folder of this Mac's own, under the name it
    // will have, and the copy is moved into Looking when it is whole; that folder is gone after.
    const out = call.args[5];
    assert.equal(extname(out), ".jpg");
    assert.ok(out.startsWith(join(t.home, "BRIMM Video Work")) && !out.startsWith(folder) && out !== join(looking, "title style.jpg"), out);
    assert.ok(!existsSync(dirname(out)), "the place it was made in is taken away");
    assert.equal(call.args.length, 6);
    assert.deepEqual(readdirSync(looking), ["title style.jpg"]);
    assert.equal(readFileSync(join(looking, "title style.jpg"), "utf8"), "a JPEG made by sips");
    assert.deepEqual(snapshotOf(folder), before);
    t.done();
  });
  it("makes a JPEG of a TIF and a TIFF picture too, whatever the case of the extension, and leaves a JPEG, WebP and GIF as they are", async () => {
    const { t, looking } = world({ pictures: { "scan.TIF": "a", "scan two.tiff": "b", "photo.jpeg": "c", "anim.gif": "d", "web.webp": "e" } });
    for (const [said, made] of [["scan", "scan.jpg"], ["scan two", "scan two.jpg"], ["photo", "photo.jpeg"], ["anim", "anim.gif"], ["web", "web.webp"]]) {
      const r = await on(t.ctx.deps, "refs", "look", said);
      assert.deepEqual([r.code, r.said], [0, [`Picture to look at: ${join(looking, made)}`]], said);
    }
    assert.deepEqual(t.calls.filter((c) => c.cmd === "SIPS").map((c) => c.args[3].split("/").pop()), ["scan.TIF", "scan two.tiff"]);
    assert.deepEqual(readdirSync(looking).sort(), ["anim.gif", "photo.jpeg", "scan two.jpg", "scan.jpg", "web.webp"]);
    t.done();
  });
  it("says it can't be used, in words, when sips fails, ends with 1, and leaves nothing in Looking, whether sips says it failed, wrote nothing or ran out of time", async () => {
    const failures = {
      "ended with an error": () => ({ code: 13, stderr: "Error 13: no such file" }),
      "wrote nothing": () => ({ code: 0, stderr: "" }),
      "ran out of time": () => ({ code: 1, stderr: "", outOfTime: true }),
      "wrote a part and failed": (args) => {
        writeFileSync(args[args.indexOf("--out") + 1], "half");
        return { code: 1, stderr: "Error" };
      }
    };
    for (const [what, SIPS] of Object.entries(failures)) {
      const { t, folder, looking } = world({ programs: { SIPS } });
      const before = snapshotOf(folder);
      const r = await on(t.ctx.deps, "refs", "look", "title style");
      assert.deepEqual([r.code, r.said], [1, ["It can't be used: Studio couldn't turn title style.heic into a picture it can read."]], what);
      assert.deepEqual([existsSync(looking) ? readdirSync(looking) : [], snapshotOf(folder)], [[], before], what);
      t.done();
    }
  });
  it("says there is no such picture, and which there are, for a name that fits none", async () => {
    const { t, looking } = world();
    const r = await on(t.ctx.deps, "refs", "look", "blue carusel");
    assert.deepEqual([r.code, r.said, existsSync(looking)], [1, ['There\'s no "blue carusel" in the reference folder. It has: blue carousel.png, quote card.jpg and title style.heic.'], false]);
    t.done();
  });
  it("asks which one, with or between the names, for a name that fits several, and copies none", async () => {
    for (const [pictures, said, words] of [
      [{ "blue carousel.png": "a", "blue carousel 2.png": "b", "red.png": "c" }, "carousel", "Which one? blue carousel.png or blue carousel 2.png"],
      [{ "a one.png": "a", "a two.png": "b", "a three.png": "c" }, "a", "Which one? a one.png, a three.png or a two.png"]
    ]) {
      const { t, looking } = world({ pictures });
      const r = await on(t.ctx.deps, "refs", "look", said);
      assert.deepEqual([r.code, r.said, existsSync(looking)], [1, [words], false], said);
      t.done();
    }
  });
  it("says there is no such picture, and that the folder has none, when it has no pictures", async () => {
    const { t } = world({ pictures: { "launch.mov": "x" } });
    const r = await on(t.ctx.deps, "refs", "look", "blue");
    assert.deepEqual([r.code, r.said], [1, ['There\'s no "blue" in the reference folder, which has no pictures yet.']]);
    t.done();
  });
  it("says a file that is not a picture is none, by its stem or its name, and uses nothing of it", async () => {
    const { t, folder, looking } = world({ pictures: { ...PICTURES, "notes.pdf": "n", "launch.txt": "m" } });
    const before = snapshotOf(folder);
    for (const said of ["notes", "NOTES.PDF"]) {
      const r = await on(t.ctx.deps, "refs", "look", said);
      assert.deepEqual([r.code, r.said], [1, ["notes.pdf isn't a picture, so Studio doesn't use it."]], said);
    }
    const two = await on(t.ctx.deps, "refs", "look", "launch");
    assert.deepEqual([two.code, two.said], [1, ["launch.mov and launch.txt aren't pictures, so Studio doesn't use them."]]);
    assert.deepEqual([existsSync(looking), snapshotOf(folder), t.calls.filter((c) => c.cmd === "SIPS")], [false, before, []]);
    t.done();
  });
  it("says there is no reference folder on this Mac yet when there is none", async () => {
    const { t, looking } = world({ pictures: false });
    const r = await on(t.ctx.deps, "refs", "look", "blue carousel");
    assert.deepEqual([r.code, r.said, existsSync(looking)], [1, [NO_FOLDER], false]);
    t.done();
  });
  it("asks Dropbox to bring a picture that is online only, by reading it, and says to say it again in a minute if it is still not whole", async () => {
    const { t, folder, looking } = world();
    const online = join(folder, "blue carousel.png");
    const reads = [];
    const deps = { ...t.ctx.deps, isWhole: (path) => path !== online, readAll: async (path, opts) => reads.push([path, opts?.quietMs]) };
    const r = await on(deps, "refs", "look", "blue carousel");
    assert.deepEqual([r.code, r.said, reads.map(([path]) => path), existsSync(looking)], [1, [COMING], [online], false]);
    assert.ok(reads[0][1] > 0 && reads[0][1] <= 60000, "it gives up a read that brings nothing, in under a minute");
    // A read that cannot be done is the same: it is still coming.
    const failing = await on({ ...deps, readAll: async () => { throw new Error("Dropbox sent nothing of it for 20 seconds, so it was given up"); } }, "refs", "look", "blue carousel");
    assert.deepEqual([failing.code, failing.said], [1, [COMING]]);
    t.done();
  });
  it("goes on with the picture once the read has brought it down", async () => {
    const { t, folder, looking } = world();
    const online = join(folder, "blue carousel.png");
    let here = false;
    const deps = { ...t.ctx.deps, isWhole: (path) => path !== online || here, readAll: async () => { here = true; } };
    const r = await on(deps, "refs", "look", "blue carousel");
    assert.deepEqual([r.code, r.said], [0, [`Picture to look at: ${join(looking, "blue carousel.png")}`]]);
    t.done();
  });
  it("reads no picture it does not copy: a name that is not found or not whole reads and copies nothing", async () => {
    const { t } = world();
    const reads = [];
    const deps = { ...t.ctx.deps, isWhole: () => false, readAll: async (path) => reads.push(path) };
    await on(deps, "refs", "look", "nothing like it");
    await on(deps, "refs", "look", "launch");
    assert.deepEqual(reads, []);
    t.done();
  });
  it("names no episode and writes no record: it runs for a Mac whose only video waits for its answer, and starts nothing", async () => {
    const { t, found, looking } = world({ record: UNANSWERED_RECORD });
    const before = [reread(found).rev, listAll(found.folder)];
    const r = await on(t.ctx.deps, "refs", "look", "blue carousel");
    assert.deepEqual([r.code, r.said], [0, [`Picture to look at: ${join(looking, "blue carousel.png")}`]]);
    assert.deepEqual([reread(found).rev, listAll(found.folder), t.started, t.waits], [...before, [], []]);
    t.done();
  });
});

describe("refs use: a picture into the episode's HyperFrames project on this Mac", () => {
  const both = [["main", MAIN_PROJECT], ["reel 2", REEL_PROJECT]];
  it("copies the picture into the main video's project as brimm/references/<file>, and says what to say in HyperFrames", async () => {
    const { t, work } = world({ projects: both });
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([r.code, r.said], [0, [DONE("blue carousel")]]);
    assert.equal(readFileSync(join(work, MAIN_PROJECT, "brimm", "references", "blue carousel.png"), "utf8"), PICTURES["blue carousel.png"]);
    assert.deepEqual(readdirSync(join(work, MAIN_PROJECT, "brimm", "references")), ["blue carousel.png"]);
    t.done();
  });
  it("tells her no path and no extension: what she is to say names the picture by its stem, as the line before it does", async () => {
    const { t } = world({ projects: both });
    for (const rest of [["blue carousel"], ["quote card", "reel", "2"], ["title style"]]) {
      const r = await on(t.ctx.deps, "refs", "use", FOLDER, ...rest);
      assert.equal(r.code, 0, r.text);
      assert.equal(r.said.length, 1);
      assert.ok(isPlain(r.said[0]), r.said[0]);
      assert.doesNotMatch(r.said[0], EXTENSION);
      assert.doesNotMatch(r.said[0], /brimm|references/);
      assert.match(r.said[0], /^The (.+) is in the HyperFrames project for .+\. In HyperFrames, say "Use the \1 picture as the style for the graphics"\.$/);
    }
    t.done();
  });
  it("names the picture by its whole stem, in the file's own case, however much of it she said", async () => {
    const { t } = world({ pictures: { "Blue Carousel.PNG": "a", "quote card.jpg": "b" }, projects: both });
    for (const said of ["Blue Carousel", "blue carousel", "CAROUSEL", "blue carousel.png"]) {
      const r = await on(t.ctx.deps, "refs", "use", FOLDER, said);
      assert.deepEqual([r.code, r.said], [0, [DONE("Blue Carousel")]], said);
    }
    t.done();
  });
  it("makes the project's one new file and touches no other: the rest of the project has the same names, bytes and times, and the other project is as it was", async () => {
    for (const running of [false, true]) {
      const { t, work } = world({ projects: both });
      const main = snapshotOf(join(work, MAIN_PROJECT));
      const reel = snapshotOf(join(work, REEL_PROJECT));
      // With the app open or not: nothing asks it, and nothing in the project is changed.
      const r = await on({ ...t.ctx.deps, running: async () => running, pgrep: () => { throw new Error("nothing asks whether the app is running"); } }, "refs", "use", FOLDER, "blue carousel");
      assert.equal(r.code, 0, `${running}: ${r.text}`);
      const after = snapshotOf(join(work, MAIN_PROJECT));
      const added = Object.keys(after).filter((path) => !(path in main));
      assert.deepEqual(added, ["/brimm/references", "/brimm/references/blue carousel.png"], String(running));
      // Every file and folder as it was, but the folder that gained the new one: its own time moves with it.
      for (const path of Object.keys(main).filter((path) => path !== "/brimm")) assert.deepEqual(after[path], main[path], `${running}: ${path}`);
      assert.deepEqual(snapshotOf(join(work, REEL_PROJECT)), reel);
      t.done();
    }
  });
  it("copies it into Reel n's project for a Reel, and says so, in the Reel's words", async () => {
    const { t, work } = world({ projects: both });
    const main = snapshotOf(join(work, MAIN_PROJECT));
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "quote card", "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [DONE("quote card", "Reel 2 of ")]]);
    assert.equal(readFileSync(join(work, REEL_PROJECT, "brimm", "references", "quote card.jpg"), "utf8"), PICTURES["quote card.jpg"]);
    assert.deepEqual(snapshotOf(join(work, MAIN_PROJECT)), main);
    t.done();
  });
  it("copies a HEIC picture in as a JPEG of the same stem, and names the picture by that stem in what she is to say", async () => {
    const { t, folder, work } = world({ projects: both });
    const before = snapshotOf(folder);
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "title style");
    assert.deepEqual([r.code, r.said], [0, [DONE("title style")]]);
    assert.deepEqual(readdirSync(join(work, MAIN_PROJECT, "brimm", "references")), ["title style.jpg"]);
    assert.equal(readFileSync(join(work, MAIN_PROJECT, "brimm", "references", "title style.jpg"), "utf8"), "a JPEG made by sips");
    const [call] = t.calls.filter((c) => c.cmd === "SIPS");
    assert.ok(call.args.includes("--out") && !call.args[call.args.indexOf("--out") + 1].startsWith(folder), "sips is told to write outside the reference folder");
    assert.deepEqual(snapshotOf(folder), before);
    t.done();
  });
  it("says it can't be used, and leaves the project as it was, when sips fails", async () => {
    const { t, work } = world({ projects: both, programs: { SIPS: () => ({ code: 13, stderr: "Error 13" }) } });
    const main = snapshotOf(join(work, MAIN_PROJECT));
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "title style");
    assert.deepEqual([r.code, r.said], [1, ["It can't be used: Studio couldn't turn title style.heic into a picture it can read."]]);
    assert.deepEqual(snapshotOf(join(work, MAIN_PROJECT)), main);
    t.done();
  });
  it("puts the picture in again when it is said again: the file is replaced by the folder's, and nothing else is", async () => {
    const { t, folder, work } = world({ projects: both });
    await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    writeFileSync(join(folder, "blue carousel.png"), "A NEW SCREENSHOT");
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([r.code, r.said], [0, [DONE("blue carousel")]]);
    assert.deepEqual(readdirSync(join(work, MAIN_PROJECT, "brimm", "references")), ["blue carousel.png"]);
    assert.equal(readFileSync(join(work, MAIN_PROJECT, "brimm", "references", "blue carousel.png"), "utf8"), "A NEW SCREENSHOT");
    t.done();
  });
  it("writes no record, claims nothing, brings nothing and starts nothing", async () => {
    const { t, found, work } = world({ projects: both });
    const before = [reread(found).rev, listAll(found.folder)];
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.equal(r.code, 0);
    assert.deepEqual([reread(found).rev, listAll(found.folder), reread(found).editing ?? null, t.started, t.waits], [...before, null, [], []]);
    assert.ok(existsSync(join(work, MAIN_PROJECT, "brimm", "references")));
    t.done();
  });
  it("reads the episode as every command does: by its folder, its name or words of its name", async () => {
    for (const said of [FOLDER, NAME, "Pricing"]) {
      const { t } = world({ projects: both });
      const r = await on(t.ctx.deps, "refs", "use", said, "blue carousel");
      assert.deepEqual(r.said, [DONE("blue carousel")], said);
      t.done();
    }
  });
  it("tells her to open it in HyperFrames first when there is no project for it on this Mac, naming the Reel for a Reel, and copies nothing", async () => {
    const { t, work } = world({ projects: [] });
    const main = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([main.code, main.said], [1, [`Open it in HyperFrames first: say "open ${NAME} in HyperFrames".`]]);
    const reel = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel", "reel", "2");
    assert.deepEqual([reel.code, reel.said], [1, [`Open it in HyperFrames first: say "open Reel 2 of ${NAME} in HyperFrames".`]]);
    assert.ok(!existsSync(work) || readdirSync(work).every((name) => !existsSync(join(work, name, "brimm", "references"))));
    t.done();
  });
  it("says the same when the record lists a project whose folder is not on this Mac, made here, and when only the Reel has none", async () => {
    const gone = world({ projects: [["main", MAIN_PROJECT]] });
    rmSync(join(gone.work, MAIN_PROJECT), { recursive: true });
    assert.deepEqual((await on(gone.t.ctx.deps, "refs", "use", FOLDER, "blue carousel")).said, [`Open it in HyperFrames first: say "open ${NAME} in HyperFrames".`]);
    gone.t.done();
    const half = world({ projects: [["main", MAIN_PROJECT]] });
    assert.deepEqual((await on(half.t.ctx.deps, "refs", "use", FOLDER, "blue carousel", "reel", "2")).said, [`Open it in HyperFrames first: say "open Reel 2 of ${NAME} in HyperFrames".`]);
    half.t.done();
  });
  it("says in app's own words that the project is on another Mac, when it was made there and is not here, for the main video and a Reel", async () => {
    const THERE = (on, of = "") => `The HyperFrames project for ${of}${NAME} is on ${on}, and ${on} has not handed it over yet. On ${on}, say "I'm done with it for now", then say it again here. If that can't be done, ask Jason.`;
    const w = world({ projects: [["main", MAIN_PROJECT, { on: "Sallie's laptop" }], ["reel 2", REEL_PROJECT, { on: "Sallie's laptop" }]] });
    w.t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
    const main = await on(w.t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([main.code, main.said], [1, [THERE("Sallie's laptop")]]);
    // The same words app says of the same record.
    assert.deepEqual((await on(w.t.ctx.deps, "app", FOLDER)).said, [THERE("Sallie's laptop")]);
    const reel = await on(w.t.ctx.deps, "refs", "use", FOLDER, "blue carousel", "reel", "2");
    assert.deepEqual([reel.code, reel.said], [1, [THERE("Sallie's laptop", "Reel 2 of ")]]);
    assert.ok(!existsSync(join(w.work, MAIN_PROJECT)));
    w.t.done();
  });
  it("says what app says when the video was finished by her editor (it has no project) or is an iPhone clip (it has no Reels), and when this Mac is not set up", async () => {
    const finished = world({ record: FINISHED });
    assert.deepEqual((await on(finished.t.ctx.deps, "refs", "use", FOLDER, "blue carousel")).said, [`${NAME} was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames.`]);
    assert.deepEqual((await on(finished.t.ctx.deps, "app", FOLDER)).said, [`${NAME} was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames.`]);
    finished.t.done();
    const clip = world({ record: SHORT, projects: [["main", MAIN_PROJECT]] });
    const reel = await on(clip.t.ctx.deps, "refs", "use", FOLDER, "blue carousel", "reel", "1");
    assert.deepEqual([reel.code, reel.said], [1, ["A short video has no Reels."]]);
    clip.t.done();
    const off = world({ set: false, projects: [["main", MAIN_PROJECT]] });
    const r = await on(off.t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([r.code, r.said], [1, [NOT_SET_UP]]);
    off.t.done();
  });
  it("names a finished video's Reel project, which it has, the same way", async () => {
    const { t, work } = world({ record: FINISHED, projects: [["reel 2", REEL_PROJECT]] });
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "quote card", "reel", "2");
    assert.deepEqual([r.code, r.said], [0, [DONE("quote card", "Reel 2 of ")]]);
    assert.ok(existsSync(join(work, REEL_PROJECT, "brimm", "references", "quote card.jpg")));
    t.done();
  });
  it("says there is no such picture, which one, that it is no picture, that it is still coming down, or that there is no folder, as refs look does, and copies nothing", async () => {
    const cases = [
      [{}, "nothing like it", ['There\'s no "nothing like it" in the reference folder. It has: blue carousel.png, quote card.jpg and title style.heic.']],
      [{ pictures: { "blue carousel.png": "a", "blue carousel 2.png": "b" } }, "carousel", ["Which one? blue carousel.png or blue carousel 2.png"]],
      [{}, "launch", ["launch.mov isn't a picture, so Studio doesn't use it."]],
      [{ pictures: false }, "blue carousel", [NO_FOLDER]]
    ];
    for (const [over, said, words] of cases) {
      const { t, work } = world({ projects: both, ...over });
      const main = snapshotOf(join(work, MAIN_PROJECT));
      const r = await on(t.ctx.deps, "refs", "use", FOLDER, said);
      assert.deepEqual([r.code, r.said], [1, words], said);
      assert.deepEqual(snapshotOf(join(work, MAIN_PROJECT)), main, said);
      t.done();
    }
    const { t, folder, work } = world({ projects: both });
    const main = snapshotOf(join(work, MAIN_PROJECT));
    const r = await on({ ...t.ctx.deps, isWhole: (path) => path !== join(folder, "blue carousel.png"), readAll: async () => {} }, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([r.code, r.said, snapshotOf(join(work, MAIN_PROJECT))], [1, [COMING], main]);
    t.done();
  });
  it("says nothing it need not about the project when the name is not found: the project comes first, in the order the brief gives", async () => {
    const { t } = world({ projects: [], pictures: false });
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual(r.said, [`Open it in HyperFrames first: say "open ${NAME} in HyperFrames".`]);
    t.done();
  });
  it("refuses a project the record gives a session clip's folder as its name, as app does, and copies nothing into that folder", async () => {
    const CLIP = "Session clip 1 3fa9c1";
    const { t, work } = world({ projects: [["main", CLIP], ["clip 1", CLIP]] });
    const before = snapshotOf(join(work, CLIP));
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.deepEqual([r.code, r.said], [1, [`The folder for ${NAME} on this Mac is not as it was made, so it wasn't opened. Ask Jason.`]]);
    assert.deepEqual(snapshotOf(join(work, CLIP)), before);
    t.done();
  });
  it("tells her which Reels there are when she names a Reel the episode does not have, as app does, and copies nothing", async () => {
    const { t, work } = world({ projects: both });
    const main = snapshotOf(join(work, MAIN_PROJECT));
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel", "reel", "9");
    assert.equal(r.code, 1);
    assert.match(r.said[0], /^There is no Reel 9\. The Reels are \d+(?:, \d+)*\.$/);
    assert.equal(r.said.length, 1);
    assert.deepEqual(snapshotOf(join(work, MAIN_PROJECT)), main);
    t.done();
  });
  it("says it could not copy it, in words, when the project cannot take a file there, and leaves the project as it was", async () => {
    const { t, work } = world({ projects: both });
    writeFileSync(join(work, MAIN_PROJECT, "brimm", "references"), "a file where the folder goes");
    const main = snapshotOf(join(work, MAIN_PROJECT));
    const r = await on(t.ctx.deps, "refs", "use", FOLDER, "blue carousel");
    assert.equal(r.code, 1);
    assert.match(r.said[0], /^blue carousel\.png could not be copied into the HyperFrames project \([A-Z]+\)\.$/);
    assert.ok(isPlain(r.said[0]), r.said[0]);
    assert.deepEqual(snapshotOf(join(work, MAIN_PROJECT)), main);
    t.done();
  });
});

describe("refs use: the gate asks first, in its own words, as it does for app", () => {
  it("refuses a video not yet answered, a video left alone and a session not cleared, whether or not this Mac is set up, and does nothing", async () => {
    for (const [record, why] of [[UNANSWERED_RECORD, WAITING], [LEFT_RECORD, LEFT_ALONE], [SESSION_RECORD, NOT_FOR_SESSION]]) {
      for (const set of [true, false]) {
        const { t, found, work } = world({ record, set });
        const before = [listAll(found.folder), existsSync(work) ? listAll(work) : []];
        for (const rest of [[FOLDER, "blue carousel"], [FOLDER, "blue carousel", "reel", "2"]]) {
          const r = await on(t.ctx.deps, "refs", "use", ...rest);
          assert.deepEqual([r.code, r.said], [1, [why]], `${record.label} ${set} ${rest.join(" ")}`);
        }
        assert.deepEqual([reread(found).rev, listAll(found.folder), existsSync(work) ? listAll(work) : [], t.started, t.calls.filter((c) => c.cmd === "SIPS")], [1, ...before, [], []]);
        t.done();
      }
    }
  });
  it("refuses a session whether this Mac's training gate is on or off, naming nothing of it", async () => {
    const { t } = world({ record: SESSION_RECORD });
    const taught = { ...t.ctx.deps, settings: { ...t.ctx.settings, app: "hyperframes", sessionTeachings: { on: true, at: "2026-10-15T09:00:00-05:00", accounts: { cli: "sallie@example.com (BRIMM)", app: "sallie@example.com (BRIMM)" } } } };
    for (const deps of [t.ctx.deps, taught]) {
      const r = await on(deps, "refs", "use", FOLDER, "blue carousel");
      assert.deepEqual([r.code, r.said], [1, [NOT_FOR_SESSION]]);
      assert.ok(!r.text.includes(FOLDER) && !r.text.includes("Pricing"), r.text);
    }
    t.done();
  });
  it("lets refs and refs look run on that same Mac: they name no episode, so the gate is never asked", async () => {
    for (const record of [UNANSWERED_RECORD, LEFT_RECORD, SESSION_RECORD]) {
      const { t, looking } = world({ record });
      assert.equal((await on(t.ctx.deps, "refs")).code, 0, record.label);
      assert.deepEqual((await on(t.ctx.deps, "refs", "look", "blue carousel")).said, [`Picture to look at: ${join(looking, "blue carousel.png")}`], record.label);
      t.done();
    }
  });
});

describe("Studio never writes into the reference folder", () => {
  /** What each command is given, as Claude runs it, for the made-up episode (every command is here, so that one added later is walked). */
  const WALK = {
    episodes: [[]], guide: [[]], kind: [[FOLDER, "finished", "--private", "no"]], leave: [[FOLDER]], which: [[FOLDER]], read: [["--now", FOLDER, "--kind", "finished", "--rev", "1"]], workcopy: [["--now", FOLDER]],
    open: [[FOLDER]], app: [[FOLDER], [FOLDER, "reel", "2"]], push: [[FOLDER]], bring: [["--now", FOLDER]], status: [[]], retry: [["nothing"]], name: [[FOLDER, "A new name"]], title: [[FOLDER]],
    reel: [["drop", FOLDER, "1"]], reels: [[FOLDER, "--no-play"]], ask: [[FOLDER]], finish: [[FOLDER]], release: [[FOLDER]], show: [[FOLDER, "transcript"]], behind: [[]], resolve: [[FOLDER]], free: [[FOLDER]],
    spell: [[FOLDER]], logo: [[FOLDER, "on"]], captions: [[FOLDER, "reel", "1", "on"]], text: [[FOLDER]], graphic: [[FOLDER]], preset: [[FOLDER]], cut: [[FOLDER, "remove", "--words", "x"]],
    teachings: [[FOLDER]], principles: [[FOLDER]], ideas: [[FOLDER]],
    refs: [[], ["look", "blue carousel"], ["look", "title style"], ["look", "launch"], ["look", "nothing like it"], ["use", FOLDER, "blue carousel"], ["use", FOLDER, "title style", "reel", "2"], ["use", FOLDER, "launch"], ["use", FOLDER, "nothing like it"]],
    // The planned episode (PR H4) reads the folder for a cue's ref (`plan … set`): the made-up episode is no plan, so this world only walks its forms; tests/edit-plan.test.js
    // proves a ref is looked up with the folder read-only, and that a plan's set leaves it as it was.
    plan: [["new", "Too many SKUs"], [FOLDER], [FOLDER, "drop"], [FOLDER, "set", "--cue", "graphic | 4 | w | S. | ref: blue carousel", "--line", "x"]]
  };
  it("has the words of every command here, so that a command added later is walked", () => {
    for (const name of COMMAND_NAMES) assert.ok(name in WALK, `${name}: give it its words in WALK`);
  });
  /** The made-up Mac of every command here, with both projects made and the stand-in command line, and the reference folder as `PICTURES` has it. */
  const mac = () => {
    const w = world({ projects: [["main", MAIN_PROJECT], ["reel 2", REEL_PROJECT]] });
    w.t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
    w.t.ctx.deps.statfs = () => ({ bavail: 300 * 2 ** 18, bsize: 4096 });
    return w;
  };
  it("leaves the names, the bytes and the times of the folder, and its own time, as they were after every command", async () => {
    for (const name of COMMAND_NAMES) {
      for (const words of WALK[name]) {
        const w = mac();
        const before = snapshotOf(w.folder);
        const listing = listReferences(w.folder);
        await on(w.t.ctx.deps, name, ...words);
        assert.deepEqual(snapshotOf(w.folder), before, `${name} ${words.join(" ")}`);
        assert.deepEqual(listReferences(w.folder), listing, `${name} ${words.join(" ")}`);
        w.t.done();
      }
    }
  });
  it("does the same, to the word, with the folder and everything in it read-only: nothing of refs ever needs to write there", async () => {
    const said = (w, r) => r.said.map((line) => line.split(w.t.dir).join("<dir>"));
    for (const words of WALK.refs) {
      const open = mac();
      const was = await on(open.t.ctx.deps, "refs", ...words);
      const locked = mac();
      const before = snapshotOf(locked.folder);
      const now = await readOnly(locked.folder, () => on(locked.t.ctx.deps, "refs", ...words));
      assert.deepEqual([now.code, said(locked, now)], [was.code, said(open, was)], words.join(" "));
      assert.deepEqual(snapshotOf(locked.folder), before, words.join(" "));
      open.t.done();
      locked.t.done();
    }
  });
});

describe("a project made from cues that name a picture (PR H3)", () => {
  const OPEN = "It's open in HyperFrames.";
  const BUTTONS = "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes.";
  /** The cut plan's cues: one in Reel 1's words (the welcome), and two in Reel 2's, which runs from p7 to p9. Their styles name a picture in the folder, a
      HEIC one that is made a JPEG, and one that is not there. */
  const CUES = [
    { n: 1, words: "Welcome to the show", kind: "words", show: "The show's name.", seconds: 3, style: { ref: "blue carousel.png" }, phrase: "p4" },
    { n: 2, words: "know your costs", kind: "graphic", show: "A chart of costs.", seconds: 4, style: { ref: "title style.heic" }, phrase: "p7" },
    { n: 3, words: "very very important", kind: "words", show: "The words very important.", seconds: 3, style: { ref: "gone.png" }, phrase: "p8" }
  ];
  const CLAUDE = { decisions: [], graphicCues: CUES, ignored: [], clips: [] };
  const NOT_THERE = '"gone.png" isn\'t in the reference folder, so the project has no copy of it.';
  const WORKING_COPY = "the working copy's bytes";
  const REEL_COPY = "the Reel's bytes";

  /** The made-up episode with the working copy of its video made (or, with `reel`, Reel 2's video), the stand-in command line, and the reference
      folder holding `pictures`. `cues`: the file of cues the run that made a finished video's Reel kept beside it. */
  function appWorld({ record = RAW, claude = CLAUDE, reel = false, pictures = PICTURES, programs = {}, cues } = {}) {
    const { t, found } = episode(record, programs, episodeFiles({ picked: false, ...(claude ? { claude } : {}) }));
    writeSettings(t.home, { app: "hyperframes" });
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    const raw = statSync(join(found.folder, "Pricing talk.mp4"));
    if (reel) {
      const { stretch } = reelStretch(found.folder, 2);
      const paths = reelCopyPaths(t.home, FOLDER, 2, reelCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }, stretch));
      mkdirSync(dirname(paths.video), { recursive: true });
      writeFileSync(paths.video, REEL_COPY);
      writeFileSync(paths.facts, JSON.stringify({ seconds: Math.round((stretch.end - stretch.start) * 1000) / 1000, fps: 30, width: 1280, height: 720, bytes: REEL_COPY.length, stretch }));
      if (cues) writeFileSync(paths.cues, JSON.stringify({ version: 1, cues }));
    } else {
      const paths = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
      mkdirSync(dirname(paths.video), { recursive: true });
      writeFileSync(paths.video, WORKING_COPY);
      writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: WORKING_COPY.length }));
    }
    t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
    const folder = referencesFolder(t.root);
    if (pictures) {
      mkdirSync(folder, { recursive: true });
      for (const [name, bytes] of Object.entries(pictures)) writeFileSync(join(folder, name), bytes);
    }
    return { t, found, folder, work: episodeWork(t.home, FOLDER) };
  }
  const cuesIn = (work, project) => JSON.parse(readFileSync(join(work, project, "brimm", "graphic-cues.json"), "utf8")).cues;
  const picturesIn = (work, project) => {
    const dir = join(work, project, "brimm", "references");
    return existsSync(dir) ? readdirSync(dir).sort() : [];
  };
  const staged = (t) => (existsSync(workFolder(t.home)) ? readdirSync(workFolder(t.home)).filter((name) => name.startsWith(".reference-")) : []);

  it("copies the pictures the main video's cues name into brimm/references/ when the project is made, a HEIC one as a JPEG, and says what is not there", async () => {
    const { t, folder, work } = appWorld();
    const before = snapshotOf(folder);
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said, [NOT_THERE, OPEN, BUTTONS]);
    assert.deepEqual(picturesIn(work, MAIN_PROJECT), ["blue carousel.png", "title style.jpg"]);
    assert.equal(readFileSync(join(work, MAIN_PROJECT, "brimm", "references", "blue carousel.png"), "utf8"), PICTURES["blue carousel.png"]);
    assert.equal(readFileSync(join(work, MAIN_PROJECT, "brimm", "references", "title style.jpg"), "utf8"), "a JPEG made by sips");
    // The cues name the files the project holds, and the cue whose picture is not in the folder keeps its style.
    assert.deepEqual(cuesIn(work, MAIN_PROJECT).map((c) => c.style), [{ ref: "blue carousel.png" }, { ref: "title style.jpg" }, { ref: "gone.png" }]);
    // The reference folder is as it was, and what was made on the way is gone.
    assert.deepEqual(snapshotOf(folder), before);
    assert.deepEqual(staged(t), []);
    t.done();
  });
  it("lists the folder in the project's notes and facts, and has the rule's sentence about it", async () => {
    const { t, work } = appWorld();
    await on(t.ctx.deps, "app", FOLDER);
    const notes = readFileSync(join(work, MAIN_PROJECT, "CLAUDE.md"), "utf8");
    assert.ok(notes.includes("  - `brimm/references/`: style references she chose: follow their look, and never copy what is in them."));
    assert.ok(notes.includes("Files in `brimm/references/` are style references she chose: follow their look, and never copy what is in them."));
    const facts = JSON.parse(readFileSync(join(work, MAIN_PROJECT, "brimm", "facts.json"), "utf8"));
    assert.equal(facts.files["brimm/references/"], "style references she chose: follow their look, and never copy what is in them");
    t.done();
  });
  it("makes a project of cues that name no picture exactly as before: the folder is not looked at, nothing is said of it, and no folder is needed", async () => {
    const { t, work } = appWorld({ claude: null, pictures: false });
    const r = await app_(t);
    assert.deepEqual([r.code, r.said], [0, [OPEN, BUTTONS]]);
    assert.deepEqual([picturesIn(work, MAIN_PROJECT), t.calls.filter((c) => c.cmd === "SIPS"), staged(t)], [[], [], []]);
    const notes = readFileSync(join(work, MAIN_PROJECT, "CLAUDE.md"), "utf8");
    assert.ok(!notes.includes("  - `brimm/references/`"));
    t.done();
  });
  it("says there is no reference folder on this Mac, for each picture the cues name, when there is none, and makes the project without them", async () => {
    const { t, work } = appWorld({ pictures: false });
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said.slice(0, 3), ['blue carousel.png', 'title style.heic', 'gone.png'].map((ref) => `There's no reference folder on this Mac yet, so the project has no copy of "${ref}": ask Jason.`));
    assert.deepEqual([picturesIn(work, MAIN_PROJECT), cuesIn(work, MAIN_PROJECT).map((c) => c.style)], [[], [{ ref: "blue carousel.png" }, { ref: "title style.heic" }, { ref: "gone.png" }]]);
    t.done();
  });
  it("asks Dropbox to bring a picture that is online only, and makes the project without it, saying how to put it in, when it is still not here", async () => {
    const { t, folder, work } = appWorld();
    const online = join(folder, "blue carousel.png");
    const reads = [];
    const deps = { ...t.ctx.deps, isWhole: (path) => path !== online, readAll: async (path) => reads.push(path) };
    const r = await on(deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said.slice(0, 2), ['"blue carousel.png" is still coming down from Dropbox, so the project has no copy of it yet: once it is here, say "use blue carousel.png from the reference folder as a style reference".', NOT_THERE]);
    assert.deepEqual([reads, picturesIn(work, MAIN_PROJECT)], [[online], ["title style.jpg"]]);
    assert.deepEqual(cuesIn(work, MAIN_PROJECT).map((c) => c.style), [{ ref: "blue carousel.png" }, { ref: "title style.jpg" }, { ref: "gone.png" }]);
    t.done();
  });
  it("makes the project without a HEIC picture sips cannot turn into a JPEG, saying so, and the cue keeps its style", async () => {
    const { t, work } = appWorld({ programs: { SIPS: () => ({ code: 13, stderr: "Error 13" }) } });
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(r.said.slice(0, 2), ["It can't be used: Studio couldn't turn title style.heic into a picture it can read.", NOT_THERE]);
    assert.deepEqual(picturesIn(work, MAIN_PROJECT), ["blue carousel.png"]);
    assert.deepEqual(cuesIn(work, MAIN_PROJECT).map((c) => c.style), [{ ref: "blue carousel.png" }, { ref: "title style.heic" }, { ref: "gone.png" }]);
    assert.deepEqual(staged(t), []);
    t.done();
  });
  it("finds a picture by the name the cue spells it in any case, and the cue then names the file as the folder has it", async () => {
    const claude = { ...CLAUDE, graphicCues: [{ ...CUES[0], style: { ref: "BLUE Carousel.PNG" } }] };
    const { t, work } = appWorld({ claude });
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.deepEqual(r.said, [OPEN, BUTTONS]);
    assert.deepEqual([picturesIn(work, MAIN_PROJECT), cuesIn(work, MAIN_PROJECT).map((c) => c.style)], [["blue carousel.png"], [{ ref: "blue carousel.png" }]]);
    t.done();
  });
  it("takes a part of a name for no picture: a cue's ref is a file's name, and a picture that only holds it is not it", async () => {
    const claude = { ...CLAUDE, graphicCues: [{ ...CUES[0], style: { ref: "carousel" } }] };
    const { t, work } = appWorld({ claude });
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.deepEqual(r.said, ['"carousel" isn\'t in the reference folder, so the project has no copy of it.', OPEN, BUTTONS]);
    assert.deepEqual(picturesIn(work, MAIN_PROJECT), []);
    t.done();
  });
  it("copies into a Reel's project the pictures of the cues that fall in its stretch alone, on its own cues, and says only what is missing for those", async () => {
    const { t, folder, work } = appWorld({ reel: true });
    const before = snapshotOf(folder);
    const r = await on(t.ctx.deps, "app", FOLDER, "reel", "2");
    assert.equal(r.code, 0, r.text);
    // Reel 2 holds cues 2 and 3: the picture of cue 1 is in Reel 1, so it is neither copied nor missed here.
    assert.equal(r.said[0], NOT_THERE);
    assert.ok(!r.text.includes("blue carousel"), r.text);
    assert.deepEqual(picturesIn(work, REEL_PROJECT), ["title style.jpg"]);
    assert.deepEqual(cuesIn(work, REEL_PROJECT).map((c) => c.style), [{ ref: "title style.jpg" }, { ref: "gone.png" }]);
    assert.deepEqual([snapshotOf(folder), staged(t)], [before, []]);
    t.done();
  });
  it("does so for a finished video's Reel too, from the cues the run that made its video kept", async () => {
    const kept = [{ n: 1, words: "know your costs", kind: "graphic", show: "A chart of costs.", seconds: 4, style: { ref: "quote card.jpg" }, phrase: "p7" }];
    const { t, work } = appWorld({ reel: true, record: FINISHED, cues: kept });
    const r = await on(t.ctx.deps, "app", FOLDER, "reel", "2");
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(picturesIn(work, REEL_PROJECT), ["quote card.jpg"]);
    assert.equal(readFileSync(join(work, REEL_PROJECT, "brimm", "references", "quote card.jpg"), "utf8"), PICTURES["quote card.jpg"]);
    assert.deepEqual(cuesIn(work, REEL_PROJECT).map((c) => c.style), [{ ref: "quote card.jpg" }]);
    t.done();
  });
  it("does the same to the word with the folder and everything in it read-only: making a project never writes there", async () => {
    for (const reel of [false, true]) {
      const said = (w, r) => r.said.map((line) => line.split(w.t.dir).join("<dir>"));
      const open = appWorld({ reel });
      const was = await on(open.t.ctx.deps, "app", FOLDER, ...(reel ? ["reel", "2"] : []));
      const locked = appWorld({ reel });
      const before = snapshotOf(locked.folder);
      const now = await readOnly(locked.folder, () => on(locked.t.ctx.deps, "app", FOLDER, ...(reel ? ["reel", "2"] : [])));
      assert.deepEqual([now.code, said(locked, now)], [was.code, said(open, was)], `reel ${reel}`);
      assert.deepEqual(snapshotOf(locked.folder), before);
      assert.deepEqual(picturesIn(locked.work, reel ? REEL_PROJECT : MAIN_PROJECT), picturesIn(open.work, reel ? REEL_PROJECT : MAIN_PROJECT));
      open.t.done();
      locked.t.done();
    }
  });
  /** `app` for the made-up episode, once the project is to be made. */
  const app_ = (t) => on(t.ctx.deps, "app", FOLDER);
});
