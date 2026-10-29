// The made-up world of the tests of `finish "<episode>" reels` (plan PR 9): a video her editor finished, whose spellings are answered and
// whose hand-off is written already, as revision 1, from the import's captions (finish.js finishFinished), with Claude's two suggestions
// in it; a HyperFrames project on disk for each Reel made, a Downloads folder in the test's own home, and the app's records of the
// exports a test makes (exports-world.js, whose world this is). Stand-ins answer for ffprobe, ffmpeg and the transcriber (episodes.js),
// so that no test runs a program, and nothing here touches the real Downloads folder, Dropbox or BRIMM Video Work: the home is a
// temporary folder.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wordsOf } from "../cuts.js";
import { finishFinished } from "../finish.js";
import { reelEntries, reelsFile } from "../reels.js";
import { SRT, toldOf } from "./episodes.js";
import { EPISODE, episodeFiles } from "./phase4.js";
import { VIDEO, world } from "./exports-world.js";

/** The hand-off of the made-up finished video: its place in the episode's folder, and its name in final/. */
export const HANDOFF = "Pricing- what to charge-.brimm-ops.json";
export const HANDOFF_REL = `final/${HANDOFF}`;

const one = (n, start, end, about) => ({ n, start, end, ranges: [{ start, end }], seconds: Math.round((end - start) * 1000) / 1000, preview: null, ...about });
/** Claude's two suggestions for the made-up finished video, on its own clock: the opening, and the sentence about costs, which is where
    the captions of the main video (the contract's) have it, 4.1 to 11.8 seconds in. A Reel made from the second falls there (`inMain`). */
export const CANDIDATES = [
  one(1, 0, 3.9, { title: "The opening", reason: "It says what the talk is about.", point: "Pricing is the subject of the talk.", first: "Welcome to the show", last: "talk about pricing", words: "Welcome to the show. Today we are going to talk about pricing." }),
  one(2, 4.1, 11.8, { title: "Know your costs", reason: "It makes one point and stands alone.", point: "Know your costs before you set a price.", first: "So the first thing you need to do is know your costs.", last: "Thank you so much, Sallie.", words: "So the first thing you need to do is know your costs. It is very, very important. Thank you so much, Sallie." })
];
/** The words Reel 2 is expected to start with, as the quick part writes them down (the suggestion's first words). */
export const REEL2_OPENING = "So the first thing you need to do is know your costs.";
/** A Reel made from times she gave: no suggestion has its number. */
export const REEL3 = { n: 3, status: "picked", from: 0, to: 4, title: "From her own times", why: "", files: [], pushed: [] };

/** The made-up recording's files (phase4.js), with the import's captions of the main video (the contract's), its word times, and
    Claude's suggestions with the four things the hand-off needs of each (first and last words, reason and point). */
export function finishedFiles({ suggestions = true, words = true } = {}) {
  const made = episodeFiles({ picked: false });
  const list = reelsFile({ video: VIDEO, by: "read", made: "2026-10-14T09:12:00-05:00", candidates: CANDIDATES });
  const files = {
    ...made.files,
    "Pricing talk.srt": SRT.main,
    "Pricing talk.words.json": JSON.stringify({ video: VIDEO, duration: 23.423, words: wordsOf(toldOf(SRT.main)) }),
    "reels.json": `${JSON.stringify(list, null, 2)}\n`
  };
  // A reading that offered no suggestion leaves no list: the hand-off then holds none, whatever the record's Reels are. And an episode
  // may have no file of word times (a hand-off made from the captions alone).
  if (!suggestions) delete files["reels.json"];
  if (!words) delete files["Pricing talk.words.json"];
  return files;
}

/** What the stand-in for the transcriber writes of each part: the captions of the main video, and of a Reel those of the sentence it
    was made from (Reel 2 starts with the words of suggestion 2). */
export const CAPTIONS = { main: SRT.main, "reel 1": SRT["reel 2"], "reel 2": SRT["reel 1"], "reel 3": SRT["reel 2"] };
const partOf = (path) => {
  const reel = /reel[ -](\d+)/.exec(path);
  return reel ? `reel ${reel[1]}` : "main";
};
export const whisper = (over = {}) => (args) => {
  const base = args[args.indexOf("-of") + 1];
  const part = partOf(args[args.indexOf("-f") + 1]);
  const srt = over[part] ?? CAPTIONS[part] ?? CAPTIONS.main;
  writeFileSync(`${base}.srt`, srt);
  if (args.includes("-ojf")) writeFileSync(`${base}.json`, JSON.stringify(toldOf(srt)));
  return { code: 0, stderr: "" };
};

/** The made-up finished video: answered as finished by her editor, with a project on disk for each of `projects` ("reel 2", "reel 1",
    "reel 3"; Reel 3 is one she gave times for) and those Reels picked. This Mac is set up for the app and hands off version 2. When
    `handoff` is true its hand-off is written, as revision 1, by finishFinished (with Claude's two suggestions in it, unless `suggestions`
    is false, and with the file of the import's word times unless `words` is). `over` changes the record, `programs` the stand-ins, and
    `captions` what the transcriber writes of a part. Gives
    exports-world.js's world. */
export async function finishedWorld({ projects = ["reel 2"], handoff = true, suggestions = true, words = true, over = {}, programs = {}, captions = {}, name = null, set = true, handoffVersion = 2 } = {}) {
  const picked = (n) => projects.includes(`reel ${n}`);
  const reels = [...reelEntries(CANDIDATES).map((reel) => (picked(reel.n) ? { ...reel, status: "picked" } : reel)), ...(picked(3) ? [REEL3] : [])];
  const w = world({ kind: "finished", projects, over: { reels, ...over }, programs: { WHISPER: whisper(captions), ...programs }, set, handoffVersion, name, made: { files: finishedFiles({ suggestions, words }), record: EPISODE.record } });
  if (handoff) {
    const done = await finishFinished(w.t.ctx, w.found, { record: w.found.record });
    assert.equal(done.ok, true, done.why);
  }
  return w;
}

/** The hand-off in the episode's final/, as it is now. */
export const handoffIn = (found) => JSON.parse(readFileSync(join(found.folder, HANDOFF_REL), "utf8"));
