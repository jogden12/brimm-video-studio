// A project's whole file set, and its writer (architecture 2026-10-27, sections 5.1, 5.2, 5.4 and 5.8, F4 and F5; plan PR 2).
// The golden files are what the pinned command line's `init --video` and `transcribe` wrote for a six-second test clip
// (tests/fixtures/hyperframes-0.8.208/init/). No test runs the command line, the app or HeyGen.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMMANDS, PIN } from "../hyperframes.js";
import { assertSafe, cutSuggestions, hyperframesGuidance, indexHtml, projectFiles, projectName, reelSuggestions, transcriptJson, writeProject } from "../project.js";

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/hyperframes-0.8.208/init/${name}`, import.meta.url), "utf8");
const GOLDEN = {
  index: fixture("index.html"),
  hyperframes: JSON.parse(fixture("hyperframes.json")),
  claude: fixture("CLAUDE.md"),
  transcript: fixture("transcript.json")
};

/** The six words of the golden's words.srt, as an episode keeps its words (cuts.js wordsOf: {w, start, end}). */
const WORDS = [
  { w: "Pricing,", start: 0.5, end: 1.1 },
  { w: "says", start: 1.2, end: 1.6 },
  { w: "Hormozy,", start: 1.7, end: 2.5 },
  { w: "is", start: 2.7, end: 2.9 },
  { w: "a", start: 3, end: 3.1 },
  { w: "skill.", start: 3.2, end: 4 }
];
/** A working copy's facts, as workcopy.js writes them beside it. */
const FACTS = { seconds: 6, fps: 30, width: 1920, height: 1080, bytes: 4830125 };
/** A cut plan as cutPlan leaves it, and Claude may change it: the first phrase is a retake of the second. */
const PLAN = {
  by: "rules",
  phrases: [
    { id: "p1", start: 0.4, end: 1.15, text: "Pricing,", words: WORDS.slice(0, 1), keep: false, kind: "retake", why: "said again at 0:01, better" },
    { id: "p2", start: 1.15, end: 4.05, text: "says Hormozy, is a skill.", words: WORDS.slice(1), keep: true, kind: "keep", why: "" }
  ]
};
/** A Reel candidate as reels.json keeps it (reels.js reelCandidates). */
const REELS = [{
  n: 2, start: 1.15, end: 4.05, ranges: [{ start: 1.15, end: 4.05, crop: { x: 656, y: 0, width: 608, height: 1080 } }], seconds: 2.9,
  title: "Pricing is a skill", reason: "a point made in one breath", words: "says Hormozy, is a skill.", phrases: ["p2"], preview: null
}];
const ID = "2026-10-14-mac-studio-3fa9c1";
const CLI = "/Users/sallie/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs";
const LOGOS = ["/Users/sallie/Dropbox/BRIMM Video/Assets/Logos/the-brimm-stacked-navy.svg", "/Users/sallie/Dropbox/BRIMM Video/Assets/Logos/the-brimm-stacked-white.svg"];

const main = (over = {}) => ({
  kind: "main", name: "Pricing talk", part: "main", id: ID, facts: FACTS, words: WORDS, spellings: [["Hormozy", "Hormozi"]], plan: PLAN, reels: REELS,
  guidance: GOLDEN.claude, video: "/Users/sallie/BRIMM Video Work/E/working copy/k.mp4", cli: CLI, logos: LOGOS, createdAt: "2026-10-28T15:00:00.000Z", ...over
});
const reel = (over = {}) => main({ kind: "reel", part: { reel: 2 }, ...over });
/** A session's clip, given everything an episode's part is given: its kind alone decides what goes in. */
const clip = (over = {}) => main({ kind: "clip", clip: 3, name: undefined, part: undefined, file: "GMT20261013-142933_Recording_Jane Doe.mp4", ...over });
const json = (files, path) => JSON.parse(files.get(path));
const FONTS = ["assets/fonts/Allison-Regular.ttf", "assets/fonts/josefin-sans-latin-300-normal.woff2", "assets/fonts/josefin-sans-latin-400-italic.woff2", "assets/fonts/josefin-sans-latin-400-normal.woff2", "assets/fonts/josefin-sans-latin-500-normal.woff2"];

/** The names of a tag's attributes, in its order. */
const attributes = (tag) => [...tag.matchAll(/\s([a-z][a-z-]*)(?=[\s=>/])/g)].map((m) => m[1]);
const rootTag = (html) => html.match(/<div\b[^>]*\bid="root"[^>]*>/)[0];
const videoTag = (html) => html.match(/<video\b[^>]*>/)[0];

describe("a project's name (5.1)", () => {
  it("is the file-safe name, the part and the short id for an episode's part, with no version", () => {
    assert.equal(projectName({ name: "Pricing talk", part: "main", id: ID }), "Pricing talk main 3fa9c1");
    assert.equal(projectName({ name: "Pricing talk", part: { reel: 2 }, id: ID }), "Pricing talk reel 2 3fa9c1");
    assert.equal(projectName({ name: "Pricing: what to charge?", part: "main", id: ID }), "Pricing- what to charge- main 3fa9c1");
  });
  it("is a number and the short id for a session's clip, never a name", () => {
    assert.equal(projectName({ clip: 3, id: ID, name: "Jane Doe" }), "Session clip 3 3fa9c1");
  });
});

describe("index.html (5.2, F4)", () => {
  const html = indexHtml(FACTS);
  it("loads no script and no stylesheet from the network", () => {
    assert.deepEqual([...html.matchAll(/\b(?:src|href)="(https?:[^"]*)"/g)].map((m) => m[1]), []);
    assert.match(html, /<script src="vendor\/gsap\.min\.js"><\/script>/);
  });
  it("has the golden's structure", () => {
    assert.deepEqual(new Set(attributes(rootTag(html))), new Set(attributes(rootTag(GOLDEN.index))));
    assert.deepEqual(new Set(attributes(videoTag(html))), new Set(attributes(videoTag(GOLDEN.index))));
    for (const name of ["data-composition-id", "data-start", "data-duration", "data-width", "data-height"]) assert.ok(attributes(rootTag(html)).includes(name), name);
    for (const name of ["class", "data-track-index", "data-has-audio"]) assert.ok(attributes(videoTag(html)).includes(name), name);
    assert.match(videoTag(html), /class="clip"/);
    assert.match(rootTag(html), /data-composition-id="main"/);
    assert.equal(html.match(/window\.__timelines\["main"\] =/g).length, 1);
  });
  it("takes its size and length from the working copy's facts", () => {
    assert.match(rootTag(html), /data-duration="6"[\s\S]*data-width="1920"[\s\S]*data-height="1080"/);
    assert.match(videoTag(html), /src="media\/recording\.mp4"/);
    assert.match(html, /data-resolution="landscape"/);
    const upright = indexHtml({ ...FACTS, width: 1080, height: 1920, seconds: 42.5 });
    assert.match(rootTag(upright), /data-duration="42\.5"[\s\S]*data-width="1080"[\s\S]*data-height="1920"/);
    assert.match(upright, /data-resolution="portrait"/);
    assert.match(upright, /content="width=1080, height=1920"/);
  });
  it("sets the brand's typefaces from the project's own files", () => {
    for (const font of FONTS) assert.ok(html.includes(`url("${font}")`), font);
    assert.match(html, /font-family: "Josefin Sans"/);
  });
});

describe("the project's template files (5.2)", () => {
  const files = projectFiles(main());
  it("hyperframes.json has the golden's keys, and no registry on a moving branch", () => {
    const made = json(files, "hyperframes.json");
    assert.deepEqual(Object.keys(made), Object.keys(GOLDEN.hyperframes).filter((key) => key !== "registry"));
    assert.ok(!files.get("hyperframes.json").includes("raw.githubusercontent.com"));
  });
  it("package.json has dev, check and render and no publish", () => {
    const pkg = json(files, "package.json");
    assert.deepEqual(pkg.scripts, { dev: "hyperframes preview", check: "hyperframes check", render: "hyperframes render" });
    assert.equal(pkg.name, "Pricing talk main 3fa9c1");
    assert.ok(!files.get("package.json").includes("publish"));
  });
  it("meta.json has id, name, createdAt", () => {
    assert.deepEqual(json(files, "meta.json"), { id: "Pricing talk main 3fa9c1", name: "Pricing talk main 3fa9c1", createdAt: "2026-10-28T15:00:00.000Z" });
  });
});

describe("transcript.json (F5)", () => {
  it("is the list the pinned transcribe writes", () => {
    assert.equal(`${JSON.stringify(transcriptJson(WORDS, []), null, 2)}\n`.trim(), GOLDEN.transcript.trim());
  });
  it("spells the company's name BRIMM in every project, whatever the transcriber wrote", () => {
    const heard = [{ w: "the", start: 0, end: 0.2 }, { w: "brim", start: 0.2, end: 0.5 }, { w: "Brim,", start: 0.6, end: 0.9 }, { w: "BRIM.", start: 1, end: 1.3 }, { w: "brim's", start: 1.4, end: 1.8 }, { w: "brimming", start: 1.9, end: 2.4 }];
    assert.deepEqual(transcriptJson(heard, []).map((word) => word.text), ["the", "BRIMM", "BRIMM,", "BRIMM.", "BRIMM's", "brimming"]);
    const files = projectFiles(clip({ words: heard }));
    assert.deepEqual(json(files, "transcript.json").map((word) => word.text).slice(1, 3), ["BRIMM", "BRIMM,"]);
    assert.deepEqual(json(projectFiles(main()), "brimm/spellings.json").spellings.slice(0, 3), [{ wrong: "brim", right: "BRIMM" }, { wrong: "Brim", right: "BRIMM" }, { wrong: "BRIM", right: "BRIMM" }]);
  });
  it("applies the episode's spellings", () => {
    const spelled = transcriptJson(WORDS, [["Hormozy", "Hormozi"]]);
    assert.equal(spelled[2].text, "Hormozi,");
    assert.deepEqual(spelled.map(({ id, start, end }) => [id, start, end]), JSON.parse(GOLDEN.transcript).map(({ id, start, end }) => [id, start, end]));
    assert.equal(json(projectFiles(main()), "transcript.json")[2].text, "Hormozi,");
  });
});

describe("what the app is given to start from (5.8)", () => {
  const transcript = transcriptJson(WORDS, []);
  const ids = new Set(transcript.map((word) => word.id));
  const byId = new Map(transcript.map((word) => [word.id, word]));
  it("brimm/cut-suggestions.json uses the transcript's ids", () => {
    const made = cutSuggestions(PLAN, transcript);
    assert.deepEqual(made, { version: 1, clock: "recording", suggestions: [{ n: 1, from: "w0", to: "w0", start: 0.5, end: 1.1, kind: "retake", why: "said again at 0:01, better", by: "rules" }] });
    for (const s of made.suggestions) {
      assert.ok(ids.has(s.from) && ids.has(s.to));
      assert.equal(s.start, byId.get(s.from).start);
      assert.equal(s.end, byId.get(s.to).end);
    }
    assert.deepEqual(json(projectFiles(main()), "brimm/cut-suggestions.json").suggestions.map((s) => [s.from, s.to]), [["w0", "w0"]]);
  });
  it("gives each word of a cut its own id, by its place, even when two words share their times", () => {
    const words = [{ w: "So", start: 1, end: 1.5 }, { w: "uh,", start: 1.5, end: 1.5 }, { w: "um,", start: 1.5, end: 1.5 }, { w: "pricing.", start: 1.5, end: 2 }];
    const plan = {
      by: "claude",
      phrases: [
        { id: "p1", start: 0.9, end: 1.5, text: "So", words: words.slice(0, 1), keep: true, kind: "keep", why: "" },
        { id: "p2", start: 1.5, end: 1.5, text: "uh, um,", words: words.slice(1, 3), keep: false, kind: "false start", why: "said before the words" },
        { id: "p3", start: 1.5, end: 2.1, text: "pricing.", words: words.slice(3), keep: true, kind: "keep", why: "" }
      ]
    };
    assert.deepEqual(cutSuggestions(plan, transcriptJson(words, [])).suggestions.map((s) => [s.from, s.to, s.by]), [["w1", "w2", "claude"]]);
  });
  it("reads a cut plan back from its file the same", () => {
    assert.deepEqual(cutSuggestions(JSON.parse(JSON.stringify(PLAN)), transcript), cutSuggestions(PLAN, transcript));
  });
  it("refuses a cut plan whose words are not the transcript's", () => {
    assert.throws(() => cutSuggestions(PLAN, transcriptJson(WORDS.slice(1), [])), /words/);
  });
  it("brimm/reel-suggestions.json has stretches, ids, title, first and last words, and why", () => {
    assert.deepEqual(reelSuggestions(REELS, transcript), {
      version: 1, clock: "recording",
      reels: [{ n: 2, title: "Pricing is a skill", why: "a point made in one breath", first: "says", last: "skill.", stretches: [{ start: 1.15, end: 4.05, from: "w1", to: "w5" }] }]
    });
    assert.ok(projectFiles(main()).has("brimm/reel-suggestions.json"));
    assert.ok(!projectFiles(reel()).has("brimm/reel-suggestions.json"));
    assert.ok(!projectFiles(clip()).has("brimm/reel-suggestions.json"));
  });
});

describe("the file set of each kind of project (5.2)", () => {
  const common = [".claude/settings.json", "AGENTS.md", "CLAUDE.md", ...FONTS, "brimm/brand.md", "brimm/facts.json", "hyperframes.json", "index.html", "media/recording.mp4", "meta.json", "node_modules/.bin/hyperframes", "package.json", "transcript.json", "vendor/gsap.min.js"];
  const logos = ["assets/logos/the-brimm-stacked-navy.svg", "assets/logos/the-brimm-stacked-white.svg"];
  const sorted = (paths) => [...paths].sort();
  it("is exactly this for a main project", () => {
    assert.deepEqual(sorted(projectFiles(main()).keys()), sorted([...common, ...logos, "brimm/cut-suggestions.json", "brimm/reel-suggestions.json", "brimm/spellings.json"]));
  });
  it("is the same for a Reel's project, without the cut and Reel suggestions", () => {
    assert.deepEqual(sorted(projectFiles(reel()).keys()), sorted([...common, ...logos, "brimm/spellings.json"]));
  });
  it("has no spellings, suggestions or logos for a session clip", () => {
    assert.deepEqual(sorted(projectFiles(clip()).keys()), sorted(common));
  });
  it("moves the working copy in, links the toolchain, and copies the brand pack's files and the vendored GSAP", () => {
    const files = projectFiles(main());
    assert.deepEqual(files.get("media/recording.mp4"), { move: "/Users/sallie/BRIMM Video Work/E/working copy/k.mp4" });
    assert.deepEqual(files.get("node_modules/.bin/hyperframes"), { link: CLI });
    assert.deepEqual(files.get("assets/logos/the-brimm-stacked-white.svg"), { copy: LOGOS[1] });
    for (const path of [...FONTS, "vendor/gsap.min.js"]) assert.ok(fs.existsSync(files.get(path).copy), path);
  });
  it("vendors the GSAP init uses, at the checksum the pin holds", () => {
    const gsap = projectFiles(main()).get("vendor/gsap.min.js").copy;
    const bytes = fs.readFileSync(gsap);
    assert.equal(PIN.gsap.version, "3.14.2");
    assert.match(bytes.toString("utf8", 0, 40), /GSAP 3\.14\.2/);
    assert.equal(`sha512-${createHash("sha512").update(bytes).digest("base64")}`, PIN.gsap.integrity);
    assert.ok(GOLDEN.index.includes(`gsap@${PIN.gsap.version}/`));
  });
  it("gives a session clip's project no part of the file's name", () => {
    const files = projectFiles(clip());
    const said = [...files.keys(), ...[...files.values()].filter((v) => typeof v === "string")].join("\n");
    for (const part of ["Jane", "Doe", "GMT20261013", "142933"]) assert.ok(!said.includes(part), part);
    assert.equal(json(files, "meta.json").name, "Session clip 3 3fa9c1");
    assert.equal(json(files, "brimm/facts.json").name, "Session clip 3 3fa9c1");
  });
  it("writes the settings of its kind", () => {
    assert.ok(!json(projectFiles(main()), ".claude/settings.json").permissions.deny.includes("WebFetch"));
    assert.ok(json(projectFiles(clip()), ".claude/settings.json").permissions.deny.includes("WebFetch"));
  });
});

describe("the notes for the agent (5.4)", () => {
  const notes = projectFiles(main()).get("CLAUDE.md");
  const rules = notes.slice(0, notes.indexOf("\n# ", 1));
  it("are the same text in CLAUDE.md and AGENTS.md", () => {
    for (const files of [projectFiles(main()), projectFiles(reel()), projectFiles(clip())]) assert.equal(files.get("AGENTS.md"), files.get("CLAUDE.md"));
  });
  it("put the BRIMM rules first, saying they come before everything below", () => {
    assert.equal(notes.split("\n")[0], "# The BRIMM: rules for this project");
    assert.match(notes.split("\n").slice(1, 4).join("\n"), /These rules come before everything below/);
  });
  it("name every command the agent may not run, and send it to transcript.json", () => {
    for (const [name, c] of Object.entries(COMMANDS)) if (c.class !== "agent") assert.ok(rules.includes(`\`${name}\``), name);
    for (const name of ["skills", "publish", "cloud", "tts", "add"]) assert.ok(rules.includes(`\`${name}\``), name);
    assert.match(rules, /`transcript\.json`/);
    assert.match(rules, /never transcribe/i);
  });
  it("keep HyperFrames' own guidance without the lines that conflict", () => {
    const kept = hyperframesGuidance(GOLDEN.claude);
    for (const gone of ["skills update", "publish", "npm run publish", "hyperframes.heygen.com", "catch-up", "upgrade", "registry"]) assert.ok(!kept.includes(gone), gone);
    for (const still of ["## Key Rules", "npx hyperframes docs <topic>", "npx hyperframes preview --background", "window.__timelines"]) assert.ok(kept.includes(still), still);
    assert.ok(notes.includes(kept.trim()));
  });
  it("give the brand's guide the company's name, and where an end card goes", () => {
    const brand = projectFiles(main()).get("brimm/brand.md");
    assert.match(brand, /The company's name is The BRIMM/);
    assert.match(brand, /"Brim" or "brim" is BRIMM/);
    assert.match(brand, /An end card starts after the last words/);
    assert.match(brand, /never cuts the recording/);
  });
  it("begin a session clip's notes with its own rules", () => {
    const own = projectFiles(clip()).get("CLAUDE.md");
    const at = own.indexOf("This is a clip of a private client session");
    assert.ok(at >= 0 && at < own.indexOf("# The BRIMM: rules for this project"));
    const first = own.slice(0, own.indexOf("# The BRIMM: rules for this project"));
    for (const said of [/Share/, /cloud/, /Script panel/, /web/]) assert.match(first, said);
  });
});

