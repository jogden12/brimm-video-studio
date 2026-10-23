// How a video came, the guess at its kind, and the labels an unanswered or session video goes by in the chat, which never
// hold the file's name. None of it needs a video, a disk or a program.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isZoomName, cameFrom, guessKind, labelFor, sessionLabel, seenLine } from "../kinds.js";

/** A cut plan holding `n` ranges the rules cut as `kind`, among a few that are kept and some pauses. */
const plan = (n, kind = "retake") => ({
  ranges: [
    { keep: true, kind: "keep" },
    { keep: false, kind: "pause" },
    ...Array.from({ length: n }, () => ({ keep: false, kind })),
    { keep: false, kind: "pause" },
    { keep: true, kind: "keep" }
  ]
});
const WIDE = { width: 1920, height: 1080 };
const UPRIGHT = { width: 1080, height: 1920 };

describe("Zoom's names", () => {
  it("are those of a recording, a sound file and a video it downloads", () => {
    assert.equal(isZoomName("GMT20261013-142933_Recording_gvo_1280x720.mp4"), true);
    assert.equal(isZoomName("GMT20261013-142933_Recording.m4a"), true);
    assert.equal(isZoomName("audio1449382767.m4a"), true);
    assert.equal(isZoomName("video1449382767.mp4"), true);
  });
  it("are not those of any other file", () => {
    assert.equal(isZoomName("Pricing talk.mov"), false);
    assert.equal(isZoomName("My GMT20261013-142933_Recording.mp4"), false);
    assert.equal(isZoomName("audio12.m4a"), false);
    assert.equal(isZoomName("audio1449382767.mp3"), false);
    assert.equal(isZoomName("video1449382767.mov"), false);
    assert.equal(isZoomName(""), false);
    assert.equal(isZoomName(undefined), false);
  });
});

describe("how a video came", () => {
  const apple = { make: "Apple", model: "iPhone 15 Pro" };
  it("is from Zoom when its name is one of Zoom's, whatever the file says", () => {
    assert.equal(cameFrom({ name: "GMT20261013-142933_Recording_gvo_1280x720.mp4", facts: { ...WIDE, device: { make: "", model: "" } } }), "zoom");
    assert.equal(cameFrom({ name: "audio1449382767.m4a", facts: { width: 0, height: 0 } }), "zoom");
    assert.equal(cameFrom({ name: "video1449382767.mp4", facts: { ...UPRIGHT, device: apple } }), "zoom");
  });
  it("is sound when there is no picture", () => {
    assert.equal(cameFrom({ name: "Voice memo.m4a", facts: { width: 0, height: 0, device: { make: "", model: "" } } }), "sound");
    assert.equal(cameFrom({ name: "Voice memo.m4a", facts: { width: 0, height: 0, device: apple } }), "sound");
  });
  it("is a phone when the file says an iPhone made it, or when the picture is upright", () => {
    assert.equal(cameFrom({ name: "IMG_1234.MOV", facts: { ...WIDE, device: apple } }), "phone");
    assert.equal(cameFrom({ name: "IMG_1234.MOV", facts: { ...WIDE, device: { make: "Apple", model: "iPhone" } } }), "phone");
    assert.equal(cameFrom({ name: "clip.mp4", facts: { ...UPRIGHT, device: { make: "", model: "" } } }), "phone");
    assert.equal(cameFrom({ name: "clip.mp4", facts: UPRIGHT }), "phone");
  });
  it("is a camera otherwise, including a wide video from an Apple device that is not an iPhone", () => {
    assert.equal(cameFrom({ name: "C0042.MP4", facts: { ...WIDE, device: { make: "Sony", model: "ILCE-7M4" } } }), "camera");
    assert.equal(cameFrom({ name: "C0042.MP4", facts: { ...WIDE, device: { make: "", model: "" } } }), "camera");
    assert.equal(cameFrom({ name: "C0042.MP4", facts: WIDE }), "camera");
    assert.equal(cameFrom({ name: "Screen.mov", facts: { ...WIDE, device: { make: "Apple", model: "Mac14,2" } } }), "camera");
    assert.equal(cameFrom({ name: "Screen.mov", facts: { ...WIDE, device: { make: "Apple", model: "iPad13,1" } } }), "camera");
    assert.equal(cameFrom({ name: "Screen.mov", facts: { ...WIDE, device: { make: "Samsung", model: "iPhone clone" } } }), "camera");
  });
});

