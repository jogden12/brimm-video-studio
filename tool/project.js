// A HyperFrames project's whole file set, and its writer (architecture 2026-10-27: F4 and F5, and sections 5.1, 5.2, 5.4, 5.7
// and 5.8).
//
// The pinned command line's `init` makes a project BRIMM would have to repair (F4): its page loads GSAP from the network, its
// package has a publish script, its settings name a registry on a moving branch, and its notes send the agent to update skills
// and to publish. So Studio writes every file of a project itself, after what `init --video` and `transcribe` write (the golden
// files, tests/fixtures/hyperframes-0.8.208/init/), with BRIMM's own in place of what conflicts:
//   - the page, HyperFrames' settings, the package and its scripts, with GSAP from the project's own vendor/ folder;
//   - transcript.json, from the episode's words with its spellings (F5), and Studio's suggestions by the same word ids (5.8): the
//     cuts, the Reels, and the graphic cues of a main video and of a Reel, each placed on the words it goes with (graphic-cues.js;
//     PR H1 and H2);
//   - the notes for the agent, CLAUDE.md and AGENTS.md: BRIMM's rules first, then what the project is, then HyperFrames' own
//     guidance without what the rules forbid (5.4);
//   - the brand pack (tool/brand/): the brand's rules, Josefin Sans and Allison; and the logos chosen, from the Assets folder.
// A Reel's project (plan PR 5, architecture 4.3) is a stretch of the recording as a project of its own: its video is that stretch,
// cut by workcopy.js; its transcript.json holds the recording's words in the stretch on the stretch's own clock (reelWords), and
// brimm/facts.json says where the stretch starts in the recording; it has no cut or Reel suggestions; it has brimm/graphic-cues.json,
// the cues that fall in its stretch, three at most, on its own clock (PR H2); and brimm/face-track.json only when the face finder
// found a face in its video. Its page is upright, 1080 by 1920, whatever the video's shape, with the
// video placed so that the speaker the finder found is in the middle of the frame (reelCrop; Jason, 2 November), while
// brimm/facts.json keeps the video's own size, which a video put back is held to. The notes of a main and a Reel project carry
// the ruling of 2026-10-28: a Reel is made by Studio only, so the agent never makes one as a new project, and tells her to say
// "Open Reel 2 in HyperFrames" in her Claude chat when she asks it for one (a short video's main project has no Reels to ask for,
// so its notes leave that line out, and have one in its place: no Reel and no new project from it); a session clip's own rules,
// first of all, forbid any new project from it.
// A project holds only the files chosen here: projectFiles gives the whole set, and the tests hold each kind's list whole.
//
// writeProject puts a file set on disk whole or not at all. It is made in the run's own folder, the working copy is renamed into
// it last, and the whole folder is renamed into place, so that no project ever holds a half-written video (5.7). Everything else
// here is pure, but for reading the brand pack's guide when this file is loaded.
import { randomUUID } from "node:crypto";
import * as nodeFs from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { clockText, heardWords, insideTheirTime } from "./clock.js";
import { spelled } from "./final-transcript.js";
import { COMMANDS, settingsFor } from "./hyperframes.js";
import { fileSafe, partName, shortId } from "./names.js";
import { UPRIGHT, shownWidth, speakerPlace, uprightPosition } from "./reframe.js";
import { graphicCuesJson, keptIndexes, keptPhraseSpans, phraseSpans, placeGraphicCues, reelGraphicCues, REEL_CUES_MOST, REEL_EDGE_SLACK } from "./graphic-cues.js";
import { projectNameOf, sameName } from "./references.js";

/** A file of this tool's own, by its path from this file. */
const own = (path) => fileURLToPath(new URL(path, import.meta.url));

/** The kinds of project: an episode's main video, one of its Reels, and a session's clip. */
const KINDS = ["main", "reel", "clip"];

/** The brand pack's typefaces (tool/brand/fonts/), as a project's `assets/fonts/` holds them and its page declares them. Josefin
    Sans stands in for the guide's Sweet Sans Pro (Jason, 2026-10-26), in the three weights the guide uses and the Regular Italic
    (Jason, 2026-10-28); its files are the latin ones of @fontsource/josefin-sans 5.3.0. Allison stands in for the guide's script,
    Sinthya (Jason, 2026-10-28); its file is Google Fonts' own (github.com/google/fonts, ofl/allison/Allison-Regular.ttf, sha256
    990750bc970472808cef2fceaed3424c922e781aee99e57907a68a9932d3a066). Both are under the SIL Open Font License, whose texts are
    beside them. */
export const FONTS = Object.freeze([
  { file: "josefin-sans-latin-300-normal.woff2", family: "Josefin Sans", weight: 300, style: "normal", format: "woff2" },
  { file: "josefin-sans-latin-400-normal.woff2", family: "Josefin Sans", weight: 400, style: "normal", format: "woff2" },
  { file: "josefin-sans-latin-400-italic.woff2", family: "Josefin Sans", weight: 400, style: "italic", format: "woff2" },
  { file: "josefin-sans-latin-500-normal.woff2", family: "Josefin Sans", weight: 500, style: "normal", format: "woff2" },
  { file: "Allison-Regular.ttf", family: "Allison", weight: 400, style: "normal", format: "truetype" }
].map((font) => Object.freeze(font)));

/** The brand's rules for the agent, as every project carries them in brimm/brand.md. */
const BRAND = nodeFs.readFileSync(own("./brand/brand.md"), "utf8");
/** The GSAP that the pinned `init` loads from the network (3.14.2), kept here so that a project never fetches it. The pin file
    holds its version and checksum. */
const GSAP = own("./vendor/gsap.min.js");

// --- The project's name ---

/** The part of a project's name: "main" or "reel 2" (names.js partName), and for the main video's later projects "main 2", "main 3"
    and on. A correction of the video's kind keeps the project made for the earlier kind (4.8), and the next is another folder,
    which needs another name: `number` is which main project this is, from 1, and the first is "main", as it was before there was a
    second. Only the main video has them: a number for another part, or one that is not a whole number from 1, throws. */
function partWords(part, number) {
  if (number === undefined || number === 1) return partName(part);
  if (part !== "main" || !Number.isInteger(number) || number < 1) throw new Error(`projectName: only the main video's projects are numbered, from 1, and ${JSON.stringify(number)} is not one for ${JSON.stringify(part)}`);
  return `main ${number}`;
}

/** The name of a project (5.1): its folder's, its meta.json's and its title in the app, which names an export after it. An
    episode's part is "<file-safe name> <part> <short id>", as "Pricing talk main 3fa9c1" or "Pricing talk reel 2 3fa9c1", with
    no version, since versions are the app's. The main video's second project, made after a correction kept the first, is "Pricing
    talk main 2 3fa9c1" (`number`: partWords). A session's clip is "Session clip <n> <short id>": from its number, never from a
    name, so that nothing a client is called reaches a folder, a file or the app. */
export function projectName({ name, part, number, clip, id }) {
  if (clip !== undefined) {
    if (!Number.isInteger(clip) || clip < 1) throw new Error(`projectName: a session's clip has a number from 1, not ${JSON.stringify(clip)}`);
    return `Session clip ${clip} ${shortId(id)}`;
  }
  return `${fileSafe(name)} ${partWords(part, number)} ${shortId(id)}`;
}

// --- index.html ---

/** A number of seconds as the page writes it: to the thousandth, with no trailing zeros. */
const secondsText = (seconds) => String(Math.round(Number(seconds) * 1000) / 1000);

/** How a Reel's page is cropped (Jason, 2 November; architecture 4.3): { at, found, position, across }. Studio makes a Reel upright and
    puts the speaker in the middle of the frame. The speaker is where reframe.js speakerPlace finds one in the stills the face finder
    looked in, `track` being faceTrack's (the largest face in each still, and the place the middle one of the stills): `at` is how far
    across the picture, as a fraction of its width from its left, and `found` whether any still held a face; with none, or no track,
    `at` is the middle and `found` is false. `position` is the `object-position` across that puts `at` in the middle of the frame
    (reframe.js uprightPosition, a percentage), and `across` whether the working copy's picture is wider than the frame, so that
    anything is cropped across at all. `facts` are the working copy's. */
export function reelCrop(facts, track) {
  const { at, found } = speakerPlace((Array.isArray(track?.stills) ? track.stills : []).map((still) => still?.faces));
  return { at, found, position: uprightPosition(facts, at), across: shownWidth(facts) > UPRIGHT.width };
}

