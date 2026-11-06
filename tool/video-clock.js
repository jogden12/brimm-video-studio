// The clock a video's times are told on: the video's own, as HyperFrames shows it. The whole recording is one piece; a Reel is
// the stretch of it that reels.json suggests. Nothing is read from Final Cut, a rough cut or a timeline, so a record from the
// Final Cut days (a render, a push) gives the same times as a record with none. Only the episode's folder is read.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readReels, REELS_FILE } from "./reel-candidates.js";
import { spellWords } from "./spelling.js";
import { saidWords } from "./project.js";

/** The video's clock for a part of an episode: `part` is "main" or { reel: n }; `found` holds `folder` and `record`.
    - { clock, on, words, raw, plan, span? }: `clock` is one piece over the whole video ({ at, from, to } as clock.js clockOfRanges gives
      them, so clockText and timelineAt read it), or over a Reel's suggestion, whose clock starts at its start and runs to its
      end; `on` is "the video" or "Reel <n>"; `words` are the video's own words from its words file, placed as they are said
      (project.js saidWords, as the HyperFrames project's transcript has them) and spelled as the record spells them; `plan` is
      its cut plan as stored, or {} when there is none to read (its ideas for graphics and phrases are in it); `span` for a Reel is
      { from, to } in seconds of the video.
    - { coming, bring } while Dropbox has not brought a file over yet, as edit.js clockRead says it.
    - { why } when the words file is missing or cannot be read, or the Reel is not in reels.json. */
export function videoClock(found, ctx, part = "main") {
  const { record, folder } = found;
  const stem = record.video.file.replace(/\.[^.]*$/, "");
  const wordsFile = `${stem}.words.json`;
  const planFile = `${stem}.cut-plan.json`;
  if (!existsSync(join(folder, wordsFile))) return { why: `${wordsFile} is not in the episode's folder.` };
  if (!ctx.isWhole(join(folder, wordsFile))) return { coming: wordsFile, bring: [wordsFile] };
  let stretch = null;
  if (part !== "main") {
    const at = join(folder, REELS_FILE);
    if (!existsSync(at)) return { why: `There is no Reel ${part.reel}.` };
    if (!ctx.isWhole(at)) return { coming: REELS_FILE, bring: [REELS_FILE] };
    const listed = readReels(readFileSync(at, "utf8"));
    const candidate = listed.reels ? listed.reels.candidates.find((c) => c.n === part.reel) : null;
    if (!candidate) return { why: `There is no Reel ${part.reel}.` };
    stretch = { from: candidate.start, to: candidate.end };
  }
  let plan = {};
  if (existsSync(join(folder, planFile)) && !ctx.isWhole(join(folder, planFile))) return { coming: planFile, bring: [planFile] };
  try {
    if (existsSync(join(folder, planFile))) plan = JSON.parse(readFileSync(join(folder, planFile), "utf8")) || {};
  } catch (e) {
    return { why: `${planFile} or ${wordsFile} cannot be read.` };
  }
  let file;
  try {
    file = JSON.parse(readFileSync(join(folder, wordsFile), "utf8"));
  } catch (e) {
    return { why: `${wordsFile} cannot be read.` };
  }
  if (!file || !Array.isArray(file.words)) return { why: `${wordsFile} cannot be read.` };
  const words = spellWords(saidWords(file.words, Array.isArray(plan.phrases) ? plan.phrases : []), record.spellings);
  const length = Number.isFinite(file.duration) && file.duration > 0 ? file.duration : words.reduce((end, w) => Math.max(end, w.end), 0);
  const [from, to] = stretch ? [stretch.from, stretch.to] : [0, length];
  return { clock: [{ at: 0, from, to }], on: stretch ? `Reel ${part.reel}` : "the video", words, raw: file.words, plan, ...(stretch ? { span: stretch } : {}) };
}
