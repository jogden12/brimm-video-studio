// Episodes filed before a Mac's switch keep the old way (Phase 3, the local working folder; L8, design D9). A Mac that has switched to a drop
// folder of its own (its settings hold `dropPath` and `exportsPath`) still holds episodes whose files are in Dropbox, at layout 4 and 5: a raw
// video, a finished video, a plan with a part. Each works as it did until it is handed off: its files are looked for in its folder in Dropbox,
// its reading waits for its own late check, its project is made from the recording in Dropbox, its finish checks its copies in its own run, and
// the guide still ends its "taken" step with the words that free its space. Nothing of it is looked for in a video/ folder, nothing is moved
// into Original files/, and no pending is left that today's finish does not leave. These tests are the net every later task of Phase 3 keeps
// green: most pass when they are written, since they pin what already works. Nothing here runs a real program or touches Dropbox: the root
// and the home are a test's own folders, and the programs are the stand-ins of episodes.js, exports-world.js and join.test.js's world.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { editMain, finishEpisode } from "../edit.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { finishNow } from "../finish.js";
import { readPendings, writePending } from "../filing.js";
import { newEpisode, readEpisode, layoutOf, recordFile, recordText } from "../episode.js";
import { fileSafe } from "../names.js";
import { localDay } from "../shared/text.js";
import { episodeFilesFolder, pendingFolder, writeSettings } from "../settings.js";
import { workCopyKey, workCopyPaths } from "../workcopy.js";
import { clockAt } from "../unedited.js";
import { writeStatus } from "../importing.js";
import { FOLDER, ID, NAME, episodeFor, listAll, otherMac, reread, setup } from "./episodes.js";
import { fw, exportOf, world as appWorld } from "./exports-world.js";
import { guideWorld, depsOf as guideDeps } from "./guide-world.js";
import { probed, TOLD, PAUSES, SRT } from "./fixtures.js";
import { wordsOf, pausesOf, phrasesOf, cutPlan, planText, roughCaptions, keptSpans } from "../cuts.js";
import { rawProbe } from "./phase4.js";

const STUDIO = "Mac Studio";

/** Run a command of edit.js by its deps: { code, said, text }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said, text: said.join("\n") };
}

/** The Mac of a test switched to a drop folder of its own and an exports folder (D8): its settings hold both, as `install.sh --drop-folder
    --exports-folder` leaves them. The folders are the test's own. Gives the settings added. */
function switchMac(t) {
  const patch = { dropPath: join(t.home, "BRIMM Video Work", "Drop"), exportsPath: join(t.dir, "exports") };
  mkdirSync(patch.dropPath, { recursive: true });
  mkdirSync(patch.exportsPath, { recursive: true });
  writeSettings(t.home, patch);
  t.ctx.settings = { ...t.ctx.settings, ...patch };
  return patch;
}
/** Every file a test left in this Mac's pending folder, by its path from there. */
const pendingTree = (home) => listAll(pendingFolder(home));