/** The page of a project (5.2): one composition, "main", as long as the working copy, with the working copy as its one video,
    of the working copy's size; GSAP from the project's vendor/ folder and the brand's typefaces from its assets/fonts/, so that
    nothing is loaded from the network (F4). Its structure is the golden's: the same attributes on the root and on the video, and
    one paused timeline registered under the root's id. `facts` are the working copy's, as workcopy.js writes them ({seconds,
    width, height}); the video has sound unless `facts.audio` is false.
    A Reel's page (`crop`, reelCrop's) is upright instead: the composition is 1080 by 1920 whatever the working copy's size, its
    portrait resolution, viewport and body included, and the video still fills it (`object-fit: cover`), placed by `object-position`
    so that the speaker is in the middle (the export shows the same crop: HyperFrames' runtime and renderer read the video's
    object-fit and object-position). Given no crop, the page is the working copy's own shape, byte for byte as it always was. */
export function indexHtml(facts, crop = null) {
  const picture = { width: Math.round(Number(facts?.width)), height: Math.round(Number(facts?.height)) };
  if (!(picture.width > 0 && picture.height > 0 && Number(facts?.seconds) > 0)) throw new Error("indexHtml: the working copy's facts need its width, height and seconds");
  const { width, height } = crop ? UPRIGHT : picture;
  const placed = crop ? `; object-position: ${Number.isFinite(crop.position) ? crop.position : 50}% 50%` : "";
  const length = secondsText(facts.seconds);
  const shape = width > height ? "landscape" : width < height ? "portrait" : "square";
  const faces = FONTS.map((f) => `      @font-face { font-family: "${f.family}"; src: url("assets/fonts/${f.file}") format("${f.format}"); font-weight: ${f.weight}; font-style: ${f.style}; }`);
  return `<!doctype html>
<html lang="en" data-resolution="${shape}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <script src="vendor/gsap.min.js"></script>
    <style>
${faces.join("\n")}
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: #000;
      }
      body {
        font-family: "Josefin Sans", sans-serif;
        font-weight: 400;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${length}"
      data-width="${width}"
      data-height="${height}"
    >
      <video
        id="a-roll"
        class="clip"
        src="media/recording.mp4"
        playsinline
        data-start="0"
        data-duration="${length}"
        data-track-index="0"
        style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover${placed}"
        data-has-audio="${facts.audio === false ? "false" : "true"}"
      ></video>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

/** The mist of the brand (brand.md): the usual background, and an explainer's page. */
const MIST = "#E8E3DA";

/** The voice an explainer's page plays, as the project names it: the working copy of the voiceover, moved in as the recording is (projectFiles). */
export const VOICEOVER = "media/voiceover.m4a";

/** The page of an explainer (PR H6): graphics and words on screen over a voice, with no video of her. It is one composition, "main", upright, 1080 by
    1920 whatever the facts say of the voice, on the brand's mist background, with the brand's typefaces and GSAP from the project's own folders (as
    indexHtml's page, so that nothing is loaded from the network), and one paused timeline registered under the root's id. `facts` need the length of
    the voice in `seconds` (the working copy's, or for a voice not made yet the length of the teleprompter script). With `voiceover` the page plays
    the voiceover from the start: one `<audio>` element, as long as the page, the voice's media in media/voiceover.m4a. Without it the page holds
    no media element at all, for the voice the app's agent makes in the project (`plan … voice` takes it from assets/ once it is made). */
export function explainerHtml(facts, { voiceover = false } = {}) {
  const seconds = Number(facts?.seconds);
  if (!(seconds > 0)) throw new Error("explainerHtml: the facts need the voice's seconds");
  const { width, height } = UPRIGHT;
  const length = secondsText(seconds);
  const faces = FONTS.map((f) => `      @font-face { font-family: "${f.family}"; src: url("assets/fonts/${f.file}") format("${f.format}"); font-weight: ${f.weight}; font-style: ${f.style}; }`);
  const voice = voiceover ? `\n      <audio id="voiceover" src="${VOICEOVER}" data-start="0" data-duration="${length}" data-track-index="0" data-volume="1"></audio>` : "";
  return `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <script src="vendor/gsap.min.js"></script>
    <style>
${faces.join("\n")}
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: ${MIST};
      }
      body {
        font-family: "Josefin Sans", sans-serif;
        font-weight: 400;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${length}"
      data-width="${width}"
      data-height="${height}"
    >${voice}
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

// --- The words, and what Studio suggests by them ---

/** The company's name as it is written, whatever the transcriber wrote: "brim", "Brim" and "BRIM" are BRIMM, so "the Brim" is
    "the BRIMM" (Jason, 2026-10-28: "'Brim' or 'brim' should always be corrected to 'BRIMM'"). Whole words only: "brimming" stays.
    Every project's words are spelled so, before the episode's own spellings, and its brimm/spellings.json lists them first. */
export const HOUSE_SPELLINGS = Object.freeze([["brim", "BRIMM"], ["Brim", "BRIMM"], ["BRIM", "BRIMM"]].map((pair) => Object.freeze(pair)));

/** The words of a project as they are said, for transcript.json. The transcriber starts a word where the word before it ended
    (cuts.js wordsOf), so a word after a pause starts in the pause: A0 (2026-10-28) found the app's agent trusting the app's own
    transcript over this one for that. Each word starts halfway into the time it was given (clock.js insideTheirTime) and, where
    the cut plan's `phrases` are given, no earlier than the phrase it ends in, which starts on the pause's end (clock.js
    heardWords). The main video's words and a Reel's are placed by the cut plan's phrases, a Reel's by the plan of the recording it is
    cut from, on the recording's clock, before they are chosen and moved to its own (reelWords): the phrases place the starts and
    cut nothing. A clip has no cut plan, and its words are moved inside their time and no more, as are the words of anything
    given no phrases. */
export const saidWords = (words, phrases = []) => {
  const list = Array.isArray(phrases) ? phrases : [];
  const heard = heardWords(insideTheirTime(Array.isArray(words) ? words : []), list);
  // The plan's phrases start on the sound (a pause's end) and the transcriber's words do not: a first word stretched over a silent
  // opening ends past its phrase's end and is found by no time. So the first word of each phrase is also found by counting, as the
  // cut suggestions find a phrase's words, and starts no earlier than its phrase, keeping its end. Only when the plan holds these words.
  const counts = list.map((phrase) => (Array.isArray(phrase?.words) ? phrase.words.length : 0));
  if (counts.reduce((sum, n) => sum + n, 0) !== heard.length) return heard;
  let at = 0;
  list.forEach((phrase, i) => {
    const word = counts[i] > 0 ? heard[at] : null;
    if (word && Number.isFinite(phrase.start) && word.start < phrase.start) heard[at] = { ...word, start: Math.min(phrase.start, word.end) };
    at += counts[i];
  });
  return heard;
};

/** A time to the thousandth of a second: a sum such as 1.2 - 1.15 comes to 0.04999999999999982. */
const thousandth = (seconds) => Math.round(seconds * 1000) / 1000;

/** Whether `stretch` is a stretch of the recording: { start, end } in seconds, from 0 at the earliest, ending after it starts. */
const isStretch = (stretch) => stretch !== null && typeof stretch === "object" && Number.isFinite(stretch.start) && Number.isFinite(stretch.end) && stretch.start >= 0 && stretch.end > stretch.start;

/** The words of the recording that a Reel's stretch holds, on the Reel's own clock (architecture 4.3, 5.2): the words whose middle
    is inside the stretch, each with the stretch's start taken off its times, since the Reel's video is that stretch and its first
    moment is 0. A word's middle, and not its end as the hand-off takes a suggestion's words (clock.js keptWords), because the
    stretch ends where a phrase does and a word's end is the transcriber's, which may be a few hundredths past it: where two
    phrases touch, the word across their edge is the last of the first, and its caption must not be lost. A word that only
    touches an edge of the stretch, the end of the one before or the start of the one after, is not one of its words. A word the
    transcriber started before the stretch, in the pause that came before it, starts at 0, and one that ends past the stretch
    ends at its end. `words` are {w, start, end} in seconds of the recording, already placed as they are said (saidWords): a
    word's start is moved no further here. None for words that are not a list or a stretch that is not one. */
export function reelWords(words, stretch) {
  if (!Array.isArray(words) || !isStretch(stretch)) return [];
  const length = thousandth(stretch.end - stretch.start);
  const inside = (word) => {
    const middle = (word.start + word.end) / 2;
    return middle >= stretch.start && middle <= stretch.end;
  };
  return words.filter(inside).map((word) => ({ ...word, start: Math.max(0, thousandth(word.start - stretch.start)), end: Math.min(length, thousandth(word.end - stretch.start)) }));
}

/** brimm/face-track.json (architecture 4.3): where the faces are in a Reel's video, from what the face finder (faces.swift)
    printed of a still every `every` seconds of it, { every, stills: [{ file, faces: [{x, y, w, h}] }] }: for each still, its time
    on the Reel's clock (its number times `every`, as unedited.js cropsFor reads it) and its boxes as the finder gave them, in
    fractions of the picture from its top left corner. Studio crops the Reel's page upright on the speaker by these (reelCrop), and
    the file is there for the app's agent to move that crop by, or to follow the speaker with it. null when no still holds a face,
    or the finder printed nothing that can be read: then there is no file, and the crop is the middle of the picture. A still
    whose file has no number is left out. */
export function faceTrack(found) {
  const every = Number(found?.every);
  if (!(every > 0) || !Array.isArray(found?.stills)) return null;
  const stills = found.stills
    .map((still) => ({ at: parseInt(still?.file, 10) * every, faces: Array.isArray(still?.faces) ? still.faces : [] }))
    .filter((still) => Number.isFinite(still.at));
  if (!stills.some((still) => still.faces.length > 0)) return null;
  return {
    version: 1, clock: "reel", every,
    about: `Faces found in a picture taken every ${every} seconds of this Reel. A box is in fractions of the picture, from its top left corner. A still shows the last picture before its time.`,
    stills
  };
}

/** How a project's words are spelled: the show's names, the house's spellings and then the episode's (final-transcript.js spelled).
    transcript.json is spelled by it word by word, and a graphic cue's words are spelled by it too (projectFiles), so that the
    words of a cue from an unspelled phrase find the words as the project has them. */
const speller = (spellings = []) => (text) => spelled(text, [...HOUSE_SPELLINGS, ...(spellings ?? [])]);

/** transcript.json (F5): the list the pinned `transcribe` writes, {text, start, end, id} for each word in order, its ids "w0",
    "w1", …, made from the episode's words (cuts.js wordsOf: {w, start, end}) with the show's names, the house's spellings and the
    episode's (final-transcript.js spelled). A word keeps its punctuation, its times and its id: a spelling changes its text alone. */
export const transcriptJson = (words, spellings = []) => {
  const spell = speller(spellings);
  return (Array.isArray(words) ? words : []).map((word, i) => ({ text: spell(word.w), start: word.start, end: word.end, id: `w${i}` }));
};

/** brimm/cut-suggestions.json (5.8): what the cut plan cuts, as the rules decided and Claude changed them, in time order:
    {n, from, to, start, end, kind, why, by}. A phrase with words is given by the ids of its first and last words in
    transcript.json and those words' times. The plan's phrases split the episode's words in order (cuts.js phrasesOf), and a
    word's id is its place in them, so each phrase's words are found by counting, never by their times, which two words can
    share. A plan that does not hold the transcript's words, as many of them, is refused: its ids would be wrong. A cut that
    holds no words (a silence: the opening, a shortened pause) is listed too, by its time alone, with `from` and `to` null.
    `by` is who decided the plan, "rules" unless the plan says otherwise. */
export function cutSuggestions(plan, transcript) {
  const phrases = Array.isArray(plan?.phrases) ? plan.phrases : [];
  const count = (phrase) => (Array.isArray(phrase.words) ? phrase.words.length : 0);
  const held = phrases.reduce((sum, phrase) => sum + count(phrase), 0);
  if (phrases.length && held !== transcript.length) throw new Error(`cutSuggestions: the cut plan holds ${held} words and the transcript ${transcript.length}: they must be the same words`);
  const found = [];
  let at = 0;
  for (const phrase of phrases) {
    const n = count(phrase);
    if (phrase.keep === false && n > 0) {
      const first = transcript[at];
      const last = transcript[at + n - 1];
      found.push({ from: first.id, to: last.id, start: first.start, end: last.end, kind: phrase.kind, why: phrase.why, by: plan.by || "rules" });
    }
    at += n;
  }
  // The cuts that hold no words (the silence before the first words, a long pause shortened) have no ids to give: they go by their times.
  const said = new Set(phrases.filter((phrase) => count(phrase) > 0).map((phrase) => phrase.id));
  for (const range of Array.isArray(plan?.ranges) ? plan.ranges : []) {
    if (range.keep !== false || (Array.isArray(range.phrases) ? range.phrases : []).some((id) => said.has(id))) continue;
    found.push({ from: null, to: null, start: range.start, end: range.end, kind: range.kind, why: range.why, by: plan.by || "rules" });
  }
  const suggestions = found.map((cut, i) => ({ i, cut })).sort((x, y) => x.cut.start - y.cut.start || x.i - y.i).map(({ cut }, i) => ({ n: i + 1, ...cut }));
  return { version: 1, clock: "recording", suggestions };
}

/** The middle of a word's time: a stretch holds a word when it holds its middle, since a stretch ends on a whole picture. */
const middle = (word) => (word.start + word.end) / 2;
const wordsIn = (transcript, { start, end }) => transcript.filter((word) => middle(word) >= start && middle(word) <= end);

/** brimm/reel-suggestions.json (5.8): each Reel candidate of reels.json (reel-candidates.js reelCandidates), {n, title, why, first, last,
    stretches}: its title and why Claude picked it, its first and last words, and its stretches in seconds of the recording, each
    with the ids of the first and last words it holds (null when it holds none). */
export function reelSuggestions(candidates, transcript) {
  const reels = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const ranges = Array.isArray(candidate.ranges) ? candidate.ranges : [];
    const stretches = ranges.map(({ start, end }) => {
      const said = wordsIn(transcript, { start, end });
      return { start, end, from: said[0]?.id ?? null, to: said[said.length - 1]?.id ?? null };
    });
    const said = ranges.flatMap((range) => wordsIn(transcript, range));
    return { n: candidate.n, title: candidate.title ?? "", why: candidate.reason ?? "", first: said[0]?.text ?? "", last: said[said.length - 1]?.text ?? "", stretches };
  });
  return { version: 1, clock: "recording", reels };
}

