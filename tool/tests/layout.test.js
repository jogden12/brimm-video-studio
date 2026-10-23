// The record's layouts 2 and 3. Layout 2 (phase 4) is written only once a record holds a layer of the session's commands, and
// layout 3 (the switch) once it holds an unanswered or new kind, an answer, a session mark, a reading, a version of another
// episode, or a rendered version; each layer is read whole or refused.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newEpisode, episodeFault, faultFor, kindOf, layoutOf, writeEpisode, recordFile, RECORD_VERSION } from "../episode.js";

const BASE = { ...newEpisode({ id: "e-20261014-3fa9c1", machine: "Mac Studio", at: "2026-10-14T09:12:00-05:00", video: { file: "a.mp4", bytes: 1, seconds: 20, created: null }, kind: "episode", writer: { commit: "c709b57", on: "Mac Studio" } }), rev: 1 };
const REEL = { n: 2, status: "picked", from: 1, to: 9, title: "t", why: "", files: [], pushed: [] };

describe("the record's layout", () => {
  it("is 3 at most here, and 2 only once a record holds a layer of phase 4", () => {
    assert.equal(RECORD_VERSION, 3);
    assert.equal(layoutOf(BASE), 1);
    assert.equal(layoutOf({ ...BASE, reels: [{ ...REEL, captions: true }] }), 1);
    for (const more of [
      { spellings: [["Sally", "Sallie"]] },
      { main: { ...BASE.main, logo: true } },
      { main: { ...BASE.main, preset: { job: "full-episode", captions: "file-only", look: "natural" } } },
      { reels: [{ ...REEL, captions: false }] },
      { reels: [{ ...REEL, texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: ["Sallie Ogden"] }] }] },
      { brand: { logo: "media/logo.png" } }
    ]) assert.equal(layoutOf({ ...BASE, ...more }), 2, JSON.stringify(more));
  });
  it("is written as the record holds: 1 with nothing laid over it, 2 once it has a spelling, and stays at 2 once written at 2", () => {
    const folder = mkdtempSync(join(tmpdir(), "layout-"));
    try {
      const options = (rev) => ({ expectRev: rev, writeText: (to, text) => writeFileSync(to, text), writer: { commit: "c709b57", on: "Mac Studio" } });
      writeEpisode(folder, BASE, options(0));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 1), "utf8")).version, 1);
      writeEpisode(folder, { ...BASE, rev: 1, spellings: [["Sally", "Sallie"]] }, options(1));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 2), "utf8")).version, 2);
      // Its last spelling taken back: a Mac on older code must still not take it back (ruling 5).
      writeEpisode(folder, { ...BASE, rev: 2, version: 2, spellings: [] }, options(2));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 3), "utf8")).version, 2);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
  it("reads each layer whole, or refuses the record", () => {
    assert.equal(episodeFault({ ...BASE, version: 2, main: { ...BASE.main, texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: ["Sallie Ogden", "Founder"] }], graphics: [{ id: "g1", picture: "media/chart.png", at: 3, for: 2, place: "corner" }], cuts: [{ id: "c1", keep: false, from: 6, to: 9 }] }, reels: [{ ...REEL, captions: false, logo: true, preset: { job: "solo-clip", captions: "bold", look: "warm" } }], brand: { logo: "media/logo.png" } }), "");
    assert.equal(episodeFault({ ...BASE, main: { ...BASE.main, texts: [{ id: "t1", kind: "lower-third", at: 2, for: 4, lines: [] }] } }), "its main video cannot be read");
    assert.equal(episodeFault({ ...BASE, main: { ...BASE.main, graphics: [{ id: "g1", picture: "../secret.png", at: 3, for: 2, place: "corner" }] } }), "its main video cannot be read");
    assert.equal(episodeFault({ ...BASE, reels: [{ ...REEL, cuts: [{ id: "c1", keep: true, from: 9, to: 6 }] }] }), "its Reels cannot be read");
    assert.equal(episodeFault({ ...BASE, brand: { logo: "/Users/x/logo.png" } }), "its logo cannot be read");
    assert.equal(episodeFault({ ...BASE, main: { ...BASE.main, graphics: [{ id: "g1", picture: "media/..", at: 3, for: 2, place: "corner" }] } }), "its main video cannot be read");
    assert.equal(episodeFault({ ...BASE, brand: { logo: "media/." } }), "its logo cannot be read");
    assert.equal(episodeFault({ ...BASE, version: 4 }), "it is version 4, and this brimm-video reads versions 1 to 3");
    assert.equal(faultFor(2)({ ...BASE, version: 3 }), "it is version 3, and this brimm-video reads versions 1 to 2");
    assert.equal(faultFor(2)({ ...BASE, version: 2 }), "");
  });
});

