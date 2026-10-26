// The timeline a push hands to Final Cut, built from the record once the session has given it anything (phase 4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { REEL_FRAME } from "../reels.js";
import { checkFcpxml } from "../fcpxml.js";
import { timelineFor, layered, clockFor, piecesOf, newestOf, newestIsRender } from "../timeline.js";
import { EPISODE, episode, episodeFiles } from "./phase4.js";
import { probed, jpegOf } from "./fixtures.js";
import { editMain, pickReels } from "../edit.js";
import { pushedFolder } from "../settings.js";
import { readdirSync, readFileSync } from "node:fs";
import { FOLDER, reread } from "./episodes.js";
import { GUESSED } from "../reels.js";
import { clockOf, clockOfRanges } from "../clock.js";
import { layoutOf, recordFile, recordText } from "../episode.js";

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

// What the times of a video are read on (the switch, section 3, "Times"): a finished video, a clip and a session on the video's
// own clock, and a raw video on the newest version of its main video that has been shown on this Mac.
const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" };
const SESSION_MARK = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
/** What each kind of a layout-3 record adds to the made-up episode's record. */
const LAYOUT_3 = {
  finished: { version: 3, kind: "finished", answer: ANSWERED },
  raw: { version: 3, kind: "raw", answer: ANSWERED },
  session: { version: 3, kind: "session", answer: { ...ANSWERED, private: "yes" }, session: SESSION_MARK, label: "Session, 2026-10-20" },
  "short video": { version: 3, kind: "short video", answer: ANSWERED }
};
const PLAN_FILE = "Pricing talk.cut-plan.json";
const VIDEO_FILE = "Pricing talk.mp4";
const SRT_FILE = "Pricing talk.srt";
/** A stored Final Cut file of two clips, the first from the raw video's second `n`, as a push or a render keeps one. */
const stored = (n) => `<fcpxml><library><event><project><sequence><spine><asset-clip offset="0s" start="${n}s" duration="3s"/><asset-clip offset="3s" start="${n + 10}s" duration="2s"/></spine></sequence></project></event></library></fcpxml>`;
const clipsOf = (n) => [{ at: 0, from: n, to: n + 3, notes: [] }, { at: 3, from: n + 10, to: n + 12, notes: [] }];
const push = (v, at, on = "Mac Studio") => ({ v, at, on, file: `edit/main.v${v}.${on === "Mac Studio" ? "studio" : "laptop"}.fcpxml`, project: `p${v}` });
const render = (v, at, on = "Mac Studio", opened = AT) => ({ v, how: "render", at, on, file: `edit/main.v${v}.fcpxml`, ...(opened ? { opened } : {}) });
/** The episode with the main video's versions as listed, each one's stored file written as its `n` says: [version, n]. */
const withPushed = (found, pushed, files = []) => {
  mkdirSync(join(found.folder, "edit"), { recursive: true });
  for (const [entry, n] of files) writeFileSync(join(found.folder, entry.file), stored(n));
  return { ...found, record: { ...found.record, main: { ...found.record.main, pushed } } };
};
const digest = (x) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 12);

