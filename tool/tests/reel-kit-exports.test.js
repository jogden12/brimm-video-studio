// A Reel Kit edit comes back through `finish` (plan Task 15; spec 2026-11-23 Reel Kit in Studio, Decision 7): its render, which Studio
// records in the project's public/renders/ as the app records an export (reel-kit-render.js writeMeta), and the app's own exports of the
// project, are found by exports.js as a part's exports, and a Reel Kit Reel is handed off by `finish … reels` as any Reel is: its words
// from the final transcript of the finished video, its on-screen title the Reel's title in Studio's record. The hand-off is the contract's,
// unchanged. The worlds are exports-world.js's and reels-world.js's, with stand-ins for ffprobe, ffmpeg and the transcriber: nothing runs a
// real program, and nothing touches the real Downloads folder, Dropbox or BRIMM Video Work.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finishEpisode } from "../edit.js";
import { exportsFound, lookForExports } from "../exports.js";
import { finishNow } from "../finish.js";
import { handoffFaultV2 } from "../handoff-v2.js";
import { PIN } from "../hyperframes.js";
import { entryOf, projectDirOf, slugOf } from "../reel-kit-project.js";
import { writeMeta } from "../reel-kit-render.js";
import { FOLDER, ID, reread } from "./episodes.js";
import { AT, MAIN, REEL2, ZONE, entry, exportOf, ms, world } from "./exports-world.js";
import { HANDOFF_REL, finishedWorld, handoffIn } from "./reels-world.js";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-finished.json", import.meta.url), "utf8"));
const RK2 = `${REEL2} Reel Kit v1`;
const RK_MAIN = `${MAIN} Reel Kit v1`;
const SLUG2 = slugOf({ id: ID }, "reel 2", 1);
const FROM = { file: "Pricing talk.mp4", bytes: 13, modified: "2026-10-14T09:00:00-05:00" };
const COPY = { bytes: 16, seconds: 23.423, fps: 30 };
/** The record's entry of a Reel Kit edit of `key`, as `reelkit start` writes it (reel-kit-project.js entryOf). */
const rkEntry = (key, name, version = 1) => entryOf({ key, name, mode: "hifi", version, at: AT, machine: "Mac Studio", fromSuggestion: key === "main" ? null : Number(key.slice(5)), from: FROM, workingCopy: COPY });

const worlds = [];
after(() => {
  for (const w of worlds) w.t.done();
});
const keep = (w) => {
  worlds.push(w);
  return w;
};

/** A Reel Kit project `name` in the episode's work folder, as Reel Kit and Studio leave one: its composition in public/ (last changed at
    13:40, before any render), and, when `render` is given ([hours, minutes, seconds], when the render began), Studio's render of it in
    renders/ with the meta record writeMeta writes in public/renders/. Gives { dir, file }. */
function rkProject(w, name, { render = null, slug = SLUG2, text = "A MADE-UP RENDER" } = {}) {
  const dir = join(w.work, name);
  for (const folder of ["public", "renders", "source", "cards", "fx"]) mkdirSync(join(dir, folder), { recursive: true });
  writeFileSync(join(dir, "edit.py"), "TITLE = \"Know your costs\"\n");
  writeFileSync(join(dir, "public", "index.html"), "<html></html>\n");
  writeFileSync(join(dir, "studio.json"), `${JSON.stringify({ slug, state: "rendered" })}\n`);
  for (const rel of ["edit.py", "public/index.html"]) utimesSync(join(dir, rel), new Date(ms(13, 40)), new Date(ms(13, 40)));
  if (!render) return { dir, file: null };
  const file = join(dir, "renders", `${slug}-v1.mp4`);
  writeFileSync(file, text);
  const [hours, minutes, seconds] = render;
  // writeMeta names the record by the Mac's own clock; the moment is made in it, so its name says 14:03:12 wherever the test runs.
  const at = new Date(2026, 9, 20, hours, minutes, seconds);
  utimesSync(file, new Date(ms(hours, minutes + 2, seconds)), new Date(ms(hours, minutes + 2, seconds)));
  writeMeta(dir, { name, file, at });
  return { dir, file };
}

