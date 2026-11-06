// The previews of a Reel's candidates (what ffmpeg is asked for) and the Reel's Final Cut project. None of it needs a video, and no program is run.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf, pausesOf, phrasesOf, cutPlan, keptSpans, framesASecond } from "../cuts.js";
import { stretchesOf } from "../reframe.js";
import { readNotes, applyDecisions, clipRanges } from "../notes.js";
import { TOLD, PAUSES } from "./fixtures.js";
import { PREVIEW, previewSteps, previewLimits, reelProject, REEL_FRAME } from "../reels.js";
import { reelCandidates } from "../reel-candidates.js";
import { fcpxml, checkFcpxml } from "../fcpxml.js";

/** A crop of a 1920x1080 picture, 606 wide, that starts `x` pixels in. */
const crop = (x, found = true) => ({ x, y: 0, w: 606, h: 1080, found });

/** The made-up recording of fixtures.js, as the rules plan it, with Claude cutting "It is very, very important." (p8) and
    picking one clip, from p7 to p9. The clip is two stretches: 13.383 to 16.53, and 19.214 to 21.297. */
const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
const HEARD = pausesOf(PAUSES);
const RULES = cutPlan(phrasesOf(wordsOf(TOLD), HEARD), { duration: FACTS.duration, pauses: HEARD });
const READ = readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphicCues: [], clips: [{ from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }] }));
const PLAN = applyDecisions(RULES, READ.decisions, HEARD).plan;
const CLIPS = clipRanges(PLAN, READ.clips, HEARD).clips;
/** The face finder's stills of the made-up recording: eleven, each with one face whose middle is `centre` of the way across,
    or with none. */
const stillsWith = (centre) => Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: centre == null ? [] : [{ x: centre - 0.05, y: 0.2, w: 0.1, h: 0.2 }] }));

