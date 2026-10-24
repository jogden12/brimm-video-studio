// The fixes of Part F's whole-branch review, and of the coordinator's cross-check (final-fixes.md, items 1 to 21), each with the
// test that failed before it. Everything edit.js prints goes into Sallie's Claude chat: a client or group session's words must
// never reach the chat (but checked teachings), the shared final/ folder or the BRIMM Ops page.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and every program is a
// stand-in. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs, { mkdirSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { HELP, editMain } from "../edit.js";
import { writeSettings } from "../settings.js";
import { setup, episodeFor, reread, FOLDER } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** Have the fs function `name` refuse, as a disk that will not let it, every path under `under` that `only` takes, while `work` runs:
    an error nobody foresaw, whose message names the path. */
async function refusing(name, under, work, only = () => true) {
  const real = fs[name];
  fs[name] = (path, ...rest) => {
    if (String(path).startsWith(under) && only(String(path))) throw Object.assign(new Error(`EACCES: permission denied, ${name.replace(/Sync$/, "")} '${path}'`), { code: "EACCES", errno: -13, path: String(path) });
    return real(path, ...rest);
  };
  syncBuiltinESMExports();
  try {
    return await work();
  } finally {
    fs[name] = real;
    syncBuiltinESMExports();
  }
}

/** A video in this Mac's drop folder, named for a client. */
const CLIENT_VIDEO = "Coaching call Jane Doe.mov";
/** What must never be in a line: the client's name. */
const SECRET = /jane|coaching/i;

describe("an error nobody foresaw, on a Mac that does the light import (item 8)", () => {
  it("says only the work stopped, with its code, for a command that names no episode, as retry", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, CLIENT_VIDEO), "video");
    const r = await refusing("statSync", drop, () => on(t.ctx.deps, "retry", CLIENT_VIDEO));
    assert.deepEqual([r.code, r.said], [1, ["The work stopped (EACCES)."]]);
    assert.doesNotMatch(r.text.replace(CLIENT_VIDEO, ""), SECRET);
    t.done();
  });
  it("is thrown as today with the light import off", async () => {
    const t = setup();
    const drop = join(t.root, "Unedited Video", "Mac Studio");
    mkdirSync(drop, { recursive: true });
    writeFileSync(join(drop, CLIENT_VIDEO), "video");
    await refusing("statSync", drop, () => assert.rejects(on(t.ctx.deps, "retry", CLIENT_VIDEO), (err) => err.code === "EACCES" && err.message.includes(CLIENT_VIDEO)));
    t.done();
  });
});

/** The clock of episodes.js's setup, as the record keeps a moment. */
const AT = "2026-10-20T15:00:00-05:00";
/** Her answer, as `kind` records it for a video that is not a session. */
const ANSWERED = { state: "answered", guess: "raw", seen: "wide, 0:23, 1 retake", came: "camera", match: null, by: "Mac Studio", on: "Mac Studio", at: AT, private: "no" };
/** The label a light import gives the made-up video. */
const LABEL = "Video of 14 Oct, 09:12 (Mac Studio)";
/** A light import's files of the made-up video: the video and its plan, and no timeline of its own (edit/main.v0.fcpxml). */
const LIGHT = { "Pricing talk.mp4": "the video", "Pricing talk.cut-plan.json": "{}", "Pricing talk.srt": "1\n00:00:00,000 --> 00:00:02,000\nHello\n", "Pricing talk.transcript.txt": "[0:00] Hello" };

describe("push of a video that has no timeline in Final Cut, and an error nobody foresaw for a record of the switch (item 20)", () => {
  it("refuses a finished video, and an iPhone clip she answered, in plain words, before any timeline is read", async () => {
    for (const [kind, what] of [["finished", "a finished video"], ["short video", "an iPhone clip"]]) {
      const t = setup();
      episodeFor(t, { record: { version: 3, kind, answer: ANSWERED, label: LABEL }, files: LIGHT });
      for (const argv of [["push", "Pricing talk"], ["push", "Pricing talk", "main", "--no-hand-edits"]]) {
        const r = await on(t.ctx.deps, ...argv);
        assert.deepEqual([r.code, r.said], [1, [`Pricing talk has no timeline to show in Final Cut: ${what} is not edited here.`]], `${kind}: ${argv.join(" ")}`);
      }
      assert.deepEqual(t.opened, []);
      t.done();
    }
  });
  it("says only that the work stopped for a record of the switch, on a Mac whose import is not the light one: no path, no stack", async () => {
    // A raw video she answered, whose timeline Dropbox never brought: reading it fails in a way nobody foresaw.
    const t = setup();
    episodeFor(t, { record: { version: 3, kind: "raw", answer: ANSWERED, label: LABEL }, files: LIGHT });
    const r = await on(t.ctx.deps, "push", "Pricing talk");
    assert.deepEqual([r.code, r.said], [1, ["The work stopped (ENOENT)."]]);
    assert.equal(reread({ folder: join(t.root, "Episodes", FOLDER) }).rev, 1);
    t.done();
  });
});

describe("a command's name is one of edit.js's own (item 21)", () => {
  it("prints the help and ends with 2 for a name every object has, as for any word that is no command", async () => {
    const t = setup();
    for (const word of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf"]) {
      const r = await on(t.ctx.deps, word, "Pricing talk");
      assert.deepEqual([r.code, r.text], [2, HELP], word);
    }
    t.done();
  });
});