const AT = "2026-10-22T10:40:00-05:00";
/** A record as the import writes it today, at rev 1, made fresh for each test. */
const made = () => structuredClone(BASE);
const ANSWER = { state: "needs your answer", guess: "finished", seen: "wide, 42:10, 2 retakes", came: "camera" };
const RENDER = { v: 0, how: "render", at: AT, on: "Mac Studio", file: "edit/main.v0.fcpxml" };
const SESSION = { marked: AT, on: "Mac Studio", teachings: null, cleared: null };
const READING = { kind: "finished", model: "sonnet", at: AT, on: "Mac Studio", account: "sallie@example.com (The BRIMM)", outcome: "read" };

describe("the record's layout 3", () => {
  it("is layout 3 for an unanswered record, which has no kind", () => {
    const r = { ...made(), kind: null, answer: ANSWER, label: "Video of 22 Oct, 10:40 (Mac Studio)" };
    assert.equal(episodeFault(r), "");
    assert.equal(layoutOf(r), 3);
    assert.equal(kindOf(r), null);
  });
  it("needs a kind once the record is answered, and lets a record that is not for brimm-video have none", () => {
    assert.match(episodeFault({ ...made(), kind: null, answer: { state: "answered", guess: null, seen: "", came: "camera" } }), /kind/);
    assert.match(episodeFault({ ...made(), kind: null }), /kind/);
    assert.match(episodeFault({ ...made(), kind: "reel", answer: ANSWER }), /kind/);
    assert.equal(episodeFault({ ...made(), kind: null, answer: { state: "not for brimm-video", guess: null, seen: "sound only, 3:00", came: "sound" } }), "");
    for (const kind of ["finished", "raw", "session", "short video", "episode"]) {
      assert.equal(episodeFault({ ...made(), kind, answer: { state: "answered", guess: null, seen: "", came: "zoom", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: kind === "session" ? "yes" : "no" } }), "", kind);
    }
  });
  it("reads an episode imported before the switch as raw, and keeps it at layout 1", () => {
    assert.equal(kindOf({ ...made(), kind: "episode" }), "raw");
    assert.equal(layoutOf({ ...made(), kind: "episode" }), 1);
    assert.equal(kindOf({ ...made(), kind: "short video" }), "short video");
    assert.equal(layoutOf({ ...made(), kind: "short video" }), 1);
    for (const kind of ["finished", "raw", "session"]) assert.equal(kindOf({ ...made(), kind }), kind);
    assert.equal(kindOf({ ...made(), kind: "reel" }), null);
  });
  it("is layout 3 once a record holds anything of it, and stays 1 or 2 while it holds none", () => {
    for (const more of [
      { kind: "finished" },
      { kind: "raw" },
      { kind: "session" },
      { kind: null },
      { answer: ANSWER },
      { session: SESSION },
      { reading: READING },
      { versionOf: "e-20261001-0a0b0c" },
      { main: { ...made().main, pushed: [RENDER] } },
      { main: { ...made().main, pushed: [{ ...RENDER, v: 1, how: "push" }] } },
      { reels: [{ ...REEL, pushed: [{ ...RENDER, v: 1 }] }] }
    ]) assert.equal(layoutOf({ ...made(), ...more }), 3, JSON.stringify(more));
    for (const none of [{}, { answer: null, session: null, reading: null, versionOf: null }, { label: "", fingerprint: "" }, { main: { ...made().main, pushed: [{ v: 1, at: AT, on: "Mac Studio", file: "edit/main.v1.fcpxml" }] } }]) {
      assert.equal(layoutOf({ ...made(), ...none }), 1, JSON.stringify(none));
    }
    assert.equal(layoutOf({ ...made(), spellings: [["Sally", "Sallie"]] }), 2);
    assert.equal(layoutOf({ ...made(), spellings: [["Sally", "Sallie"]], kind: "raw" }), 3);
  });
  it("takes a rendered version 0 as a version, and a push from version 1 on, as before", () => {
    const pushed = (...list) => ({ ...made(), kind: "raw", main: { ...made().main, pushed: list } });
    assert.equal(episodeFault(pushed(RENDER)), "");
    assert.equal(episodeFault(pushed(RENDER, { ...RENDER, v: 1 }, { v: 2, how: "push", at: AT, on: "Mac Studio", file: "edit/main.v2.fcpxml" })), "");
    assert.equal(episodeFault({ ...made(), reels: [{ ...REEL, pushed: [RENDER] }] }), "");
    assert.match(episodeFault({ ...made(), main: { ...made().main, pushed: [{ v: 0, at: AT, on: "Mac Studio", file: "x" }] } }), /main video/);
    assert.match(episodeFault(pushed({ ...RENDER, how: "push", v: 0 })), /main video/);
    assert.match(episodeFault(pushed({ ...RENDER, how: "show" })), /main video/);
    assert.match(episodeFault(pushed({ ...RENDER, v: -1 })), /main video/);
    assert.match(episodeFault(pushed({ ...RENDER, at: "later" })), /main video/);
    assert.match(episodeFault({ ...made(), reels: [{ ...REEL, pushed: [{ v: 0, at: AT, on: "Mac Studio", file: "x" }] }] }), /Reels/);
  });
  it("reads its fields whole when they are there, and refuses the record when one cannot be read", () => {
    const withAnswer = (change) => ({ ...made(), kind: "raw", answer: { state: "answered", guess: "raw", seen: "wide, 42:10", came: "camera", ...change } });
    assert.equal(episodeFault({ ...withAnswer({ by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" }), label: "", fingerprint: "ab12", versionOf: null, session: null, reading: READING }), "");
    for (const bad of [{ state: "maybe" }, { came: "carrier pigeon" }, { guess: 3 }, { seen: null }, { by: "" }, { on: 7 }, { at: "later" }, { private: "maybe" }, { private: true }]) {
      assert.match(episodeFault(withAnswer(bad)), /answer/, JSON.stringify(bad));
    }
    // The episode the import found its words in, for her card to offer as "a new version of", or none: an id, or null.
    for (const match of ["e-20261001-0a0b0c", null]) assert.equal(episodeFault(withAnswer({ match })), "", JSON.stringify(match));
    for (const match of ["", "Talk", "e-20261001-0A0B0C", "e-2026101-0a0b0c", 4, ["e-20261001-0a0b0c"], {}]) {
      assert.match(episodeFault(withAnswer({ match })), /answer/, JSON.stringify(match));
    }
    assert.match(episodeFault({ ...made(), answer: "answered" }), /answer/);
    assert.match(episodeFault({ ...made(), label: 4 }), /label/);
    assert.match(episodeFault({ ...made(), fingerprint: ["a"] }), /fingerprint/);
    assert.match(episodeFault({ ...made(), versionOf: 4 }), /version/);
    assert.match(episodeFault({ ...made(), versionOf: "" }), /version/);
    assert.equal(episodeFault({ ...made(), kind: "session", session: SESSION }), "");
    assert.equal(episodeFault({ ...made(), kind: "finished", session: { ...SESSION, teachings: "transcript only", cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "dialog" } } }), "");
    for (const bad of [{ marked: "later" }, { on: "" }, { teachings: "yes" }, { cleared: {} }, { cleared: { at: AT, on: "Mac Studio", to: "finished", confirmed: "typed" } }, { cleared: { at: "later", on: "Mac Studio", to: "finished", confirmed: "dialog" } }]) {
      assert.match(episodeFault({ ...made(), kind: "session", session: { ...SESSION, ...bad } }), /session/, JSON.stringify(bad));
    }
    assert.match(episodeFault({ ...made(), session: "yes" }), /session/);
    for (const bad of [{ kind: "" }, { model: 1 }, { at: "later" }, { on: "" }, { account: null }, { outcome: "" }]) {
      assert.match(episodeFault({ ...made(), reading: { ...READING, ...bad } }), /reading/, JSON.stringify(bad));
    }
    assert.match(episodeFault({ ...made(), reading: "done" }), /reading/);
  });
  it("is written as version 3 for an unanswered record, stays at 3, and is never written without a kind it needs", () => {
    const folder = mkdtempSync(join(tmpdir(), "layout-"));
    try {
      const options = (rev) => ({ expectRev: rev, writeText: (to, text) => writeFileSync(to, text), writer: { commit: "c709b57", on: "Mac Studio" } });
      const first = { ...made(), rev: 0, kind: null, answer: ANSWER, label: "Video of 22 Oct, 10:40 (Mac Studio)" };
      assert.throws(() => writeEpisode(folder, { ...first, answer: undefined }, options(0)), { code: "FAULT", message: /kind/ });
      writeEpisode(folder, first, options(0));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 1), "utf8")).version, 3);
      const answered = { ...JSON.parse(readFileSync(recordFile(folder, 1), "utf8")), kind: "finished", answer: { ...ANSWER, state: "answered" } };
      writeEpisode(folder, answered, options(1));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 2), "utf8")).version, 3);
      // An episode already recorded as layout 3 is not written back at a lower layout when its layout-3 fields are gone.
      writeEpisode(folder, { ...answered, rev: 2, kind: "episode", answer: null }, options(2));
      assert.equal(JSON.parse(readFileSync(recordFile(folder, 3), "utf8")).version, 3);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