describe("the preview of a Reel candidate", () => {
  const HD = { width: 1920, height: 1080 };
  /** The steps of a preview, in the run's folder /w, of a 1920x1080 video unless another size is given. */
  const steps = (o) => previewSteps({ video: "/in/a.mp4", out: "/w/reel-1.mp4", work: "/w", size: HD, duration: 3600, ...o });
  const graph = (args) => args[args.indexOf("-filter_complex") + 1];
  /** Each input as [its seek time, how much is read, what is left out of it]. */
  const inputs = (args) => args.flatMap((a, i) => (a === "-i" ? [[args[i - 4], args[i - 2], args[i - 1]]] : []));
  /** Stretches of 2 s, 3 s apart, from 10 s. */
  const many = (n) => Array.from({ length: n }, (_, i) => ({ start: 10 + i * 3, end: 12 + i * 3, crop: crop(438) }));

  it("is 540 by 960, each part made of its stretches alone, by seeking, at veryfast and quality 30, with its sound kept whole", () => {
    const ranges = [{ start: 312.4, end: 330.1, crop: crop(438) }, { start: 333.3, end: 354.5, crop: crop(500, false) }];
    const made = steps({ ranges, fps: "30" });
    assert.deepEqual(PREVIEW, { width: 540, height: 960 });
    assert.deepEqual(made.parts, [{
      file: "/w/reel-1.part-1.mov", seconds: 38.9,
      args: [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", "312.4", "-t", "17.767", "-an", "-i", "/in/a.mp4",
        "-ss", "312.4", "-t", "17.767", "-vn", "-i", "/in/a.mp4",
        "-ss", "333.3", "-t", "21.267", "-an", "-i", "/in/a.mp4",
        "-ss", "333.3", "-t", "21.267", "-vn", "-i", "/in/a.mp4",
        "-filter_complex", [
          "[0:v]fps=30:start_time=0,trim=end_frame=531,crop=606:1080:438:0,scale=540:960,setsar=1[v0]",
          "[1:a]aresample=async=1:first_pts=0,atrim=end=17.7[a0]",
          "[2:v]fps=30:start_time=0,trim=end_frame=636,crop=606:1080:500:0,scale=540:960,setsar=1[v1]",
          "[3:a]aresample=async=1:first_pts=0,atrim=end=21.2[a1]",
          "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][c]",
          "[c]aformat=channel_layouts=mono[m]",
          "anullsrc=r=48000:cl=mono,atrim=end=38.9[s]",
          "[s][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]"
        ].join(";"),
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-ar", "48000",
        "-f", "mov", "/w/reel-1.part-1.mov"
      ]
    }]);
  });
  it("is joined in one last pass: the parts listed, the picture copied, the sound written once, so the joins have no gap", () => {
    const made = steps({ ranges: many(10), fps: "30" });
    assert.deepEqual(made.list, { file: "/w/reel-1.parts.txt", text: "file 'reel-1.part-1.mov'\nfile 'reel-1.part-2.mov'\n" });
    assert.deepEqual(made.join, {
      seconds: 20,
      args: ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "/w/reel-1.parts.txt", "-map", "0:v", "-map", "0:a", "-c:v", "copy", "-af", "aresample=async=1:first_pts=0", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", "-f", "mp4", "/w/reel-1.mp4"]
    });
  });
  it("makes each part's sound exactly as long as its picture, silence where the recording has none, so no later part plays early", () => {
    // Inside a part, the join of its stretches puts silence after every stretch's sound but the last one's. A part whose sound
    // ended a little before its picture, under 0.1 s, made every later part's sound play early by as much, and a part with no
    // sound at all wrote no sound, so a preview whose first part had none could not be joined. Mixed with silence exactly as
    // long as the part, its sound is always there and always that long. Both are one channel, the recording's set to one by
    // ffmpeg as it would be anywhere: mixed with silence of two, a recording of one channel came out 3 dB quieter.
    const made = steps({ ranges: many(10), fps: "30" });
    for (const part of made.parts) {
      assert.match(graph(part.args), new RegExp(`concat=n=\\d+:v=1:a=1\\[v\\]\\[c\\];\\[c\\]aformat=channel_layouts=mono\\[m\\];anullsrc=r=48000:cl=mono,atrim=end=${part.seconds}\\[s\\];\\[s\\]\\[m\\]amix=inputs=2:duration=first:dropout_transition=0:normalize=0\\[a\\]$`));
    }
    assert.deepEqual(made.parts.map((part) => part.seconds), [16, 4]);
  });
  it("names its parts and their list after the preview, so two previews in one folder never share them, and says what to clear away", () => {
    const made = previewSteps({ video: "/in/a.mp4", out: "/w/reel-3.mp4", work: "/w", size: HD, duration: 3600, fps: "30", ranges: many(10) });
    assert.deepEqual(made.parts.map((part) => part.file), ["/w/reel-3.part-1.mov", "/w/reel-3.part-2.mov"]);
    assert.deepEqual(made.cleanup, ["/w/reel-3.parts.txt", "/w/reel-3.part-1.mov", "/w/reel-3.part-2.mov"]);
  });
  it("lists its parts by their names alone, beside the list, so a folder given by a relative path still joins", () => {
    // ffmpeg reads the names in its list relative to the list's own folder.
    const made = previewSteps({ video: "a.mp4", out: "work/reel-1.mp4", work: "work", size: HD, duration: 3600, fps: "30", ranges: many(10) });
    assert.deepEqual(made.list, { file: "work/reel-1.parts.txt", text: "file 'reel-1.part-1.mov'\nfile 'reel-1.part-2.mov'\n" });
  });
  it("is made in parts of at most 8 stretches, fewer for a larger picture, so its memory does not grow with the stretches", () => {
    // Read at once, every stretch's input is open and decoding together: measured on the Mac Studio at 1080 lines, about 310 MB
    // and 28 MB more for every stretch, so 60 stretches passed 2 GB, and at 3840x2160 about 17 did.
    const count = (size, n) => steps({ ranges: many(n), fps: "30", size }).parts.map((part) => inputs(part.args).length / 2);
    assert.deepEqual(count(HD, 60), [8, 8, 8, 8, 8, 8, 8, 4]);
    assert.deepEqual(count({ width: 640, height: 360 }, 9), [8, 1]);
    assert.deepEqual(count({ width: 3840, height: 2160 }, 5), [2, 2, 1]);
    assert.deepEqual(count({ width: 2560, height: 1440 }, 5), [4, 1]);
    assert.deepEqual(steps({ ranges: many(60), fps: "30" }).parts.map((part) => part.file).slice(0, 2), ["/w/reel-1.part-1.mov", "/w/reel-1.part-2.mov"]);
  });
  it("holds exactly the pictures of its stretches, counted on the picture's own clock, at every common rate", () => {
    // ffmpeg's -t counts from the first picture it keeps, so a stretch cut by -t alone can keep the picture the plan cuts after
    // it, with a silent hole in the sound there. The count is the trim's, on an even grid that starts at the seek time.
    for (const fps of ["25", "30", "30000/1001", "24000/1001"]) {
      const rate = framesASecond(fps);
      let at = 3.217;
      const kept = Array.from({ length: 40 }, (_, k) => {
        const r = { start: at, end: at + 1.4 + (k % 7) * 0.33, keep: true };
        at = r.end + 0.41 + (k % 5) * 0.17;
        return r;
      });
      const spans = keptSpans(kept, fps);
      const want = spans.map((s) => Math.round(s.end * rate) - Math.round(s.start * rate));
      const got = steps({ ranges: stretchesOf(spans).map((s) => ({ ...s, crop: crop(0) })), fps }).parts.flatMap((part) => [...graph(part.args).matchAll(/trim=end_frame=(\d+)/g)].map((m) => Number(m[1])));
      assert.deepEqual(got, want, fps);
    }
  });
  it("starts each stretch's picture and sound at the seek time, so a stretch that starts on a missing picture stays in step", () => {
    const g = graph(steps({ ranges: [{ start: 6.48, end: 8.48, crop: crop(0) }], fps: "25" }).parts[0].args);
    assert.match(g, /^\[0:v\]fps=25:start_time=0,trim=end_frame=50,/);
    assert.match(g, /\[1:a\]aresample=async=1:first_pts=0,atrim=end=2\[a0\]/);
    assert.doesNotMatch(g, /setpts/);
  });
  it("reads a little past each stretch, so a stretch that starts on a missing picture still has all its pictures", () => {
    assert.deepEqual(inputs(steps({ ranges: [{ start: 6.48, end: 8.48, crop: crop(0) }], fps: "25" }).parts[0].args), [["6.48", "2.08", "-an"], ["6.48", "2.08", "-vn"]]);
  });
  it("reads each stretch's picture and its sound as two inputs, never padding the sound, so a stretch with no sound ends", () => {
    // Read together, a stretch where the recording has no sound (its sound ended before its picture) waits for the sound to
    // end, which is the end of the file, while its picture is read on into memory: tried on ffmpeg 9.0.2, a stretch at 30 s of
    // a clip whose sound ends at 20 s passed 400 MB and was stopped. apad on a stretch with no sound at all never ends either.
    // Read apart, each ends on its own: 189 MB, and an hour of 1080 lines with no sound at 50 minutes, 292 MB.
    const args = steps({ ranges: [{ start: 10, end: 11, crop: crop(0) }, { start: 30, end: 31, crop: crop(0) }], fps: "30", duration: 60 }).parts[0].args;
    assert.deepEqual(inputs(args).map(([, , left]) => left), ["-an", "-vn", "-an", "-vn"]);
    assert.match(graph(args), /^\[0:v\].*;\[1:a\].*;\[2:v\].*;\[3:a\]/);
    assert.doesNotMatch(graph(args), /apad/);
  });
  it("writes a time a computer's sums leave a hair off as ffmpeg can read it", () => {
    assert.deepEqual(inputs(steps({ ranges: [{ start: 0.1 + 0.2, end: 0.6, crop: crop(0) }], fps: "30" }).parts[0].args)[0], ["0.3", "0.367", "-an"]);
  });
  it("writes a part's name in the list so the list can be read, whatever is in the preview's name", () => {
    assert.equal(previewSteps({ video: "/in/a.mp4", out: "/w/Sallie's reel.mp4", work: "/w", size: HD, duration: 60, fps: "30", ranges: [{ start: 1, end: 2, crop: crop(0) }] }).list.text, "file 'Sallie'\\''s reel.part-1.mov'\n");
  });
  it("stops a stretch at the end of the video, as a cut plan's last stretch can run past it", () => {
    // The transcriber can time the last words past the end of the file, and a cut plan can end there. ffmpeg asked to read
    // past the end of a file grows its memory without end: on a 60-second clip, a stretch from 61 to 62 took the Mac Studio
    // to 101 GB before it was killed.
    const args = steps({ ranges: [{ start: 30, end: 31, crop: crop(0) }, { start: 59.5, end: 60.4, crop: crop(0) }], fps: "30", duration: 60 }).parts[0].args;
    assert.deepEqual(inputs(args), [["30", "1.067", "-an"], ["30", "1.067", "-vn"], ["59.5", "0.567", "-an"], ["59.5", "0.567", "-vn"]]);
    assert.match(graph(args), /\[2:v\]fps=30:start_time=0,trim=end_frame=15,/);
    assert.match(graph(args), /\[3:a\]aresample=async=1:first_pts=0,atrim=end=0\.5\[a1\]/);
  });
  it("leaves out a stretch that starts at or after the end of the video, or holds less than a picture before it", () => {
    const made = steps({ ranges: [{ start: 30, end: 31, crop: crop(0) }, { start: 59.99, end: 60.5, crop: crop(0) }, { start: 61, end: 62, crop: crop(0) }, { start: 63, end: 64, crop: crop(0) }], fps: "30", duration: 60 });
    assert.equal(made.parts.length, 1);
    assert.equal(inputs(made.parts[0].args).length, 2);
    assert.match(graph(made.parts[0].args), /concat=n=1:v=1:a=1\[v\]\[c\];/);
  });
  it("refuses a preview with every stretch past the end of the video, or a length or a size that cannot be read", () => {
    assert.throws(() => steps({ ranges: [{ start: 61, end: 62, crop: crop(0) }, { start: 63, end: 64, crop: crop(0) }], fps: "30", duration: 60 }), { message: "Every stretch of this preview lies past the end of the video, at 60 seconds: there is nothing to show." });
    assert.throws(() => steps({ ranges: [{ start: 1, end: 2, crop: crop(0) }], fps: "30", duration: undefined }), { message: "A preview needs the video's length, and this one cannot be read: undefined" });
    assert.throws(() => steps({ ranges: [{ start: 1, end: 2, crop: crop(0) }], fps: "30", size: { width: 0, height: 1080 } }), { message: "A preview needs the size of the video's picture, and this one cannot be read: 0 by 1080" });
  });
  it("refuses what would make no preview, or one with its stretches out of order or uncropped, and says which", () => {
    const refused = (ranges, fps = "30") => () => steps({ ranges, fps });
    assert.throws(refused([]), { message: "A preview needs at least one stretch to show." });
    assert.throws(refused([{ start: 5, end: 5, crop: crop(0) }]), { message: "A stretch must end after it starts, at times in seconds: this one runs from 5 to 5." });
    assert.throws(refused([{ start: 10, end: 12, crop: crop(0) }, { start: 11, end: 14, crop: crop(0) }]), { message: "The stretches must be in rising order and must not overlap: the one from 11 to 14 starts before the one before it ends." });
    // A stretch with no crop beside one with its own; a candidate with no crop at all is one not made yet (tests/reading.test.js).
    assert.throws(refused([{ start: 1, end: 2, crop: crop(0) }, { start: 10, end: 12 }]), { message: "Each stretch of a preview needs its crop: the one from 10 to 12 has none." });
    assert.throws(refused([{ start: 10, end: 10.01, crop: crop(0) }]), { message: "A stretch must hold at least one picture: the one from 10 to 10.01 holds none at 30 a second." });
    assert.throws(refused([{ start: 10, end: 12, crop: crop(0) }], ""), { message: "A preview needs the video's frame rate, and this one cannot be read: " });
  });
});