describe("an episode filed before the switch, on a Mac that has switched: a raw video", () => {
  it("is listed by `episodes` with its files checked in its folder in Dropbox, and no line of being on a Mac", async () => {
    const w = fw();
    try {
      switchMac(w.t);
      const ok = await on(w.t.ctx.deps, "episodes");
      assert.equal(ok.code, 0, ok.text);
      assert.doesNotMatch(ok.text, /is on |It is on|on the Mac Studio|missing|not all here/, ok.text);
      assert.ok(ok.said.some((line) => line.startsWith("  Pricing: what to charge?: ")), ok.text);
      // A file of it missing from its folder in Dropbox is said: the files are looked for there, not in a video/ folder of this Mac's.
      assert.equal(existsSync(episodeFilesFolder(w.t.home, FOLDER)), false);
      writeFileSync(join(w.found.folder, "Pricing talk.srt"), "");
      const short = await on(w.t.ctx.deps, "episodes");
      const told = short.said.filter((line) => line.startsWith("    A file of this video"));
      assert.equal(told.length, 1, short.text);
      assert.match(told[0], /Pricing talk\.srt/);
    } finally {
      w.t.done();
    }
  });
  /** The answered finished video of the made-up episode, kept in Dropbox (an episode from before the switch, with no `local`), on a Mac that has switched, with
      the late check of its import still to come: this Mac's, last copy 5 minutes ago. */
  function owing() {
    const t = setup();
    writeSettings(t.home, { app: "hyperframes" });
    t.ctx.settings = { ...t.ctx.settings, app: "hyperframes" };
    switchMac(t);
    const found = episodeFor(t, { record: { version: 3, kind: "finished", answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: STUDIO, at: "2026-10-20T15:00:00-05:00", private: "no" }, name: { text: NAME, placeholder: false } } });
    writePending(t.home, { version: 1, id: ID, name: FOLDER, folder: found.folder, video: "Pricing talk.mp4", bytes: 1, seconds: 120, drop: "/drop", work: "/work", entries: [], lastCopy: t.now() - 5 * 60 * 1000, root: t.root, machine: STUDIO, planTxt: "x.txt" });
    return { t, found, due: t.now() - 5 * 60 * 1000 + LATE_CHECK_MS };
  }
  it("is read the old way by `kind … raw --private no --again`: the reading and the copy are started on its folder in Dropbox, and it waits for the late check another Mac's import still owes", async () => {
    const { t, found, due } = owing();
    try {
      // The other Mac's import of the same video is at work: its late check is not this Mac's to keep in step, so the reading waits for it.
      writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 7, import: "k3j9x", video: "Pricing talk.mp4", bytes: found.record.video.bytes, seconds: 120, step: "Waiting for its late check", at: "2026-10-20T15:00:00-05:00", label: "x" }, (to, text) => writeFileSync(to, text));
      const before = pendingTree(t.home);
      const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, new RegExp(`Claude reads it at ${clockAt(due)}, when the import has checked its copies\\.`), r.text);
      assert.deepEqual(t.started.map(([, args]) => args.slice(1)), [["read", "--now", FOLDER, "--kind", "raw", "--rev", "3"], ["workcopy", "--now", FOLDER]]);
      // The reading's files go where the record's files are: its folder in Dropbox. Nothing is made in a video/ folder.
      assert.equal(readEpisode(found.folder).record.local, undefined);
      assert.equal(existsSync(episodeFilesFolder(t.home, FOLDER)), false);
      assert.deepEqual(pendingTree(t.home), before);
    } finally {
      t.done();
    }
  });
  it("keeps this Mac's own late check in step with a reading when only its own import is owed: the reading starts at once, and the check is due 15 minutes after the last copy", async () => {
    const { t, found, due } = owing();
    try {
      const { lateCheckAt, readingWaitsUntil } = await import("../late-wait.js");
      assert.equal(lateCheckAt(t.ctx, found.record), due);
      assert.equal(readingWaitsUntil(t.ctx, found.record), null);
      const r = await on(t.ctx.deps, "kind", NAME, "raw", "--private", "no", "--again");
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /^Claude is still reading /, r.text);
      assert.equal(readPendings(t.home).length, 1, "the check is still owed");
    } finally {
      t.done();
    }
  });
  it("has `app` make its project from the recording in its folder in Dropbox", async () => {
    const w = appWorld({ projects: null });
    try {
      switchMac(w.t);
      const raw = readFileSync(join(w.found.folder, "Pricing talk.mp4"));
      assert.ok(raw.length > 0);
      // The working copy is keyed by the recording in Dropbox, as it always was: made already, so the project is made at once.
      const stat = statSync(join(w.found.folder, "Pricing talk.mp4"));
      const paths = workCopyPaths(w.t.home, FOLDER, workCopyKey({ bytes: stat.size, mtimeMs: stat.mtimeMs }));
      mkdirSync(dirname(paths.video), { recursive: true });
      writeFileSync(paths.video, "the working copy's bytes");
      writeFileSync(paths.facts, JSON.stringify({ seconds: 23.423, fps: 30, width: 1280, height: 720, bytes: 24 }));
      writeFileSync(join(w.t.home, "hyperframes-stand-in.json"), JSON.stringify({ open: "opened" }));
      const standIn = fileURLToPath(new URL("./stand-ins/hyperframes.mjs", import.meta.url));
      const guidance = fileURLToPath(new URL("./fixtures/hyperframes-0.8.208/init/CLAUDE.md", import.meta.url));
      const r = await on({ ...w.t.ctx.deps, app: { cli: standIn, node: process.execPath, guidance } }, "app", FOLDER);
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /It's open in HyperFrames\./, r.text);
      const project = reread(w.found).app.projects.find((p) => p.key === "main");
      assert.ok(project, "the record holds the main project");
      assert.deepEqual([project.from.file, project.from.bytes], ["Pricing talk.mp4", stat.size]);
      assert.equal(reread(w.found).local, undefined);
      assert.equal(existsSync(episodeFilesFolder(w.t.home, FOLDER)), false);
    } finally {
      w.t.done();
    }
  });
});

