// finish, the detached part (spec section 5, steps 3 to 9). The quick part, in edit.js, found Final Cut's files and asked what
// it had to; it wrote what it was told in finish.asked.json, on this Mac's own disk, and started this. This part waits until
// each finished video is whole, checks its shape, transcribes it again as the transcript tool does, cuts the parts of a
// Story from a finished Reel of more than a minute, and copies everything into the episode's final/ folder by the Dropbox
// rule, the hand-off last. Then it writes the record, shows the hand-off in Finder, and at least 15 minutes after the last
// copy checks the copies again; only when they are whole does it delete from From Final Cut what it took from there.
// Nothing here asks anything: what a person must check is said in the result, which status shows.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { probeArgs, factsOf, pauseArgs, pausesOf } from "./cuts.js";
import { clipArgs, storyCuts, STORY_MAX } from "./reframe.js";
import { captionsOf, settled } from "./lib.js";
import { firstWordsMatch } from "./parts.js";
import { finalTranscript } from "./final-transcript.js";
import { buildHandoff, handoffText, handoffFault, inMain } from "./handoff.js";
import { cloneIn, replaceIn, lateCheck, textWriter, cloneFile, LATE_CHECK_MS } from "./dropbox.js";
import { readEpisode, writeEpisode, localStamp, recordFile, heldElsewhere } from "./episode.js";
import { fileSafe } from "./names.js";
import { episodeWork, runsFolder } from "./settings.js";
import { noProgress } from "./progress.js";
import { runProgram } from "./run.js";
import { commitOf } from "./filing.js";
import { findPrograms } from "./unedited.js";

/** How often a finished video's size is looked at while Final Cut may still be writing it, and how many looks before the
    finish stops: ten minutes. */
const LOOK_MS = 5000;
const MOST_LOOKS = 120;
/** The steps of a finish, as the progress panel counts them. */
const STEPS = ["Waiting for Final Cut's files", "Checking the files", "Writing the transcripts", "Cutting the Story parts", "Copying into the episode", "Checking the copies"];

const capital = (text) => text[0].toUpperCase() + text.slice(1);
const stem = (name) => basename(name, extname(name));
/** The folder in the run's own where a part's files are made: "main", "reel-1". */
const dirOf = (key) => key.replace(/\s+/g, "-");
const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return null;
  }
};
const sizeOf = (file) => {
  try {
    return statSync(file).size;
  } catch (e) {
    return 0;
  }
};
/** A picture's shape, in words. */
const shapeOf = (w, h) => (h > w ? "upright" : w > h ? "wider than it is tall" : "square");

/** The words of captions, said evenly over each caption: the best that can be done for a video whose word times are missing. */
function wordsOfCaptions(srt) {
  return captionsOf(srt).flatMap((c) => {
    const said = c.text.split(/\s+/).filter(Boolean);
    const each = (c.end - c.start) / Math.max(1, said.length);
    return said.map((w, i) => ({ w, start: c.start + each * i, end: c.start + each * (i + 1) }));
  });
}

/** Every file inside a folder, as paths from it. */
function filesIn(dir, from = dir) {
  let out = [];
  for (const name of readdirSync(dir)) {
    const at = join(dir, name);
    if (statSync(at).isDirectory()) out = out.concat(filesIn(at, from));
    else out.push(relative(from, at));
  }
  return out;
}