describe("the limits a preview is made under", () => {
  it("are 2 GB of memory, and a minute and five seconds for every second of the preview", () => {
    // Measured on the Mac Studio: a preview of 40 stretches of 1080 lines took 1.29 GB at its peak and 3.9 seconds.
    assert.deepEqual(previewLimits(40), { most: 2 * 1024 * 1024 * 1024, limit: 260000 });
    assert.deepEqual(previewLimits(90.5), { most: 2 * 1024 * 1024 * 1024, limit: 512500 });
  });
});

describe("the Final Cut project of a Reel", () => {
  const VIDEO = "/Users/sallie/BRIMM Video/Episodes/2026-10-14 Talk/talk.mov";
  const [CANDIDATE] = reelCandidates({ clips: CLIPS, plan: PLAN, facts: FACTS, stills: stillsWith(0.25) });
  const tagsOf = (xml, name) => [...xml.matchAll(new RegExp(`<${name}((?: [\\w-]+="[^"]*")*)/?>`, "g"))].map((m) => Object.fromEntries([...m[1].matchAll(/ ([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
  const make = (over = {}) => reelProject({ video: VIDEO, facts: FACTS, candidate: CANDIDATE, plan: PLAN, project: "Talk reel 1 v0 3fa9c1", event: "Talk", ...over });

  it("is 1080 by 1920, its stretches as clips one after another, each filled and moved onto the face", () => {
    const { text } = make();
    assert.deepEqual(REEL_FRAME, { width: 1080, height: 1920 });
    // The stretches start and end on pictures 401, 495, 576 and 638 at 29.97 a second. The face's crop starts 118 pixels into
    // 1280, so its middle is at 320 and the picture's at 640: 320 / 720 of the height, 44.4444 hundredths.
    assert.deepEqual(tagsOf(text, "asset-clip").map((c) => `${c.offset} ${c.start} ${c.duration}`), ["0s 401401/30000s 94094/30000s", "94094/30000s 576576/30000s 62062/30000s"]);
    assert.deepEqual(tagsOf(text, "adjust-transform"), [{ position: "44.4444 0" }, { position: "44.4444 0" }]);
    assert.deepEqual([tagsOf(text, "project")[0].name, tagsOf(text, "event")[0].name], ["Talk reel 1 v0 3fa9c1", "Talk"]);
    assert.deepEqual(checkFcpxml(text, { duration: 23.423, frameRate: "30000/1001", width: 1280, height: 720 }, { frame: REEL_FRAME }), []);
  });
  it("has a marker at the join, saying what was taken out there and why", () => {
    assert.deepEqual(tagsOf(make().text, "marker").map((m) => [m.start, m.value]), [["576576/30000s", "Taken out, 2.7 seconds. Claude: It adds nothing to the line before it."]]);
  });
  it("has a marker on each stretch whose crop is a guess, for it to be checked by eye", () => {
    const guessed = { ...CANDIDATE, ranges: CANDIDATE.ranges.map((r, i) => ({ ...r, crop: { ...r.crop, found: i === 1 } })) };
    assert.deepEqual(tagsOf(make({ candidate: guessed }).text, "marker").map((m) => m.value), [
      "No face was found in this stretch, so the picture is placed where the face is in the rest of the video, or in the middle. Check it.",
      "Taken out, 2.7 seconds. Claude: It adds nothing to the line before it."
    ]);
  });
  it("has no captions and no titles yet", () => {
    const { text } = make();
    assert.deepEqual([tagsOf(text, "caption"), tagsOf(text, "title")], [[], []]);
  });
  it("is checked before it is given back, and one that does not pass is not", () => {
    // A writer that leaves a gap between the two clips: the check finds it, and nothing is given back to be pushed.
    const gappy = (given) => fcpxml(given).replace('offset="94094/30000s"', 'offset="95095/30000s"');
    assert.deepEqual(make({ writer: gappy }), { why: "it did not pass its own check (There is a gap of 1 frame before clip 2)" });
  });
  it("is not given back, and says why, for a candidate with no stretch", () => {
    assert.deepEqual(make({ candidate: { ...CANDIDATE, ranges: [] } }), { why: "the Reel has no stretch to show" });
  });
});

describe("the streams a preview is made from", () => {
  it("are named in each part's graph when they are given, and the parts are as before when not", () => {
    const at = { video: "/in/a.mov", ranges: [{ start: 1, end: 3, crop: { x: 0, y: 0, w: 404, h: 720 } }], out: "/out/a.mp4", fps: "30/1", duration: 10, work: "/work", size: { width: 1280, height: 720 } };
    const graph = (steps) => steps.parts[0].args[steps.parts[0].args.indexOf("-filter_complex") + 1];
    const mapped = graph(previewSteps({ ...at, streams: { video: 0, audio: 2 } }));
    assert.ok(mapped.includes("[0:0]fps=") && mapped.includes("[1:2]aresample="), mapped);
    assert.deepEqual(previewSteps({ ...at, streams: { video: 0, audio: null } }), previewSteps(at));
  });
});