describe("assertSafe (5.2)", () => {
  it("refuses a path that leaves the project, an absolute one and a .env", () => {
    for (const path of ["../outside", "brimm/../../x", "/etc/passwd", ".env", "brimm/.env", ".env.local"]) {
      assert.throws(() => assertSafe(new Map([[path, "x"]])), undefined, path);
    }
  });
  it("lets each kind's file set through", () => {
    for (const files of [projectFiles(main()), projectFiles(reel()), projectFiles(clip())]) assert.doesNotThrow(() => assertSafe(files));
  });
});

describe("writeProject (5.7)", () => {
  /** A scratch folder holding a working copy and a logo, with the file set of a main project for them, to go in its episode's folder. */
  function scratch() {
    const root = fs.mkdtempSync(join(tmpdir(), "brimm-project-"));
    const video = join(root, "working copy", "k.mp4");
    fs.mkdirSync(join(root, "working copy"));
    fs.writeFileSync(video, "the working copy's bytes");
    fs.mkdirSync(join(root, "logos"));
    fs.writeFileSync(join(root, "logos", "mark.svg"), "<svg/>");
    const files = projectFiles(main({ video, logos: [join(root, "logos", "mark.svg")] }));
    const episode = join(root, "Episode");
    return { root, video, files, episode, dir: join(episode, "Pricing talk main 3fa9c1") };
  }
  /** node:fs, with the rename of the finished folder into place refused, and, when `stuck`, the working copy's way back too. */
  const refusing = (dir, video, stuck = false) => ({
    ...fs,
    renameSync: (from, to) => {
      if (to === dir) throw new Error("the rename was refused");
      if (stuck && to === video) throw new Error("the way back is gone");
      return fs.renameSync(from, to);
    }
  });
  /** node:fs, with writeFileSync and copyFileSync failing after `n` files. */
  const failingAfter = (n) => {
    let made = 0;
    const counted = (call) => (...args) => {
      if (++made > n) throw new Error("the disk is full");
      return call(...args);
    };
    return { ...fs, writeFileSync: counted(fs.writeFileSync), copyFileSync: counted(fs.copyFileSync) };
  };

  it("moves the video in, not copies it, and writes the rest, building beside the project's folder", () => {
    const { root, video, files, episode, dir } = scratch();
    writeProject(dir, files);
    assert.ok(!fs.existsSync(video));
    assert.equal(fs.readFileSync(join(dir, "media", "recording.mp4"), "utf8"), "the working copy's bytes");
    assert.equal(fs.readFileSync(join(dir, "CLAUDE.md"), "utf8"), files.get("CLAUDE.md"));
    assert.equal(fs.readlinkSync(join(dir, "node_modules", ".bin", "hyperframes")), CLI);
    assert.equal(fs.readFileSync(join(dir, "assets", "logos", "mark.svg"), "utf8"), "<svg/>");
    assert.deepEqual(fs.readdirSync(episode), ["Pricing talk main 3fa9c1"]);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("writes whole or not at all: a failure after the third file leaves no folder and the video where it was", () => {
    const { root, video, files, episode, dir } = scratch();
    assert.throws(() => writeProject(dir, files, { fs: failingAfter(3) }), /the disk is full/);
    assert.ok(!fs.existsSync(dir));
    assert.equal(fs.readFileSync(video, "utf8"), "the working copy's bytes");
    assert.deepEqual(fs.readdirSync(episode), []);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("puts the video back when the folder cannot be put in place", () => {
    const { root, video, files, episode, dir } = scratch();
    assert.throws(() => writeProject(dir, files, { fs: refusing(dir, video) }), /the rename was refused/);
    assert.ok(!fs.existsSync(dir));
    assert.equal(fs.readFileSync(video, "utf8"), "the working copy's bytes");
    assert.deepEqual(fs.readdirSync(episode), []);
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("leaves the video beside the project's folder, and says where, when it cannot be put back", () => {
    const { root, video, files, episode, dir } = scratch();
    let said = "";
    assert.throws(() => writeProject(dir, files, { fs: refusing(dir, video, true) }), (error) => {
      said = error.message;
      return /could not be put back/.test(said);
    });
    const at = said.slice(said.lastIndexOf(" is at ") + " is at ".length);
    assert.ok(at.startsWith(`${episode}/`), at);
    assert.equal(fs.readFileSync(at, "utf8"), "the working copy's bytes");
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("refuses a folder that exists, and leaves it alone", () => {
    const { root, video, files, dir } = scratch();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(join(dir, "theirs.txt"), "kept");
    assert.throws(() => writeProject(dir, files), /already/);
    assert.deepEqual(fs.readdirSync(dir), ["theirs.txt"]);
    assert.ok(fs.existsSync(video));
    fs.rmSync(root, { recursive: true, force: true });
  });
  it("refuses a file set with an unsafe path before it touches anything", () => {
    const { root, video, files, episode, dir } = scratch();
    assert.throws(() => writeProject(dir, new Map([...files, ["../escaped.txt", "x"]])));
    assert.ok(!fs.existsSync(episode) && fs.existsSync(video));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
