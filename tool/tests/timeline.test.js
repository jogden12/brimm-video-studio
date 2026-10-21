// The timeline a push hands to Final Cut, built from the record once the session has given it anything (phase 4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { REEL_FRAME } from "../reels.js";
import { checkFcpxml } from "../fcpxml.js";
import { timelineFor, layered } from "../timeline.js";
import { EPISODE, episode, episodeFiles } from "./phase4.js";
import { probed, jpegOf } from "./fixtures.js";
import { editMain, pickReels } from "../edit.js";
import { pushedFolder } from "../settings.js";
import { readdirSync, readFileSync } from "node:fs";
import { FOLDER, reread } from "./episodes.js";
import { GUESSED } from "../reels.js";
import { clockOf } from "../clock.js";

const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}

describe("a push, through what it hands to Final Cut", () => {
  it("shows a Reel with its captions and its title on screen, and says what stood in for Varela once it is shown", async () => {
    const { t } = episode();
    t.ctx.deps.fontFiles = () => ["LucidaGrande.ttc"];
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "2");
    assert.equal(r.code, 0, r.text);
    const lines = r.text.split("\n");
    assert.match(lines[0], /^Shown in Final Cut as "Pricing- what to charge- reel 2 v1 3fa9c1"/);
    assert.equal(lines[1], "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book.");
    const dir = pushedFolder(t.home, FOLDER);
    const handed = readFileSync(join(dir, readdirSync(dir).find((n) => n.startsWith("reel-2.v1"))), "utf8");
    assert.ok(tags(handed, "title").some((x) => x.role === "BRIMM captions"));
    assert.ok(tags(handed, "title").some((x) => x.name === "brimm hook 3fa9c1"));
    t.done();
  });
  it("builds a picked Reel on the project written at its pick: its clips and moves as they were, its note of a guessed crop once", async () => {
    const made = episodeFiles({ guessed: true, picked: false });
    const { t, found } = episode({}, {}, made);
    assert.equal(await pickReels(t.ctx, found, [2]), 0);
    const now = { ...found, record: reread(found) };
    const v0 = readFileSync(join(found.folder, "edit", "reel-2.v0.fcpxml"), "utf8");
    const built = await timelineFor(now, { reel: 2 }, t.ctx);
    assert.ok(built.xml, built.why);
    const clips = (xml) => clockOf(xml).map((p) => [p.from, p.to, p.position]);
    assert.deepEqual(clips(built.xml), clips(v0));
    assert.equal(tags(built.xml, "marker").filter((m) => m.value.split(" / ").includes(GUESSED)).length, 1);
    assert.ok(tags(built.xml, "title").some((x) => x.role === "BRIMM captions"));
    assert.ok(tags(built.xml, "title").some((x) => x.name === "brimm hook 3fa9c1"));
    assert.deepEqual(checkFcpxml(built.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    // A cut in the Reel keeps each piece's move as the pick wrote it, and its note that the face was guessed.
    const cut = { ...now, record: { ...now.record, version: 2, reels: now.record.reels.map((r) => (r.n === 2 ? { ...r, cuts: [{ id: "c1", keep: false, from: 19.414, to: 21.097 }] } : r)) } };
    const after = await timelineFor(cut, { reel: 2 }, t.ctx);
    assert.deepEqual(clockOf(after.xml).map((p) => p.position), [clips(v0)[0][2]]);
    assert.equal(tags(after.xml, "marker").filter((m) => m.value.split(" / ").includes(GUESSED)).length, 1);
    assert.deepEqual(checkFcpxml(after.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    t.done();
  });
});

describe("a push on a Mac without ffprobe", () => {
  it("is refused in plain words, and runs no program that is not there", async () => {
    const { t } = episode();
    assert.equal((await on(t.ctx.deps, "spell", FOLDER, "add", "Sallie", "Sally")).code, 0);
    t.ctx.deps.tools = { ...t.ctx.deps.tools, ffprobe: "" };
    for (const ask of [["push", FOLDER], ["push", FOLDER, "reel", "2"]]) {
      assert.deepEqual(await on(t.ctx.deps, ...ask), { code: 1, text: "ffprobe is not installed. It comes with ffmpeg." }, ask.join(" "));
    }
    assert.ok(!t.calls.some((c) => c.cmd === ""), JSON.stringify(t.calls.map((c) => c.cmd)));
    t.done();
  });
});

describe("a Reel whose own stretches cannot be read", () => {
  it("is refused while its project from the pick is not whole in Dropbox, as a push refused it before phase 4", async () => {
    const made = episodeFiles({ picked: false });
    const { t, found } = episode({}, {}, made);
    assert.equal(await pickReels(t.ctx, found, [2]), 0);
    const v0 = join(found.folder, "edit", "reel-2.v0.fcpxml");
    const whole = readFileSync(v0, "utf8");
    writeFileSync(v0, whole.slice(0, Math.floor(whole.length / 2)));
    const short = new RegExp(`is not whole in Dropbox: edit/reel-2\\.v0\\.fcpxml is short: ${Math.floor(whole.length / 2)} bytes of ${whole.length}\\.`);
    for (const ask of [["push", FOLDER, "reel", "2"], ["text", FOLDER, "add", "lower-third", "reel", "2", "--at", "0:01", "--line", "Sallie Ogden"]]) {
      const r = await on(t.ctx.deps, ...ask);
      assert.equal(r.code, 1, `${ask[0]}: ${r.text}`);
      assert.match(r.text, short, ask[0]);
    }
    // Whole, but not a project brimm-video wrote: it is said to be unreadable, and nothing is built.
    writeFileSync(v0, "x".repeat(whole.length));
    assert.deepEqual(await on(t.ctx.deps, "push", FOLDER, "reel", "2"), { code: 1, text: "edit/reel-2.v0.fcpxml cannot be read." });
    t.done();
  });
  it("is refused when its candidate has nothing to show, and says why", async () => {
    const reels = JSON.parse(EPISODE.files["reels.json"]);
    reels.candidates = reels.candidates.map((c) => (c.n === 2 ? { ...c, ranges: [], failed: "it is shorter than one picture" } : c));
    const { t } = episode({}, {}, { ...EPISODE, files: { ...EPISODE.files, "reels.json": JSON.stringify(reels) } });
    assert.deepEqual(await on(t.ctx.deps, "push", FOLDER, "reel", "2"), { code: 1, text: "Reel 2 has nothing to show: it is shorter than one picture." });
    t.done();
  });
});

describe("the timeline a push hands to Final Cut", () => {
  it("is the import's own main timeline while nothing is laid over it", async () => {
    const { t, found } = episode();
    assert.equal(layered(found.record, "main"), false);
    assert.deepEqual(await timelineFor(found, "main", t.ctx), { xml: EPISODE.files["edit/main.v0.fcpxml"], told: [] });
    t.done();
  });
  it("is built the same as the import's, once a preset is picked that draws nothing on it", async () => {
    const { t, found } = episode();
    const record = { ...found.record, main: { ...found.record.main, preset: { job: "full-episode", captions: "file-only", look: "natural" } } };
    const made = await timelineFor({ ...found, record }, "main", t.ctx);
    assert.equal(made.xml.replace(/ name="[^"]*"/g, ""), EPISODE.files["edit/main.v0.fcpxml"].replace(/ name="[^"]*"/g, ""));
    t.done();
  });
  it("keeps the import's own pieces once a spelling is laid over it, on a recording whose tail the phrase gaps cannot show", async () => {
    // ffmpeg heard no silence after the last words: the plan keeps the tail, a sound with no words to it.
    const made = episodeFiles({ drop: [7] });
    const { t, found } = episode({}, {}, made);
    const record = { ...found.record, version: 2, spellings: [["Sallie", "Sally"]] };
    const built = await timelineFor({ ...found, record }, "main", t.ctx);
    const clips = (xml) => tags(xml, "asset-clip").map((c) => [c.offset, c.start, c.duration]);
    assert.deepEqual(clips(built.xml), clips(made.files["edit/main.v0.fcpxml"]));
    assert.match(built.xml, /Thank you so much, Sally\./);
    t.done();
  });
  it("has a name title on the main video, on the Basic Lower Third, in Varela", async () => {
    const { t, found } = episode();
    const record = { ...found.record, version: 2, main: { ...found.record.main, texts: [{ id: "t1", kind: "lower-third", at: 15.3, for: 2, lines: ["Sallie Ogden", "Founder, The BRIMM"] }] } };
    const made = await timelineFor({ ...found, record }, "main", t.ctx);
    assert.deepEqual(tags(made.xml, "title").map((x) => [x.name, x.role, x.lane]), [["brimm text t1 3fa9c1", "BRIMM titles", "5"], ["brimm text t1 3fa9c1", "BRIMM titles", "5"]]);
    assert.deepEqual(checkFcpxml(made.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }), []);
    assert.deepEqual(made.told, []);
    t.done();
  });
  it("puts no look on an HDR recording, PQ as well as HLG, and says so", async () => {
    for (const color_transfer of ["smpte2084", "arib-std-b67"]) {
      const hdr = (args) => {
        writeFileSync(args[args.indexOf("-o") + 1], probed({ picture: { color_primaries: "bt2020", color_transfer }, sound: { sample_rate: "48000", channels: 2 } }));
        return { code: 0, stderr: "" };
      };
      const { t, found } = episode({}, { FFPROBE: hdr });
      const record = { ...found.record, version: 2, main: { ...found.record.main, preset: { job: "full-episode", captions: "file-only", look: "bright" } } };
      const made = await timelineFor({ ...found, record }, "main", t.ctx);
      assert.match(made.told.join(" "), /This recording is HDR/, color_transfer);
      // A Reel of it says so too: Final Cut converts its colours for the upright timeline as well.
      assert.match((await timelineFor(found, { reel: 2 }, t.ctx)).told.join(" "), /This recording is HDR: Final Cut converts its colours/, color_transfer);
      t.done();
    }
  });
  it("reads a phone photo's size as it is shown, turned upright, from a JPEG whose frame comes after a large EXIF part", async () => {
    const { t, found } = episode();
    mkdirSync(join(found.folder, "media"), { recursive: true });
    writeFileSync(join(found.folder, "media", "photo.jpg"), jpegOf(4032, 3024, { orientation: 6, padding: 70000 }));
    const record = { ...found.record, version: 2, main: { ...found.record.main, graphics: [{ id: "g1", picture: "media/photo.jpg", at: 14, for: 2, place: "full" }] } };
    const made = await timelineFor({ ...found, record }, "main", t.ctx);
    assert.deepEqual(tags(made.xml, "format").find((f) => f.name === "FFVideoFormatRateUndefined"), { id: "r4", name: "FFVideoFormatRateUndefined", width: "3024", height: "4032" });
    t.done();
  });
  it("is a picked Reel's own project with its captions, and its title on screen, upright", async () => {
    const { t, found } = episode();
    const made = await timelineFor(found, { reel: 2 }, t.ctx);
    assert.ok(made.xml, made.why);
    const titles = tags(made.xml, "title");
    assert.ok(titles.some((x) => x.role === "BRIMM captions"));
    assert.ok(titles.some((x) => x.name === "brimm hook 3fa9c1"));
    assert.deepEqual(checkFcpxml(made.xml, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
    t.done();
  });
  it("says Lucida Grande stands in when Varela is not on this Mac", async () => {
    const { t, found } = episode();
    t.ctx.deps.fontFiles = () => ["LucidaGrande.ttc"];
    const made = await timelineFor(found, { reel: 2 }, t.ctx);
    assert.equal(made.told[0], "Varela is not installed on this Mac, so the words are in Lucida Grande. Jason installs Varela with Font Book.");
    t.done();
  });
  it("brings over what Dropbox has not brought yet, a picture included", async () => {
    const { t, found } = episode();
    mkdirSync(join(found.folder, "media"), { recursive: true });
    writeFileSync(join(found.folder, "media", "chart.png"), "png");
    t.ctx.isWhole = (path) => !path.endsWith("chart.png");
    const record = { ...found.record, main: { ...found.record.main, graphics: [{ id: "g1", picture: "media/chart.png", at: 15.3, for: 2, place: "lower" }] } };
    assert.deepEqual(await timelineFor({ ...found, record }, "main", t.ctx), { coming: "media/chart.png", bring: ["media/chart.png"] });
    t.done();
  });
});
