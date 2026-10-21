// The made-up episode phase 4's tests share: phase 3's, with the files a phase 4 push reads too.
import { writeFileSync } from "node:fs";
import { wordsOf, pausesOf, phrasesOf, cutPlan } from "../cuts.js";
import { readNotes, applyDecisions, clipRanges } from "../notes.js";
import { reelCandidates, reelsFile, reelEntries, previewPath } from "../reels.js";
import { mainProject } from "../projects.js";
import { ideaNotes } from "../unedited.js";
import { relativeMedia } from "../portable.js";
import { TOLD, PAUSES, probed } from "./fixtures.js";
import { setup, episodeFor, NAME } from "./episodes.js";

export const SRT = "1\n00:00:06,070 --> 00:00:07,040\nWelcome to the show.\n\n2\n00:00:19,414 --> 00:00:21,097\nThank you so much, Sallie.\n\n";

/** The made-up recording of fixtures.js, as phase 3's tests make it, with the files a phase 4 push reads too: the words, the
    whole recording's captions, and the import's own main timeline. */
/** The episode's files, made from the pauses ffmpeg heard: `drop` takes out the heard pauses of those numbers, as a recording
    whose lead-in or tail has a sound with no words to it. `guessed` marks Reel 2's first stretch as one where no face was
    found. `picked` is whether Reel 2 is picked in the record. */
export const episodeFiles = ({ drop = [], guessed = false, picked = true } = {}) => {
  const heard = pausesOf(PAUSES).filter((_, i) => !drop.includes(i));
  const facts = { duration: 23.423, width: 1280, height: 720, fps: "30000/1001", sound: true, soundStart: 0 };
  const read = readNotes(JSON.stringify({ decisions: [{ id: "p8", keep: false, why: "It adds nothing to the line before it." }], notes: "", graphics: [], clips: [{ from: "p4", to: "p5", hook: "The opening", why: "It says what the talk is about." }, { from: "p7", to: "p9", hook: "Know your costs", why: "It makes one point and stands alone." }] }));
  const words = wordsOf(TOLD);
  const plan = applyDecisions(cutPlan(phrasesOf(words, heard), { duration: facts.duration, pauses: heard }), read.decisions, heard).plan;
  const stills = Array.from({ length: 11 }, (_, i) => ({ file: String(i + 1).padStart(4, "0") + ".jpg", faces: [{ x: 0.2, y: 0.2, w: 0.1, h: 0.2 }] }));
  const candidates = reelCandidates({ clips: clipRanges(plan, read.clips, heard).clips, plan, facts, stills }).map((c) => ({ ...c, preview: previewPath(c.n) }))
    .map((c) => (guessed && c.n === 2 ? { ...c, ranges: c.ranges.map((r, i) => (i === 0 ? { ...r, crop: { ...r.crop, found: false } } : r)) } : c));
  const stored = { version: 1, video: "Pricing talk.mp4", facts, phrases: plan.phrases, ranges: plan.ranges, kept: plan.kept, cut: plan.cut, by: plan.by, claude: { graphics: [{ id: "p7", idea: "A chart of what it costs to run the business" }] } };
  const v0 = mainProject({ video: "/x/Pricing talk.mp4", facts, more: { audioRate: 48000, audioChannels: 2 }, plan: stored, srt: SRT, ideas: ideaNotes(stored, stored.claude.graphics) }).text;
  const files = {
    "Pricing talk.mp4": "the raw video",
    "Pricing talk.cut-plan.json": JSON.stringify(stored),
    "Pricing talk.words.json": JSON.stringify({ video: "Pricing talk.mp4", duration: facts.duration, words }),
    "Pricing talk.srt": SRT,
    "reels.json": JSON.stringify(reelsFile({ video: "Pricing talk.mp4", by: "import", made: "2026-10-14T09:12:00-05:00", candidates }), null, 2) + "\n",
    "edit/main.v0.fcpxml": relativeMedia(v0, { from: "/x/edit/a.fcpxml", to: "/x/edit/a.fcpxml", episode: "/x" }).xml
  };
  const record = { name: { text: NAME, placeholder: false }, reels: reelEntries(candidates).map((r) => (r.n === 2 && picked ? { ...r, status: "picked" } : r)) };
  return { files, record };
};
export const EPISODE = episodeFiles();
export const rawProbe = (args) => {
  writeFileSync(args[args.indexOf("-o") + 1], probed({ sound: { sample_rate: "48000", channels: 2 } }));
  return { code: 0, stderr: "" };
};
export const episode = (record = {}, programs = {}, made = EPISODE) => {
  const t = setup({ programs: { FFPROBE: rawProbe, ...programs } });
  t.ctx.deps.fontFiles = () => ["Varela-Regular.ttf"];
  const found = episodeFor(t, { record: { ...made.record, ...record }, files: made.files });
  return { t, found };
};