/** The phrases of a cut plan as places among the words of a Reel, for a cue Claude wrote for a phrase to be looked for there first: the
    spans of the plan's phrases (graphic-cues.js phraseSpans, counted over all the recording's words, as the cut suggestions are),
    moved by where the Reel's first word is among them and cut to the Reel's `count` words. The Reel's first word is the first of
    the recording's `placed` words whose middle is not before the stretch's start (reelWords takes the words whose middle is
    inside). A phrase that is wholly outside the Reel has no place in it, and nor has one the plan does not have. */
function reelPhraseSpans(phrases, placed, stretch, count) {
  const first = placed.findIndex((word) => (word.start + word.end) / 2 >= stretch.start);
  const spans = new Map();
  if (first === -1) return spans;
  for (const [id, [from, to]] of phraseSpans(phrases)) {
    const [a, b] = [from - first, to - first];
    if (b >= 0 && a < count) spans.set(id, [Math.max(0, a), Math.min(count - 1, b)]);
  }
  return spans;
}

/** A Reel's graphic cues, placed on the Reel's own words (PR H2), whichever way it has them:
    - `input.reelCues`, for a Reel of a video her editor finished: the cues Claude read of the Reel's stretch alone (readings.js
      readReelCues), placed on the Reel's own transcript as a main video's are, three at most, in the order given. A cue written for a
      phrase of the plan (its `phrase`) is looked for in that phrase first, as the plan's phrases fall among the Reel's words (all of
      them, kept or not: a finished video keeps the whole of itself); the words alone, from the first, when it names none the Reel holds;
    - `input.graphicCues`, for a Reel of a raw episode: the episode's cues, placed first on the words of the whole recording as the main
      video's are (so a cue is on the take she keeps, and a cue that names a phrase the plan cuts counts as naming none), and then taken
      to the Reel (graphic-cues.js reelGraphicCues): those wholly inside its stretch, the first three, on its own clock and with its own ids.
    `placed` are the recording's words as they are said (saidWords), and `transcript` the Reel's own (transcriptJson of reelWords). */
function reelCues(input, { placed, transcript }) {
  const spell = speller(input.spellings);
  if (Array.isArray(input.reelCues)) {
    const spans = reelPhraseSpans(input.plan?.phrases, placed, input.stretch, transcript.length);
    return placeGraphicCues(input.reelCues.slice(0, REEL_CUES_MOST), transcript, { spans, spell });
  }
  if (!Array.isArray(input.graphicCues)) return [];
  const phrases = input.plan?.phrases;
  const onRecording = placeGraphicCues(input.graphicCues, transcriptJson(placed, input.spellings), { spans: keptPhraseSpans(phrases), kept: keptIndexes(phrases), spell });
  // The stretch's ends are on pictures, so a cue at the Reel's very start or end may be a few thousandths outside them: it is the Reel's.
  return reelGraphicCues(onRecording, input.stretch, transcript, { spell, slack: REEL_EDGE_SLACK });
}

/** A main video's graphic cues, each placed on the transcript's own words (graphic-cues.js): in its own phrase when that phrase is kept, and
    else in kept words before any cut, so a cue that names a phrase the plan cuts is placed as if it named none. The words of a cue are
    spelled as the transcript's are. A short video's are the ones its reading kept in its record (PR H2), placed as a raw video's are. */
