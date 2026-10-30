// `show "<episode>" transcript` for a raw video with a main HyperFrames project in use: the recording's captions at their times on the
// project's timeline (Jason's by-hand check of 30 October: his episode fbb80c had the recording 3 seconds in, behind a title card, and
// `show transcript` printed the words at the recording's own times, 3 seconds early). The made-up episode and project are as
// edit-show.test.js makes them; the project's index.html is made up in the shape the app writes it. A page, a recording or captions that
// cannot be read print what `show` printed before.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SHOWN_MARKER, editMain } from "../edit.js";
import { episodeWork } from "../settings.js";
import { setup, episodeFor, FOLDER } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, text }, with what it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, text: said.join("\n") };
}

const AT = "2026-10-20T15:00:00-05:00";
const ANSWERED = { state: "answered", guess: null, seen: "", came: "camera", by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
const PROJECT = (over = {}) => ({ key: "main", name: "Pricing talk main 3fa9c1", madeAt: AT, on: "Mac Studio", from: { file: "Pricing talk.mp4", bytes: 13, modified: AT }, workingCopy: { bytes: 16, seconds: 23.4, fps: 30 }, opened: [AT], handover: false, fromSuggestion: null, state: "opened", ...over });
/** The recording's own transcript, as the import wrote it beside the recording's captions, and the captions the lines come from. */
const OWN = "[0:00] Welcome to the show.\n[0:05] So the first thing you need to do is know your costs.\n[0:12] Thank you so much, Sallie.\n";
const SRT = "1\n00:00:00,000 --> 00:00:04,000\n Welcome to the show.\n\n2\n00:00:05,000 --> 00:00:09,000\n So the first thing you need to do is know your costs.\n\n3\n00:00:12,000 --> 00:00:15,000\n Thank you so much, Sallie.\n\n";
const ROUGH = "[0:00] Welcome to the show.\n";
/** The text `show` prints for a file: without its last new line. */
const printed = (text) => text.replace(/\n$/, "");

/** An index.html whose main composition holds `inner`, as the app writes the page. */
const page = (inner) => `<!doctype html><html><body><div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="1920" data-height="1080">${inner}</div></body></html>`;
const recording = (attrs, tag = "video") => `<${tag} data-hf-id="hf-huzn" id="a-roll" class="clip" src="media/recording.mp4" playsinline ${attrs} data-track-index="0"></${tag}>`;
const TITLE = '<div data-hf-id="hf-unau" id="title" data-composition-id="title" data-composition-src="compositions/title.html" data-start="0" data-duration="3" data-track-index="1"></div>';

/** A raw video she has answered, with the main project `project` (none when null) in its record, the recording's own transcript and
    captions beside the video (`srt` null for no captions), and the project's folder on this Mac holding `index` as its index.html
    (none when null, and no folder at all for `folder: false`). */
function world({ index = null, srt = SRT, project = PROJECT(), folder = true, record = {} } = {}) {
  const t = setup();
  const found = episodeFor(t, { record: { version: 4, kind: "raw", answer: ANSWERED, name: { text: "Pricing talk", placeholder: false }, ...(project ? { app: { toolchain: "0.8.208", projects: [project] } } : {}), ...record } });
  writeFileSync(join(found.folder, "Pricing talk.transcript.txt"), OWN);
  writeFileSync(join(found.folder, "Pricing talk.rough-cut.transcript.txt"), ROUGH);
  if (srt !== null) writeFileSync(join(found.folder, "Pricing talk.srt"), srt);
  const dir = join(episodeWork(t.home, FOLDER), (project ?? PROJECT()).name);
  if (folder) {
    mkdirSync(dir, { recursive: true });
    if (index !== null) writeFileSync(join(dir, "index.html"), index);
  }
  return { t, found, dir };
}
/** `show transcript` of a world, and the world done with. */
async function shown(made, deps = {}) {
  const r = await on({ ...made.t.ctx.deps, ...deps }, "show", FOLDER, "transcript");
  return { ...r, t: made.t };
}

describe("show transcript, with a main HyperFrames project in use: the recording's captions on the project's timeline", () => {
  it("shifts every line by the 3 seconds the app's agent moved the recording for a title card", async () => {
    const w = world({ index: page(TITLE + recording('data-start="3" data-duration="23.423"')) });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [0, "[0:03] Welcome to the show.\n[0:08] So the first thing you need to do is know your costs.\n[0:15] Thank you so much, Sallie."]);
    w.t.done();
  });
  it("prints the recording's own times when it is still where Studio put it, at 0", async () => {
    const w = world({ index: page(recording('data-start="0" data-duration="23.423"')) });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [0, printed(OWN)]);
    w.t.done();
  });
  it("maps a recording the app has split piece by piece, and leaves out the stretch that was cut", async () => {
    // The first 6 seconds of the recording, then its seconds 12 to 22 from the 6th second on: the words at 7 to 9 s were cut.
    const w = world({ index: page(recording('data-start="0" data-duration="6"') + recording('data-start="6" data-duration="10" data-playback-start="12"')) });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [0, "[0:00] Welcome to the show.\n[0:05] So the first thing you need to do is know your costs.\n[0:06] Thank you so much, Sallie."]);
    w.t.done();
  });
  it("leaves out words that are in a stretch of the recording no piece shows, and puts the pieces' words in timeline order", async () => {
    // Her three captions, with the last piece first on the timeline and the middle caption cut.
    const w = world({ index: page(recording('data-start="20" data-duration="4"') + recording('data-start="0" data-duration="10" data-playback-start="12"')) });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [0, "[0:00] Thank you so much, Sallie.\n[0:20] Welcome to the show."]);
    w.t.done();
  });
  it("takes the in-point from data-playback-start before data-media-start", async () => {
    const both = world({ index: page(recording('data-start="2" data-duration="10" data-playback-start="12" data-media-start="0"')) });
    assert.deepEqual([(await shown(both)).text], ["[0:02] Thank you so much, Sallie."]);
    both.t.done();
    const alone = world({ index: page(recording('data-start="2" data-duration="10" data-media-start="12"')) });
    assert.deepEqual([(await shown(alone)).text], ["[0:02] Thank you so much, Sallie."]);
    alone.t.done();
  });
  it("takes the playback rate into account", async () => {
    const w = world({ index: page(recording('data-start="1" data-duration="5" data-playback-rate="2"')) });
    // 5 seconds at twice the speed show the recording's first 10: the third caption is past them.
    assert.deepEqual([(await shown(w)).text], ["[0:01] Welcome to the show.\n[0:03] So the first thing you need to do is know your costs."]);
    w.t.done();
  });
  it("reads an audio element of the recording as well", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"', "audio")) });
    assert.equal((await shown(w)).text.split("\n")[0], "[0:03] Welcome to the show.");
    w.t.done();
  });
  it("reads the project's index.html on the Mac it is run on, for a project another Mac made and this Mac has", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), project: PROJECT({ on: "Sallie's laptop" }) });
    assert.equal((await shown(w)).text.split("\n")[0], "[0:03] Welcome to the show.");
    w.t.done();
  });
  it("reads a project whose state is made or finished as well as opened", async () => {
    for (const project of [PROJECT({ state: "made", opened: [] }), PROJECT({ state: "finished" })]) {
      const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), project });
      assert.equal((await shown(w)).text.split("\n")[0], "[0:03] Welcome to the show.", project.state);
      w.t.done();
    }
  });

  describe("prints what it printed before when the placement cannot be read", () => {
    const cases = [
      ["index.html holds no recording element", { index: page(TITLE) }],
      ["index.html holds nothing", { index: "" }],
      ["index.html is not a page", { index: "this is not html" }],
      ["there is no index.html in the project's folder", { index: null }],
      ["the project's folder is not on this Mac", { folder: false }],
      ["the recording is on a timeline of its own, in a composition inside the main one", { index: page(`<div id="inner" data-composition-id="inner" data-start="20" data-duration="10">${recording('data-start="1" data-duration="9"')}</div>`) }],
      ["the recording has no duration", { index: page(recording('data-start="3"')) }],
      ["the recording has a duration of 0", { index: page(recording('data-start="3" data-duration="0"')) }],
      ["the recording starts after another clip, by a name, not a number", { index: page(recording('data-start="title" data-duration="23.423"')) }],
      ["another file is on the timeline, and not the recording", { index: page('<video src="media/broll.mp4" data-start="3" data-duration="9"></video>') }],
      ["there are no captions of the recording", { index: page(recording('data-start="3" data-duration="23.423"')), srt: null }],
      // A caption file that holds no captions says nothing of the timeline: it is not that no caption is on it.
      ["the captions file is empty", { index: page(recording('data-start="3" data-duration="30"')), srt: "" }],
      ["the captions file is not captions", { index: page(recording('data-start="3" data-duration="30"')), srt: "this is not a caption file\n" }],
      ["the captions file has no caption in the shape of one", { index: page(recording('data-start="3" data-duration="30"')), srt: "1\nsoon --> later\nWords\n\n" }],
      // Where the rest of the recording is, is not known when one of its elements cannot be read: only the first would be told.
      ["one element of the recording starts by another clip's name, beside one that can be read", { index: page(recording('data-start="0" data-duration="4.5"') + recording('data-start="title" data-duration="10" data-media-start="4.5"')) }],
      ["the recording is also in a composition inside the main one, beside one that can be read", { index: page(recording('data-start="3" data-duration="30"') + `<div id="inner" data-composition-id="inner" data-start="20" data-duration="10">${recording('data-start="1" data-duration="9"')}</div>`) }]
    ];
    for (const [what, made] of cases) {
      it(`when ${what}`, async () => {
        const w = world(made);
        const r = await shown(w);
        assert.deepEqual([r.code, r.text], [0, printed(OWN)]);
        w.t.done();
      });
    }
    it("when index.html is a link, which is not read", async () => {
      const w = world({ index: null });
      writeFileSync(join(w.dir, "real.html"), page(recording('data-start="3" data-duration="23.423"')));
      symlinkSync(join(w.dir, "real.html"), join(w.dir, "index.html"));
      const r = await shown(w);
      assert.deepEqual([r.code, r.text], [0, printed(OWN)]);
      w.t.done();
    });
    it("when index.html is larger than 2 MB, which is not read", async () => {
      const w = world({ index: page(recording('data-start="3" data-duration="23.423"')) + " ".repeat(2 * 1024 * 1024) });
      const r = await shown(w);
      assert.deepEqual([r.code, r.text], [0, printed(OWN)]);
      w.t.done();
    });
    it("when the captions cannot be read", async () => {
      const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), srt: null });
      mkdirSync(join(w.found.folder, "Pricing talk.srt"));
      const r = await shown(w);
      assert.deepEqual([r.code, r.text], [0, printed(OWN)]);
      w.t.done();
    });
    it("and asks for nothing and writes nothing", async () => {
      const w = world({ index: page(TITLE) });
      await shown(w);
      assert.deepEqual(w.t.started, []);
      assert.deepEqual([readFileSync(join(w.found.folder, "Pricing talk.srt"), "utf8"), readFileSync(join(w.found.folder, "Pricing talk.transcript.txt"), "utf8")], [SRT, OWN]);
      w.t.done();
    });
  });

  it("says so, and prints nothing of the recording's own times, when none of its words is on the timeline", async () => {
    const w = world({ index: page(recording('data-start="0" data-duration="2" data-playback-start="100"')) });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [1, "Pricing talk has no spoken words on its timeline."]);
    w.t.done();
  });
  it("has Dropbox bring the captions over when they are not whole on this Mac yet, and says so", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')) });
    const r = await shown(w, { isWhole: (path) => !path.endsWith(".srt") });
    assert.deepEqual([r.code, r.text], [1, "Dropbox is still bringing it over; say it again when it is done."]);
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "Pricing talk.srt"]]);
    w.t.done();
  });
  it("asks for the captions only when the transcript text is whole, and for the text first when it is not", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')) });
    const r = await shown(w, { isWhole: (path) => !path.endsWith(".txt") });
    assert.deepEqual([r.code, r.text], [1, "Dropbox is still bringing it over; say it again when it is done."]);
    assert.deepEqual(w.t.started.map(([, args]) => args.slice(1)), [["bring", "--now", FOLDER, "Pricing talk.transcript.txt"]]);
    w.t.done();
  });
  it("does not ask for the captions when the recording is not placed on the timeline, so that a page that cannot be read costs nothing", async () => {
    const w = world({ index: page(TITLE) });
    const r = await shown(w, { isWhole: (path) => !path.endsWith(".srt") });
    assert.deepEqual([r.code, r.text, w.t.started], [0, printed(OWN), []]);
    w.t.done();
  });
  it("still says there is no transcript yet when the text is not there, whatever the captions say", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')) });
    writeFileSync(join(w.found.folder, "Pricing talk.srt"), SRT);
    rmSync(join(w.found.folder, "Pricing talk.transcript.txt"));
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [1, "Pricing talk has no transcript yet."]);
    w.t.done();
  });
  it("leaves Claude's notes and the cut plan as they were", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')) });
    writeFileSync(join(w.found.folder, "Pricing talk.cut-plan.txt"), "Cut plan for Pricing talk.mp4\n\nKeeps 0:11 of 0:23.\n");
    const r = await on(w.t.ctx.deps, "show", FOLDER, "plan");
    assert.deepEqual([r.code, r.text], [0, "Cut plan for Pricing talk.mp4\n\nKeeps 0:11 of 0:23."]);
    w.t.done();
  });
});