describe("an episode filed before the switch, on a Mac that has switched: its finish", () => {
  /** What a finish of the made-up raw video leaves: the files in final/, the record's finished mark, and every file of the pending folder. */
  async function finished(w) {
    exportOf(w, "main");
    exportOf(w, "reel 2");
    assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
    const found = { ...w.found, record: reread(w.found) };
    const result = await finishNow(w.t.ctx, found);
    return { found, result };
  }
  it("writes its hand-off, waits for its own late check as today, and leaves under pending/ what an unswitched Mac's finish leaves", async () => {
    const control = fw();
    const w = fw();
    try {
      const was = await finished(control);
      switchMac(w.t);
      const waits = [];
      const wait = w.t.ctx.deps.wait;
      w.t.ctx.deps.wait = async (ms) => {
        waits.push(ms);
        return wait(ms);
      };
      const now = await finished(w);
      assert.equal(now.result.ok, true, now.result.failed.join(" "));
      assert.equal(was.result.ok, true, was.result.failed.join(" "));
      assert.ok(waits.includes(LATE_CHECK_MS), `the finish waited for its late check: ${waits}`);
      assert.ok(existsSync(join(now.found.folder, "final", "Pricing- what to charge-.brimm-ops.json")));
      assert.equal(reread(w.found).finished.revision, 1);
      assert.equal(reread(w.found).local, undefined);
      assert.deepEqual(pendingTree(w.t.home), pendingTree(control.t.home));
    } finally {
      w.t.done();
      control.t.done();
    }
  });
  it("is refused a spelling from the other Mac while its late check runs, in today's words", async () => {
    const w = fw();
    try {
      switchMac(w.t);
      exportOf(w, "main");
      exportOf(w, "reel 2");
      assert.equal(await finishEpisode(w.t.ctx, w.found, { yes: true }), 0, w.t.said());
      const found = { ...w.found, record: reread(w.found) };
      const her = otherMac(w.t);
      her.settings = { ...her.settings, app: "hyperframes", handoffVersion: 2 };
      let refused = null;
      const wait = w.t.ctx.deps.wait;
      w.t.ctx.deps.wait = async (ms) => {
        if (ms === LATE_CHECK_MS) refused = await on(her.deps, "spell", FOLDER, "add", "Sallie", "Sally");
        return wait(ms);
      };
      const result = await finishNow(w.t.ctx, found);
      assert.equal(result.ok, true, result.failed.join(" "));
      assert.equal(refused.code, 1, refused.text);
      assert.match(refused.text, /^The finish on Mac Studio is still checking its copies in final\/, until 2026-10-20 \d\d:17\. Say it again after that\. Nothing was changed\.$/);
    } finally {
      w.t.done();
    }
  });
  it("moves nothing into Original files/ after its hand-off, and leaves its recording where it is", async () => {
    const w = fw();
    try {
      switchMac(w.t);
      const { found } = await finished(w);
      assert.equal(existsSync(join(found.folder, "Original files")), false);
      assert.equal(existsSync(join(pendingFolder(w.t.home), "original")), false);
      assert.ok(!pendingTree(w.t.home).some((rel) => rel.startsWith("original")), pendingTree(w.t.home).join(", "));
      assert.ok(existsSync(join(found.folder, "Pricing talk.mp4")), "the recording stays in its folder in Dropbox");
    } finally {
      w.t.done();
    }
  });
});

