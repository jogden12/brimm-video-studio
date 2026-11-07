// Phase 2, F7: the seven Final Cut commands are gone (push, cut, captions, text, logo, preset, and graphic's add), and an episode from
// the Final Cut days still reads. Stand-ins only; every name is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMAND_NAMES, HELP, editMain } from "../edit.js";
import { episodeFault, newEpisode } from "../episode.js";
import { episodeWork, writeSettings } from "../settings.js";
import { workCopyKey, workCopyPaths } from "../workcopy.js";
import { EPISODE, episode } from "./phase4.js";
import { FOLDER, NAME, reread } from "./episodes.js";
import { OFFERS, READ } from "./guide-world.js";

const STAND_IN = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
const GUIDANCE = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** A raw video as the Final Cut days left it: its main holds a text, a graphic, a cut, a preset and a logo, a rough-cut render and a v1 push. */
const OLD_MAIN = {
  preset: { job: "full-episode", captions: "word-by-word", look: "clean" },
  cuts: [{ id: "c1", keep: false, from: 1, to: 2 }],
  texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: ["Sallie Ogden", "Founder"] }],
  graphics: [{ id: "g1", picture: "media/chart.png", at: 3, for: 4, place: "full" }],
  logo: true,
  pushed: [
    { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: AT },
    { v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.mac-studio.fcpxml", project: "Pricing main v1" }
  ],
  base: null
};
const WHOLE = { ...newEpisode({ id: "e-20261028-3fa9c1", machine: "Mac Studio", at: "2026-10-28T09:00:00-04:00", video: { file: "Talk.mov", bytes: 20, seconds: 2.6, created: null }, kind: "raw", writer: { commit: "c709b57", on: "Mac Studio" } }), rev: 1 };
const OLD = { version: 3, kind: "raw", answer: ANSWERED, main: OLD_MAIN, brand: { logo: "media/logo.png" }, captions: null };

describe("the seven Final Cut commands are no commands", () => {
  it("push, cut, captions, text, logo, preset and graphic's add print the help and end with 2, writing nothing", async () => {
    for (const argv of [["push", FOLDER], ["cut", FOLDER, "remove", "--words", "hello"], ["captions", FOLDER, "reel", "2", "on"], ["text", FOLDER, "add", "lower-third", "--at", "0:03", "--line", "A"], ["logo", FOLDER, "on"], ["preset", FOLDER], ["graphic", FOLDER, "add", "chart.png", "--at", "0:03"]]) {
      const { t, found } = episode({ version: 3, kind: "raw", answer: ANSWERED });
      const r = await on(t.ctx.deps, ...argv);
      assert.deepEqual([r.code, r.said], [2, [HELP]], argv.join(" "));
      assert.equal(reread(found).rev, 1, argv.join(" "));
      t.done();
    }
    for (const word of ["push", "cut", "captions", "text", "logo", "preset"]) assert.ok(!COMMAND_NAMES.includes(word), word);
    assert.ok(COMMAND_NAMES.includes("graphic"));
  });
  it("the help no longer shows them, and still shows graphic's ideas", () => {
    for (const word of ["push", "cut", "captions", "text", "logo", "preset"]) assert.doesNotMatch(HELP, new RegExp(`node edit\\.js ${word} `), word);
    assert.doesNotMatch(HELP, /graphic "<episode>" add/);
    assert.match(HELP, /graphic "<episode>" ideas/);
  });
});

describe("an old record with Final Cut layers still reads", () => {
  // Read by Claude and its spellings answered, as the guide's tests have a video (guide-world.js), so that the guide goes on to say what is next.
  const old = () => episode({ ...OLD, reading: READ("raw"), offers: OFFERS });
  it("is whole for episodeFault, and episodes, guide, open, spell, graphic ideas and resolve work on it", async () => {
    const { t, found } = old();
    assert.equal(episodeFault({ ...WHOLE, main: OLD_MAIN, brand: OLD.brand }), "");
    for (const argv of [["episodes"], ["guide"], ["guide", FOLDER], ["open", FOLDER], ["spell", FOLDER], ["graphic", FOLDER, "ideas"], ["resolve", FOLDER]]) {
      // The guide is run on a Mac set up as Studio is (the light import, the app on), where it follows an episode through HyperFrames.
      const deps = argv[0] === "guide" ? { ...t.ctx.deps, settings: { ...t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2, app: "hyperframes" } } : t.ctx.deps;
      const r = await on(deps, ...argv);
      assert.ok([0, 1].includes(r.code), `${argv.join(" ")}: ${r.text}`);
      assert.doesNotMatch(r.text, /broken|cannot be read|not understood/i, `${argv.join(" ")}: ${r.text}`);
      // The guide's one line for an episode edited in Final Cut before (F6) is allowed; nothing else names it.
      if (argv[0] !== "guide") assert.doesNotMatch(r.text, /Final Cut|timeline|show it/, `${argv.join(" ")}: ${r.text}`);
      // And the guide for this episode does say it: the old-episode line, not "isn't set up".
      if (argv[0] === "guide" && argv.length === 2) assert.match(r.text, /It was edited in Final Cut before\. Studio doesn't use Final Cut now: say "open it in HyperFrames"/, r.text);
    }
    t.done();
  });
  it("opens in HyperFrames from the recording", async () => {
    const { t, found } = old();
    writeSettings(t.home, { app: "hyperframes" });
    writeFileSync(join(t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
    const raw = statSync(join(found.folder, "Pricing talk.mp4"));
    const paths = workCopyPaths(t.home, FOLDER, workCopyKey({ bytes: raw.size, mtimeMs: raw.mtimeMs }));
    mkdirSync(dirname(paths.video), { recursive: true });
    writeFileSync(paths.video, "the working copy's bytes");
    writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: 24 }));
    t.ctx.deps.app = { cli: STAND_IN, node: process.execPath, guidance: GUIDANCE };
    const r = await on(t.ctx.deps, "app", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /Final Cut/);
    assert.deepEqual(reread(found).main, OLD_MAIN);
    assert.ok(episodeWork(t.home, FOLDER));
    t.done();
  });
});

describe("a spelling says nothing of Final Cut", () => {
  it("spell … add on a raw video with a project prints no Final Cut, timeline or show it", async () => {
    const { t, found } = episode(OLD);
    writeSettings(t.home, { app: "hyperframes" });
    const r = await on(t.ctx.deps, "spell", FOLDER, "add", "Ogdin", "Ogden");
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /Final Cut|timeline|show it/i, r.text);
    assert.deepEqual(reread(found).spellings, [["Ogdin", "Ogden"]]);
    t.done();
  });
});

describe("phase4.js's episode has no Final Cut file", () => {
  it("lists no .fcpxml file and nothing in edit/", () => {
    assert.deepEqual(Object.keys(EPISODE.files).filter((f) => /\.fcpxmld?$/.test(f) || f.startsWith("edit/")), []);
    assert.ok(NAME);
  });
});
