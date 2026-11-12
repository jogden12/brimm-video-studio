// edit.js while an update is under way (Phase 7, Task 2): with the marker live, every command but `behind` and `update` is refused,
// and so is a second half typed in a chat. A second half started by Studio itself (`--now`, `app --when-ready`) goes on, for it holds
// a lock and the update waits for it. The marker is written in the made-up Mac's own home, at its own clock.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_NAMES, editMain } from "../edit.js";
import { existsSync, readFileSync } from "node:fs";
import { UPDATING, markUpdating, noteWaited, updatingWaitedFile } from "../busy.js";
import { setup } from "./episodes.js";

/** `words` given to editMain on the made-up Mac `t`, with `env` its environment. Every program it would run or start is written down. */
async function on(t, words, env = {}, more = {}) {
  const said = [];
  const ran = [];
  const deps = {
    ...t.ctx.deps,
    ...more,
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
    // Each says a line of its own, which shows that the command ran: git's answers here are empty, the made-up Mac runs from a
    // checkout, and it has no episodes.
    const runs = [
      [["behind"], "Could not check for a newer BRIMM Video Studio. Is this Mac offline?"],
      [["update"], "This Mac runs BRIMM Video Studio from a git checkout, so it is not updated from here. Ask Jason to update it when it suits. (Jason: when no import is at work, pull main in the checkout.)"],
      [["bring", "--now", "x"], "There are no episodes yet."],
      [["app", "--when-ready", "x"], "There are no episodes yet."]
    ];
    for (const [words, line] of runs) {
      const r = await on(t, words);
      assert.ok(!r.said.includes(UPDATING), words.join(" "));
      assert.ok(r.said.includes(line), `${words.join(" ")}: ${JSON.stringify(r.said)}`);
    }
    t.done();
  });
  describe("behind and a run that waited for the marker", () => {
    /** `behind` on the made-up Mac `t`, with `more` in its deps: whether the launch agent was asked to look, and whether the note is still there. */
    async function behindOn(t, more = {}) {
      const r = await on(t, ["behind"], {}, more);
      return { kicks: [...t.kicks], noted: existsSync(updatingWaitedFile(t.home)), said: r.said };
    }
    it("once the marker has lapsed, asks the job to look once and takes the note away, and says nothing of it", async () => {
      const t = setup();
      assert.equal(noteWaited({ home: t.home }), true);
      const r = await behindOn(t);
      assert.deepEqual([r.kicks, r.noted], [["kickstart"], false]);
      assert.deepEqual(r.said, ["Could not check for a newer BRIMM Video Studio. Is this Mac offline?"]);
      // The note is gone, so the next behind asks nothing.
      assert.deepEqual((await behindOn(t)).kicks, ["kickstart"]);
      t.done();
    });
    it("while the marker is live, asks nothing and keeps the note", async () => {
      const t = updating();
      assert.equal(noteWaited({ home: t.home }), true);
      const r = await behindOn(t);
      assert.deepEqual([r.kicks, r.noted], [[], true]);
      t.done();
    });
    it("with no note, asks nothing", async () => {
      const t = setup();
      const r = await behindOn(t);
      assert.deepEqual([r.kicks, r.noted], [[], false]);
      t.done();
    });
    it("while a run is at work, asks nothing and keeps the note", async () => {
      const t = setup();
      assert.equal(noteWaited({ home: t.home }), true);
      const r = await behindOn(t, { agentPid: () => 4242 });
      assert.deepEqual([r.kicks, r.noted], [[], true]);
      t.done();
    });
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

describe("edit.js's own kickstart", () => {
  it("is given the same time limit as busy.js's", () => {
    const text = readFileSync(new URL("../edit.js", import.meta.url), "utf8");
    const at = text.indexOf("function kickstart(");
    assert.ok(at !== -1, "edit.js has function kickstart(");
    const body = text.slice(at, text.indexOf("\n}\n", at));
    assert.ok(body.includes("KICK_TIMEOUT_MS"), body);
  });
});