describe("the guide's step after the page's \"taken\" step, on a Mac that has switched", () => {
  const TAKE = 'On the BRIMM Ops page: Drag the hand-off onto Episodes. If the page says it is a new episode, press "Add the episode and take the hand-off". If it opens an episode, press "Take the hand-off". If the page already holds an older revision, press "Take revision N in place of revision M", with the numbers it shows.';
  const ONLINE = ' Once Dropbox shows the episode\'s folder is up to date, Control-click it in Finder and choose "Make online-only".';
  const FINISHED = { revision: 1, at: "2026-10-20T10:00:00-05:00", on: STUDIO, handoff: "final/Pricing talk.brimm-ops.json", parts: {} };
  /** The made-up episode with its hand-off in final/, as a finish writes one, on a Mac that has switched. `local` keeps the record on this Mac. */
  function handedOff(local) {
    const w = guideWorld({ over: { finished: FINISHED, ...(local ? { version: 6, local: { on: STUDIO } } : {}) } });
    switchMac(w.t);
    mkdirSync(join(w.found.folder, "final"), { recursive: true });
    writeFileSync(join(w.found.folder, "final", "Pricing talk.brimm-ops.json"), JSON.stringify({ format: "brimm-video hand-off", version: 2, revision: 1, video: { id: ID, kind: "raw", name: "Pricing talk" }, main: { file: "Pricing talk.mov" } }));
    return w;
  }
  const line = async (w) => {
    const r = await on(guideDeps(w), "guide", "3fa9c1");
    assert.equal(r.code, 0, r.text);
    return r.said[0];
  };
  it("ends an old raw episode's with the \"Make online-only\" sentence", async () => {
    const w = handedOff(false);
    try {
      assert.equal(await line(w), `Pricing: what to charge? (3fa9c1): ${TAKE}${ONLINE}`);
    } finally {
      w.t.done();
    }
  });
  it("ends a local raw episode's without it: its recording is not in Dropbox to free", async () => {
    const w = handedOff(true);
    try {
      const step = await line(w);
      assert.ok(step.startsWith("Pricing: what to charge? (3fa9c1): " + TAKE), step);
      assert.doesNotMatch(step, /online-only/);
    } finally {
      w.t.done();
    }
  });
  it("keeps the sentence in opsText for a raw hand-off with no local, and leaves it off with one, for every other step as today", async () => {
    const { opsText } = await import("../guide.js");
    const raw = { kind: "raw", revision: 1 };
    assert.equal(opsText(raw, "taken", false, null), TAKE.replace("On the BRIMM Ops page: ", "") + ONLINE);
    assert.equal(opsText(raw, "taken", false, null, false), TAKE.replace("On the BRIMM Ops page: ", "") + ONLINE);
    assert.equal(opsText(raw, "taken", false, null, true), TAKE.replace("On the BRIMM Ops page: ", ""));
    // Another kind's words, and another step's, are the same either way.
    for (const handoff of [{ kind: "finished", revision: 1 }, { kind: "short video", revision: 1 }]) assert.equal(opsText(handoff, "taken", false, null, true), opsText(handoff, "taken", false, null, false));
    assert.equal(opsText(raw, "kit", false, null, true), opsText(raw, "kit", false, null, false));
  });
});