/** What ffprobe says of a file, or null when it cannot read it, as of a file Final Cut has not finished writing. */
async function probe(file, work, my) {
  const out = join(work, `facts-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const ended = await my.run(my.tools.ffprobe, probeArgs(file, out));
  const facts = ended.code === 0 && existsSync(out) ? factsOf(readFileSync(out, "utf8")) : null;
  rmSync(out, { force: true });
  return facts;
}

/** Wait until a finished video is whole: its size the same twice, LOOK_MS apart, its blocks all on this Mac, and ffprobe able
    to read it with a length. {facts}, or {why} after ten minutes of waiting. */
async function whole(file, work, my) {
  const sizes = [sizeOf(file)];
  for (let look = 0; look < MOST_LOOKS; look++) {
    await my.wait(LOOK_MS);
    sizes.push(sizeOf(file));
    if (!settled(sizes) || !my.isWhole(file)) continue;
    const facts = await probe(file, work, my);
    if (facts && facts.duration) return { facts };
  }
  return { why: `${basename(file)} is still being written by Final Cut. Say finish again when its Share is done.` };
}

/** What is wrong with a finished video's shape for its part, or "". A Reel is upright. The main video has the raw video's
    shape, so a short upright video's main video is upright. */
function shapeFault(part, name, facts, raw) {
  const shape = shapeOf(facts.width, facts.height);
  if (part.reel) return shape === "upright" ? "" : `${name} is ${shape}, and a Reel is upright.`;
  if (!raw || !raw.width || !raw.height) return "";
  const want = shapeOf(raw.width, raw.height);
  return shape === want ? "" : `${name} is ${shape}, and the main video has the raw video's shape: ${want}.`;
}

/** The words a part is expected to start with: the cut plan's first kept phrase, for a Reel the first from where it starts. */
export function expectedWords(part, record, plan) {
  const phrases = plan && Array.isArray(plan.phrases) ? plan.phrases.filter((p) => p.keep) : [];
  const reel = part.reel ? (record.reels || []).find((r) => r.n === part.reel) : null;
  const first = reel ? phrases.find((p) => p.start >= reel.from - 0.25) : phrases[0];
  return first ? String(first.text).trim() : "";
}

/** A file or an export bundle as it is when finish takes it: its size and time, or for a bundle each file's. */
function snapshot(path) {
  if (statSync(path).isDirectory()) return { files: Object.fromEntries(filesIn(path).map((rel) => [rel, snapshot(join(path, rel))])) };
  const now = statSync(path);
  return { size: now.size, mtimeMs: now.mtimeMs };
}
/** Is a file or a bundle still as it was when it was taken? */
function unchanged(path, snap) {
  try {
    if (snap.files) {
      const now = filesIn(path);
      return now.length === Object.keys(snap.files).length && now.every((rel) => snap.files[rel] && unchanged(join(path, rel), snap.files[rel]));
    }
    const now = statSync(path);
    return now.size === snap.size && now.mtimeMs === snap.mtimeMs;
  } catch (e) {
    return false;
  }
}
/** Take a file or a bundle into the run's own folder, as a clone: what finish works from and copies into final/, whatever
    happens to the original after. */
function takeCopy(from, to, clone) {
  if (statSync(from).isDirectory()) {
    for (const rel of filesIn(from)) takeCopy(join(from, rel), join(to, rel), clone);
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  clone(from, to);
}
/** The version a finished file is of: the push whose project name it bears. */
function versionOf(record, part, name) {
  const pushed = part.reel ? ((record.reels || []).find((r) => r.n === part.reel) || {}).pushed : record.main && record.main.pushed;
  const own = String(stem(name)).normalize("NFC");
  const push = (Array.isArray(pushed) ? pushed : []).find((p) => String(p.project).normalize("NFC") === own);
  return push ? push.v : undefined;
}
/** The highest revision of a hand-off of this episode already in final/: a revision is never used twice, even when the
    record of the last finish was never written. */
function lastRevision(finalDir, id) {
  let most = 0;
  let names = [];
  try {
    names = readdirSync(finalDir).filter((n) => n.endsWith(".brimm-ops.json"));
  } catch (e) {
    return 0;
  }
  for (const name of names) {
    const h = readJson(join(finalDir, name));
    if (h && h.episode && h.episode.id === id && Number.isInteger(h.revision)) most = Math.max(most, h.revision);
  }
  return most;
}

/** Is there a record of the episode numbered above `n`? */
function laterRecord(folder, n) {
  try {
    return readdirSync(join(folder, "record")).some((name) => /^\d+\.json$/.test(name) && Number.parseInt(name, 10) > n);
  } catch (e) {
    return false;
  }
}

/** Do finish's detached work for an episode, as finish.asked.json says. Resolves {ok, made, failed, next}, which runDetached
    writes as the finish's result: `made` the files copied into final/, `failed` what went wrong, `next` what a person is to
    check by eye, and the offers. Nothing is thrown from here. `deps.lateCheck` stands in for the late check in a test. */
/** Let go the claim a finish's quick part took for an episode nobody had open, when the finish did not write its record: the
    episode goes back to as it was. Only while the record is still the one the claim wrote, and still this Mac's. Gives
    back what to say, or "" when there was nothing to let go (the P1 check, T4 and T17). */
export function letGoClaim(ctx, found) {
  const asked = readJson(join(episodeWork(ctx.home, found.name), "finish.asked.json"));
  if (!asked || !asked.claimed) return "";
  const now = readEpisode(found.folder);
  if (!now.record || now.record.rev !== asked.rev || !now.record.editing || now.record.editing.by !== ctx.machine) return "";
  const opts = { ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) };
  const work = join(runsFolder(ctx.home), `let-go-${process.pid}-${Date.now()}`);
  try {
    writeEpisode(found.folder, { ...now.record, editing: null }, { expectRev: asked.rev, writeText: textWriter({ work, ...opts }), writer: { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine }, home: ctx.home });
    return "The episode is let go again, as it was before the finish.";
  } catch (e) {
    // A record written since (one not whole yet, say: the other Mac's take-over on its way) is not this Mac's claim to keep
    // (round 3, t1-5).
    if (e.code === "CHANGED") return "The episode changed on the other Mac while finish ran, so nothing was let go here: say open to see who has it now.";
    return `This Mac still has the episode open: it could not be let go (${String(e.message).replace(/\.$/, "")}). Say "hand it to Jason", or open it on the other Mac with "take it over".`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export async function finishNow(ctx, found, deps = {}) {
  const progress = deps.progress || noProgress;
  const check = deps.lateCheck || lateCheck;
  const made = [];
  const failed = [];
  const next = [];
  const result = () => ({ ok: failed.length === 0, made, failed, next: next.join(" ") });
  // The programs, the clock's waits and the clone, as this Mac has them unless a test gives others.
  const tools = ctx.deps.tools || findPrograms();
  const my = { run: ctx.deps.run || runProgram, tools, model: tools.model, wait: ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))), isWhole: ctx.isWhole };
  const opts = { ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) };
  const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
  // The run's own folder is on the same disk as Dropbox, so what is made in it can be cloned in.
  // Named for this process, so a run that dies leaves nothing clearRuns keeps.
  const work = join(runsFolder(ctx.home), `finish-${process.pid}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  let ended = false;
  // Whether its record was written, and whether a record it wrote let its claim go already.
  let recordWritten = false;
  let letGoneAlready = false;
  try {
    const asked = readJson(join(episodeWork(ctx.home, found.name), "finish.asked.json"));
    if (!asked) {
      failed.push("Nothing says what to finish: say finish first.");
      return result();
    }
    const read = readEpisode(found.folder);
    if (!read.record) {
      failed.push(read.why);
      return result();
    }
    const record = read.record;
    if (record.rev !== asked.rev) {
      failed.push("The episode changed since finish was asked. Say finish again.");
      return result();
    }
    progress.begin(record.name.text);
    progress.steps(STEPS);
    const before = (record.finished && record.finished.parts) || {};
    const parts = asked.parts.map((p) => ({ ...p, path: p.video ? join(p.video.dir, p.video.name) : "" }));

    // Each new finished video whole, and its facts. Then the video, and its export, are taken into the run's own folder as
    // clones, with their sizes and times: everything after works from what was taken.
    progress.step("Waiting for Final Cut's files");
    const clone = ctx.deps.clone || cloneFile;
    for (const part of parts.filter((p) => !p.kept)) {
      const got = await whole(part.path, work, my);
      if (got.why) {
        failed.push(got.why);
        continue;
      }
      part.dir = join(work, dirOf(part.key));
      part.snap = snapshot(part.path);
      part.video = { ...part.video, bytes: part.snap.size, mtimeMs: part.snap.mtimeMs };
      part.copy = join(part.dir, "taken", part.video.name);
      takeCopy(part.path, part.copy, clone);
      // The facts of what was taken, which is what goes into final/.
      const facts = await probe(part.copy, work, my);
      if (!facts || !facts.duration) {
        failed.push(`${part.video.name} could not be read once it was taken. Say finish again.`);
        continue;
      }
      part.facts = facts;
      if (part.export) {
        part.exportPath = join(part.export.dir, part.export.name);
        part.exportSnap = snapshot(part.exportPath);
        part.exportCopy = join(part.dir, "taken", part.export.name);
        takeCopy(part.exportPath, part.exportCopy, clone);
      }
    }
    if (failed.length) return result();

    // Its shape, before anything is transcribed.
    progress.step("Checking the files");
    const plan = readJson(join(found.folder, `${stem(record.video.file)}.cut-plan.json`));
    for (const part of parts.filter((p) => !p.kept)) {
      const wrong = shapeFault(part, part.video.name, part.facts, plan && plan.facts);
      if (wrong) failed.push(wrong);
    }
    if (failed.length) return result();

    // The transcripts: made again for a video that is new, read back from final/ for one that is not. Word times are read
    // back only when the last finish recorded them for that video, never from a file an earlier cut left there.
    progress.step("Writing the transcripts");
    const finalDir = join(found.folder, "final");
    for (const part of parts) {
      const was = before[part.key];
      const same = !part.kept && was && was.source && was.source.bytes === part.video.bytes && was.source.mtimeMs === part.video.mtimeMs;
      if (part.kept || same) {
        const name = basename(was.file);
        part.name = name;
        part.seconds = was.seconds;
        part.srt = readFileSync(join(finalDir, `${stem(name)}.srt`), "utf8");
        const words = was.words ? readJson(join(found.folder, was.words)) : null;
        part.words = words && Array.isArray(words.words) ? words.words : null;
        part.reused = true;
        continue;
      }
      part.name = part.video.name;
      part.seconds = part.facts.duration;
      const heard = await finalTranscript(part.copy, join(part.dir, "heard"), { run: my.run, tools: my.tools, model: my.model, spellings: record.spellings || [] });
      if (heard.why) {
        failed.push(`No transcript could be made of ${part.name}: ${heard.why}.`);
        continue;
      }
      Object.assign(part, { srt: heard.srt, txt: heard.txt, words: heard.words, wav: heard.wav });
      if (heard.untimed) next.push(`Word times are missing for ${part.name}: ${heard.untimed}.`);
      const expected = expectedWords(part, record, plan);
      const opening = captionsOf(heard.srt).map((c) => c.text).join(" ");
      if (expected && !firstWordsMatch(expected, opening)) {
        const first = (captionsOf(heard.srt)[0] || { text: "" }).text;
        next.push(`${capital(part.label)} starts with "${first}", where "${expected}" was expected: check by eye that it is the right video.`);
      }
      const stemmed = join(part.dir, stem(part.name));
      writeFileSync(`${stemmed}.srt`, heard.srt);
      writeFileSync(`${stemmed}.transcript.txt`, heard.txt);
      if (heard.words) writeFileSync(`${stemmed}.words.json`, JSON.stringify({ video: part.name, duration: part.seconds, words: heard.words }, null, 2) + "\n");
    }
    if (failed.length) return result();

    // The parts of a Story, from each new finished Reel of more than a minute. Until a preset's job says which Reels go to
    // Stories (phase 4), every one of more than a minute does.
    progress.step("Cutting the Story parts");
    for (const part of parts.filter((p) => p.reel && !p.reused && p.seconds > STORY_MAX)) {
      const heard = await my.run(my.tools.ffmpeg, pauseArgs(part.wav, part.seconds), { keep: 1000000 });
      const pauses = heard.code === 0 ? pausesOf(heard.stderr) : [];
      part.story = [];
      for (const [k, cut] of storyCuts(part.seconds, { pauses, words: part.words || [], fps: part.facts.fps }).entries()) {
        const out = join(part.dir, `${stem(part.name)}.story-${k + 1}.mp4`);
        const encoded = await my.run(my.tools.ffmpeg, clipArgs({ video: part.copy, start: cut.start, end: cut.end, crop: null, out }));
        if (encoded.code !== 0 || !existsSync(out)) failed.push(`Part ${k + 1} of the Story of ${part.label} could not be cut.`);
        else part.story.push(out);
      }
    }

    // The hand-off, from what each part is now. Its revision is one more than any before it, in the record or in final/.
    const main = parts.find((p) => p.key === "main");
    const mainWords = main.words || wordsOfCaptions(main.srt);
    const revision = Math.max((record.finished && record.finished.revision) || 0, lastRevision(finalDir, record.id)) + 1;
    const reels = parts.filter((p) => p.reel).sort((a, b) => a.reel - b.reel).map((p) => {
      const reel = (record.reels || []).find((r) => r.n === p.reel) || {};
      const title = String(reel.title || "").trim();
      // BRIMM Ops takes a Reel's title for the words in its picture, so one is never made up: the quick part asks for it.
      if (!title) failed.push(`Reel ${p.reel} has no title on screen. Say what it says, and finish again.`);
      const timed = Boolean(p.words && main.words);
      return { n: p.reel, title, file: p.name, seconds: p.seconds, inMain: inMain(p.words || wordsOfCaptions(p.srt), mainWords, p.seconds, main.seconds, { spacing: timed }), srt: p.srt };
    });
    if (failed.length) return result();
    const handoff = buildHandoff({ record, revision, made: localStamp(new Date(ctx.now())), madeOn: ctx.machine, commit: writer.commit, main: { file: main.name, seconds: main.seconds, srt: main.srt }, reels });
    const fault = handoffFault(handoff);
    if (fault) {
      failed.push(`The hand-off could not be written: ${fault}`);
      return result();
    }
    const handoffName = `${fileSafe(record.name.text)}.brimm-ops.json`;
    writeFileSync(join(work, handoffName), handoffText(handoff));

    // Nothing is copied when a file taken has changed since: the hand-off would then not describe what is in final/.
    for (const part of parts.filter((p) => !p.reused)) {
      const where = part.video.where === "From Final Cut" ? " in From Final Cut" : "";
      if (!unchanged(part.path, part.snap)) failed.push(`${part.video.name} changed${where} while finish was working on it. Say finish again.`);
      if (part.export && !unchanged(part.exportPath, part.exportSnap)) failed.push(`${part.export.name} changed${where} while finish was working on it. Say finish again.`);
    }
    if (failed.length) return result();

    // Nothing goes into final/ once the episode has changed since finish was asked, as when the other Mac took it over while
    // this ran: the copies would land under its claim, and the record could not be written (the review of PR 21, finding 2).
    const now = readEpisode(found.folder);
    const held = now.record ? heldElsewhere(now.record, ctx.machine) : null;
    if (held) failed.push(`${held.by} has ${record.name.text} open now, so nothing was copied into final/. Finish it there, or take it over and say finish again.`);
    else if (!now.record || now.record.rev !== asked.rev) failed.push("The episode changed while finish was working, so nothing was copied into final/. Say finish again.");
    if (failed.length) return result();

    // Into final/, by the rule, from what was taken: each new video, its transcripts, its Story parts and its export, and the
    // hand-off last.
    progress.step("Copying into the episode");
    const entries = [];
    const files = {};
    const put = (from, as) => {
      const to = join(finalDir, as);
      mkdirSync(dirname(to), { recursive: true });
      (existsSync(to) ? replaceIn : cloneIn)(from, to, opts);
      const bytes = statSync(from).size;
      entries.push({ from, to, bytes });
      files[`final/${as}`] = bytes;
      made.push(`final/${as}`);
    };
    const taken = [];
    try {
      for (const part of parts.filter((p) => !p.reused)) {
        put(part.copy, part.name);
        if (part.video.where === "From Final Cut") taken.push({ path: part.path, snap: part.snap, name: part.video.name });
        for (const ending of [".srt", ".transcript.txt", ".words.json"]) {
          const from = join(part.dir, stem(part.name) + ending);
          if (existsSync(from)) put(from, stem(part.name) + ending);
        }
        for (const from of part.story || []) put(from, basename(from));
        if (part.export) {
          if (statSync(part.exportCopy).isDirectory()) for (const inside of filesIn(part.exportCopy)) put(join(part.exportCopy, inside), join(part.export.name, inside));
          else put(part.exportCopy, part.export.name);
          if (part.export.where === "From Final Cut") taken.push({ path: part.exportPath, snap: part.exportSnap, name: part.export.name });
        }
      }
      put(join(work, handoffName), handoffName);
    } catch (e) {
      failed.push(e.message);
      // The record lists what final/ holds now: each copy made so far at its size, and one whose old file replaceIn deleted
      // before its clone failed no more, so that a finish again goes through (the P1 check, T3).
      const files_ = { ...record.files, ...files };
      for (const rel of Object.keys(files_)) if (rel.startsWith("final/") && !existsSync(join(found.folder, rel))) delete files_[rel];
      if (JSON.stringify(files_) !== JSON.stringify(record.files)) {
        try {
          writeEpisode(found.folder, { ...record, files: files_, ...(asked.claimed ? { editing: null } : {}) }, { expectRev: asked.rev, writeText: textWriter({ work: join(work, "record"), ...opts }), writer, home: ctx.home });
          if (asked.claimed) letGoneAlready = true;
          failed.push("The record lists what final/ holds now. Say finish again.");
        } catch (w) {
          failed.push(`The record could not be written to list what final/ holds now: ${String(w.message).replace(/\.$/, "")}.`);
        }
      }
      return result();
    }
    const lastCopy = ctx.now();

    // The record: the finish, each part's file, its version and what keeps its edit, the Reels finished, and the files
    // listed. A part made again leaves nothing of an earlier cut listed under its name: Story parts and word times it no
    // longer has stay in final/, and are no longer the record's.
    const finishedParts = { ...before };
    let listed = { ...record.files };
    for (const part of parts.filter((p) => !p.reused)) {
      const own = `final/${stem(part.name)}.`;
      listed = Object.fromEntries(Object.entries(listed).filter(([path]) => !path.startsWith(own) || path in files));
      const words = `final/${stem(part.name)}.words.json`;
      finishedParts[part.key] = {
        v: versionOf(record, part, part.name), file: `final/${part.name}`, bytes: part.video.bytes, seconds: part.seconds, source: { bytes: part.video.bytes, mtimeMs: part.video.mtimeMs },
        ...(words in files ? { words } : {}), ...(part.story && part.story.length ? { story: part.story.map((f) => `final/${basename(f)}`) } : {}),
        ...(part.export ? { export: `final/${part.export.name}` } : { noHandEdits: true })
      };
    }
    const finishedReels = new Map(parts.filter((p) => p.reel).map((p) => [p.reel, p]));
    const nextRecord = {
      ...record,
      finished: { revision, at: localStamp(new Date(ctx.now())), on: ctx.machine, handoff: `final/${handoffName}`, parts: finishedParts },
      reels: (record.reels || []).map((r) => (finishedReels.has(r.n) ? { ...r, status: "finished", final: { file: `final/${finishedReels.get(r.n).name}`, seconds: finishedReels.get(r.n).seconds } } : r)),
      files: { ...listed, ...files },
      ...(record.editing && record.editing.by === ctx.machine ? { editing: null } : {})
    };
    // The record is written by the rule, and its work copy kept, so the late check looks at it as at every other copy.
    // The other Mac may have taken it over while the copies were made: then the record is not written over its claim.
    // When it is not written, final/ holds what this finish copied all the same: the record in force is written again with
    // its list of files as final/ holds them, so that neither Mac is stuck on "not whole", and with no finish, as final/ now
    // mixes this finish's files with the last one's: the next finish makes every part again (the P1 check, T1; round 3, t1-3).
    const NEEDS_JASON = " If the episode then says it is not whole in Dropbox, that needs Jason.";
    const listWhatFinalHolds = () => {
      const newest = readEpisode(found.folder);
      if (!newest.record) return ` The record could not be read to list what final/ holds now.${NEEDS_JASON}`;
      try {
        writeEpisode(found.folder, { ...newest.record, files: { ...newest.record.files, ...files }, finished: null }, { expectRev: newest.record.rev, writeText: textWriter({ work: join(work, "record-listed"), ...opts }), writer, home: ctx.home });
        return " The record lists what final/ holds now, and no finish: the next finish makes every part again, from the Shares on the Mac that makes it.";
      } catch (w) {
        return ` The record could not be written to list what final/ holds now: ${String(w.message).replace(/\.$/, "")}.${NEEDS_JASON}`;
      }
    };
    const before_ = readEpisode(found.folder);
    const heldNow = before_.record ? heldElsewhere(before_.record, ctx.machine) : null;
    if (heldNow) {
      failed.push(`${heldNow.by} took ${record.name.text} over while finish was copying into final/, so the finish is not in the record.${listWhatFinalHolds()} Take it over and say finish again, or finish it there.`);
      return result();
    }
    const recordWriter = textWriter({ work: join(work, "record"), keep: true, ...opts });
    const recordEntries = [];
    let written = true;
    try {
      writeEpisode(found.folder, nextRecord, { expectRev: asked.rev, writeText: (to, text, o) => {
        const entry = recordWriter(to, text, o);
        recordEntries.push(entry);
        return entry;
      }, writer, home: ctx.home });
      recordWritten = true;
    } catch (e) {
      written = false;
      failed.push(`The files are in final/, but the record was not written: ${String(e.message).replace(/\.$/, "")}.${listWhatFinalHolds()} Say finish again.`);
    }

    // The hand-off, shown in Finder, for her to drop on the BRIMM Ops page: only when the record says it is the finish.
    if (written) await my.run("/usr/bin/open", ["-R", join(finalDir, handoffName)]);

    // The late check, at least 15 minutes after the last copy. Only when it finds every copy whole, and the record says what
    // was finished, are the files this finish took from From Final Cut deleted there; and only those still as they were
    // when taken. One made again since is kept, and named.
    progress.step("Checking the copies");
    await my.wait(Math.max(0, lastCopy + LATE_CHECK_MS - ctx.now()));
    // Once the other Mac has the episode, nothing is copied into it again: what is not whole is said, for that Mac's own
    // finish to put right (the P1 check, T20).
    const late = readEpisode(found.folder);
    const theirs = late.record ? heldElsewhere(late.record, ctx.machine) : null;
    const problems = theirs
      ? entries.filter((e) => { const s = statSync(e.to, { throwIfNoEntry: false }); return !s || s.size !== e.bytes; }).map((e) => `${basename(e.to)} is not whole in final/ at the late check, and ${theirs.by} has ${record.name.text} open now, so it was not copied in again: say finish again there.`)
      : check(entries, opts);
    // Its record is put back only when it is gone and no later record is there: never over a record the other Mac wrote
    // under its number, or over one written since. Then the episode is read again, and From Final Cut is emptied only
    // when its record still holds this finish.
    let holds = false;
    if (written) {
      const own = recordFile(found.folder, asked.rev + 1);
      const entry = recordEntries.find((e) => e.to === own);
      if (entry && !existsSync(own) && !laterRecord(found.folder, asked.rev + 1)) {
        try {
          cloneIn(entry.from, own, opts);
        } catch (e) {
          problems.push(e.message);
        }
      }
      const now = readEpisode(found.folder);
      holds = Boolean(now.record && now.record.finished && now.record.finished.revision === revision);
      if (!holds) failed.push(now.record ? "The episode's record no longer holds this finish: the other Mac changed it. Say finish again." : `The episode's record cannot be read now: ${String(now.why).replace(/\.$/, "")}. Say finish again.`);
    }
    if (problems.length) {
      failed.push(...problems);
      next.push("The files it took from From Final Cut are kept there, because a copy in final/ was not whole at the late check.");
    } else if (written && holds) {
      for (const file of taken) {
        if (unchanged(file.path, file.snap)) rmSync(file.path, { recursive: true, force: true });
        else next.push(`${file.name} changed in From Final Cut after it was taken, so it is kept there.`);
      }
    }

    next.push("To save space on this Mac, make the episode's folder online-only: in Finder, Control-click it and choose Make online-only.");
    next.push("Final Cut's render files can be freed with File > Delete Generated Library Files.");
    ended = failed.length === 0;
    return result();
  } catch (e) {
    failed.push(`The finish stopped: ${e.message}`);
    return result();
  } finally {
    // A finish that did not write its record lets go a claim its quick part took for it.
    if (!ended && !recordWritten && !letGoneAlready) {
      const gone = letGoClaim(ctx, found);
      if (gone) failed.push(gone);
    }
    progress.end(ended);
    rmSync(work, { recursive: true, force: true });
  }
}