function mainCues(input, transcript) {
  const graphicCues = Array.isArray(input.graphicCues) ? input.graphicCues : [];
  return placeGraphicCues(graphicCues, transcript, { spans: keptPhraseSpans(input.plan?.phrases), kept: keptIndexes(input.plan?.phrases), spell: speller(input.spellings) });
}

/** The graphic cues that the project `input` makes (as projectFiles takes it) lists in brimm/graphic-cues.json, placed, with each cue's style as
    it came: for a main project (from `graphicCues`) and a Reel's (from `graphicCues` or `reelCues`). A caller asks it which pictures the cues
    name (references.js refNamesOf) before it makes the project, to have those pictures ready (PR H3). None for a session's clip, which has no
    cues, and for any other kind. */
export function projectCues(input) {
  const { kind } = input ?? {};
  if (kind === "main") return mainCues(input, transcriptJson(saidWords(input.words, input.plan?.phrases), input.spellings));
  if (kind !== "reel" || !isStretch(input.stretch)) return [];
  const placed = saidWords(input.words, input.plan?.phrases);
  return reelCues(input, { placed, transcript: transcriptJson(reelWords(placed, input.stretch), input.spellings) });
}

// --- The reference pictures (PR H3) ---

/** Whether a name is one file's name and leads nowhere else: no slash, backslash or control character in it, and no dot to begin it. */
const bareFileName = (name) => name !== "" && !/[\\/\u0000-\u001f\u007f]/.test(name) && !name.startsWith(".");

/** The reference pictures a project is given, [{ name, path }]: `name` is the file's name in the reference folder, and `path` the whole path
    of the file to copy into the project, which for a HEIC or TIFF picture is the JPEG made of it (references.js). None for a session's
    clip, whatever it is given. A reference of another shape throws: a name that is not a file name of its own would lead out of the project. */
function referencesOf(input, episode) {
  if (!episode || input.references === undefined || input.references === null) return [];
  const sound = (r) => r !== null && typeof r === "object" && typeof r.name === "string" && bareFileName(r.name) && typeof r.path === "string" && isAbsolute(r.path);
  if (!Array.isArray(input.references) || !input.references.every(sound)) {
    throw new Error(`projectFiles: references are a list of { name, path }, each name a file name of its own and each path a whole path, and ${JSON.stringify(input.references)} are not`);
  }
  return input.references;
}

/** The cues with the name of each picture they name as the project holds it: a cue that names a picture the project was given (by a name that
    is the same for a person, as sameName says) names the file in brimm/references/, which for a picture made a JPEG is the JPEG's name. A cue
    that names a picture the project was not given keeps its style as it came. */
function namedAsHeld(cues, references) {
  if (!references.length) return cues;
  return cues.map((cue) => {
    const ref = cue?.style?.ref;
    const given = typeof ref === "string" ? references.find((r) => sameName(r.name, ref)) : undefined;
    return given && projectNameOf(given.name) !== ref ? { ...cue, style: { ref: projectNameOf(given.name) } } : cue;
  });
}

// --- The notes for the agent ---

/** HyperFrames' docs site, which the guidance links to: the agent is never sent to the network. */
const DOCS_SITE = /hyperframes\.heygen\.com/i;
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A command the agent may not run, as the guidance spells one: `npx hyperframes catch-up`, `hyperframes init --tailwind`. */
const NOT_THE_AGENTS = new RegExp(`\\bhyperframes(?:@[\\w.-]+)?\\s+(?:${Object.keys(COMMANDS).filter((name) => COMMANDS[name].class !== "agent").map(escaped).join("|")})\\b`);
/** A line of the guidance that conflicts with BRIMM's rules: it names a command the agent may not run, publishing, the
    registry, updating skills, or the docs site. */
const conflicts = (line) => DOCS_SITE.test(line) || /\bpublish\b|\bregistry\b|skills update/i.test(line) || NOT_THE_AGENTS.test(line);

const FENCE = /^\s*```/;
const ITEM = /^\s{0,3}(?:[-*]|\d+\.)\s/;
/** A text's blocks, split at its blank lines, a fenced block of code kept whole. */
function blocksOf(text) {
  const blocks = [];
  let block = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (FENCE.test(line)) fenced = !fenced;
    if (!fenced && line.trim() === "") {
      if (block.length) blocks.push(block);
      block = [];
    } else block.push(line);
  }
  if (block.length) blocks.push(block);
  return blocks;
}
/** A list's items, each its first line and the lines that go on from it. */
function itemsOf(block) {
  const items = [];
  for (const line of block) {
    if (ITEM.test(line) || !items.length) items.push([line]);
    else items[items.length - 1].push(line);
  }
  return items;
}

/** HyperFrames' own guidance, the CLAUDE.md the pinned package ships (5.4, item 3), without what conflicts with BRIMM's rules: a
    paragraph or a quote that says any of it goes whole; in a list, the item that says it goes; in a block of code, the line that
    says it goes, and the block goes when no code is left in it; a paragraph that ends with a colon goes with the block it leads
    to. A link to the docs site keeps its words and loses the address. */
export function hyperframesGuidance(text) {
  const unlinked = String(text ?? "").replace(/\[([^\]]+)\]\((?:https?:\/\/)?hyperframes\.heygen\.com[^)]*\)/gi, "$1");
  const blocks = blocksOf(unlinked);
  const kept = blocks.map((block) => {
    if (FENCE.test(block[0])) {
      const lines = block.filter((line) => !conflicts(line));
      return lines.some((line) => !FENCE.test(line) && line.trim()) ? lines : null;
    }
    if (ITEM.test(block[0])) {
      const items = itemsOf(block).filter((item) => !item.some(conflicts));
      return items.length ? items.flat() : null;
    }
    return block.some(conflicts) ? null : block;
  });
  for (let i = 0; i < kept.length - 1; i++) {
    const leads = !FENCE.test(blocks[i][0]) && !ITEM.test(blocks[i][0]) && /:\s*$/.test(blocks[i][blocks[i].length - 1]);
    if (kept[i] && leads && kept[i + 1] === null) kept[i] = null;
  }
  return `${kept.filter(Boolean).map((block) => block.join("\n")).join("\n\n")}\n`;
}

/** The commands a project's agent never runs, as the rules name them. */
const barredList = (cls) => Object.keys(COMMANDS).filter((name) => COMMANDS[name].class === cls).map((name) => `\`${name}\``);
const inWords = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

/** What a session's clip is told before anything else (5.4, item 4). */
const CLIP_RULES = `# A clip of a private client session

This is a clip of a private client session. These rules come before everything else in this file.

- **Nothing of it goes anywhere.** No Share, no render in the cloud, and no transcription in the Script panel.
- **No web.** Never search the web or fetch anything from it while working on this clip.
- **Its own files only.** Use this project's files, and nothing from another project.
- **No new projects.** Never make a Reel or any other new project from this clip: a new project holds a second copy of the clip outside Studio's care. Say it is not done for a client session's clip.`;

/** The rule about generated people in the notes of a main video and of a Reel (Jason, 2026-11-04, after A1). HeyGen's tools are open
    and nothing here blocks them: the agent warns her first, in his words, before an AI avatar, lip-sync or an AI-generated Sallie, her
    face or her voice, goes ahead only if she still wants it, and reminds her of YouTube's label. The notes are the only guard in the
    app, which starts its agent with `--setting-sources user`: a project's `.claude/settings.json` has no effect there. */
const AI_PEOPLE = "- **AI-generated people.** HeyGen's tools are open. The BRIMM doesn't use AI avatars, lip-sync, or an AI-generated Sallie, her face or her voice, for now. If she asks for one of these, warn her first: \"The BRIMM doesn't use AI avatars or an AI Sallie, her face or her voice, for now. Do you still want it?\" Go ahead only if she still wants it, and remind her that YouTube needs the video marked as altered or synthetic content. A stock HeyGen voice is fine without the warning, with the same YouTube reminder.";

/** A session clip's rule about generated people, as it was before 2026-11-04. CLAUDE.md says no session clip uses HeyGen's features
    until HeyGen confirms the training opt-out, so HeyGen's tools are not open in a clip's notes. */
const NO_GENERATED_PEOPLE = "- **No generated people.** No HeyGen avatars, HeyGen voices or HeyGen Video 1 clips without Jason's yes. No generated people who could pass as real, and never a generated Sallie, face or voice.";

/** The ruling of 2026-10-28 (plan PR 5): a Reel is made by Studio only. The app, asked for a Reel, makes it as a project of its
    own in ~/.hyperframes-studio/, outside BRIMM Video Work, with a copy of the whole recording in its assets (A0), and Studio
    could not find its export for the hand-off. So the agent is told never to make one, and what to tell her instead: the
    phrase of architecture 6.3 that runs `app "<episode>" reel 2`. */
const REELS_ARE_STUDIOS = `Never make a Reel as a new project yourself: the app would put it outside BRIMM Video Work with a second copy of the whole recording, and Studio could not find its export. Studio makes every Reel. When she asks you for one, tell her to say "Open Reel 2 in HyperFrames" in her Claude chat, with the number of the Reel she wants.`;

