// The final review's fix round (branch claude/studio-review-changes): M1 and M3 (the words under `episodes`). The other items' tests are beside the tests they extend.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, unreadWords } from "../edit.js";
import { writeSettings } from "../settings.js";
import { setup } from "./episodes.js";
import { readEpisode, isFromPlan } from "../episode.js";
import { HAND_EDITED } from "../plan-script.js";
import { localDay } from "../shared/text.js";
import { fileSafe } from "../names.js";

/** Run a command of edit.js by its deps: { code, said }. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}

describe("M1: a record Dropbox is still bringing, on a Mac that does the light import", () => {
  it("says Dropbox may still be bringing it, naming nothing, when the record is not there at all", () => {
    const name = "An episode of 2026-10-20 from the Mac Studio whose record cannot be read";
    assert.equal(unreadWords(name, { code: "NONE", why: "it has no whole record" }), `${name}: Dropbox may still be bringing its record. Wait a few minutes and ask again. If it says this again, tell Jason.`);
    for (const code of ["UNREADABLE", "CONFLICTED"]) assert.equal(unreadWords(name, { code, why: "x" }), `${name}: ask Jason.`);
  });
  it("keeps ask Jason for a folder that cannot be read", async () => {
    const t = setup();
    writeSettings(t.home, { import: "light" });
    writeFileSync(join(t.root, "Episodes", "2026-10-20 Coaching call Jane Doe (Mac Studio)"), "not a folder");
    const said = (await on(t.ctx.deps, "episodes")).said;
    assert.ok(said.includes("  An episode of 2026-10-20 from the Mac Studio whose record cannot be read: ask Jason."), said.join("\n"));
    t.done();
  });
});

describe("M3: a made plan's script line", () => {
  const TITLE = "Too many SKUs";
  async function planned(t) {
    assert.equal((await on(t.ctx.deps, "plan", "new", TITLE)).code, 0);
    const r = await on(t.ctx.deps, "plan", TITLE, "set", "--line", "Most shops carry too many products.");
    assert.equal(r.code, 0, r.said.join("\n"));
    return readEpisode(join(t.root, "Episodes", `${localDay(new Date(t.now()))} ${fileSafe(TITLE)} (Mac Studio)`)).record;
  }
  it("keeps R5's line for a plan not made from its footage", async () => {
    const t = setup();
    const record = await planned(t);
    assert.equal(isFromPlan(record), false);
    assert.equal(HAND_EDITED(record), `The script file of "${TITLE}" was changed outside the chat. Tell me the changes you want and I will save them to the plan.`);
    t.done();
  });
  it("says it can't be changed, and to ask Jason, for a plan made from its footage", async () => {
    const t = setup();
    const record = { ...(await planned(t)), kind: "raw", video: { file: "x.mov", seconds: 5 } };
    assert.equal(isFromPlan(record), true);
    assert.equal(HAND_EDITED(record), "A file of this video is not the one Studio saved: teleprompter.txt. It is made from its footage now, so its script can't be changed. Ask Jason.");
    t.done();
  });
});