describe("the guess at what a video is", () => {
  it("is a clip for a phone or short video, raw by its retakes, finished otherwise; Zoom and sound get none", () => {
    assert.equal(guessKind({ facts: { width: 1080, height: 1920, duration: 300 }, plan: plan(0), came: "phone" }), "clip");
    assert.equal(guessKind({ facts: { width: 1920, height: 1080, duration: 60 }, plan: plan(0), came: "camera" }), "clip");
    assert.equal(guessKind({ facts: { width: 1920, height: 1080, duration: 1200 }, plan: plan(2), came: "camera" }), "raw");
    assert.equal(guessKind({ facts: { width: 1920, height: 1080, duration: 1200 }, plan: plan(1), came: "camera" }), "finished");
    assert.equal(guessKind({ facts: { width: 1280, height: 720, duration: 1800 }, plan: plan(9), came: "zoom" }), null);
  });
  it("is a clip by the same rule an episode's kind uses: upright or square, or under 90 seconds", () => {
    assert.equal(guessKind({ facts: { width: 1080, height: 1080, duration: 600 }, plan: plan(0), came: "camera" }), "clip");
    assert.equal(guessKind({ facts: { ...WIDE, duration: 89.9 }, plan: plan(0), came: "camera" }), "clip");
    assert.equal(guessKind({ facts: { ...WIDE, duration: 90 }, plan: plan(0), came: "camera" }), "finished");
    // A clip is a clip however many retakes it has.
    assert.equal(guessKind({ facts: { ...UPRIGHT, duration: 1800 }, plan: plan(9), came: "phone" }), "clip");
  });
  it("is raw when the rules cut at least one retake, false start or spoken cue for each ten minutes, and finished when fewer", () => {
    const at = (minutes, n, kind) => guessKind({ facts: { ...WIDE, duration: minutes * 60 }, plan: plan(n, kind), came: "camera" });
    assert.equal(at(10, 1), "raw");
    assert.equal(at(10, 0), "finished");
    assert.equal(at(20, 2), "raw");
    assert.equal(at(20, 1), "finished");
    assert.equal(at(30, 3), "raw");
    assert.equal(at(30, 2), "finished");
    assert.equal(guessKind({ facts: { ...WIDE, duration: 1199 }, plan: plan(1), came: "camera" }), "finished");
    assert.equal(guessKind({ facts: { ...WIDE, duration: 100 }, plan: plan(1), came: "camera" }), "raw");
    assert.equal(at(20, 2, "false start"), "raw");
    assert.equal(at(20, 2, "cue"), "raw");
  });
  it("counts only what is cut as a retake, false start or cue: not what is kept, and not a pause", () => {
    const wide = { ...WIDE, duration: 1200 };
    const ranges = [{ keep: true, kind: "keep" }, { keep: true, kind: "retake" }, { keep: false, kind: "pause" }, { keep: false, kind: "pause" }, { keep: false, kind: "retake" }];
    assert.equal(guessKind({ facts: wide, plan: { ranges }, came: "camera" }), "finished");
    assert.equal(guessKind({ facts: wide, plan: { ranges: [...ranges, { keep: false, kind: "cue" }] }, came: "camera" }), "raw");
  });
  it("takes a plan with no ranges for one with no retakes", () => {
    assert.equal(guessKind({ facts: { ...WIDE, duration: 1200 }, plan: { ranges: [] }, came: "camera" }), "finished");
    assert.equal(guessKind({ facts: { ...WIDE, duration: 1200 }, plan: {}, came: "camera" }), "finished");
    assert.equal(guessKind({ facts: { ...WIDE, duration: 1200 }, plan: null, came: "camera" }), "finished");
  });
  it("gives none to a Zoom download or to sound alone, however short it is and however many retakes it has", () => {
    assert.equal(guessKind({ facts: { ...WIDE, duration: 1800 }, plan: plan(0), came: "zoom" }), null);
    assert.equal(guessKind({ facts: { ...WIDE, duration: 60 }, plan: plan(0), came: "zoom" }), null);
    assert.equal(guessKind({ facts: { width: 0, height: 0, duration: 1800 }, plan: plan(0), came: "sound" }), null);
    assert.equal(guessKind({ facts: { width: 0, height: 0, duration: 1800 }, plan: plan(9), came: "sound" }), null);
    assert.equal(guessKind({ facts: { width: 0, height: 0, duration: 60 }, plan: plan(0), came: "sound" }), null);
  });
});