describe("an old raw episode's own reading, on a Mac that has switched", () => {
  const VIDEO = "Pricing talk.mp4";
  const HEARD = pausesOf(PAUSES);
  const WORDS = wordsOf(TOLD);
  const RULES = cutPlan(phrasesOf(WORDS, HEARD), { duration: 23.423, pauses: HEARD });
  const FACTS = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
  const PLAN = { version: 1, video: VIDEO, facts: FACTS, phrases: RULES.phrases, ranges: RULES.ranges, kept: RULES.kept, cut: RULES.cut, pauses: HEARD, by: "rules" };
  const FILES = {
    [VIDEO]: "the raw video",
    "Pricing talk.cut-plan.json": JSON.stringify(PLAN, null, 2) + "\n",
    "Pricing talk.cut-plan.txt": planText(RULES, "The rules' alone."),
    "Pricing talk.words.json": JSON.stringify({ video: VIDEO, duration: 23.423, words: WORDS }, null, 2) + "\n",
    "Pricing talk.srt": SRT,
    "Pricing talk.transcript.txt": "the transcript",
    "Pricing talk.rough-cut.srt": roughCaptions(RULES.phrases, keptSpans(RULES.ranges, FACTS.fps)),
    "Pricing talk.rough-cut.transcript.txt": "the rough cut's transcript"
  };
  const REPLY = { decisions: [], notes: "Open on the welcome.", graphicCues: [], clips: [{ from: "p4", to: "p5", hook: "What this is about", why: "It says what the talk is about.", point: "Pricing is the subject." }], spellings: [] };
  const STATUS = { loggedIn: true, authMethod: "claude.ai", email: "sallie@example.com", orgName: "BRIMM" };
  it("puts its files into its folder in Dropbox, writes nothing under video/, and waits for its own late check of them (LATE_CHECK_MS)", async () => {
    const t = setup({
      programs: {
        FFPROBE: rawProbe,
        CLAUDE: (args) => (args.includes("auth") ? { code: 0, stderr: "", stdout: JSON.stringify(STATUS) } : { code: 0, stderr: "", stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(REPLY) }) })
      }
    });
    try {
      t.ctx.deps.tools = { ...t.ctx.deps.tools, claude: "CLAUDE" };
      t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
      t.ctx.deps.notify = () => {};
      switchMac(t);
      const at = "2026-10-20T15:00:00-05:00";
      const found = episodeFor(t, { record: { version: 3, kind: "raw", answer: { state: "answered", guess: "raw", seen: "wide", came: "camera", match: null, by: STUDIO, on: STUDIO, at, private: "no" }, label: "Video of 14 Oct, 09:12 (Mac Studio)", editing: { by: STUDIO, since: at } }, files: FILES });
      const before = readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8");
      const r = await on(t.ctx.deps, "read", "--now", FOLDER, "--kind", "raw", "--rev", "1");
      assert.equal(r.code, 0, r.text);
      // What it read went into the episode's folder in Dropbox, by the rule: its reels.json and cut plan were put in there.
      assert.ok(existsSync(join(found.folder, "reels.json")));
      assert.notEqual(readFileSync(join(found.folder, "Pricing talk.cut-plan.json"), "utf8"), before);
      assert.ok(t.clones.some(([, to]) => to === join(found.folder, "reels.json")), "cloned into Dropbox's folder");
      assert.equal(reread(found).reading.outcome, "read");
      assert.equal(reread(found).local, undefined);
      assert.equal(existsSync(episodeFilesFolder(t.home, FOLDER)), false, "nothing is written under video/");
      assert.ok(t.waits.includes(LATE_CHECK_MS), `waits: ${t.waits}`);
    } finally {
      t.done();
    }
  });
});

// --- A plan from before the switch, and a part dropped after it ---

