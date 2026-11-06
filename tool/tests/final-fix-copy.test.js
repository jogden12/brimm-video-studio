// The final review's fix round, M5 and R1b-3's neighbour: the drop file that goes in the second between the import's check and ffprobe.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pendingFolder } from "../settings.js";
import { FOLDER } from "./episodes.js";
import { COPY, owedWithLocal, world, on as onWorld } from "./workcopy-world.js";

describe("M5: the drop file goes in the second between the import's check and ffprobe", () => {
  /** The import makes its late check, and takes its pending one away, as the file goes. */
  const checkMade = (t, found) => rmSync(join(pendingFolder(t.home), `${found.record.id}.json`), { force: true });
  it("makes the copy from the Dropbox video, and does not say the recording could not be read, when the drop file is gone before ffprobe opens it", async () => {
    const { t, found, paths, guarded } = world();
    const { drop } = owedWithLocal(t, found);
    const run = t.ctx.deps.run;
    t.ctx.deps.run = async (cmd, args, asked) => {
      if (cmd === "FFPROBE" && args[args.length - 1] === drop) {
        rmSync(drop);
        checkMade(t, found);
        return { code: 1, stderr: "No such file or directory" };
      }
      return run(cmd, args, asked);
    };
    const r = await onWorld(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /could not be read as a video|could not be converted/);
    assert.equal(guarded.length, 1);
    assert.equal(guarded[0].args[guarded[0].args.indexOf("-i") + 1], join(found.folder, "Pricing talk.mp4"));
    assert.equal(readFileSync(paths.video, "utf8"), COPY);
    t.done();
  });
  it("goes round once more when ffmpeg fails because the drop file went while it was being opened", async () => {
    const { t, found, paths, guarded } = world();
    const { drop } = owedWithLocal(t, found);
    const ran = t.ctx.deps.runGuarded;
    let first = true;
    t.ctx.deps.runGuarded = async (cmd, args, limits) => {
      if (first) {
        first = false;
        rmSync(drop);
        checkMade(t, found);
        guarded.push({ cmd, args, limits });
        return { signal: null, overMemory: false, outOfTime: false, peak: 0, stopped: "", code: 1, stderr: "No such file or directory" };
      }
      return ran(cmd, args, limits);
    };
    const r = await onWorld(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 0, r.text);
    assert.doesNotMatch(r.text, /could not be read as a video|could not be converted/);
    assert.equal(guarded[guarded.length - 1].args[guarded[guarded.length - 1].args.indexOf("-i") + 1], join(found.folder, "Pricing talk.mp4"));
    assert.equal(readFileSync(paths.video, "utf8"), COPY);
    t.done();
  });
  it("still says a recording that cannot be read cannot, when its drop file is still the one that came in", async () => {
    const { t, found } = world({ how: "fail" });
    owedWithLocal(t, found);
    const r = await onWorld(t.ctx.deps, "workcopy", "--now", FOLDER);
    assert.equal(r.code, 1, r.text);
    t.done();
  });
});