describe("clockFor, for a video that keeps all of it (a finished video, a session, an answered clip)", () => {
  const WHOLE = [{ at: 0, from: 0, to: 23.423 }];
  const WHAT = { finished: "a finished video", session: "a session", "short video": "an answered iPhone clip" };
  for (const kind of ["finished", "session", "short video"]) {
    it(`reads the times of ${WHAT[kind]} on the video's own clock, whatever its plan cut, and needs neither the video nor its captions here`, () => {
      const { t, found } = episode(LAYOUT_3[kind]);
      const planText = readFileSync(join(found.folder, PLAN_FILE), "utf8");
      // The plan cuts silences and a retake, as a raw video's does.
      assert.ok(JSON.parse(planText).ranges.some((r) => !r.keep));
      rmSync(join(found.folder, VIDEO_FILE));
      rmSync(join(found.folder, SRT_FILE));
      t.ctx.isWhole = (path) => !path.endsWith(".mp4") && !path.endsWith(".srt");
      const read = clockFor(found, "main", t.ctx);
      assert.equal(read.coming, undefined, JSON.stringify(read.coming));
      assert.equal(read.why, undefined, read.why);
      assert.deepEqual([read.on, read.clock, read.pieces], ["the video", WHOLE, [{ start: 0, end: 23.423 }]]);
      assert.ok(read.ranges.length === 1 && read.ranges[0].keep, JSON.stringify(read.ranges));
      assert.deepEqual(read.need, [PLAN_FILE, "Pricing talk.words.json"]);
      // The plan returned is the one read, and the file is as it was.
      assert.deepEqual(read.plan, JSON.parse(planText));
      assert.equal(readFileSync(join(found.folder, PLAN_FILE), "utf8"), planText);
      t.done();
    });
  }
  it("makes the one range of the whole video as the plan's own ranges are made: kept, with every phrase and its words", () => {
    const { t, found } = episode(LAYOUT_3.finished);
    const read = clockFor(found, "main", t.ctx);
    const phrases = read.plan.phrases;
    assert.deepEqual(read.ranges, [{ start: 0, end: 23.423, keep: true, kind: "keep", why: "", phrases: phrases.map((p) => p.id), text: phrases.map((p) => p.text).filter(Boolean).join(" ") }]);
    t.done();
  });
  it("still takes her own cuts off it", () => {
    const { t, found } = episode(LAYOUT_3.finished);
    const cut = { ...found, record: { ...found.record, main: { ...found.record.main, cuts: [{ id: "c1", keep: false, from: 13.38, to: 16.3 }] } } };
    const read = clockFor(cut, "main", t.ctx);
    assert.equal(read.on, "the video");
    assert.equal(read.pieces.length, 2);
    assert.deepEqual([read.pieces[0].start, read.pieces[read.pieces.length - 1].end], [0, 23.423]);
    assert.ok(read.pieces[0].end > 12 && read.pieces[0].end < 13.38 && read.pieces[1].start > 16.3 && read.pieces[1].start < 17.3, JSON.stringify(read.pieces));
    assert.deepEqual(read.clock, clockOfRanges(read.pieces));
    t.done();
  });
  it("does not read its versions: none is needed in the folder, and a push listed is not looked for", () => {
    const { t, found } = episode(LAYOUT_3.finished);
    const record = { ...found.record, main: { ...found.record.main, pushed: [push(2, AT)] } };
    const read = clockFor({ ...found, record }, "main", t.ctx);
    assert.deepEqual([read.on, read.clock, read.why, read.coming], ["the video", WHOLE, undefined, undefined]);
    t.done();
  });
  it("keeps a Reel of a finished video on its versions, as a Reel is", () => {
    const { t, found } = episode(LAYOUT_3.finished);
    writeFileSync(join(found.folder, "edit", "reel-2.v1.fcpxml"), stored(5));
    const reels = found.record.reels.map((r) => (r.n === 2 ? { ...r, pushed: [{ v: 1, at: AT, on: "Mac Studio", file: "edit/reel-2.v1.fcpxml", project: "r2" }] } : r));
    const read = clockFor({ ...found, record: { ...found.record, reels } }, { reel: 2 }, t.ctx);
    assert.deepEqual([read.on, read.clock], ["Reel 2 v1", clipsOf(5)]);
    t.done();
  });
  it("keeps the plan's cuts for a short video from before the switch (layout 1 or 2)", () => {
    const { t, found } = episode({ kind: "short video" });
    const read = clockFor(found, "main", t.ctx);
    assert.equal(read.on, "the main video as it is now");
    assert.deepEqual(read.clock, clockOfRanges(read.pieces));
    assert.equal(read.pieces.length, 3);
    // And a layer of phase 4 (layout 2) does not change that.
    const spelled = episode({ kind: "short video", spellings: [["Sally", "Sallie"]] });
    assert.equal(clockFor(spelled.found, "main", spelled.t.ctx).pieces.length, 3);
    t.done();
    spelled.t.done();
  });
  it("keeps today's choice of version for a short video from before the switch that holds a version with a `how`: the version, not the whole video", () => {
    for (const how of ["render", "push"]) {
      const { t, found } = episode({ kind: "short video" });
      const one = push(1, "2026-10-20T10:00:00-05:00");
      const two = how === "render" ? render(2, "2026-10-20T11:00:00-05:00") : { ...push(2, "2026-10-20T11:00:00-05:00"), how };
      const held = withPushed(found, [one, two], [[one, 1], [two, 2]]);
      // layoutOf turns 3 for such a record, but she has answered nothing about it.
      assert.equal(layoutOf(held.record), 3);
      const read = clockFor(held, "main", t.ctx);
      assert.deepEqual([read.on, read.clock], ["main v2", clipsOf(2)], how);
      t.done();
    }
  });
  it("keeps the whole video of an iPhone clip only once it is answered (layout 3)", () => {
    const { t, found } = episode({ kind: "short video" });
    assert.equal(clockFor(found, "main", t.ctx).pieces.length, 3);
    const answered = episode(LAYOUT_3["short video"]);
    assert.deepEqual(clockFor(answered.found, "main", answered.t.ctx).pieces, [{ start: 0, end: 23.423 }]);
    t.done();
    answered.t.done();
  });
});