const TITLE = "Too many SKUs";
const SCRIPT = [
  "Too many SKUs will sink a small shop before it ever finds its footing.",
  "The first thing you need to do is count what you actually sell each week.",
  "Then cut the bottom fifth of the list and watch what happens to your cash."
];
const SHOT_ARGS = ["--shot", "talking | Open on the problem, to the camera.", "--shot", "talking | Why it matters, to the camera.", ...SCRIPT.flatMap((line) => ["--line", line])];
const WIDE = (duration) => probed({ picture: { codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "30/1", avg_frame_rate: "30/1", pix_fmt: "yuv420p" }, sound: { codec_name: "aac", sample_rate: "48000", channels: 2 }, duration });
const LIGHT_NAMES = (stem) => ["srt", "transcript.txt", "words.json", "cut-plan.json", "cut-plan.txt", "rough-cut.srt", "rough-cut.transcript.txt"].map((e) => `${stem}.${e}`);
const LIGHT = (stem, words) => ({
  [`${stem}.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.transcript.txt`]: "[0:00] words\n",
  [`${stem}.words.json`]: JSON.stringify({ video: `${stem}.mov`, duration: 60, words: words.map((w, i) => ({ w, start: i, end: i + 1 })) }),
  [`${stem}.cut-plan.json`]: JSON.stringify({ version: 1, video: `${stem}.mov` }),
  [`${stem}.cut-plan.txt`]: "The cut plan.\n",
  [`${stem}.rough-cut.srt`]: "1\n00:00:00,000 --> 00:00:04,000\n words\n",
  [`${stem}.rough-cut.transcript.txt`]: "[0:00] words\n"
});

