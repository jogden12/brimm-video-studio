// The record's layout 2 (phase 4): written only once a record holds a layer of the session's commands, and each layer read
// whole or refused.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newEpisode, episodeFault, layoutOf, writeEpisode, recordFile, RECORD_VERSION } from "../episode.js";

const BASE = { ...newEpisode({ id: "e-20261014-3fa9c1", machine: "Mac Studio", at: "2026-10-14T09:12:00-05:00", video: { file: "a.mp4", bytes: 1, seconds: 20, created: null }, kind: "episode", writer: { commit: "c709b57", on: "Mac Studio" } }), rev: 1 };
const REEL = { n: 2, status: "picked", from: 1, to: 9, title: "t", why: "", files: [], pushed: [] };

describe("the record's layout", () => {
  it("is 2 at most here, and 2 only once a record holds a layer of phase 4", () => {
    assert.equal(RECORD_VERSION, 2);
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
    assert.equal(episodeFault({ ...BASE, version: 3 }), "it is version 3, and this brimm-video reads versions 1 to 2");
  });
});
