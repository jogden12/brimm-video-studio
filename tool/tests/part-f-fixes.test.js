// The fixes of Part F's whole-branch review, and of the coordinator's cross-check (final-fixes.md, items 1 to 21), each with the
// test that failed before it. Everything edit.js prints goes into Sallie's Claude chat: a client or group session's words must
// never reach the chat (but checked teachings), the shared final/ folder or the BRIMM Ops page.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and every program is a
// stand-in. Every name in it is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HELP, editMain } from "../edit.js";
import { setup } from "./episodes.js";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

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