describe("clockFor, for a raw video's versions", () => {
  it("reads the rough cut's own stored clock once it is rendered and opened here: main v0", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const rough = render(0, AT);
    const read = clockFor(withPushed(found, [rough]), "main", t.ctx);
    assert.equal(read.on, "main v0");
    assert.deepEqual(read.clock, clockOf(EPISODE.files["edit/main.v0.fcpxml"]));
    assert.equal("elsewhere" in read, false);
    t.done();
  });
  it("needs neither the video nor its captions on this Mac to read a time of a layout-3 video, and still needs its plan and words", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    t.ctx.isWhole = (path) => !path.endsWith(".mp4") && !path.endsWith(".srt");
    const read = clockFor(withPushed(found, [render(0, AT)]), "main", t.ctx);
    assert.deepEqual([read.on, read.coming], ["main v0", undefined]);
    assert.deepEqual(read.need, [PLAN_FILE, "Pricing talk.words.json"]);
    t.ctx.isWhole = (path) => !path.endsWith(".words.json");
    assert.deepEqual(clockFor(withPushed(found, [render(0, AT)]), "main", t.ctx), { coming: "Pricing talk.words.json", bring: ["Pricing talk.words.json"] });
    t.done();
  });
  it("does not count a render of the other Mac as this Mac's clock, and says there is a newer one there", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const one = push(1, "2026-10-20T10:00:00-05:00");
    const elsewhere = render(2, "2026-10-20T11:00:00-05:00", "Sallie's laptop");
    const read = clockFor(withPushed(found, [one, elsewhere], [[one, 1]]), "main", t.ctx);
    assert.deepEqual([read.on, read.clock, read.elsewhere], ["main v1", clipsOf(1), { v: 2, on: "Sallie's laptop" }]);
    t.done();
  });
  it("does not count a render on this Mac that has not opened yet, and says nothing of a newer one elsewhere for it", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const one = push(1, "2026-10-20T10:00:00-05:00");
    const rendered = render(2, "2026-10-20T11:00:00-05:00", "Mac Studio", "");
    assert.equal("opened" in rendered, false);
    for (const unopened of [rendered, { ...rendered, opened: "" }]) {
      const read = clockFor(withPushed(found, [one, unopened], [[one, 1]]), "main", t.ctx);
      assert.deepEqual([read.on, read.clock, "elsewhere" in read], ["main v1", clipsOf(1), false]);
    }
    t.done();
  });
  it("counts a render that has opened here after a push, by the version, and the push of the other Mac as it does today", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const one = push(1, "2026-10-20T10:00:00-05:00", "Sallie's laptop");
    const two = render(2, "2026-10-20T11:00:00-05:00");
    const read = clockFor(withPushed(found, [one, two], [[one, 1], [two, 7]]), "main", t.ctx);
    assert.deepEqual([read.on, read.clock], ["main v2", clipsOf(7)]);
    // A push of the other Mac counts, newer than the render here.
    const three = push(3, "2026-10-20T12:00:00-05:00", "Sallie's laptop");
    const next = clockFor(withPushed(found, [one, two, three], [[three, 3]]), "main", t.ctx);
    assert.deepEqual([next.on, next.clock, "elsewhere" in next], ["main v3", clipsOf(3), false]);
    t.done();
  });
  it("reads the newest version by its number, and of two with one number the first listed, as it always did", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const one = push(1, "2026-10-20T10:00:00-05:00");
    const here = push(2, "2026-10-20T11:00:00-05:00");
    const there = push(2, "2026-10-20T11:30:00-05:00", "Sallie's laptop");
    const files = [[one, 1], [here, 2], [there, 4]];
    for (const [pushed, n] of [[[one, here, there], 2], [[there, here, one], 4], [[here, one, there], 2]]) {
      const read = clockFor(withPushed(found, pushed, files), "main", t.ctx);
      assert.deepEqual([read.on, read.clock], ["main v2", clipsOf(n)], pushed.map((p) => p.file).join());
    }
    t.done();
  });
  it("says a newer render of the other Mac is there when no version counts here, and reads the timeline as it is now", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const read = clockFor(withPushed(found, [render(0, AT, "Sallie's laptop")]), "main", t.ctx);
    assert.deepEqual([read.on, read.elsewhere], ["the main video as it is now", { v: 0, on: "Sallie's laptop" }]);
    assert.equal(read.pieces.length, 3);
    t.done();
  });
  it("says the newest render of the other Mac that has opened is there, though a render of this Mac that has not opened is the newest listed", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const one = push(1, "2026-10-20T10:00:00-05:00");
    const theirs = render(2, "2026-10-20T11:00:00-05:00", "Sallie's laptop");
    const mine = render(3, "2026-10-20T12:00:00-05:00", "Mac Studio", "");
    const read = clockFor(withPushed(found, [one, theirs, mine], [[one, 1]]), "main", t.ctx);
    assert.deepEqual([read.on, read.clock, read.elsewhere], ["main v1", clipsOf(1), { v: 2, on: "Sallie's laptop" }]);
    // Of two on the other Mac, the newest that has opened.
    const later = render(4, "2026-10-20T13:00:00-05:00", "Sallie's laptop");
    const again = clockFor(withPushed(found, [one, theirs, mine, later], [[one, 1]]), "main", t.ctx);
    assert.deepEqual(again.elsewhere, { v: 4, on: "Sallie's laptop" });
    t.done();
  });
  it("does not count a render of the other Mac before it has opened there", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const one = push(1, "2026-10-20T10:00:00-05:00");
    for (const unopened of [render(2, "2026-10-20T11:00:00-05:00", "Sallie's laptop", ""), { ...render(2, "2026-10-20T11:00:00-05:00", "Sallie's laptop"), opened: "  " }]) {
      const read = clockFor(withPushed(found, [one, unopened], [[one, 1]]), "main", t.ctx);
      assert.deepEqual([read.on, "elsewhere" in read], ["main v1", false]);
    }
    const none = clockFor(withPushed(found, [render(0, AT, "Sallie's laptop", "")]), "main", t.ctx);
    assert.equal("elsewhere" in none, false);
    t.done();
  });
  it("says nothing of a render of the other Mac that is not newer than the version it reads", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const old = render(1, "2026-10-20T10:00:00-05:00", "Sallie's laptop");
    const two = push(2, "2026-10-20T11:00:00-05:00");
    const read = clockFor(withPushed(found, [old, two], [[two, 2]]), "main", t.ctx);
    assert.deepEqual([read.on, "elsewhere" in read], ["main v2", false]);
    t.done();
  });
  it("brings a stored file Dropbox has not brought yet, and says one that is gone", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    const rough = render(0, AT);
    t.ctx.isWhole = (path) => !path.endsWith("main.v0.fcpxml");
    assert.deepEqual(clockFor(withPushed(found, [rough]), "main", t.ctx), { coming: "edit/main.v0.fcpxml", bring: ["edit/main.v0.fcpxml"] });
    t.ctx.isWhole = () => true;
    const gone = render(5, AT);
    assert.deepEqual(clockFor(withPushed(found, [gone]), "main", t.ctx), { why: "edit/main.v5.fcpxml is not in the episode's folder." });
    t.done();
  });
  it("reads a Reel on its own versions in the same way: a render of the other Mac is not this Mac's clock", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    writeFileSync(join(found.folder, "edit", "reel-2.v1.fcpxml"), stored(5));
    const mine = { v: 1, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/reel-2.v1.fcpxml", project: "r2" };
    const theirs = { v: 2, how: "render", at: "2026-10-20T11:00:00-05:00", on: "Sallie's laptop", file: "edit/reel-2.v2.fcpxml", opened: AT };
    const reels = found.record.reels.map((r) => (r.n === 2 ? { ...r, pushed: [mine, theirs] } : r));
    const read = clockFor({ ...found, record: { ...found.record, reels } }, { reel: 2 }, t.ctx);
    assert.deepEqual([read.on, read.clock, read.elsewhere], ["Reel 2 v1", clipsOf(5), { v: 2, on: "Sallie's laptop" }]);
    t.done();
  });
});

