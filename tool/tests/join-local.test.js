// The join of a plan kept on this Mac (Phase 3, the local working folder; L4). Each part is read from its own place, its own episode's video/ folder on this Mac;
// the joined video, or the one part, is filed into the PLAN's video/ folder here, with only the plan's record written in Dropbox; no pending is written, no late
// check is owed, the launch agent is not asked to look, and the notice is `Ready: "<title>" is made from its footage. In Claude, say "what's next?"`. A part
// stays its own episode. A plan whose footage began before the switch has no `local` and is joined the old way (D9).
// Nothing here runs a real program: ffprobe and ffmpeg are stand-ins, and each test has a folder of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { episodeFault, isFromPlan, isPlannedRecord, layoutOf, newEpisode, readEpisode, recordFile, recordText } from "../episode.js";
import { readPendings } from "../filing.js";
import { episodeFilesFolder } from "../settings.js";
import { fileSafe } from "../names.js";
import { localDay } from "../shared/text.js";
import { probed } from "./fixtures.js";
import { setup, listAll } from "./episodes.js";

async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

const TITLE = "Too many SKUs";
const SCRIPT = [
  "Too many SKUs will sink a small shop before it ever finds its footing.",
  "The first thing you need to do is count what you actually sell each week.",
  "Then cut the bottom fifth of the list and watch what happens to your cash."
];
const SHOT_ARGS = ["--shot", "talking | Open on the problem, to the camera.", "--shot", "b-roll | Sallie at her desk sorting invoices.", "--shot", "talking | Why it matters, to the camera.", ...SCRIPT.flatMap((line) => ["--line", line])];
const WIDE = (duration = "60.000000") => probed({ picture: { codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p" }, sound: { codec_name: "aac", sample_rate: "48000", channels: 2 }, duration });
const READY = `Ready: "${TITLE}" is made from its footage. In Claude, say "what's next?"`;

function world() {
  const t = setup({
    programs: {
      FFPROBE: (args) => {
        const name = args[args.length - 1].split("/").pop();
        writeFileSync(args[args.indexOf("-o") + 1], name === `${fileSafe(TITLE)}.mov` ? WIDE("120.000000") : name === "Take 1.mov" ? WIDE("120.000000") : WIDE());
        return { code: 0, stderr: "" };
      },
      FFMPEG: (args) => {
        if (args.includes("concat")) {
          writeFileSync(args[args.length - 1], "the joined video");
          return { code: 0, stderr: "" };
        }
        const out = args[args.length - 1];
        if (out !== "-") writeFileSync(out, "RIFF");
        return { code: 0, stderr: "" };
      }
    }
  });
  t.kicks = [];
  t.ctx.deps.kickstart = () => t.kicks.push("kickstart");
  t.studio = { ...t.ctx.deps, rand: () => 0.25, settings: { ...t.ctx.settings, app: "hyperframes", import: "light", handoffVersion: 2, drop: "Drop", dropPath: join(t.home, "BRIMM Video Work", "Drop") } };
  return t;
}
const day = (t) => localDay(new Date(t.now()));
const FOLDER = (t) => `${day(t)} ${TITLE} (Mac Studio)`;
const folderOf = (t) => join(t.root, "Episodes", FOLDER(t));
const planOf = (t) => readEpisode(folderOf(t)).record;
const idOf = (n) => `e-20261104-a${String(n).repeat(5)}`;

/** A plan made on the Mac Studio with its package set; marked as filmed here unless `local` is false (a plan whose footage began before the switch). */
async function planned(t, { local = true } = {}) {
  assert.equal((await on(t.studio, "plan", "new", TITLE)).code, 0);
  const s = await on(t.studio, "plan", TITLE, "set", ...SHOT_ARGS);
  assert.equal(s.code, 0, s.text);
  const record = planOf(t);
  if (local) writeFileSync(recordFile(folderOf(t), record.rev + 1), recordText({ ...record, rev: record.rev + 1, version: 6, local: { on: "Mac Studio" } }));
  return folderOf(t);
}
const LIGHT = (stem, words) => ({
  [`${stem}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.transcript.txt`]: "[0:00] words\n",
  [`${stem}.words.json`]: JSON.stringify({ video: `${stem}.mov`, duration: 60, words: words.map((w, i) => ({ w, start: i, end: i + 1 })) }),
  [`${stem}.cut-plan.json`]: JSON.stringify({ version: 1, video: `${stem}.mov` }),
  [`${stem}.cut-plan.txt`]: "The cut plan.\n",
  [`${stem}.rough-cut.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.rough-cut.transcript.txt`]: "[0:00] words\n"
});
/** A talking part dropped on this Mac: its own episode, its files in its own video/ folder, its record kept here. */
function part(t, n, { words, local = true } = {}) {
  const stem = `Take ${n}`;
  const name = `2026-11-04 Drop ${n} (Mac Studio)`;
  const folder = join(t.root, "Episodes", name);
  const own = local ? episodeFilesFolder(t.home, name) : folder;
  mkdirSync(join(folder, "record"), { recursive: true });
  const files = { [`${stem}.mov`]: `video ${n}`, ...LIGHT(stem, words) };
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(own, rel)), { recursive: true });
    writeFileSync(join(own, rel), text);
  }
  const sizes = Object.fromEntries(Object.entries(files).map(([rel, text]) => [rel, Buffer.byteLength(text)]));
  const made = newEpisode({
    id: idOf(n), machine: "Mac Studio", at: "2026-11-04T09:00:00-05:00", video: { file: `${stem}.mov`, bytes: sizes[`${stem}.mov`], seconds: 60, created: null }, kind: null, writer: { commit: "c709b57", on: "Mac Studio" },
    files: sizes, label: `Video of 4 Nov, 0${n}:00 (Mac Studio)`, fingerprint: `fp${n}`, answer: { state: "needs your answer", guess: "raw", seen: "wide, 1:00, no retakes", came: "camera", match: null }
  });
  const next = {
    ...made, rev: 2, ...(local ? { local: { on: "Mac Studio" } } : {}),
    answer: { ...made.answer, state: "part", by: "Mac Studio", on: "Mac Studio", at: `2026-11-04T09:3${n}:00-05:00`, private: "no" },
    partOf: { id: `e-${day(t).replaceAll("-", "")}-400000`, as: "talking", shot: null, client: false }
  };
  writeFileSync(recordFile(folder, 2), recordText({ ...next, version: layoutOf(next) }));
  return { name, folder, own, stem, record: readEpisode(folder).record };
}
const joinRun = (t, ids) => on(t.studio, "join", "--now", FOLDER(t), "--parts", ids.join(","));
const notStaged = (rels) => rels.filter((rel) => !rel.startsWith("record/"));

