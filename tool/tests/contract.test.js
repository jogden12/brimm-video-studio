// The contract with BRIMM Ops, from this side: the hand-off fixtures that brimm-video owns, and that brimm-operations keeps a
// copy of and tests the page's reader on. Only hand-off version 2's are pinned here so far: phase T's Task 4 (the transcript
// tool moves in) adds version 1's pins and the .srt pair beside them in this file. Version 1 is what the page reads until the
// switch (spec 2026-10-22, section 8); these five are what version 2 will be.
// A fixture that changes fails here with its new hash. Changing one is changing the contract: the page's copy is made again
// first, by a session in brimm-operations, and only then is the hash set here.
import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { handoffFaultV2 } from "../handoff-v2.js";
import { tidyTranscript } from "../shared/transcript.js";
import { fixtures } from "./fixtures/make-handoff-v2.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (name) => JSON.parse(fixture(name).toString("utf8"));

/** The captions of an .srt: where each begins and ends in seconds, and its words. */
const cuesOf = (srt) => [...srt.matchAll(/(\d+):(\d{2}):(\d{2}),(\d{3}) --> (\d+):(\d{2}):(\d{2}),(\d{3})\n ([^\n]+)\n/g)].map((m) => ({
  start: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000,
  end: Number(m[5]) * 3600 + Number(m[6]) * 60 + Number(m[7]) + Number(m[8]) / 1000,
  words: m[9]
}));
const near = (a, b) => Math.abs(a - b) < 0.0005;

/** Hand-off version 2's fixtures and the sha256 of each, as brimm-operations last copied them. */
const PINNED_V2 = {
  "handoff-v2-finished.json": "7c597e74b53e9865cc2156166ee528503d5bf217730d261ae67c09604fac968f",
  "handoff-v2-raw.json": "6dd251eff72c483b93f17a495977510c2346f4b88c63d4e13e0ca81554901159",
  "handoff-v2-session.json": "c34761be3c7800303bc974a2a555617624ed4d5a51369f7c05616c0807b7c6f3",
  "handoff-v2-short-video.json": "ffd0129ab711ca15280ec2a20a9b32e43856856a6bb1f8b281d198ed11946ac7",
  "handoff-v2-session-replacing.json": "921a8bd762938601ad063b5adb13f290f267705486969da1757451b78042580f"
};

describe("the contract with BRIMM Ops: hand-off version 2's fixtures are pinned", () => {
  for (const [name, pinned] of Object.entries(PINNED_V2)) {
    it(`${name} is as brimm-operations last copied it`, () => {
      const now = sha256(fixture(name));
      assert.equal(now, pinned, `"${name}" changed. brimm-operations keeps a copy of it: ask Jason for a session there to copy it again, then set its hash here to ${now}.`);
    });
    it(`${name} passes the hand-off's own check, and its captions are lines the page's reader can make`, () => {
      const h = read(name);
      assert.equal(handoffFaultV2(h), "");
      const captions = [...(h.main ? [h.main.srt] : []), ...(h.reels || []).map((r) => r.srt)];
      for (const srt of captions) {
        const lines = tidyTranscript(srt).split("\n");
        assert.ok(lines.length >= 1 && lines.every((line) => /^\[\d+:\d{2}\] \S/.test(line)), `${name}: ${lines.join(" / ")}`);
      }
    });
  }
});