/** What a short video's main project has in place of the Reels' line. It has no Reels to ask for (`app … reel` answers that a short
    video has none) and no suggestions, so it is not told to send her to "Open Reel 2 in HyperFrames". But the ruling matters as much
    there as anywhere: asked for a Reel, the app's agent would make a project of its own, outside Studio's reach. So its one line says
    no Reel and no new project from it, in the voice of a session clip's rule (CLIP_RULES). */
const SHORT_VIDEO_NO_NEW_PROJECTS = "- **No new projects.** Never make a Reel or any other new project from this video: a new project holds a second copy of the recording outside Studio's care, and a short video has no Reels. Say a short video has no Reels.";

/** The rule of a Reel's own page (Jason, 2 November): what Studio did to it, and what stays. Studio made it upright, 1080 by 1920,
    and cropped it on the speaker, so the agent is told which `object-position` the video was given and how to move it; the Reel
    stays upright for the hand-off (`finish` refuses one that is not); and the face track, when it is there, is for moving the crop
    or following the speaker with. `crop` is reelCrop's, and the rule says the page as it is: cropped on the speaker found, on the
    middle of the picture when no face was found, or not cropped across when the video is upright already. */
function thisReel(crop) {
  const frame = "`#a-roll` fills the frame (`object-fit: cover`)";
  const position = `\`object-position: ${crop.position}% 50%\``;
  const sides = "(0% shows the picture's left edge, 100% its right)";
  const made = !crop.across
    ? `Studio made it upright, 1080 by 1920. Its picture is upright already, so nothing is cropped across: \`#a-roll\` fills the frame (\`object-fit: cover\`, ${position}).`
    : crop.found
      ? `Studio made it upright, 1080 by 1920, and cropped it on the speaker: ${frame} and ${position} puts the speaker, found ${Math.round(crop.at * 100)}% of the way across the picture, in the middle ${sides}.`
      : `Studio made it upright, 1080 by 1920, and cropped it on the middle of the picture, as it found no face to crop on: ${frame} and ${position} shows the middle ${sides}.`;
  return `- **This Reel.** ${made} Keep it upright, 1080 by 1920: it is exported and handed off at that size. \`brimm/face-track.json\`, when it is there, says where the faces are, to move the crop by or to follow the speaker with.`;
}

/** The main project's rule for the graphic cues Studio suggests (PR H1; design 3 and 4): they are offered to her after the cuts and
    built only when she takes them, as a suggested cut is. The times in their file are on the recording's clock, which is the
    project's own until its video has moved (`data-start`). */
const CUES_RULE = "- **Graphic cues.** Studio's suggested graphics are in `brimm/graphic-cues.json`, each tied to the words it goes with: word ids and times on the recording's clock, so add the recording's `data-start` if it has moved. After the cuts, offer them to her, one at a time or all together, and build only the ones she takes: each short (its `seconds`), in the brand, with things and words and never people. A cue with no `at` was not found in her words: tell her, and place it only where she says. Never add a graphic she has not taken.";

/** The sentence that ends the rule in a main project and in a Reel (PR H3; design 7): the pictures she chose from the reference folder are
    in brimm/references/. They are a style reference and not a source: nothing from someone else's post is copied into hers. */
const REFERENCES_SENTENCE = " Files in `brimm/references/` are style references she chose: follow their look, and never copy what is in them.";

const GRAPHIC_CUES_RULE = `${CUES_RULE}${REFERENCES_SENTENCE}`;

/** The rule for the footage cues of a video made from a plan (PR H5b; Jason and A1: "Full cutaway is fine"), in its main project's notes right after the
    rule for graphic cues, and in no other project's: a cue of kind `b-roll` or `screen` shows the footage she filmed for it, a video in media/ with no
    sound, which she takes as she takes a graphic. A cue whose material is not in media/ has no footage yet, or waits for her client's agreement
    (footage.js mayGoIn), and is never built. */
const FOOTAGE_RULE = "- **Footage cues.** A cue whose kind is `b-roll` or `screen` shows footage she filmed for it: its `material`, a video in `media/` with no sound. When she takes it, put that video at the cue's words for its `seconds`, muted, as a full cutaway over the recording, and keep the recording's sound. Wide footage fills the frame. Upright footage goes in the middle as a rounded panel on a plain mist background, hiding the recording for those seconds. A cue whose `material` is not in `media/` has no footage yet, or waits for her client's agreement: tell her, and never build it.";

/** The rule an explainer's main project adds to its notes (PR H6), right after the rule for graphic cues: what the video is, and that it stays upright. */
const EXPLAINER_RULE = "- **This explainer.** It is graphics and words on screen over a voice, with no video of her. Keep it upright, 1080 by 1920: it is exported and handed off at that size.";

/** The rule a HeyGen explainer's project adds after it (PR H6): its voice is a stock HeyGen voice, which the app's own tool makes from the teleprompter
    script once she has chosen one. */
const VOICE_RULE = "- **Its voice.** A stock HeyGen voice she chooses reads it. When she has chosen one, make it with the app's voice tool from `brimm/teleprompter.txt`, word for word, put it on the timeline from the start, and make the composition as long as the voice.";

/** The rule for the words of a HeyGen explainer's project, in place of the one every other project has (PR H6): the voice is not made yet, so there are no
    words, and when it is made the app's own transcript of it, beside it in assets/, is what to use. */
const HEYGEN_WORDS_RULE = "- **The words.** There are none yet: they are the voice's, in the app's transcript beside it in `assets/` once it is made. Never transcribe again.";

/** The rule for the graphic cues of a HeyGen explainer's project, in place of H1's (PR H6; with H3's sentence about brimm/references/ after it): the cues
    have no times yet, since the voice is not made, so the agent places each on its words in the voice's transcript once it is, and tells her of one the
    voice does not say. */
const HEYGEN_CUES_RULE = `- **Graphic cues.** Studio's suggested graphics are in \`brimm/graphic-cues.json\`, each with the words it goes with and no times yet. Once the voice is made, place each on its words in the voice's transcript, then offer them to her, one at a time or all together, and build only the ones she takes: each short (its \`seconds\`), in the brand, with things and words and never people. Tell her of a cue whose words the voice does not say, and place it only where she says. Never add a graphic she has not taken.${REFERENCES_SENTENCE}`;

/** The rule for the graphic cues of an explainer in her own voice (PR H6): H1's, but that its times are on the voiceover's clock, which is the project's
    own and which the voiceover does not move from (the page plays it from the start). */
const VOICEOVER_CUES_RULE = `${CUES_RULE.replace("on the recording's clock, so add the recording's `data-start` if it has moved", "on the voiceover's clock")}${REFERENCES_SENTENCE}`;

/** A Reel's rule for the same (PR H2): the same line, but that its times are on the Reel's own clock, which starts where the Reel does
    and is never moved, and that the Reel's frame is upright, with the top 14% and the bottom 35% kept clear for its captions. */
const REEL_GRAPHIC_CUES_RULE = `${CUES_RULE.replace("on the recording's clock, so add the recording's `data-start` if it has moved", "on the Reel's clock")} On this upright Reel, keep graphics and words out of the top 14% and the bottom 35%.${REFERENCES_SENTENCE}`;

/** BRIMM's rules for a project (5.4, item 1): A0's brief, the commands denied (5.5), and what each kind of project has. A short
    video's main project (`short`) has no Reels to ask for, and `app … reel` answers that a short video has none, so it is not told
    to send her to "Open Reel 2 in HyperFrames", and has no line about the Reels Studio suggests; it has one line in their place
    (SHORT_VIDEO_NO_NEW_PROJECTS). A Reel's project has a line about its own page (thisReel), from the `crop` it was made with. A
    session clip's rule about generated people is its old one (NO_GENERATED_PEOPLE), and the other kinds' is AI_PEOPLE. The main project of a video
    made from a plan (`footage`, true when projectFiles was given a list of footage, an empty one too; PR H5b) has the rule for its footage cues
    (FOOTAGE_RULE) right after the rule for graphic cues. An explainer's main project (`explainer`, PR H6: { voice, teleprompter }) has no footage to
    show, and its cue rule is its voice's: in her own voice H1's, with the times on the voiceover's clock; in a HeyGen voice the one that says there
    are no times yet. Right after it come the rule that says what an explainer is (EXPLAINER_RULE) and, for a HeyGen voice, the rule for its voice
    (VOICE_RULE); and a HeyGen explainer's words are none yet (HEYGEN_WORDS_RULE). */