describe("a session", () => {
  it("is never guessed, whatever is seen", () => {
    const sizes = [[1920, 1080], [1280, 720], [1080, 1920], [1080, 1080], [0, 0]];
    const lengths = [0.5, 30, 60, 89, 90, 600, 1200, 2530, 7200, 36000];
    const plans = [null, undefined, {}, { ranges: [] }, plan(0), plan(1), plan(2), plan(9), plan(40), plan(3, "false start"), plan(3, "cue")];
    const came = ["zoom", "phone", "sound", "camera", undefined];
    const guesses = new Set();
    for (const [width, height] of sizes) for (const duration of lengths) for (const p of plans) for (const c of came) {
      guesses.add(guessKind({ facts: { width, height, duration }, plan: p, came: c }));
    }
    assert.ok(!guesses.has("session"));
    assert.deepEqual([...guesses].sort(), [null, "clip", "finished", "raw"].sort());
  });
});

describe("labels", () => {
  it("never hold the file's name", () => {
    const l = labelFor({ seconds: 2530, machine: "Mac Studio", at: "2026-10-22T10:40:00-04:00" });
    assert.equal(l.short, "Video of 22 Oct, 10:40 (Mac Studio)");
    assert.equal(l.spoken, "the 42-minute video dropped on the Mac Studio at 10:40 on 22 Oct");
    assert.equal(sessionLabel("2026-10-22", ["Session, 2026-10-22"]), "Session, 2026-10-22 (2)");
    // Nothing a caller holds beyond the three things a label is made of can get into one.
    const named = labelFor({ seconds: 2530, machine: "Mac Studio", at: "2026-10-22T10:40:00-04:00", name: "Coaching call Jane Doe.mov", file: "/Drop/Coaching call Jane Doe.mov" });
    assert.deepEqual(named, l);
    assert.ok(!JSON.stringify(named).includes("Jane"));
  });
  it("give the length in minutes, rounded to the nearest whole minute", () => {
    const spoken = (seconds) => labelFor({ seconds, machine: "Mac Studio", at: "2026-10-22T10:40:00-04:00" }).spoken;
    assert.match(spoken(2530), /^the 42-minute video /);
    assert.match(spoken(2549), /^the 42-minute video /);
    assert.match(spoken(2551), /^the 43-minute video /);
    assert.match(spoken(60), /^the 1-minute video /);
    assert.match(spoken(3600), /^the 60-minute video /);
    assert.match(spoken(4500), /^the 75-minute video /);
    assert.match(spoken(30), /^the 1-minute video /);
  });
  it("leave the length out for a video of less than half a minute, and for one with no length", () => {
    const at = "2026-10-22T10:40:00-04:00";
    assert.equal(labelFor({ seconds: 20, machine: "Mac Studio", at }).spoken, "the video dropped on the Mac Studio at 10:40 on 22 Oct");
    assert.equal(labelFor({ seconds: 0, machine: "Mac Studio", at }).spoken, "the video dropped on the Mac Studio at 10:40 on 22 Oct");
    assert.equal(labelFor({ seconds: undefined, machine: "Mac Studio", at }).spoken, "the video dropped on the Mac Studio at 10:40 on 22 Oct");
    assert.equal(labelFor({ seconds: 20, machine: "Mac Studio", at }).short, "Video of 22 Oct, 10:40 (Mac Studio)");
  });
  it("use the clock time written in `at`, not the time where the Mac running the tool is", () => {
    assert.equal(labelFor({ seconds: 600, machine: "Mac Studio", at: "2026-10-22T10:40:00+09:00" }).short, "Video of 22 Oct, 10:40 (Mac Studio)");
    assert.equal(labelFor({ seconds: 600, machine: "Mac Studio", at: "2026-10-22T23:59:30-07:00" }).short, "Video of 22 Oct, 23:59 (Mac Studio)");
    assert.equal(labelFor({ seconds: 600, machine: "Mac Studio", at: "2026-12-05T09:05:00-05:00" }).short, "Video of 5 Dec, 09:05 (Mac Studio)");
    assert.equal(labelFor({ seconds: 600, machine: "Mac Studio", at: "2026-01-31T00:00:00Z" }).short, "Video of 31 Jan, 00:00 (Mac Studio)");
  });
  it("say 'on' a Mac that has a person's name without 'the' before it", () => {
    const l = labelFor({ seconds: 2530, machine: "Sallie's laptop", at: "2026-10-22T10:40:00-04:00" });
    assert.equal(l.short, "Video of 22 Oct, 10:40 (Sallie's laptop)");
    assert.equal(l.spoken, "the 42-minute video dropped on Sallie's laptop at 10:40 on 22 Oct");
  });
  it("still come out, without the day and time, when `at` cannot be read", () => {
    for (const at of ["", undefined, "yesterday", "2026-13-40T10:40:00-04:00"]) {
      const l = labelFor({ seconds: 2530, machine: "Mac Studio", at });
      assert.equal(l.short, "Video (Mac Studio)");
      assert.equal(l.spoken, "the 42-minute video dropped on the Mac Studio");
    }
  });
});