describe("what each version 2 fixture shows the page", () => {
  let finished, raw, session, short, replacing;
  before(() => {
    finished = read("handoff-v2-finished.json");
    raw = read("handoff-v2-raw.json");
    session = read("handoff-v2-session.json");
    short = read("handoff-v2-short-video.json");
    replacing = read("handoff-v2-session-replacing.json");
  });

  it("finished: a Reel that takes its suggestion's number, a suggestion that was not made, and no words on the picture", () => {
    assert.equal(finished.video.kind, "finished");
    assert.equal(finished.revision, 1);
    assert.equal(finished.suggestions.length, 2);
    assert.equal(finished.reels.length, 1);
    const [reel] = finished.reels;
    assert.equal(reel.fromSuggestion, reel.n);
    const from = finished.suggestions.find((s) => s.n === reel.fromSuggestion);
    assert.deepEqual(reel.inMain, { start: from.start, end: from.end });
    assert.ok(finished.suggestions.some((s) => s.n !== reel.n), "one suggestion has no Reel");
    assert.ok(finished.suggestions.every((s) => s.stretches.length === 1));
    assert.equal("onPicture" in finished.main, false);
    assert.equal(finished.session, null);
    assert.equal("title" in finished.video, false);
  });
  it("finished: named for the dropped file, and with an id whose short form is not version 1's", () => {
    assert.equal(finished.video.name, "Pricing talk");
    assert.equal(finished.main.file, "Pricing talk.mov");
    const v1 = [read("handoff-v1.json").episode.id, read("handoff-v1-short-video.json").episode.id].map((id) => id.slice(-6));
    for (const h of [finished, raw, session, short, replacing]) assert.ok(!v1.includes(h.video.id.slice(-6)), h.video.id);
  });
  it("every suggestion is 15 to 90 seconds of kept words, and its first and last words are the captions' at its ends", () => {
    for (const h of [finished, raw]) {
      const cues = cuesOf(h.main.srt);
      for (const s of h.suggestions) {
        const kept = s.stretches.reduce((sum, t) => sum + (t.end - t.start), 0);
        assert.ok(kept >= 15 && s.end - s.start <= 90, `${h.video.kind} suggestion ${s.n} keeps ${kept} seconds`);
        const opens = cues.find((c) => near(c.start, s.start));
        const closes = cues.find((c) => near(c.end, s.end));
        assert.ok(opens && opens.words.startsWith(s.first), `${h.video.kind} suggestion ${s.n} opens with ${s.first}`);
        assert.ok(closes && closes.words.endsWith(s.last), `${h.video.kind} suggestion ${s.n} closes with ${s.last}`);
      }
    }
  });
  it("raw: a suggestion's stretches meet or sit a short pause apart, with no kept caption between them", () => {
    const cues = cuesOf(raw.main.srt);
    for (const s of raw.suggestions) {
      s.stretches.forEach((t, i) => {
        if (i === 0) return;
        const gap = t.start - s.stretches[i - 1].end;
        assert.ok(gap >= 0 && gap <= 0.5, `suggestion ${s.n}: ${gap} seconds between its stretches`);
        assert.deepEqual(cues.filter((c) => c.end > s.stretches[i - 1].end + 0.0005 && c.start < t.start - 0.0005), []);
      });
    }
  });
  it("raw: the words drawn on the main picture, and a suggestion of two stretches", () => {
    assert.equal(raw.video.kind, "raw");
    assert.deepEqual(raw.main.onPicture, ["Sallie Ogden", "Founder, The BRIMM"]);
    assert.ok(raw.suggestions.some((s) => s.stretches.length === 2));
    assert.equal(raw.session, null);
  });
  it("raw: the numbers of the suggestions and Reels never repeat, a Reel's suggestion may be gone, and a Reel made from times she gave has a null one", () => {
    const numbers = [...raw.suggestions.map((s) => s.n), ...raw.reels.map((r) => r.n)];
    assert.equal(new Set(numbers).size, numbers.length);
    const gone = raw.reels.filter((r) => r.fromSuggestion !== null && !raw.suggestions.some((s) => s.n === r.fromSuggestion));
    assert.equal(gone.length, 1);
    assert.equal("inMain" in gone[0], false);
    const gave = raw.reels.filter((r) => r.fromSuggestion === null);
    assert.equal(gave.length, 1);
    assert.equal(gave[0].title, "");
    assert.ok(gave[0].n > Math.max(...raw.suggestions.map((s) => s.n)), "its number is fresh");
  });
  it("session: no main video and no suggestions, and a Reel with the day the client's agreement was noted and no suggestion", () => {
    assert.equal(session.video.kind, "session");
    assert.equal(session.video.name, "Session, 2026-10-22");
    assert.equal("main" in session, false);
    assert.equal("suggestions" in session, false);
    assert.equal(session.reels.length, 1);
    const [reel] = session.reels;
    assert.match(reel.clientAgreed, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(reel.fromSuggestion, null);
    assert.ok(reel.file.startsWith("Session, 2026-10-22 reel"));
    assert.equal("inMain" in reel, false);
  });
  it("session: principles in the frameworks shape and without source_context, recurring principles, and Reels to film", () => {
    const { principles, recurringPrinciples, reelsToFilm } = session.session;
    assert.deepEqual(Object.keys(session.session), ["principles", "recurringPrinciples", "reelsToFilm"]);
    assert.ok(principles.length >= 2 && recurringPrinciples.length >= 1 && reelsToFilm.length >= 1);
    for (const p of principles) {
      assert.deepEqual(Object.keys(p), ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"]);
    }
    assert.ok(principles.some((p) => p.verbatim_key_phrases.length === 0), "key phrases may be an empty list");
    assert.ok(reelsToFilm.some((f) => f.principle === null) && reelsToFilm.some((f) => f.principle !== null));
    assert.equal(JSON.stringify(session).includes("source_context"), false);
  });
  it("session: no Reel idea's words are the cut Reel's captions word for word", () => {
    const said = cuesOf(session.reels[0].srt).map((c) => c.words).join(" ");
    for (const f of session.session.reelsToFilm) assert.ok(!said.includes(f.words) && !f.words.includes(said), `Reel idea ${f.n}`);
  });
  it("short video: the main video only, with no suggestions and no reels key at all", () => {
    assert.equal(short.video.kind, "short video");
    assert.equal("suggestions" in short, false);
    assert.equal("reels" in short, false);
    assert.deepEqual(short.main.onPicture, ["Know your costs"]);
    assert.equal(short.session, null);
  });
  it("the session that replaces a finished video: the same id one revision on, and nothing in it yet", () => {
    assert.equal(replacing.video.id, finished.video.id);
    assert.equal(finished.revision, 1);
    assert.equal(replacing.revision, 2);
    assert.equal(replacing.video.kind, "session");
    assert.ok(replacing.made > finished.made, "made after the finished video's");
    assert.equal("main" in replacing, false);
    assert.equal("suggestions" in replacing, false);
    assert.deepEqual(replacing.reels, []);
    assert.deepEqual(replacing.session, { principles: [], recurringPrinciples: [], reelsToFilm: [] });
    const firstWords = tidyTranscript(finished.main.srt).split("\n")[0].replace(/^\[[\d:]+\] /, "");
    assert.ok(firstWords.length > 20 && !JSON.stringify(replacing).includes(firstWords), "none of the finished video's words");
  });
  it("only that pair shares an id", () => {
    const ids = [finished, raw, session, short, replacing].map((h) => h.video.id);
    assert.equal(new Set(ids).size, ids.length - 1);
  });
  it("a session's hand-off names only the keys of the contract, and has no main video: it holds no transcript of the session", () => {
    for (const h of [session, replacing]) {
      assert.deepEqual(Object.keys(h), ["format", "version", "revision", "made", "madeOn", "madeBy", "video", "reels", "session"]);
    }
  });
});

describe("the fixtures are what make-handoff-v2.mjs writes from the builder, byte for byte", () => {
  let made;
  before(() => {
    made = fixtures();
  });
  it("makes the five that are pinned, and no other", () => {
    assert.deepEqual(Object.keys(made).sort(), Object.keys(PINNED_V2).sort());
  });
  for (const name of Object.keys(PINNED_V2)) {
    it(`${name} is the text it makes`, () => {
      assert.equal(fixture(name).toString("utf8"), made[name]);
    });
  }
});