function brimmRules(kind, short = false, crop = null, footage = false, explainer = null) {
  const episode = kind !== "clip";
  const heygen = explainer !== null && explainer.voice === "heygen";
  const cues = explainer === null ? [GRAPHIC_CUES_RULE, ...(footage ? [FOOTAGE_RULE] : [])] : [heygen ? HEYGEN_CUES_RULE : VOICEOVER_CUES_RULE, EXPLAINER_RULE, ...(heygen ? [VOICE_RULE] : [])];
  return [
    "# The BRIMM: rules for this project",
    "",
    "These rules come before everything below. Where anything below says otherwise, these rules win.",
    "",
    "- **A draft only.** This video is a draft for The BRIMM. Never post or publish anything.",
    "- **On this Mac only.** Renders and exports are made on this Mac, never in the cloud.",
    "- **Sharing.** If asked to share, say that Sallie shares from the app's Share button, and only with \"Only people you invite\". Never set a link to \"Anyone with the link\".",
    episode ? AI_PEOPLE : NO_GENERATED_PEOPLE,
    `- **Commands never run here.** Never run these HyperFrames commands, however they are spelled (\`npx hyperframes …\`, \`hyperframes …\`): ${inWords(barredList("denied"))}. Never run \`npm run publish\` either. ${inWords(barredList("edit"))} are Studio's to run, never this project's.`,
    heygen ? HEYGEN_WORDS_RULE : "- **The words.** Every word said, with its time and its id, is in `transcript.json`, made on this Mac. Use it, and never transcribe again.",
    `- **Cutting.** Cut whole phrases at pauses, never in the middle of a word.${kind === "main" ? " When she asks to clean up retakes, propose the cuts in `brimm/cut-suggestions.json` first: those with word ids by their ids, and those with `from` and `to` null (silence) by their `start` and `end` times, the opening first." : ""}`,
    ...(kind === "main" ? cues : []),
    ...(kind === "reel" ? [REEL_GRAPHIC_CUES_RULE] : []),
    ...(kind === "main" ? [short ? SHORT_VIDEO_NO_NEW_PROJECTS : `- **Reels.** The Reels Studio suggests are in \`brimm/reel-suggestions.json\`, by their word ids. ${REELS_ARE_STUDIOS}`] : []),
    ...(kind === "reel" ? [`- **Reels.** ${REELS_ARE_STUDIOS}`, thisReel(crop)] : []),
    ...(episode ? ["- **Spellings.** Spell names in titles and captions as `brimm/spellings.json` says."] : []),
    `- **The brand.** Follow \`brimm/brand.md\`: its colours, Josefin Sans for words and Allison for an accent, from \`assets/fonts/\`${episode ? ", and the logos in `assets/logos/`" : ""}. The name on screen is Sallie Ogden.`,
    kind === "clip" ? CLIP_CAPTIONS_RULE : CAPTIONS_RULE,
    "- **Versions.** When asked what has changed, or to go back, use `npx hyperframes history`.",
    "- **When she is done.** Export on This Mac. Then she says \"hand it off\" in her Claude chat."
  ].join("\n");
}

/** A session clip's rule about captions, as it was: R8a's style is not given to a client session's clip. */
const CLIP_CAPTIONS_RULE = "- **Captions.** A wide main video has no captions drawn on it. Reels have captions, with the top 14% and the bottom 35% of an upright frame kept clear.";

/** The rule about captions in a main video's and a Reel's notes (R8a): where there are none, where they stand, and the one style for
    captions that are drawn, from brand.md: word by word, Josefin Sans (Google Fonts), white with a soft shadow or navy on a mist box. */
const CAPTIONS_RULE = `${CLIP_CAPTIONS_RULE} Captions that are drawn, a Reel's or any she asks for, show one word at a time, each word as it is said, in Josefin Sans Medium from Google Fonts (\`assets/fonts/\`), as spoken, with BRIMM in capitals. Over the picture the words are white with a soft shadow, or navy on a mist box with rounded corners. Words in sand go only on navy.`;

/** What each of a project's files is, as its notes and its facts say. */
const ABOUT = {
  "index.html": "the composition: the video, and what is drawn over it",
  "media/recording.mp4": "the video: the recording, made ready for HyperFrames and not cut",
  "transcript.json": "every word said, with its time and its id",
  "meta.json": "the project's name, for HyperFrames",
  "hyperframes.json": "HyperFrames' settings for the project",
  "package.json": "the scripts `npm run dev`, `npm run check` and `npm run render`",
  ".claude/settings.json": "the commands denied here, and the variables the agent runs with",
  "brimm/facts.json": "what this project is, for Studio",
  "brimm/cut-suggestions.json": "the cuts Studio suggests, by word ids, or by time for silence",
  "brimm/reel-suggestions.json": "the Reels Studio suggests, by word ids",
  "brimm/graphic-cues.json": "the graphics Studio suggests, each on the words it goes with, by word ids",
  "brimm/face-track.json": "where the faces are in this Reel, for the upright crop",
  "brimm/spellings.json": "names spelled as she spells them",
  "brimm/brand.md": "The BRIMM's brand: colours, typefaces, logos and how to use them",
  "assets/fonts/": "Josefin Sans and Allison",
  "assets/logos/": "the logos chosen for this project",
  "brimm/references/": "style references she chose: follow their look, and never copy what is in them",
  "vendor/gsap.min.js": "GSAP, kept here so that nothing is fetched from the network",
  "CLAUDE.md": "these notes (AGENTS.md is the same text)",
  "node_modules/.bin/hyperframes": "a link to this Mac's pinned HyperFrames command line, which `npx hyperframes` runs"
};
/** The project's files as its notes and facts list them: a folder of assets, and the folder of the reference pictures, once each, every
    other file by its path. */
const listed = (paths) => [...new Set(paths.filter((path) => path !== "AGENTS.md").map((path) => (path.startsWith("assets/") ? `${path.slice(0, path.indexOf("/", 7) + 1)}` : path.startsWith("brimm/references/") ? "brimm/references/" : path)))];

/** The name of a footage file in a project's media/ (PR H5b): `media/b-roll-<shot>.mp4` or `media/screen-<shot>.mp4`, the shot a whole number from 1.
    It is the name a cue's `material` gives it (join.js footagePath). */
const FOOTAGE_PATH = /^media\/(b-roll|screen)-([1-9]\d*)\.mp4$/;

/** What a footage file is, as the notes and the facts say it: "b-roll she filmed for shot 2, with no sound", "a screen recording she made for shot 4,
    with no sound"; none for any other path. */
function footageAbout(path) {
  const found = FOOTAGE_PATH.exec(path);
  if (!found) return undefined;
  return found[1] === "b-roll" ? `b-roll she filmed for shot ${found[2]}, with no sound` : `a screen recording she made for shot ${found[2]}, with no sound`;
}

/** What a file of an explainer's project is, where it differs from a video's (PR H6): the page plays graphics and words over a voice, the voice is
    the voiceover (her own, made ready for HyperFrames), and the teleprompter script is what the voice reads. */
const EXPLAINER_ABOUT = {
  "index.html": "the composition: graphics and words over the voice",
  "media/voiceover.m4a": "the voiceover: her voice, made ready for HyperFrames and not cut",
  "brimm/teleprompter.txt": "the teleprompter script: the words the voice reads, as she wrote them"
};

/** What a file is, as a project of this kind says it: a Reel's video is a stretch of the recording, and any other project's is the
    recording itself; a footage file is the footage of its shot; an explainer's project (`explainer`, PR H6) has the voice and the page of its own. */
const aboutOf = (kind, path, explainer = false) => (explainer && EXPLAINER_ABOUT[path]) || (kind === "reel" && path === "media/recording.mp4" ? "the Reel's stretch of the recording, made ready for HyperFrames and not cut inside it" : ABOUT[path] ?? footageAbout(path));

/** The line that says what a project's times are on (5.4, item 2). The main video's and a clip's video is the recording itself, so
    its clock is the recording's own. A Reel's video is a stretch of the recording (architecture 4.3), so its clock starts where
    the stretch does, at `offset` seconds into the recording, and the words of its transcript.json are on it. An explainer's (PR H6) is its
    voiceover's, which is its own; a HeyGen explainer's voice is not made yet, so nothing is on a clock until it is. */
function clockLine(kind, offset, explainer = null) {
  if (explainer !== null) {
    return explainer.voice === "heygen"
      ? "- **Its clock.** There is no voice yet, so no time is on a clock: the times of `transcript.json` and `brimm/` come with the voice, on its own clock."
      : "- **Its clock.** Every time in `transcript.json` and in `brimm/` is on the clock of `media/voiceover.m4a`, which is the voiceover's own: nothing was cut from it.";
  }
  if (kind !== "reel") return "- **Its clock.** Every time in `transcript.json` and in `brimm/` is on the clock of `media/recording.mp4`, which is the recording's own: nothing was cut from it.";
  return `- **Its clock.** Every time in \`transcript.json\` and in \`brimm/\` is on the clock of \`media/recording.mp4\`, which starts at ${clockText(offset)} (${thousandth(offset)} seconds) into the episode's recording: this Reel is that stretch of it, and nothing was cut from the stretch.`;
}