describe("the join of a plan kept on this Mac", () => {
  it("one part: its video and the files of its light import are cloned into the plan's video/, the plan's record is written as the video, and nothing else is in Dropbox", async () => {
    const t = world();
    const folder = await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const plan = planOf(t);
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 0, r.text);
    const own = episodeFilesFolder(t.home, FOLDER(t));
    for (const rel of ["Take 1.mov", ...Object.keys(LIGHT("Take 1", []))]) assert.equal(readFileSync(join(own, rel), "utf8"), readFileSync(join(one.own, rel), "utf8"), rel);
    // The plan's folder in Dropbox holds its package and its records, and no media.
    assert.deepEqual(notStaged(listAll(folder)), ["shot list.md", "teleprompter.txt", "video guide.md"]);
    const now = planOf(t);
    assert.deepEqual([now.rev, now.kind, now.id, isFromPlan(now), isPlannedRecord(now), now.local], [plan.rev + 1, "raw", plan.id, true, false, { on: "Mac Studio" }]);
    assert.equal(episodeFault(now), "");
    assert.equal(now.files["Take 1.mov"], statSync(join(own, "Take 1.mov")).size);
    // The part stays its own episode, with its own video.
    assert.ok(existsSync(join(one.own, "Take 1.mov")));
    t.done();
  });
  it("one part: no pending is written, the launch agent is not asked to look, and the notice is the plain one", async () => {
    const t = world();
    await planned(t);
    const one = part(t, 1, { words: SCRIPT[0].split(" ") });
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 0, r.text);
    assert.deepEqual(readPendings(t.home), []);
    assert.deepEqual(t.kicks, []);
    assert.deepEqual(t.notices, [READY]);
    assert.ok(!t.said().includes("Dropbox"), t.said());
    t.done();
  });
  it("several parts: the joined video is in the plan's video/, with the files read of it, and no pending is written", async () => {
    const t = world();
    const folder = await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    const r = await joinRun(t, [a.record.id, b.record.id]);
    assert.equal(r.code, 0, r.text);
    const own = episodeFilesFolder(t.home, FOLDER(t));
    assert.equal(readFileSync(join(own, "Too many SKUs.mov"), "utf8"), "the joined video");
    for (const ending of ["srt", "transcript.txt", "words.json", "cut-plan.json", "cut-plan.txt", "rough-cut.srt", "rough-cut.transcript.txt"]) assert.ok(existsSync(join(own, `Too many SKUs.${ending}`)), ending);
    assert.deepEqual(notStaged(listAll(folder)), ["shot list.md", "teleprompter.txt", "video guide.md"]);
    const now = planOf(t);
    assert.deepEqual([now.kind, now.video.file, isFromPlan(now), now.local], ["raw", "Too many SKUs.mov", true, { on: "Mac Studio" }]);
    assert.equal(episodeFault(now), "");
    assert.deepEqual(readPendings(t.home), []);
    assert.deepEqual(t.kicks, []);
    assert.deepEqual(t.notices, [READY]);
    // The parts stay their own episodes.
    assert.ok(existsSync(join(a.own, "Take 1.mov")) && existsSync(join(b.own, "Take 2.mov")));
    t.done();
  });
  it("starts the reading and the copy of the joined video at once, from the plan's video/", async () => {
    const t = world();
    await planned(t);
    const a = part(t, 1, { words: SCRIPT[0].split(" ") });
    const b = part(t, 2, { words: SCRIPT[1].split(" ") });
    assert.equal((await joinRun(t, [a.record.id, b.record.id])).code, 0);
    const started = t.started.map(([, args]) => args.slice(1).join(" "));
    assert.ok(started.some((s) => s.startsWith(`read --now ${FOLDER(t)}`)), started.join(" | "));
    assert.ok(started.some((s) => s === `workcopy --now ${FOLDER(t)}`), started.join(" | "));
    t.done();
  });
  it("a plan whose footage began before the switch has no local and is joined the old way: into Dropbox, with a late check", async () => {
    const t = world();
    const folder = await planned(t, { local: false });
    const one = part(t, 1, { words: SCRIPT[0].split(" "), local: false });
    const r = await joinRun(t, [one.record.id]);
    assert.equal(r.code, 0, r.text);
    assert.ok(existsSync(join(folder, "Take 1.mov")));
    assert.equal(planOf(t).local, undefined);
    assert.equal(readPendings(t.home).length, 1);
    t.done();
  });
});