describe("a session's label", () => {
  it("is the day, and the day with a number once another session has taken it", () => {
    assert.equal(sessionLabel("2026-10-22", []), "Session, 2026-10-22");
    assert.equal(sessionLabel("2026-10-22"), "Session, 2026-10-22");
    assert.equal(sessionLabel("2026-10-22", ["Session, 2026-10-22"]), "Session, 2026-10-22 (2)");
    assert.equal(sessionLabel("2026-10-22", ["Session, 2026-10-22", "Session, 2026-10-22 (2)"]), "Session, 2026-10-22 (3)");
    assert.equal(sessionLabel("2026-10-22", ["Session, 2026-10-22", "Session, 2026-10-22 (2)", "Session, 2026-10-22 (3)"]), "Session, 2026-10-22 (4)");
  });
  it("is not changed by another day's sessions or other labels", () => {
    assert.equal(sessionLabel("2026-10-22", ["Session, 2026-10-21", "Video of 22 Oct, 10:40 (Mac Studio)"]), "Session, 2026-10-22");
  });
});

describe("what was seen, in a line", () => {
  it("is the shape of the picture, the length and the retakes the rules found", () => {
    assert.equal(seenLine({ facts: { ...WIDE, duration: 2530 }, plan: plan(2), came: "camera" }), "wide, 42:10, 2 retakes");
    assert.equal(seenLine({ facts: { ...UPRIGHT, duration: 300 }, plan: plan(0), came: "phone" }), "upright, 5:00, no retakes");
    assert.equal(seenLine({ facts: { ...WIDE, duration: 3725 }, plan: plan(1), came: "camera" }), "wide, 1:02:05, 1 retake");
  });
  it("counts false starts and spoken cues as retakes, and not pauses or what is kept", () => {
    const ranges = [{ keep: true, kind: "keep" }, { keep: false, kind: "pause" }, { keep: false, kind: "retake" }, { keep: false, kind: "false start" }, { keep: false, kind: "cue" }];
    assert.equal(seenLine({ facts: { ...WIDE, duration: 600 }, plan: { ranges }, came: "camera" }), "wide, 10:00, 3 retakes");
  });
  it("says so when there is no picture, and calls a square picture upright, as an episode's kind does", () => {
    assert.equal(seenLine({ facts: { width: 0, height: 0, duration: 1800 }, plan: plan(0), came: "sound" }), "sound only, 30:00, no retakes");
    assert.equal(seenLine({ facts: { width: 1080, height: 1080, duration: 45 }, plan: plan(0), came: "camera" }), "upright, 0:45, no retakes");
  });
  it("rounds the length to the second, and reads a plan with no ranges as having no retakes", () => {
    assert.equal(seenLine({ facts: { ...WIDE, duration: 2529.6 }, plan: null, came: "camera" }), "wide, 42:10, no retakes");
  });
});