/** What the project is (5.4, item 2): its kind, its name, its clock and its files. */
function thisProject({ kind, what, name, offset, files, explainer = null }) {
  return [
    "# This project",
    "",
    `- **What it is:** ${what}.`,
    `- **Its name:** ${name}. HyperFrames names an export after it.`,
    clockLine(kind, offset, explainer),
    "- **Its files:**",
    ...files.map((path) => `  - \`${path}\`: ${aboutOf(kind, path, explainer !== null) ?? "a file of this project"}.`)
  ].join("\n");
}

/** The notes for the agent (5.4), the text of both CLAUDE.md and AGENTS.md: a session clip's own rules first, then BRIMM's rules,
    then what the project is, then HyperFrames' own guidance without what conflicts. */
function notesText({ kind, what, name, offset, files, guidance, short, crop, footage = false, explainer = null }) {
  return [
    ...(kind === "clip" ? [CLIP_RULES] : []),
    brimmRules(kind, short, crop, footage, explainer),
    thisProject({ kind, what, name, offset, files, explainer }),
    "# HyperFrames' own guidance\n\nWhat follows is the guidance the pinned HyperFrames ships, without what the rules above forbid.",
    hyperframesGuidance(guidance).trim()
  ].join("\n\n") + "\n";
}

// --- The whole file set ---

/** HyperFrames' settings, the golden's without the registry, which sits on a moving branch: the registry is only for installing
    blocks, which the agent may not do (`add`, 5.5). If A0b shows the app needs the key, it comes back as "". */
const HYPERFRAMES_JSON = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
  media: { autoProxy: true }
};
/** The package's scripts: the golden's three, run by the link in node_modules/.bin, and no publish. */
const SCRIPTS = { dev: "hyperframes preview", check: "hyperframes check", render: "hyperframes render" };
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
/** What `.claude/settings.json` holds in a project of that kind ("main", which a Reel's is too, or "clip"): the pin's table of denied commands
    and the environment (5.5). A project rebuilt from a snapshot makes the file again from it, since a snapshot leaves out names that start
    with a dot (snapshot.js). */
export const settingsText = (kind) => jsonText(settingsFor(kind));

/** The footage a main project is given (PR H5b), [{ path, from }]: the copies with no sound of a plan's b-roll and screen recordings that may go in
    (join.js footageToUse), each `path` the name its cue gives it in media/ (FOOTAGE_PATH) and once, each `from` the whole path of the copy to move
    there. null for a project given none, which is every project but a video made from a plan's main one: a Reel or a clip is given no footage
    whatever it is handed. A list of another shape throws: a name outside media/ would lead out of it, or over the recording. */
function footageOf(input) {
  if (input.kind !== "main" || input.footage === undefined || input.footage === null) return null;
  const sound = (f) => f !== null && typeof f === "object" && typeof f.path === "string" && FOOTAGE_PATH.test(f.path) && typeof f.from === "string" && isAbsolute(f.from);
  if (!Array.isArray(input.footage) || !input.footage.every(sound) || new Set(input.footage.map((f) => f.path)).size !== input.footage.length) {
    throw new Error(`projectFiles: footage is a list of { path, from }, each path a footage file of media/ (media/b-roll-2.mp4) once and each from a whole path, and ${JSON.stringify(input.footage)} is not`);
  }
  return input.footage;
}

/** The explainer a main project is made as (PR H6), { voice: "sallie" | "heygen", teleprompter }, or null for every project that is none: a Reel or a
    clip is given none whatever it is handed. `teleprompter` is the plan's teleprompter script as a text, which the project holds as
    brimm/teleprompter.txt. A value of another shape throws, since the notes would then say what the project is not. */
function explainerOf(input) {
  if (input.kind !== "main" || input.explainer === undefined || input.explainer === null) return null;
  const e = input.explainer;
  if (typeof e !== "object" || Array.isArray(e) || !["sallie", "heygen"].includes(e.voice) || typeof e.teleprompter !== "string") {
    throw new Error(`projectFiles: an explainer is { voice: "sallie" or "heygen", teleprompter: the teleprompter script as a text }, and ${JSON.stringify(input.explainer)} is not`);
  }
  return e;
}

/** The whole file set of a project (5.2), a Map from each path in the project to what goes there: a text, or {copy: path} for a
    file to copy, {link: path} for the link to the toolchain, or {move: path} for the working copy, which is renamed in last.
    `input` is {kind, id, facts, words, video, cli, guidance, createdAt}, and:
    - for an episode's part, `name` and, for a Reel, `part` ({reel: n}); its `spellings` ([wrong, right] pairs) and `logos`
      (the paths of the logos chosen, in the Assets folder);
    - for the main video, the cut `plan` and the Reel candidates, `reels`, and `number`, which main project this is (projectName),
      the first when it is not given; `graphicCues`, the cut plan's graphic cues (graphic-cues.js graphicCuesOf, or for a plan made
      before them graphicCuesOfPlan), which brimm/graphic-cues.json places on the transcript's words; and `short`, true when the
      episode is a short video (an iPhone clip), which has no Reels: its notes say nothing of them (brimmRules). Its graphic cues are
      the ones its reading kept in its record (graphic-cues.js graphicCuesOfRecord; its cut plan holds none), given as a raw video's are;
    - for a Reel, its `stretch` of the recording, { start, end } in seconds (a Reel's video is that stretch, cut by workcopy.js, and
      its words are the recording's words in it, on its own clock: reelWords), the cut `plan` of the recording, by whose phrases the
      words are placed as the main video's are, before they are chosen (it may be none: the words are then only moved inside their
      time), and the `faces` the face finder printed of its video, { every, stills }, if any were looked for (faceTrack: a file only
      when one holds a face; the page is upright, cropped on the speaker they show, or on the middle of the picture when none does:
      reelCrop). No cut or Reel suggestions are written, and the plan cuts nothing. Its brimm/graphic-cues.json is always written,
      with the Reel's clock (PR H2): of a raw episode's Reel from `graphicCues`, the cut plan's cues of the episode (reelGraphicCues
      takes those inside the stretch), and of a finished video's Reel from `reelCues`, the cues Claude read of the Reel itself;
    - for an episode's part (a main video's or a Reel's), `references` too (PR H3): [{ name, path }], the pictures its cues name (and any she chose)
      from the reference folder, each `name` the file's name there and `path` the file to copy, which for a HEIC or TIFF picture is the JPEG made
      of it (references.js). Each is copied to brimm/references/<name as Claude reads it> and listed as a folder, and a cue that names one names
      that file (a cue that names a picture not given keeps its style as it came);
    - for the main video of a video made from a plan (PR H5b), `footage` too: [{ path, from }], the copies with no sound of its b-roll and screen
      recordings that may go in (join.js footageToUse), each moved in under the name its cue gives it in media/ (`media/b-roll-2.mp4`; footageOf).
      Its `graphicCues` are then the plan's guide's, each b-roll and screen cue naming that file as its `material` whether or not the file is
      in yet (join.js withMaterial). The list may be empty; given one, the notes have the rule for footage cues (FOOTAGE_RULE). A Reel and a
      clip are given no footage, whatever is handed them;
    - for the main video of an explainer (PR H6), `explainer`: { voice: "sallie" | "heygen", teleprompter }. Its page is the explainer's
      (explainerHtml), upright, and holds brimm/teleprompter.txt too. In her own voice (`sallie`) `video` is the working copy of the voiceover,
      a sound (workcopy.js voiceCopyArgs), moved in as media/voiceover.m4a in place of media/recording.mp4, and the words are the voiceover's, as
      those of any video are. In a HeyGen voice the voice is not made yet, and the project has no media at all and no `video`, its words are none,
      and its cues have no place. Its notes say what it is (brimmRules). A Reel and a clip are given no explainer, whatever is handed them;
    - for a session's clip, `clip`, its number. A clip has no spellings, suggestions, logos or references, whatever it is given, and nothing
      of its name or its file's is written anywhere.
    `facts` are the working copy's, `words` the episode's (or the clip's, with names muted), `video` the working copy's path,
    `cli` the toolchain's program (hyperframes.js cliPath), `guidance` the CLAUDE.md the pinned package ships, and `createdAt`
    the moment, as an ISO string. */