describe("clockFor, for a record with pushes only (every record before the switch)", () => {
  /** What clockFor gave at a92eab4 for each case below: its key facts, and a digest of the whole result, key order included. */
  const TODAYS = {
    "main, no pushes": { on: "the main video as it is now", digest: "c6374af92e0f" },
    "reel 2, no pushes": { on: "Reel 2 as it is now", digest: "0f1787d37773" },
    "reel 3, not in reels.json": { why: "Reel 3 was cut as a clip before Reels had projects of their own, so a time on it cannot be read. Make this change by hand in Final Cut.", digest: "51c54b93bc44" },
    "main with pushes": { on: "main v2", clock: clipsOf(2), digest: "1872a0a7c1b8" },
    "main, newest push not whole": { coming: "edit/main.v2.fcpxml", bring: ["edit/main.v2.fcpxml"], digest: "e29a9287ab7c" },
    "main, newest push gone": { why: "edit/main.v2.fcpxml is not in the episode's folder.", digest: "8b3f3cc850ce" },
    "reel 2 with a push": { on: "Reel 2 v1", clock: clipsOf(5), digest: "a9fd6f2dba23" },
    "video not whole": { coming: "Pricing talk.mp4", bring: ["Pricing talk.mp4"], digest: "ab7c51c91a99" },
    "srt not whole": { coming: "Pricing talk.srt", bring: ["Pricing talk.srt"], digest: "dd9b30aeb082" },
    "plan gone": { why: "Pricing talk.cut-plan.json is not in the episode's folder.", digest: "ecd3f1538fdf" }
  };
  const pushes = () => [
    { v: 1, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/main.v1.fcpxml", project: "p1" },
    { v: 2, at: "2026-10-20T11:00:00-05:00", on: "Mac Studio", file: "edit/main.v2.fcpxml", project: "p2" }
  ];
  const CASES = {
    "main, no pushes": (t, f) => clockFor(f, "main", t.ctx),
    "reel 2, no pushes": (t, f) => clockFor(f, { reel: 2 }, t.ctx),
    "reel 3, not in reels.json": (t, f) => clockFor(f, { reel: 3 }, t.ctx),
    "main with pushes": (t, f) => {
      writeFileSync(join(f.folder, "edit/main.v1.fcpxml"), stored(1));
      writeFileSync(join(f.folder, "edit/main.v2.fcpxml"), stored(2));
      return clockFor({ ...f, record: { ...f.record, main: { ...f.record.main, pushed: pushes() } } }, "main", t.ctx);
    },
    "main, newest push not whole": (t, f) => {
      writeFileSync(join(f.folder, "edit/main.v1.fcpxml"), stored(1));
      writeFileSync(join(f.folder, "edit/main.v2.fcpxml"), stored(2));
      t.ctx.isWhole = (path) => !path.endsWith("main.v2.fcpxml");
      return clockFor({ ...f, record: { ...f.record, main: { ...f.record.main, pushed: pushes() } } }, "main", t.ctx);
    },
    "main, newest push gone": (t, f) => clockFor({ ...f, record: { ...f.record, main: { ...f.record.main, pushed: pushes().slice(1) } } }, "main", t.ctx),
    "reel 2 with a push": (t, f) => {
      writeFileSync(join(f.folder, "edit/reel-2.v1.fcpxml"), stored(5));
      const pushed = [{ v: 1, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/reel-2.v1.fcpxml", project: "p1" }];
      return clockFor({ ...f, record: { ...f.record, reels: f.record.reels.map((r) => (r.n === 2 ? { ...r, pushed } : r)) } }, { reel: 2 }, t.ctx);
    },
    "video not whole": (t, f) => {
      t.ctx.isWhole = (path) => !path.endsWith("Pricing talk.mp4");
      return clockFor(f, "main", t.ctx);
    },
    "srt not whole": (t, f) => {
      t.ctx.isWhole = (path) => !path.endsWith(".srt");
      return clockFor(f, "main", t.ctx);
    },
    "plan gone": (t, f) => {
      rmSync(join(f.folder, PLAN_FILE));
      return clockFor(f, "main", t.ctx);
    }
  };
  for (const [label, run] of Object.entries(CASES)) {
    it(`gives what it gave before: ${label}`, () => {
      const { t, found } = episode();
      const got = run(t, found);
      const want = TODAYS[label];
      assert.deepEqual({ on: got.on, clock: want.clock && got.clock, coming: got.coming, bring: got.bring, why: got.why }, { on: want.on, clock: want.clock, coming: want.coming, bring: want.bring, why: want.why });
      assert.equal("elsewhere" in got, false);
      assert.equal(digest(got), want.digest);
      t.done();
    });
  }
});

describe("piecesOf, for the files a timeline is built from", () => {
  it("still needs the raw video and the captions of a layout-3 video to build from, and brings them", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    t.ctx.isWhole = (path) => !path.endsWith(".mp4");
    assert.deepEqual(piecesOf(found, "main", t.ctx), { coming: VIDEO_FILE, bring: [VIDEO_FILE] });
    t.ctx.isWhole = (path) => !path.endsWith(".srt");
    assert.deepEqual(piecesOf(found, "main", t.ctx), { coming: SRT_FILE, bring: [SRT_FILE] });
    assert.deepEqual(piecesOf(found, "main", t.ctx, [], null, {}), { coming: SRT_FILE, bring: [SRT_FILE] });
    t.ctx.isWhole = () => true;
    assert.deepEqual(piecesOf(found, "main", t.ctx).need, [VIDEO_FILE, PLAN_FILE, "Pricing talk.words.json", SRT_FILE]);
    rmSync(join(found.folder, VIDEO_FILE));
    assert.deepEqual(piecesOf(found, "main", t.ctx), { why: "Pricing talk.mp4 is not in the episode's folder." });
    t.done();
  });
  it("leaves them out when it is to read a clock, for a layout-3 video only", () => {
    const { t, found } = episode(LAYOUT_3.raw);
    t.ctx.isWhole = (path) => !path.endsWith(".mp4") && !path.endsWith(".srt");
    const read = piecesOf(found, "main", t.ctx, [], null, { clock: true });
    assert.deepEqual(read.need, [PLAN_FILE, "Pricing talk.words.json"]);
    const reel = piecesOf(found, { reel: 2 }, t.ctx, [], null, { clock: true });
    assert.deepEqual(reel.need, [PLAN_FILE, "Pricing talk.words.json"]);
    const legacy = episode();
    legacy.t.ctx.isWhole = (path) => !path.endsWith(".mp4");
    assert.deepEqual(piecesOf(legacy.found, "main", legacy.t.ctx, [], null, { clock: true }), { coming: VIDEO_FILE, bring: [VIDEO_FILE] });
    t.done();
    legacy.t.done();
  });
  it("still needs the raw video to read a clock of a video from before the switch, though it holds a version with a `how`", () => {
    for (const kind of ["episode", "short video"]) {
      const { t, found } = episode({ kind });
      const held = withPushed(found, [push(1, "2026-10-20T10:00:00-05:00"), render(2, "2026-10-20T11:00:00-05:00")]);
      assert.equal(layoutOf(held.record), 3);
      t.ctx.isWhole = (path) => !path.endsWith(".mp4");
      assert.deepEqual(piecesOf(held, "main", t.ctx, [], null, { clock: true }), { coming: VIDEO_FILE, bring: [VIDEO_FILE] }, kind);
      t.done();
    }
  });
  it("says in plain words that a plan it cannot use cannot be read, for a video that keeps all of it", () => {
    const { t, found } = episode(LAYOUT_3.finished);
    const why = { why: "Pricing talk.cut-plan.json or Pricing talk.words.json cannot be read." };
    for (const plan of ['{"phrases":[]}', '{"facts":{"duration":9}}', "{}", "[]", "null"]) {
      writeFileSync(join(found.folder, PLAN_FILE), plan);
      assert.deepEqual(piecesOf(found, "main", t.ctx), why, plan);
      assert.deepEqual(clockFor(found, "main", t.ctx), why, plan);
    }
    // And with no words file to have read the phrases first.
    rmSync(join(found.folder, "Pricing talk.words.json"));
    for (const plan of ['{"phrases":[]}', "{}", "null"]) {
      writeFileSync(join(found.folder, PLAN_FILE), plan);
      assert.deepEqual(piecesOf(found, "main", t.ctx), why, plan);
    }
    t.done();
  });
  it("keeps the plan's own ranges for a legacy record and for a raw one, and the whole video for a finished one, with or without a clock asked for", () => {
    for (const [record, kept] of [[{}, 3], [{ kind: "short video" }, 3], [LAYOUT_3.raw, 3], [LAYOUT_3.finished, 1], [LAYOUT_3.session, 1], [LAYOUT_3["short video"], 1]]) {
      const { t, found } = episode(record);
      for (const options of [undefined, { clock: true }]) assert.equal(piecesOf(found, "main", t.ctx, [], null, options).pieces.length, kept, JSON.stringify([record.kind, options]));
      t.done();
    }
  });
  it("makes a finished video's ranges from a plan it is given, whole, as it does from the plan in the folder", () => {
    const { t, found } = episode(LAYOUT_3.finished);
    const plan = JSON.parse(readFileSync(join(found.folder, PLAN_FILE), "utf8"));
    const given = { ...plan, phrases: plan.phrases.slice(0, 3), ranges: [] };
    const read = piecesOf(found, "main", t.ctx, [], given);
    assert.deepEqual(read.pieces, [{ start: 0, end: 23.423 }]);
    assert.equal(read.plan, given);
    t.done();
  });
});

describe("the timeline of a Reel of a video that keeps all of it", () => {
  const notes = async ({ t, found }) => {
    const built = await timelineFor(found, { reel: 2 }, t.ctx);
    assert.ok(built.xml, built.why);
    return tags(built.xml, "marker").map((m) => m.value).filter((v) => v.startsWith("Taken out"));
  };
  it("has no note of what the import's plan took out between its stretches, since the video keeps all of it", async () => {
    const before = episode();
    const finished = episode(LAYOUT_3.finished);
    assert.ok((await notes(before)).length > 0, "a Reel of a raw video says what the plan took out between its stretches");
    assert.deepEqual(await notes(finished), []);
    before.t.done();
    finished.t.done();
  });
});

describe("newestOf", () => {
  const entry = (v, at, over = {}) => ({ v, at, on: "Mac Studio", file: `edit/x.v${v}.fcpxml`, ...over });
  it("is the entry of the highest number, and null for none or for what is not a list", () => {
    const [a, b, c] = [entry(1, "2026-10-20T10:00:00-05:00"), entry(3, "2026-10-20T09:00:00-05:00"), entry(2, "2026-10-20T11:00:00-05:00")];
    assert.equal(newestOf([a, b, c]), b);
    assert.equal(newestOf([c, a]), c);
    for (const none of [[], undefined, null, "v1", 3, {}, { length: 1, 0: a }]) assert.equal(newestOf(none), null, JSON.stringify(none));
  });
  it("takes, of two with one number, the first listed, whatever time each carries, as the highest number alone always did", () => {
    const early = entry(2, "2026-10-20T10:00:00-05:00", { on: "Mac Studio" });
    const late = entry(2, "2026-10-20T11:30:00-05:00", { on: "Sallie's laptop" });
    assert.equal(newestOf([early, late]), early);
    assert.equal(newestOf([late, early]), late);
    assert.equal(newestOf([entry(1, AT), early, late]), early);
    const three = entry(3, "2026-10-19T10:00:00-05:00");
    assert.equal(newestOf([late, three, early]), three);
    assert.equal(newestOf([late, entry(1, AT), early]), late);
  });
});

describe("newestIsRender", () => {
  const record = (main, reels = []) => ({ main: { pushed: main }, reels: reels.map(([n, pushed]) => ({ n, pushed })) });
  const rendered = { v: 2, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v2.fcpxml", opened: AT };
  const pushed = { v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.fcpxml" };
  it("is true only when the newest version listed, on either Mac, was rendered", () => {
    assert.equal(newestIsRender(record([pushed, rendered]), "main"), true);
    assert.equal(newestIsRender(record([rendered, pushed]), "main"), true);
    assert.equal(newestIsRender(record([{ ...rendered, on: "Sallie's laptop" }]), "main"), true);
    assert.equal(newestIsRender(record([{ ...rendered, opened: undefined }]), "main"), true);
  });
  it("is false for a push, for an entry with no how, and for none", () => {
    assert.equal(newestIsRender(record([rendered, { ...pushed, v: 3 }]), "main"), false);
    assert.equal(newestIsRender(record([rendered, { ...pushed, v: 3, how: "push" }]), "main"), false);
    assert.equal(newestIsRender(record([]), "main"), false);
    assert.equal(newestIsRender({ main: {}, reels: [] }, "main"), false);
  });
  it("is read for a Reel by its own list, and is false for a Reel the record does not have", () => {
    const r = record([rendered], [[1, [pushed]], [2, [rendered]]]);
    assert.deepEqual([{ reel: 1 }, { reel: 2 }, { reel: 3 }].map((part) => newestIsRender(r, part)), [false, true, false]);
  });
});

describe("reels, the list of a raw video's suggestions, through the command", () => {
  /** The made-up episode with its Reels as a reading suggests them (reels.json version 2): no crop, no preview, no title, and the
      words each opens and closes with. */
  const suggested = () => {
    const list = JSON.parse(EPISODE.files["reels.json"]);
    const candidates = list.candidates.map((c) => ({ ...c, ranges: c.ranges.map(({ start, end }) => ({ start, end })), title: "", preview: null, point: "A point.", first: "Welcome to the show", last: "talk about pricing" }));
    return { ...EPISODE, files: { ...EPISODE.files, "reels.json": JSON.stringify({ ...list, version: 2, by: "read", candidates }, null, 2) + "\n" } };
  };
  const rough = { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml", opened: AT };
  const raw = (pushed) => ({ ...LAYOUT_3.raw, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed, base: null } });
  it("gives each suggestion's times on the rough cut she is watching, not the raw video's", async () => {
    const { t } = episode(raw([rough]), {}, suggested());
    const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
    assert.equal(r.code, 0, r.text);
    // The rough cut leaves out what comes before 0:05.9 and the retakes and the pauses between its pieces: the first suggestion, at
    // 0:05 to 0:09 of the raw video, is at 0:00 to 0:03 of it, and the second, at 0:13 to 0:21, is at 0:04 to 0:08.
    assert.equal(r.text, [
      "Reel suggestions of Pricing: what to charge?: 2, with times on main v0.",
      "",
      "1. 0:00 to 0:03, 4 seconds. A candidate.",
      "   Opens with: Welcome to the show.",
      "   Closes with: talk about pricing.",
      "   Why: It says what the talk is about.",
      "   It does not fit a Reel. It is 3.971 seconds long, and a Reel clip is at least 15 seconds.",
      "",
      "2. 0:04 to 0:08, 5 seconds. Picked.",
      "   Opens with: So the first thing",
      "   Closes with: so much, Sallie.",
      "   Why: It makes one point and stands alone.",
      "   It does not fit a Reel. It is 5.204 seconds long, and a Reel clip is at least 15 seconds.",
      "",
      // brimm-video makes no Reel from a suggestion yet (phase V): where she makes them for now (Sallie's walkthrough, 25 Oct).
      'brimm-video cannot make Reels from this video yet: for now, cut them in OpusClip. BRIMM Ops writes their post text: on the episode\'s Reels card, press "New short video from a clip".'
    ].join("\n"));
    t.done();
  });
  it("gives the recording's own times while the rough cut's file is not whole on this Mac, and starts no bringing", async () => {
    const { t } = episode(raw([rough]), {}, suggested());
    t.ctx.deps.isWhole = (path) => !path.endsWith("main.v0.fcpxml");
    const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^Reel suggestions of Pricing: what to charge\?: 2, with times on the recording's own clock\.\n\n1\. 0:05 to 0:09, 4 seconds\. A candidate\.\n/);
    assert.match(r.text, /\n2\. 0:13 to 0:21, 5 seconds\. Picked\.\n/);
    assert.deepEqual(t.started, []);
    t.done();
  });
  it("gives the times on the main video as it is now for a raw video no version of which has been shown yet", async () => {
    const { t } = episode(raw([]), {}, suggested());
    const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
    assert.match(r.text, /^Reel suggestions of Pricing: what to charge\?: 2, with times on the main video as it is now\.\n\n1\. 0:00 to 0:03, 4 seconds\. A candidate\.\n/);
    t.done();
  });
  it("gives a finished video's times on the video's own clock", async () => {
    const { t } = episode({ ...LAYOUT_3.finished }, {}, suggested());
    const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^Reel suggestions of Pricing: what to charge\?: 2, with times on the video\.\n\n1\. 0:06 to 0:09, 4 seconds\. A candidate\.\n/);
    // Reel 2 is two stretches, 13.38 to 16.516 and 19.219 to 21.287, 5.204 seconds; the video keeps what lies between them too.
    assert.match(r.text, /\n2\. 0:13 to 0:20, 5 seconds\. Picked\.\n/);
    t.done();
  });
  it("gives the recording's own times when the rough cut's file holds no timeline, or cannot be opened, and does not call every suggestion cut", async () => {
    for (const spoil of [(file) => writeFileSync(file, "not a timeline"), (file) => { rmSync(file); mkdirSync(file); }]) {
      const { t, found } = episode(raw([rough]), {}, suggested());
      spoil(join(found.folder, "edit", "main.v0.fcpxml"));
      const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /^Reel suggestions of Pricing: what to charge\?: 2, with times on the recording's own clock\.\n\n1\. 0:05 to 0:09, 4 seconds\. A candidate\.\n/);
      assert.ok(!r.text.includes("Cut now"), r.text);
      t.done();
    }
  });
  it("lists a video from before the switch as it always did, though it holds a version with a `how`", async () => {
    const main = { preset: null, cuts: [], texts: [], graphics: [], logo: false, base: null, pushed: [push(1, "2026-10-20T10:00:00-05:00"), render(2, "2026-10-20T11:00:00-05:00")] };
    const { t, found } = episode({ main }, {}, EPISODE);
    assert.equal(layoutOf(found.record), 3);
    const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
    assert.match(r.text, /^Reel candidates of Pricing talk\.mp4: 2\.\n\n1\. 0:05 to 0:09, 4 seconds\. A candidate\.\n/);
    t.done();
  });
  it("lists a video from before the switch as it always did", async () => {
    const { t } = episode({}, {}, EPISODE);
    const r = await on(t.ctx.deps, "reels", "Pricing", "--no-play");
    assert.match(r.text, /^Reel candidates of Pricing talk\.mp4: 2\.\n\n1\. 0:05 to 0:09, 4 seconds\. A candidate\.\n/);
    assert.match(r.text, /\n   Preview: previews\/reel-2\.mp4\n/);
    t.done();
  });
});

describe("edit.js on the one version model: a render is a version, and only a push was in Final Cut", () => {
  const STUDIO = "Mac Studio";
  const LAPTOP = "Sallie's laptop";
  const V0 = EPISODE.files["edit/main.v0.fcpxml"];
  /** A raw video she has answered, this Mac holding it, its main video's versions as listed, each one's stored file laid in edit/
      as the rough cut's own timeline is. */
  const answeredRaw = (pushed) => {
    const made = episode({ ...LAYOUT_3.raw, editing: { by: STUDIO, since: AT }, main: { preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed, base: null } });
    for (const p of pushed) if (!existsSync(join(made.found.folder, p.file))) writeFileSync(join(made.found.folder, p.file), V0);
    return made;
  };
  const renderOn = (v, on = STUDIO) => ({ v, how: "render", at: AT, on, file: v ? `edit/main.v${v}.fcpxml` : "edit/main.v0.fcpxml", opened: AT });
  const pushOn = (v, on = STUDIO) => ({ v, at: AT, on, file: `edit/main.v${v}.${on === STUDIO ? "mac-studio" : "sallie-s-laptop"}.fcpxml`, project: `p${v}` });
  const ELSEWHERE = (v, on) => `The other Mac has a newer version (v${v}, on ${on}): say "render it here" to see it.`;

  it("pushes without asking about Final Cut when the newest version was rendered", async () => {
    const { t, found } = answeredRaw([pushOn(1), renderOn(2)]);
    const r = await on(t.ctx.deps, "push", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^Shown in Final Cut as "Pricing- what to charge- main v3 3fa9c1"/);
    const entry = reread(found).main.pushed.find((p) => p.v === 3);
    assert.ok(entry && !("how" in entry) && !("answer" in entry), JSON.stringify(entry));
    t.done();
  });
  it("still asks when the newest version was pushed, or when this Mac handed Final Cut a newer one than the record lists", async () => {
    const { t } = answeredRaw([renderOn(1), pushOn(2)]);
    const r = await on(t.ctx.deps, "push", FOLDER);
    assert.deepEqual([r.code, r.text], [1, 'Did you change v2 of Pricing: what to charge? in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.']);
    t.done();
    const other = answeredRaw([renderOn(2)]);
    mkdirSync(pushedFolder(other.t.home, FOLDER), { recursive: true });
    writeFileSync(join(pushedFolder(other.t.home, FOLDER), "main.v3.mac-studio.fcpxml"), V0);
    const asked = await on(other.t.ctx.deps, "push", FOLDER);
    assert.deepEqual([asked.code, asked.text], [1, 'Did you change v3 of Pricing: what to charge? in Final Cut since it was shown? Say "no changes" to show it again. If you did change it, say so.']);
    other.t.done();
  });
  it("reads a time on a rendered newest version without asking about Final Cut", async () => {
    const { t, found } = answeredRaw([pushOn(1), renderOn(2)]);
    const r = await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:03", "--line", "Sallie Ogden");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /on main v2 at 0:03/);
    assert.equal(reread(found).main.texts.length, 1);
    t.done();
  });
  it("says when the other Mac has a newer version rendered there, and offers to render it here", async () => {
    const { t } = answeredRaw([renderOn(0), renderOn(1, LAPTOP)]);
    const r = await on(t.ctx.deps, "text", FOLDER, "add", "lower-third", "--at", "0:03", "--line", "Sallie Ogden");
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text.split("\n")[0], ELSEWHERE(1, LAPTOP));
    const reels = await on(t.ctx.deps, "reels", FOLDER, "--no-play");
    assert.ok(reels.text.split("\n").includes(ELSEWHERE(1, LAPTOP)), reels.text);
    t.done();
  });
  it("hands Final Cut a version's own stored timeline with push v<n>, not the timeline as the record makes it now", async () => {
    const { t, found } = answeredRaw([pushOn(1)]);
    const stored = V0.replace("<spine>", "<spine><!-- as v1 was stored -->");
    writeFileSync(join(found.folder, pushOn(1).file), stored);
    // Since v1, a cut was asked for: a plain push would show it.
    writeFileSync(recordFile(found.folder, 2), recordText({ ...reread(found), rev: 2, files: { ...reread(found).files, [pushOn(1).file]: Buffer.byteLength(stored) }, main: { ...reread(found).main, cuts: [{ id: "c1", keep: false, from: 13.38, to: 16.3 }] } }));
    const r = await on(t.ctx.deps, "push", FOLDER, "v1", "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^Shown in Final Cut as "Pricing- what to charge- main v2 3fa9c1"/);
    assert.ok(r.text.includes("It is v1 as it was stored, shown again as a new version."), r.text);
    const handed = readFileSync(join(pushedFolder(t.home, FOLDER), "main.v2.mac-studio.fcpxml"), "utf8");
    assert.ok(handed.includes("<!-- as v1 was stored -->"), handed.slice(0, 400));
    assert.equal(tags(handed, "project")[0].name, "Pricing- what to charge- main v2 3fa9c1");
    const entry = reread(found).main.pushed.find((p) => p.v === 2);
    assert.equal(readFileSync(join(found.folder, entry.file), "utf8").includes("<!-- as v1 was stored -->"), true);
    t.done();
  });
  it("hands Final Cut a rendered version's timeline too, and refuses a version the part does not have", async () => {
    const { t, found } = answeredRaw([renderOn(0)]);
    const r = await on(t.ctx.deps, "push", FOLDER, "v0");
    assert.equal(r.code, 0, r.text);
    assert.equal(reread(found).main.pushed.map((p) => p.v).join(), "0,1");
    const none = await on(t.ctx.deps, "push", FOLDER, "v7", "--no-hand-edits");
    assert.deepEqual([none.code, none.text], [1, "There is no v7 of the main video."]);
    t.done();
  });
  it("hands Final Cut a Reel's stored version too, with push … reel <n> v<k>", async () => {
    const { t, found } = episode();
    assert.equal((await on(t.ctx.deps, "push", FOLDER, "reel", "2")).code, 0);
    const first = reread(found).reels.find((r) => r.n === 2).pushed[0];
    const marked = readFileSync(join(found.folder, first.file), "utf8").replace("<spine>", "<spine><!-- reel 2 as v1 was stored -->");
    writeFileSync(join(found.folder, first.file), marked);
    const now = reread(found);
    writeFileSync(recordFile(found.folder, now.rev + 1), recordText({ ...now, rev: now.rev + 1, files: { ...now.files, [first.file]: Buffer.byteLength(marked) } }));
    const r = await on(t.ctx.deps, "push", FOLDER, "reel", "2", "v1", "--no-hand-edits");
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /^Shown in Final Cut as "Pricing- what to charge- reel 2 v2 3fa9c1"/);
    const handed = readFileSync(join(pushedFolder(t.home, FOLDER), readdirSync(pushedFolder(t.home, FOLDER)).find((n) => n.startsWith("reel-2.v2"))), "utf8");
    assert.ok(handed.includes("<!-- reel 2 as v1 was stored -->"));
    assert.deepEqual((await on(t.ctx.deps, "push", FOLDER, "reel", "2", "v9", "--no-hand-edits")).text, "There is no v9 of Reel 2.");
    t.done();
  });
  it("writes no `how` on a push: a record from before the switch stays at its layout", async () => {
    const { t, found } = episode();
    const before = layoutOf(found.record);
    assert.ok(before < 3);
    const r = await on(t.ctx.deps, "push", FOLDER);
    assert.equal(r.code, 0, r.text);
    const record = reread(found);
    assert.deepEqual([record.version, record.main.pushed.some((p) => "how" in p)], [layoutOf(record), false]);
    assert.ok(record.version < 3, String(record.version));
    t.done();
  });
  it("hands an episode over asking nothing about Final Cut for a part whose newest version was rendered", async () => {
    const { t } = answeredRaw([pushOn(1), renderOn(2)]);
    const r = await on(t.ctx.deps, "release", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.equal(r.text, "Pricing: what to charge? is handed over. Copied for the other Mac: nothing. Keep this Mac open and online until Dropbox shows the folder is up to date.");
    t.done();
    const pushed = answeredRaw([renderOn(1), pushOn(2)]);
    const asked = await on(pushed.t.ctx.deps, "release", FOLDER);
    assert.deepEqual([asked.code, asked.text], [1, 'Did you change anything in Final Cut since it was last shown (main v2)? Say "no changes" to hand it over, or "hand it over anyway" if your changes should stay on this Mac.']);
    pushed.t.done();
  });
  it("says in the episodes and open lines whether the newest version was rendered or shown in Final Cut", async () => {
    for (const [pushed, line] of [[[renderOn(0)], "Shown: v0 (rendered), on Mac Studio"], [[renderOn(0), pushOn(1)], "Shown: v1 (in Final Cut), on Mac Studio"], [[pushOn(2), renderOn(1, LAPTOP)], "Shown: v2 (in Final Cut), on Mac Studio"]]) {
      const { t } = answeredRaw(pushed);
      const listed = await on(t.ctx.deps, "episodes");
      assert.ok(listed.text.split("\n").includes(`    ${line}`), listed.text);
      const opened = await on(t.ctx.deps, "open", FOLDER);
      assert.ok(opened.text.split("\n").includes(`${line}.`), opened.text);
      t.done();
    }
  });
  it("opens no preview for a video she has answered, and says nothing of asking Claude again", async () => {
    const { t } = episode({ ...LAYOUT_3.raw }, {}, EPISODE);
    const r = await on(t.ctx.deps, "reels", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual([t.opened, t.started], [[], []]);
    assert.ok(!/ask Claude again/i.test(r.text), r.text);
    t.done();
  });
});