describe("a Reel Kit edit's exports", () => {
  it("finds a Reel Kit render as the part's recorded export", () => {
    const w = keep(world({ projects: ["main"], over: { reels: [{ n: 2, status: "picked", from: 13.38, to: 21.287, title: "Know your costs", why: "", files: [], pushed: [] }] } }));
    // The record holds the main video's HyperFrames project and Reel 2's Reel Kit edit.
    const record = { ...w.found.record, app: { toolchain: PIN.version, projects: [entry("main"), rkEntry("reel 2", RK2)] } };
    const { dir, file } = rkProject(w, RK2, { render: [14, 3, 12] });
    assert.equal(projectDirOf(w.work, record.app.projects[1]), join(dir, "public"));
    const seen = exportsFound({ home: w.t.home, name: FOLDER, record, zone: ZONE });
    const part = seen.input.parts.find((p) => p.key === "reel 2");
    assert.ok(part, "the Reel Kit edit is Reel 2's part");
    assert.deepEqual([part.project, part.here, part.dir], [RK2, true, join(dir, "public")], "its records are read from its public/");
    assert.deepEqual(part.recorded.map((r) => [r.name, r.dir, r.where]), [[`${SLUG2}-v1.mp4`, join(dir, "renders"), "another folder"]]);
    assert.deepEqual(part.renders, [], "the render its record names is no loose render");
    const looked = lookForExports(seen.input);
    const taken = looked.parts.find((p) => p.key === "reel 2");
    assert.deepEqual([taken.video?.name, taken.video?.dir], [`${SLUG2}-v1.mp4`, join(dir, "renders")]);
    assert.equal(join(taken.video.dir, taken.video.name), file);
    assert.match(taken.line, new RegExp(`^Reel 2: ${SLUG2}-v1\\.mp4, from another folder, exported 2026-10-20 14:03`));
    // A Reel Kit edit of the main video is the main part, as a HyperFrames project in use is (app.js isMain leaves it out, so that `app` never
    // takes it for its own); one kept for an earlier kind is none.
    const rkMain = rkProject(w, RK_MAIN, { render: [13, 58, 0], slug: slugOf({ id: ID }, "main", 1) });
    const asMain = { ...record, app: { toolchain: PIN.version, projects: [rkEntry("main", RK_MAIN)] } };
    const mainPart = exportsFound({ home: w.t.home, name: FOLDER, record: asMain, zone: ZONE }).input.parts.find((p) => p.key === "main");
    assert.deepEqual([mainPart?.project, mainPart?.dir, mainPart?.recorded.length], [RK_MAIN, join(rkMain.dir, "public"), 1]);
    const kept = { ...record, app: { toolchain: PIN.version, projects: [{ ...rkEntry("main", RK_MAIN), state: "kept for an earlier kind" }] } };
    assert.deepEqual(exportsFound({ home: w.t.home, name: FOLDER, record: kept, zone: ZONE }).input.parts, []);
    // Two Reel Kit edits of one Reel: the newest version is the part's project, once.
    const v2 = `${REEL2} Reel Kit v2`;
    rkProject(w, v2, { render: [14, 10, 0], slug: slugOf({ id: ID }, "reel 2", 2) });
    const both = { ...record, app: { toolchain: PIN.version, projects: [rkEntry("reel 2", RK2), rkEntry("reel 2", v2, 2)] } };
    assert.deepEqual(exportsFound({ home: w.t.home, name: FOLDER, record: both, zone: ZONE }).input.parts.map((p) => [p.key, p.project]), [["reel 2", v2]]);
  });

  it("finds an app export of a Reel Kit project in its public/renders", () => {
    const w = keep(world({ projects: ["main"] }));
    const record = { ...w.found.record, app: { toolchain: PIN.version, projects: [entry("main"), rkEntry("reel 2", RK2)] } };
    const { dir } = rkProject(w, RK2);
    // She opened the edit's public/ in HyperFrames and exported it from there: the app saved the export in Downloads and left its record in
    // public/renders/, under the name it gives the project (the folder it opened).
    const path = join(w.downloads, "public 2026-10-20 14.20.mp4");
    writeFileSync(path, "the app's export of the Reel Kit edit");
    utimesSync(path, new Date(ms(14, 22)), new Date(ms(14, 22)));
    mkdirSync(join(dir, "public", "renders"), { recursive: true });
    writeFileSync(join(dir, "public", "renders", "public_2026-10-20_14-20-05.meta.json"), JSON.stringify({ status: "complete", exportedTo: path, settings: { format: "mp4", resolution: "1080x1920" } }));
    // A record in the project's own renders/ (where a HyperFrames project keeps them) is not where a Reel Kit edit's are.
    writeFileSync(join(dir, "renders", "elsewhere.mp4"), "not an export of the edit");
    writeFileSync(join(dir, "renders", `${RK2}_2026-10-20_15-00-00.meta.json`), JSON.stringify({ status: "complete", exportedTo: join(dir, "renders", "elsewhere.mp4") }));
    const seen = exportsFound({ home: w.t.home, name: FOLDER, record, zone: ZONE });
    const part = seen.input.parts.find((p) => p.key === "reel 2");
    assert.deepEqual(part.recorded.map((r) => [r.name, r.where]), [["public 2026-10-20 14.20.mp4", "Downloads"]]);
    const taken = lookForExports(seen.input).parts.find((p) => p.key === "reel 2");
    assert.deepEqual([taken.video?.name, taken.video?.where], ["public 2026-10-20 14.20.mp4", "Downloads"]);
    assert.match(taken.line, /^Reel 2: public 2026-10-20 14\.20\.mp4, from Downloads, exported 2026-10-20 14:20/);
  });
});