export function projectFiles(input) {
  const { kind } = input ?? {};
  if (!KINDS.includes(kind)) throw new Error(`projectFiles: a project's kind is "main", "reel" or "clip", not ${JSON.stringify(kind)}`);
  const explainer = explainerOf(input);
  // A HeyGen explainer's project has no media at all: the voice is made in it, by the app's agent, after.
  for (const key of explainer !== null && explainer.voice === "heygen" ? ["cli"] : ["video", "cli"]) if (!isAbsolute(String(input[key] ?? ""))) throw new Error(`projectFiles: ${key} must be an absolute path`);
  if (kind === "reel" && !Number.isInteger(input.part?.reel)) throw new Error("projectFiles: a Reel's project needs its part, {reel: n}");
  if (kind === "reel" && !isStretch(input.stretch)) throw new Error("projectFiles: a Reel's project needs its stretch of the recording, { start, end } in seconds, from 0 at the earliest and ending after it starts");
  const episode = kind !== "clip";
  const name = episode ? projectName({ name: input.name, part: kind === "main" ? "main" : input.part, number: kind === "main" ? input.number : undefined, id: input.id }) : projectName({ clip: input.clip, id: input.id });
  const what = kind === "main" ? `the main video of the ${explainer !== null ? "explainer" : "episode"} “${fileSafe(input.name)}”` : kind === "reel" ? `Reel ${input.part.reel} of the episode “${fileSafe(input.name)}”` : `clip ${input.clip} of a session`;
  // The words are placed as they are said on the recording's clock, by the cut plan's phrases for the main video and a Reel (a
  // clip has none), and only then does a Reel choose its own and move them to its clock: no second halving.
  const placed = saidWords(input.words, kind === "clip" ? [] : input.plan?.phrases);
  const transcript = transcriptJson(kind === "reel" ? reelWords(placed, input.stretch) : placed, episode ? input.spellings : []);
  const track = kind === "reel" ? faceTrack(input.faces) : null;
  // A Reel's page is upright and cropped on the speaker the finder found; a main video's and a clip's is the working copy's own shape.
  const crop = kind === "reel" ? reelCrop(input.facts, track) : null;
  const references = referencesOf(input, episode);
  const footage = footageOf(input);

  const files = new Map();
  files.set("index.html", explainer !== null ? explainerHtml(input.facts, { voiceover: explainer.voice === "sallie" }) : indexHtml(input.facts, crop));
  files.set("meta.json", jsonText({ id: name, name, createdAt: input.createdAt }));
  files.set("hyperframes.json", jsonText(HYPERFRAMES_JSON));
  files.set("package.json", jsonText({ name, private: true, type: "module", scripts: SCRIPTS }));
  files.set("transcript.json", jsonText(transcript));
  files.set(".claude/settings.json", settingsText(episode ? "main" : "clip"));
  if (kind === "main") {
    files.set("brimm/cut-suggestions.json", jsonText(cutSuggestions(input.plan, transcript)));
    files.set("brimm/reel-suggestions.json", jsonText(reelSuggestions(input.reels, transcript)));
    // The graphic cues, each placed on the transcript's own words (mainCues), naming the pictures the project holds as it holds them.
    files.set("brimm/graphic-cues.json", graphicCuesJson(namedAsHeld(mainCues(input, transcript), references), "recording"));
    // An explainer holds the plan's teleprompter script, which its voice reads (or, in her own, read).
    if (explainer !== null) files.set("brimm/teleprompter.txt", explainer.teleprompter);
  }
  if (kind === "reel") files.set("brimm/graphic-cues.json", graphicCuesJson(namedAsHeld(reelCues(input, { placed, transcript }), references), "reel"));
  if (track) files.set("brimm/face-track.json", jsonText(track));
  if (episode) files.set("brimm/spellings.json", jsonText({ version: 1, spellings: [...HOUSE_SPELLINGS, ...(input.spellings ?? [])].map(([wrong, right]) => ({ wrong, right })) }));
  files.set("brimm/brand.md", BRAND);
  files.set("vendor/gsap.min.js", { copy: GSAP });
  for (const font of FONTS) files.set(`assets/fonts/${font.file}`, { copy: own(`./brand/fonts/${font.file}`) });
  if (episode) for (const logo of input.logos ?? []) files.set(`assets/logos/${basename(logo)}`, { copy: logo });
  // The pictures she chose from the reference folder, to follow and never to copy (the rule's last sentence): each under the name Claude reads it by.
  for (const reference of references) files.set(`brimm/references/${projectNameOf(reference.name)}`, { copy: reference.path });
  files.set("node_modules/.bin/hyperframes", { link: input.cli });
  // The video is moved in last, as the recording; an explainer's voice is its voiceover, and a HeyGen explainer has none yet (PR H6).
  if (explainer === null) files.set("media/recording.mp4", { move: input.video });
  else if (explainer.voice === "sallie") files.set(VOICEOVER, { move: input.video });
  // The copies of a video made from a plan's footage, with no sound, each under the name its cue gives it (PR H5b): moved in as the recording is.
  for (const { path, from } of footage ?? []) files.set(path, { move: from });

  const paths = listed([...files.keys(), "brimm/facts.json", "CLAUDE.md"]);
  const facts = input.facts;
  files.set("brimm/facts.json", jsonText({
    version: 1, kind, name, seconds: facts.seconds, width: facts.width, height: facts.height, fps: facts.fps,
    // Where a Reel's video starts in the recording (4.3): Studio reads it back, and the notes say it.
    ...(kind === "reel" ? { reel: { n: input.part.reel, offset: input.stretch.start } } : {}),
    files: Object.fromEntries(paths.map((path) => [path, aboutOf(kind, path, explainer !== null) ?? ""]))
  }));
  const notes = notesText({ kind, what, name, offset: kind === "reel" ? input.stretch.start : 0, files: paths, guidance: input.guidance, short: kind === "main" && (input.short === true || explainer !== null), crop, footage: footage !== null, explainer });
  files.set("CLAUDE.md", notes);
  files.set("AGENTS.md", notes);
  return files;
}

// --- Putting it on disk ---

/** A file set, if every path in it stays inside the project and none is a .env file; otherwise a throw (5.2). A path is relative,
    of names joined by "/", none of them empty, "." or "..". */
export function assertSafe(files) {
  for (const path of files.keys()) {
    const names = String(path).split("/");
    if (isAbsolute(String(path)) || names.some((n) => n === "" || n === "." || n === "..")) throw new Error(`A project's file must stay inside it, and ${JSON.stringify(path)} would not.`);
    if (names.some((n) => /^\.env(?:\.|$)/.test(n))) throw new Error(`A project never holds a .env file: ${JSON.stringify(path)}.`);
  }
  return files;
}

const moves = (value) => value !== null && typeof value === "object" && "move" in value;

/** Write a project's file set (projectFiles) to `dir`, whole or not at all (5.7). Nothing is written when a path is unsafe
    (assertSafe), and a folder that is there already is refused and left as it is. The project is made beside `dir`, in a folder
    of its own named "<project name> <8 characters>.part": every text, copy and link first, then the working copy renamed in, so
    nothing is copied, and then the whole folder renamed into place. It is made there, on the same disk, and never in a run's own
    folder, which its run removes when it ends, so that a working copy that cannot be put back is never removed with it. On any
    failure the working copy is renamed back to where it was and the half-made folder is removed; if the working copy cannot be
    put back, the half-made folder is left beside the project's and the error says where the working copy is. `fs` is node:fs,
    which a test replaces to make a step fail. Gives `dir`. */
export function writeProject(dir, files, { fs = nodeFs } = {}) {
  assertSafe(files);
  if (!isAbsolute(String(dir ?? ""))) throw new Error("writeProject: the project's folder must be an absolute path");
  if (fs.existsSync(dir)) throw new Error(`A project is already at ${dir}: it is left as it is.`);
  const building = join(dirname(dir), `${basename(dir)} ${randomUUID().slice(0, 8)}.part`);
  const moved = [];
  try {
    fs.mkdirSync(building, { recursive: true });
    for (const [path, value] of files) {
      if (moves(value)) continue;
      const to = join(building, path);
      fs.mkdirSync(dirname(to), { recursive: true });
      if (typeof value === "string") fs.writeFileSync(to, value);
      else if (value && "copy" in value) {
        fs.copyFileSync(value.copy, to);
        // A file copied with a time keeps it (mtimeMs), as a project rebuilt from a snapshot has the times its files had.
        if (Number.isFinite(value.mtimeMs)) fs.utimesSync(to, value.mtimeMs / 1000, value.mtimeMs / 1000);
      }
      else if (value && "link" in value) fs.symlinkSync(value.link, to);
      else throw new Error(`writeProject: ${path} is neither a text nor a file to copy, link or move`);
    }
    for (const [path, value] of files) {
      if (!moves(value)) continue;
      const to = join(building, path);
      fs.mkdirSync(dirname(to), { recursive: true });
      fs.renameSync(value.move, to);
      moved.push({ from: value.move, to });
    }
    fs.renameSync(building, dir);
    return dir;
  } catch (error) {
    const stuck = [];
    for (const { from, to } of moved.reverse()) {
      try {
        fs.renameSync(to, from);
      } catch {
        stuck.push(to);
      }
    }
    if (stuck.length) throw new Error(`${error.message}. The working copy could not be put back, and is at ${stuck.join(", ")}`, { cause: error });
    fs.rmSync(building, { recursive: true, force: true });
    throw error;
  }
}
