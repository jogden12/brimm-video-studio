// How the finish her last yes started has gone (finish-ended.js): when she said yes, as finish.asked.json has it, and the result of the run
// that began after it. Everything is in a home folder of the test's own; no program and no Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resultFile } from "../detached.js";
import { episodeWork } from "../settings.js";
import { ASKED_FILE, askedAt, endedSinceYes, endedWithoutHandoff } from "../finish-ended.js";

const FOLDER = "2026-10-14 Pricing talk (Mac Studio)";
const YES = "2026-10-20T15:00:00-05:00";
const YES_MS = Date.parse(YES);

function home() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-finish-ended-"));
  mkdirSync(episodeWork(dir, FOLDER), { recursive: true });
  return {
    dir,
    asked: (text) => writeFileSync(join(episodeWork(dir, FOLDER), ASKED_FILE), typeof text === "string" ? text : JSON.stringify(text)),
    ended: (over) => writeFileSync(resultFile(dir, FOLDER, "finish"), JSON.stringify({ version: 1, command: "finish", started: YES_MS + 1000, ended: YES_MS + 2000, ok: false, made: [], failed: ["x"], next: "", ...over })),
    done: () => rmSync(dir, { recursive: true, force: true })
  };
}

describe("when she said yes to a finish", () => {
  it("is the time finish.asked.json has, in milliseconds", () => {
    const t = home();
    t.asked({ version: 1, at: YES, rev: 3 });
    assert.equal(askedAt(t.dir, FOLDER), YES_MS);
    t.done();
  });
  it("is none when there is no yes, when it cannot be read, or when it is not dated", () => {
    const t = home();
    assert.equal(askedAt(t.dir, FOLDER), null);
    for (const text of ["{ not json", "null", "[]", "{}", JSON.stringify({ at: 5 }), JSON.stringify({ at: "yesterday" })]) {
      t.asked(text);
      assert.equal(askedAt(t.dir, FOLDER), null, text);
    }
    t.done();
  });
});

describe("the finish her last yes started, once it has ended", () => {
  it("is the result of the run that began at or after her yes, with the time of the yes", () => {
    const t = home();
    t.asked({ at: YES });
    for (const started of [YES_MS, YES_MS + 1, YES_MS + 90000]) {
      t.ended({ started });
      const got = endedSinceYes(t.dir, FOLDER);
      assert.equal(got.yes, YES_MS);
      assert.equal(got.result.started, started);
    }
    t.done();
  });
  it("is none for the result of a run that began before her yes: it is an earlier finish's", () => {
    const t = home();
    t.asked({ at: YES });
    t.ended({ started: YES_MS - 1 });
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    t.done();
  });
  it("is none for the early result a run writes while it still works, for a result that cannot be read, and with no yes or no result", () => {
    const t = home();
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    t.asked({ at: YES });
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    t.ended({ early: true });
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    writeFileSync(resultFile(t.dir, FOLDER, "finish"), "null");
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    writeFileSync(resultFile(t.dir, FOLDER, "finish"), "{ not json");
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    t.ended({});
    rmSync(join(episodeWork(t.dir, FOLDER), ASKED_FILE));
    assert.equal(endedSinceYes(t.dir, FOLDER), null);
    t.done();
  });
});

describe("a finish that ended without a hand-off", () => {
  it("is one whose run did not end well, when the video has no hand-off, or one older than her yes", () => {
    const t = home();
    t.asked({ at: YES });
    t.ended({});
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, null), true);
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, YES_MS - 60000), true);
    t.done();
  });
  it("is none when the run ended well", () => {
    const t = home();
    t.asked({ at: YES });
    t.ended({ ok: true, failed: [] });
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, null), false);
    t.done();
  });
  it("is none when the hand-off on file is from her yes or after: the run wrote it, and failed at the late check", () => {
    const t = home();
    t.asked({ at: YES });
    t.ended({});
    for (const at of [YES_MS, YES_MS + 5000]) assert.equal(endedWithoutHandoff(t.dir, FOLDER, at), false, String(at));
    t.done();
  });
  it("is none when the time of the hand-off cannot be told: nothing is said of a finish that may have written it", () => {
    const t = home();
    t.asked({ at: YES });
    t.ended({});
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, Number.NaN), false);
    t.done();
  });
  it("is none for a result of an earlier yes, an early result, or no result at all", () => {
    const t = home();
    t.asked({ at: YES });
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, null), false);
    t.ended({ started: YES_MS - 1000 });
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, null), false);
    t.ended({ early: true });
    assert.equal(endedWithoutHandoff(t.dir, FOLDER, null), false);
    t.done();
  });
});