describe("a Reel Kit main video through finish", () => {
  it("finishes a raw video whose main video is a Reel Kit edit from its render, reading its picture's words from its public/", async () => {
    const w = keep(world({ projects: ["main"], shown: false, over: { app: { toolchain: PIN.version, projects: [rkEntry("main", RK_MAIN)] } } }));
    rkProject(w, RK_MAIN, { render: [13, 58, 0], slug: slugOf({ id: ID }, "main", 1) });
    const linesOf = () => (w.t.said() === "" ? [] : w.t.said().split("\n"));
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, {}), 0, w.t.said());
    const lines = linesOf();
    assert.ok(!lines.some((line) => /never opened in HyperFrames/.test(line)), lines.join("\n"));
    assert.ok(lines.some((line) => line.startsWith(`The main video: ${slugOf({ id: ID }, "main", 1)}-v1.mp4, from another folder, exported 2026-10-20 13:58`)), lines.join("\n"));
    // Its picture is read from the edit's public/, where Reel Kit's composition is: here it holds no words, so she is asked what is on screen.
    assert.ok(lines.includes("I found no words on the main video's picture. Say what is on screen, or say that nothing is."), lines.join("\n"));
  });
});

describe("a Reel Kit Reel through finish … reels", () => {
  /** The made-up finished video, its hand-off written as revision 1, with Reel 2 picked and edited in Reel Kit (no HyperFrames project),
      and that edit rendered by Studio at 14:03:12. */
  async function rkWorld() {
    const w = keep(await finishedWorld({ projects: ["reel 2"], over: { app: { toolchain: PIN.version, projects: [rkEntry("reel 2", RK2)] } } }));
    const made = rkProject(w, RK2, { render: [14, 3, 12] });
    return { w, ...made };
  }
  /** Asked with a yes, and run to its end. */
  async function handedOff(w) {
    const linesOf = () => (w.t.said() === "" ? [] : w.t.said().split("\n"));
    const had = linesOf().length;
    assert.equal(await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, { reels: true, yes: true }), 0, w.t.said());
    const lines = linesOf().slice(had);
    const found = { ...w.found, record: reread(w.found) };
    const result = await finishNow(w.t.ctx, found);
    assert.equal(result.ok, true, result.failed.join(" "));
    return { found, lines };
  }

  it("hands off a Reel Kit Reel with finish … reels as today", async () => {
    const { w, file } = await rkWorld();
    const before = handoffIn(w.found);
    const { found, lines } = await handedOff(w);
    assert.ok(lines.some((line) => line.startsWith(`Reel 2: ${SLUG2}-v1.mp4, from another folder, exported 2026-10-20 14:03`)), lines.join("\n"));
    assert.ok(!lines.some((line) => /has no HyperFrames project|never opened/.test(line)), "the Reel Kit edit is Reel 2's project");
    const h = handoffIn(found);
    assert.deepEqual([h.revision, h.main, h.suggestions], [2, before.main, before.suggestions]);
    // Its title on screen is the Reel's title in Studio's record; its words are the final transcript of the finished video (the transcriber
    // stand-in's captions of Reel 2); its file is the render, copied into final/.
    const reel = reread(found).reels.find((r) => r.n === 2);
    assert.deepEqual(h.reels.map((r) => [r.n, r.title, r.file, r.seconds, r.fromSuggestion]), [[2, reel.title, `${SLUG2}-v1.mp4`, 75, 2]]);
    assert.equal(reel.title, "Know your costs");
    assert.match(h.reels[0].srt, /So the first thing you need to do is know your\n/);
    assert.match(h.reels[0].srt, /costs\. It is very, very important\./);
    assert.ok(existsSync(join(found.folder, "final", `${SLUG2}-v1.mp4`)));
    // The render stays in its project (it is not in Downloads, so nothing takes it away), the edit's entry is finished, and the record
    // finishes Reel 2.
    assert.equal(readFileSync(file, "utf8"), "A MADE-UP RENDER");
    const after_ = reread(found);
    assert.deepEqual(after_.app.projects.map((p) => [p.key, p.name, p.maker, p.state]), [["reel 2", RK2, "reel-kit", "finished"]]);
    assert.equal(after_.finished.parts["reel 2"].project, RK2);
    assert.equal(after_.reels.find((r) => r.n === 2).status, "finished");
    assert.deepEqual(readdirSync(w.downloads), []);
  });

  it("finishes only the edit it took, when a Reel has two", async () => {
    const v2 = `${REEL2} Reel Kit v2`;
    const w = keep(await finishedWorld({ projects: ["reel 2"], over: { app: { toolchain: PIN.version, projects: [rkEntry("reel 2", RK2), rkEntry("reel 2", v2, 2)] } } }));
    rkProject(w, RK2, { render: [14, 3, 12] });
    rkProject(w, v2, { render: [14, 30, 0], slug: slugOf({ id: ID }, "reel 2", 2), text: "THE SECOND EDIT'S RENDER" });
    const { found } = await handedOff(w);
    assert.equal(handoffIn(found).reels[0].file, `${slugOf({ id: ID }, "reel 2", 2)}-v1.mp4`, "the newest edit's render");
    assert.deepEqual(reread(found).app.projects.map((p) => [p.name, p.state]), [[RK2, "made"], [v2, "finished"]]);
  });

  it("leaves the hand-off's keys and madeBy as the contract names them", async () => {
    const { w } = await rkWorld();
    const { found } = await handedOff(w);
    const h = handoffIn(found);
    assert.equal(handoffFaultV2(h), "");
    assert.deepEqual(Object.keys(h), Object.keys(FIXTURE));
    assert.deepEqual(Object.keys(h.video), Object.keys(FIXTURE.video));
    assert.deepEqual(Object.keys(h.main), Object.keys(FIXTURE.main));
    for (const r of h.reels) assert.deepEqual(Object.keys(r), Object.keys(FIXTURE.reels[0]));
    assert.match(h.madeBy, /^brimm-video \S+$/, "the contract names the tool brimm-video");
    assert.ok(!JSON.stringify(h).includes("reel-kit") && !JSON.stringify(h).includes("Reel Kit"), "nothing of Reel Kit's is in the hand-off");
    assert.equal(HANDOFF_REL.startsWith("final/"), true);
  });
});