describe("a plan filed before the switch, on a Mac that has switched", () => {
  /** A Mac with the plan's stand-ins: ffprobe says every part is a wide minute, and ffmpeg's concat writes the joined file, writing down the list it joins. */
  function planWorld() {
    const lists = [];
    const t = setup({
      programs: {
        FFPROBE: (args) => {
          const name = args[args.length - 1].split("/").pop();
          writeFileSync(args[args.indexOf("-o") + 1], WIDE(name === `${fileSafe(TITLE)}.mov` ? "120.000000" : "60.000000"));
          return { code: 0, stderr: "" };
        },
        FFMPEG: (args) => {
          if (args.includes("concat")) {
            lists.push(readFileSync(args[args.indexOf("-i") + 1], "utf8"));
            writeFileSync(args[args.length - 1], "the joined video");
            return { code: 0, stderr: "" };
          }
          if (args[args.length - 1] !== "-") writeFileSync(args[args.length - 1], "RIFF");
          return { code: 0, stderr: "" };
        }
      }
    });
    t.ctx.deps.kickstart = () => {};
    return { t, lists };
  }
  const depsOf = (t) => ({ ...t.ctx.deps, rand: () => 0.25, settings: { ...t.ctx.settings, app: "hyperframes" } });
  const dayOf = (t) => localDay(new Date(t.now()));
  const planFolder = (t) => join(t.root, "Episodes", `${dayOf(t)} ${fileSafe(TITLE)} (${STUDIO})`);
  const planId = (t) => `e-${dayOf(t).replaceAll("-", "")}-400000`;
  /** A video answered as a talking part of the plan. Filed before the switch, it is in its own folder in Dropbox; filed after it (`local`), its
      files are in its video/ folder on this Mac and its record is layout 6. */
  function part(t, n, words, local) {
    const name = `2026-11-04 Drop ${n} (${STUDIO})`;
    const folder = join(t.root, "Episodes", name);
    mkdirSync(join(folder, "record"), { recursive: true });
    const stem = `Take ${n}`;
    const files = { [`${stem}.mov`]: `video ${n}`, ...LIGHT(stem, words) };
    const into = local ? episodeFilesFolder(t.home, name) : folder;
    mkdirSync(into, { recursive: true });
    for (const [rel, text] of Object.entries(files)) writeFileSync(join(into, rel), text);
    const sizes = Object.fromEntries(Object.entries(files).map(([rel, text]) => [rel, Buffer.byteLength(text)]));
    const made = newEpisode({
      id: `e-20261104-a${String(n).repeat(5)}`, machine: STUDIO, at: "2026-11-04T09:00:00-05:00", video: { file: `${stem}.mov`, bytes: sizes[`${stem}.mov`], seconds: 60, created: null }, kind: null, writer: { commit: "c709b57", on: STUDIO },
      files: sizes, label: `Video of 4 Nov, 0${n}:00 (${STUDIO})`, fingerprint: `fp${n}`, answer: { state: "needs your answer", guess: "raw", seen: "wide, 1:00, no retakes", came: "camera", match: null }
    });
    const next = { ...made, rev: 2, version: 5, answer: { ...made.answer, state: "part", by: STUDIO, on: STUDIO, at: `2026-11-04T09:3${n}:00-05:00`, private: "no" }, partOf: { id: planId(t), as: "talking", shot: null, client: false }, ...(local ? { version: 6, local: { on: STUDIO } } : {}) };
    writeFileSync(recordFile(folder, 2), recordText(next));
    return { name, folder, record: readEpisode(folder).record, into };
  }
  async function planned(t) {
    assert.equal((await on(depsOf(t), "plan", "new", TITLE)).code, 0);
    const s = await on(depsOf(t), "plan", TITLE, "set", ...SHOT_ARGS);
    assert.equal(s.code, 0, s.text);
    return planFolder(t);
  }
  it("joins the old way: the joined video is filed into the plan's folder in Dropbox, with its pending, and the plan stays at layout 5", async () => {
    const { t } = planWorld();
    try {
      const folder = await planned(t);
      switchMac(t);
      const one = part(t, 1, SCRIPT[0].split(" "), false);
      const started = await on(depsOf(t), "plan", TITLE, "join");
      assert.equal(started.code, 0, started.text);
      assert.deepEqual(t.started[0][1].slice(1), ["join", "--now", `${dayOf(t)} ${TITLE} (${STUDIO})`, "--parts", one.record.id]);
      const run = await on(depsOf(t), "join", "--now", `${dayOf(t)} ${TITLE} (${STUDIO})`, "--parts", one.record.id);
      assert.equal(run.code, 0, run.text);
      assert.ok(existsSync(join(folder, "Take 1.mov")), "the joined video is in the plan's folder in Dropbox");
      for (const rel of LIGHT_NAMES("Take 1")) assert.ok(existsSync(join(folder, rel)), rel);
      const [pending] = readPendings(t.home);
      assert.equal(pending.folder, folder);
      assert.deepEqual(pending.entries.map((e) => dirname(e.to) === folder || dirname(e.to) === join(folder, "record")), pending.entries.map(() => true));
      const now = readEpisode(folder).record;
      assert.deepEqual([now.version, layoutOf(now), now.local], [5, 5, undefined]);
      assert.equal(existsSync(episodeFilesFolder(t.home, `${dayOf(t)} ${TITLE} (${STUDIO})`)), false);
    } finally {
      t.done();
    }
  });
  it("joins a part dropped after the switch from its own video/ folder, into the plan's folder in Dropbox", async () => {
    const { t, lists } = planWorld();
    try {
      const folder = await planned(t);
      switchMac(t);
      const old = part(t, 1, SCRIPT[0].split(" "), false);
      const fresh = part(t, 2, SCRIPT[1].split(" "), true);
      assert.equal(readEpisode(fresh.folder).record.local.on, STUDIO);
      assert.equal(existsSync(join(fresh.folder, "Take 2.mov")), false, "its recording is not in Dropbox");
      const ids = [old.record.id, fresh.record.id].join(",");
      const run = await on(depsOf(t), "join", "--now", `${dayOf(t)} ${TITLE} (${STUDIO})`, "--parts", ids);
      assert.equal(run.code, 0, run.text);
      assert.equal(lists.length, 1);
      assert.ok(lists[0].includes(join(old.into, "Take 1.mov")), lists[0]);
      assert.ok(lists[0].includes(join(fresh.into, "Take 2.mov")), lists[0]);
      const joined = readEpisode(folder).record.video.file;
      assert.ok(existsSync(join(folder, joined)), `the joined video, ${joined}, is in the plan's folder in Dropbox`);
      const [pending] = readPendings(t.home);
      assert.equal(pending.folder, folder);
      assert.deepEqual([readEpisode(folder).record.version, readEpisode(folder).record.local], [5, undefined]);
      assert.equal(existsSync(episodeFilesFolder(t.home, `${dayOf(t)} ${TITLE} (${STUDIO})`)), false);
    } finally {
      t.done();
    }
  });
});
