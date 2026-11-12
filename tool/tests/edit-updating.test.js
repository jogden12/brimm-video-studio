// edit.js while an update is under way (Phase 7, Task 2): with the marker live, every command but `behind` and `update` is refused,
// and so is a second half typed in a chat. A second half started by Studio itself (`--now`, `app --when-ready`) goes on, for it holds
// a lock and the update waits for it. The marker is written in the made-up Mac's own home, at its own clock.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_NAMES, editMain } from "../edit.js";
import { UPDATING, markUpdating } from "../busy.js";
import { setup } from "./episodes.js";

/** `words` given to editMain on the made-up Mac `t`, with `env` its environment. Every program it would run or start is written down. */
async function on(t, words, env = {}) {
  const said = [];
  const ran = [];
  const deps = {
    ...t.ctx.deps,
    env,
    say: (x) => said.push(x),
    run: async (cmd, args) => {
      ran.push([cmd, ...args]);
      return { code: 0, stderr: "" };
    },
    start: (cmd, args) => ran.push([cmd, ...args])
  };
  const code = await editMain(words, deps);
  return { code, said, ran };
}

/** The made-up Mac with the marker of an update written at its own clock. */
function updating() {
  const t = setup();
  assert.equal(markUpdating({ home: t.home, now: t.now() }), true);
  return t;
}

describe("edit.js while an update is under way", () => {
  it("every command but behind and update is refused", async () => {
    const t = updating();
    for (const name of COMMAND_NAMES.filter((n) => n !== "behind" && n !== "update")) {
      const r = await on(t, [name]);
      assert.deepEqual([r.code, r.said, r.ran], [1, [UPDATING], []], name);
    }
    t.done();
  });
  it("behind, update and a second half go on", async () => {
    const t = updating();
    for (const words of [["behind"], ["update"], ["bring", "--now", "x"], ["app", "--when-ready", "x"]]) {
      const r = await on(t, words);
      assert.ok(!r.said.includes(UPDATING), words.join(" "));
    }
    t.done();
  });
  it("a second half typed in a chat is refused", async () => {
    const t = updating();
    for (const words of [["bring", "--now", "x"], ["app", "--when-ready", "x"]]) {
      const r = await on(t, words, { CLAUDECODE: "1" });
      assert.deepEqual([r.code, r.said, r.ran], [1, [UPDATING], []], words.join(" "));
    }
    t.done();
  });
  it("with no marker nothing is refused for it", async () => {
    const t = setup();
    const r = await on(t, ["status"]);
    assert.ok(!r.said.includes(UPDATING));
    t.done();
  });
});