describe("show transcript, where the project's timeline is not read", () => {
  it("prints the rough cut's transcript for a raw video with no project in use, whatever its folder holds", async () => {
    for (const projects of [null, [], [PROJECT({ state: "kept for an earlier kind" })], [PROJECT({ key: "reel 2", name: "Pricing talk reel 2 3fa9c1" })]]) {
      const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), project: null, record: projects ? { app: { toolchain: "0.8.208", projects } } : {} });
      const r = await shown(w);
      assert.deepEqual([r.code, r.text], [0, printed(ROUGH)], JSON.stringify(projects));
      w.t.done();
    }
  });
  it("reads an iPhone clip's project as a raw video's: the app's agent moves its recording as well", async () => {
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), record: { kind: "short video" } });
    assert.equal((await shown(w)).text.split("\n")[0], "[0:03] Welcome to the show.");
    w.t.done();
  });
  it("opens a read-only copy of the transcript in TextEdit for a session, and prints only that it did, whatever the project's timeline", async () => {
    const SESSION = { version: 4, kind: "session", answer: { ...ANSWERED, private: "yes" }, label: "Video of 14 Oct, 09:12 (Mac Studio)", name: { text: "Session, 2026-10-14", placeholder: false }, session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } };
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), record: SESSION });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [0, "Opened Session, 2026-10-14's transcript in TextEdit on this Mac."]);
    const dir = join(episodeWork(w.t.home, FOLDER), "shown");
    const [copy] = readdirSync(dir).filter((n) => n !== SHOWN_MARKER);
    assert.equal(readFileSync(join(dir, copy), "utf8"), OWN);
    w.t.done();
  });
  it("opens a copy for a video not yet answered, and prints nothing of it", async () => {
    const UNANSWERED = { version: 4, kind: null, answer: { state: "needs your answer", guess: "raw", seen: "wide, 0:23", came: "camera", match: null }, label: "Video of 14 Oct, 09:12 (Mac Studio)" };
    const w = world({ index: page(recording('data-start="3" data-duration="23.423"')), record: UNANSWERED });
    const r = await shown(w);
    assert.deepEqual([r.code, r.text], [0, "Opened Video of 14 Oct, 09:12 (Mac Studio)'s transcript in TextEdit on this Mac."]);
    w.t.done();
  });
});
