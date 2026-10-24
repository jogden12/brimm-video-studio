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
import { setup } from "./episodes.js";

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
