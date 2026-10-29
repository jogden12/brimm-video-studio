// A HyperFrames project's whole file set, and its writer (architecture 2026-10-27: F4 and F5, and sections 5.1, 5.2, 5.4, 5.7
// and 5.8).
//
// The pinned command line's `init` makes a project BRIMM would have to repair (F4): its page loads GSAP from the network, its
// package has a publish script, its settings name a registry on a moving branch, and its notes send the agent to update skills
// and to publish. So Studio writes every file of a project itself, after what `init --video` and `transcribe` write (the golden
// files, tests/fixtures/hyperframes-0.8.208/init/), with BRIMM's own in place of what conflicts:
//   - the page, HyperFrames' settings, the package and its scripts, with GSAP from the project's own vendor/ folder;
//   - transcript.json, from the episode's words with its spellings (F5), and Studio's suggestions by the same word ids (5.8);
//   - the notes for the agent, CLAUDE.md and AGENTS.md: BRIMM's rules first, then what the project is, then HyperFrames' own
//     guidance without what the rules forbid (5.4);
//   - the brand pack (tool/brand/): the brand's rules, Josefin Sans and Allison; and the logos chosen, from the Assets folder.
// A Reel's project (plan PR 5, architecture 4.3) is a stretch of the recording as a project of its own: its video is that stretch,
// cut by workcopy.js; its transcript.json holds the recording's words in the stretch on the stretch's own clock (reelWords), and
// brimm/facts.json says where the stretch starts in the recording; it has no cut or Reel suggestions, and brimm/face-track.json
// only when the face finder found a face in its video. The notes of a main and a Reel project carry the ruling of 2026-10-28: a Reel
// is made by Studio only, so the agent never makes one as a new project, and tells her to say "Open Reel 2 in HyperFrames" in her
// Claude chat when she asks it for one; a session clip's own rules, first of all, forbid any new project from it.
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

/** The page of a project (5.2): one composition, "main", as long as the working copy, with the working copy as its one video,
    of the working copy's size; GSAP from the project's vendor/ folder and the brand's typefaces from its assets/fonts/, so that
    nothing is loaded from the network (F4). Its structure is the golden's: the same attributes on the root and on the video, and
    one paused timeline registered under the root's id. `facts` are the working copy's, as workcopy.js writes them ({seconds,
    width, height}); the video has sound unless `facts.audio` is false. */
export function indexHtml(facts) {
  const width = Math.round(Number(facts?.width));
  const height = Math.round(Number(facts?.height));
  if (!(width > 0 && height > 0 && Number(facts?.seconds) > 0)) throw new Error("indexHtml: the working copy's facts need its width, height and seconds");
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
        style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"
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
export const saidWords = (words, phrases = []) => heardWords(insideTheirTime(Array.isArray(words) ? words : []), Array.isArray(phrases) ? phrases : []);

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
    fractions of the picture from its top left corner. The upright crop is the app's job; this is what Studio offers for it. null
    when no still holds a face, or the finder printed nothing that can be read: then there is no file. A still whose file has no
    number is left out. */
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

/** transcript.json (F5): the list the pinned `transcribe` writes, {text, start, end, id} for each word in order, its ids "w0",
    "w1", …, made from the episode's words (cuts.js wordsOf: {w, start, end}) with the show's names, the house's spellings and the
    episode's (final-transcript.js spelled). A word keeps its punctuation, its times and its id: a spelling changes its text alone. */
export const transcriptJson = (words, spellings = []) =>
  (Array.isArray(words) ? words : []).map((word, i) => ({ text: spelled(word.w, [...HOUSE_SPELLINGS, ...(spellings ?? [])]), start: word.start, end: word.end, id: `w${i}` }));

/** brimm/cut-suggestions.json (5.8): the phrases the cut plan cuts, as the rules decided and Claude changed them, each by the ids
    of its first and last words in transcript.json and those words' times: {n, from, to, start, end, kind, why, by}. The plan's
    phrases split the episode's words in order (cuts.js phrasesOf), and a word's id is its place in them, so each phrase's words
    are found by counting, never by their times, which two words can share. A plan that does not hold the transcript's words, as
    many of them, is refused: its ids would be wrong. A phrase with no words (a silence) has no ids to give and is left out. `by`
    is who decided the plan, "rules" unless the plan says otherwise. */
export function cutSuggestions(plan, transcript) {
  const phrases = Array.isArray(plan?.phrases) ? plan.phrases : [];
  const count = (phrase) => (Array.isArray(phrase.words) ? phrase.words.length : 0);
  const held = phrases.reduce((sum, phrase) => sum + count(phrase), 0);
  if (phrases.length && held !== transcript.length) throw new Error(`cutSuggestions: the cut plan holds ${held} words and the transcript ${transcript.length}: they must be the same words`);
  const suggestions = [];
  let at = 0;
  for (const phrase of phrases) {
    const n = count(phrase);
    if (phrase.keep === false && n > 0) {
      const first = transcript[at];
      const last = transcript[at + n - 1];
      suggestions.push({ n: suggestions.length + 1, from: first.id, to: last.id, start: first.start, end: last.end, kind: phrase.kind, why: phrase.why, by: plan.by || "rules" });
    }
    at += n;
  }
  return { version: 1, clock: "recording", suggestions };
}

/** The middle of a word's time: a stretch holds a word when it holds its middle, since a stretch ends on a whole picture. */
const middle = (word) => (word.start + word.end) / 2;
const wordsIn = (transcript, { start, end }) => transcript.filter((word) => middle(word) >= start && middle(word) <= end);

/** brimm/reel-suggestions.json (5.8): each Reel candidate of reels.json (reels.js reelCandidates), {n, title, why, first, last,
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

/** The ruling of 2026-10-28 (plan PR 5): a Reel is made by Studio only. The app, asked for a Reel, makes it as a project of its
    own in ~/.hyperframes-studio/, outside BRIMM Video Work, with a copy of the whole recording in its assets (A0), and Studio
    could not find its export for the hand-off. So the agent is told never to make one, and what to tell her instead: the
    phrase of architecture 6.3 that runs `app "<episode>" reel 2`. */
const REELS_ARE_STUDIOS = `Never make a Reel as a new project yourself: the app would put it outside BRIMM Video Work with a second copy of the whole recording, and Studio could not find its export. Studio makes every Reel. When she asks you for one, tell her to say "Open Reel 2 in HyperFrames" in her Claude chat, with the number of the Reel she wants.`;

/** BRIMM's rules for a project (5.4, item 1): A0's brief, the commands denied (5.5), and what each kind of project has. */
function brimmRules(kind) {
  const episode = kind !== "clip";
  return [
    "# The BRIMM: rules for this project",
    "",
    "These rules come before everything below. Where anything below says otherwise, these rules win.",
    "",
    "- **A draft only.** This video is a draft for The BRIMM. Never post or publish anything.",
    "- **On this Mac only.** Renders and exports are made on this Mac, never in the cloud.",
    "- **Sharing.** If asked to share, say that Sallie shares from the app's Share button, and only with \"Only people you invite\". Never set a link to \"Anyone with the link\".",
    "- **No generated people.** No HeyGen avatars, HeyGen voices or HeyGen Video 1 clips without Jason's yes. No generated people who could pass as real, and never a generated Sallie, face or voice.",
    `- **Commands never run here.** Never run these HyperFrames commands, however they are spelled (\`npx hyperframes …\`, \`hyperframes …\`): ${inWords(barredList("denied"))}. Never run \`npm run publish\` either. ${inWords(barredList("edit"))} are Studio's to run, never this project's.`,
    "- **The words.** Every word said, with its time and its id, is in `transcript.json`, made on this Mac. Use it, and never transcribe again.",
    `- **Cutting.** Cut whole phrases at pauses, never in the middle of a word.${kind === "main" ? " When she asks to clean up retakes, propose the cuts in `brimm/cut-suggestions.json` first, by their word ids." : ""}`,
    ...(kind === "main" ? [`- **Reels.** The Reels Studio suggests are in \`brimm/reel-suggestions.json\`, by their word ids. ${REELS_ARE_STUDIOS}`] : []),
    ...(kind === "reel" ? [`- **Reels.** ${REELS_ARE_STUDIOS}`, "- **This Reel.** It is exported upright, 1080 by 1920: if its picture is wide, make the composition upright and crop it on the speaker. `brimm/face-track.json`, when it is there, says where the faces are."] : []),
    ...(episode ? ["- **Spellings.** Spell names in titles and captions as `brimm/spellings.json` says."] : []),
    `- **The brand.** Follow \`brimm/brand.md\`: its colours, Josefin Sans for words and Allison for an accent, from \`assets/fonts/\`${episode ? ", and the logos in `assets/logos/`" : ""}. The name on screen is Sallie Ogden.`,
    "- **Captions.** A wide main video has no captions drawn on it. Reels have captions, with the top 14% and the bottom 35% of an upright frame kept clear.",
    "- **Versions.** When asked what has changed, or to go back, use `npx hyperframes history`.",
    "- **When she is done.** Export on This Mac. Then she says \"hand it off\" in her Claude chat."
  ].join("\n");
}

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
  "brimm/cut-suggestions.json": "the cuts Studio suggests, by word ids",
  "brimm/reel-suggestions.json": "the Reels Studio suggests, by word ids",
  "brimm/face-track.json": "where the faces are in this Reel, for the upright crop",
  "brimm/spellings.json": "names spelled as she spells them",
  "brimm/brand.md": "The BRIMM's brand: colours, typefaces, logos and how to use them",
  "assets/fonts/": "Josefin Sans and Allison",
  "assets/logos/": "the logos chosen for this project",
  "vendor/gsap.min.js": "GSAP, kept here so that nothing is fetched from the network",
  "CLAUDE.md": "these notes (AGENTS.md is the same text)",
  "node_modules/.bin/hyperframes": "a link to this Mac's pinned HyperFrames command line, which `npx hyperframes` runs"
};
/** The project's files as its notes and facts list them: a folder of assets once, every other file by its path. */
const listed = (paths) => [...new Set(paths.filter((path) => path !== "AGENTS.md").map((path) => (path.startsWith("assets/") ? `${path.slice(0, path.indexOf("/", 7) + 1)}` : path)))];

/** What a file is, as a project of this kind says it: a Reel's video is a stretch of the recording, and any other project's is the
    recording itself. */
const aboutOf = (kind, path) => (kind === "reel" && path === "media/recording.mp4" ? "the Reel's stretch of the recording, made ready for HyperFrames and not cut inside it" : ABOUT[path]);

/** The line that says what a project's times are on (5.4, item 2). The main video's and a clip's video is the recording itself, so
    its clock is the recording's own. A Reel's video is a stretch of the recording (architecture 4.3), so its clock starts where
    the stretch does, at `offset` seconds into the recording, and the words of its transcript.json are on it. */
function clockLine(kind, offset) {
  if (kind !== "reel") return "- **Its clock.** Every time in `transcript.json` and in `brimm/` is on the clock of `media/recording.mp4`, which is the recording's own: nothing was cut from it.";
  return `- **Its clock.** Every time in \`transcript.json\` and in \`brimm/\` is on the clock of \`media/recording.mp4\`, which starts at ${clockText(offset)} (${thousandth(offset)} seconds) into the episode's recording: this Reel is that stretch of it, and nothing was cut from the stretch.`;
}

/** What the project is (5.4, item 2): its kind, its name, its clock and its files. */
function thisProject({ kind, what, name, offset, files }) {
  return [
    "# This project",
    "",
    `- **What it is:** ${what}.`,
    `- **Its name:** ${name}. HyperFrames names an export after it.`,
    clockLine(kind, offset),
    "- **Its files:**",
    ...files.map((path) => `  - \`${path}\`: ${aboutOf(kind, path) ?? "a file of this project"}.`)
  ].join("\n");
}

/** The notes for the agent (5.4), the text of both CLAUDE.md and AGENTS.md: a session clip's own rules first, then BRIMM's rules,
    then what the project is, then HyperFrames' own guidance without what conflicts. */
function notesText({ kind, what, name, offset, files, guidance }) {
  return [
    ...(kind === "clip" ? [CLIP_RULES] : []),
    brimmRules(kind),
    thisProject({ kind, what, name, offset, files }),
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

/** The whole file set of a project (5.2), a Map from each path in the project to what goes there: a text, or {copy: path} for a
    file to copy, {link: path} for the link to the toolchain, or {move: path} for the working copy, which is renamed in last.
    `input` is {kind, id, facts, words, video, cli, guidance, createdAt}, and:
    - for an episode's part, `name` and, for a Reel, `part` ({reel: n}); its `spellings` ([wrong, right] pairs) and `logos`
      (the paths of the logos chosen, in the Assets folder);
    - for the main video, the cut `plan` and the Reel candidates, `reels`, and `number`, which main project this is (projectName),
      the first when it is not given;
    - for a Reel, its `stretch` of the recording, { start, end } in seconds (a Reel's video is that stretch, cut by workcopy.js, and
      its words are the recording's words in it, on its own clock: reelWords), the cut `plan` of the recording, by whose phrases the
      words are placed as the main video's are, before they are chosen (it may be none: the words are then only moved inside their
      time), and the `faces` the face finder printed of its video, { every, stills }, if any were looked for (faceTrack: a file only
      when one holds a face). No cut or Reel suggestions are written, and the plan cuts nothing;
    - for a session's clip, `clip`, its number. A clip has no spellings, suggestions or logos, whatever it is given, and nothing
      of its name or its file's is written anywhere.
    `facts` are the working copy's, `words` the episode's (or the clip's, with names muted), `video` the working copy's path,
    `cli` the toolchain's program (hyperframes.js cliPath), `guidance` the CLAUDE.md the pinned package ships, and `createdAt`
    the moment, as an ISO string. */
export function projectFiles(input) {
  const { kind } = input ?? {};
  if (!KINDS.includes(kind)) throw new Error(`projectFiles: a project's kind is "main", "reel" or "clip", not ${JSON.stringify(kind)}`);
  for (const key of ["video", "cli"]) if (!isAbsolute(String(input[key] ?? ""))) throw new Error(`projectFiles: ${key} must be an absolute path`);
  if (kind === "reel" && !Number.isInteger(input.part?.reel)) throw new Error("projectFiles: a Reel's project needs its part, {reel: n}");
  if (kind === "reel" && !isStretch(input.stretch)) throw new Error("projectFiles: a Reel's project needs its stretch of the recording, { start, end } in seconds, from 0 at the earliest and ending after it starts");
  const episode = kind !== "clip";
  const name = episode ? projectName({ name: input.name, part: kind === "main" ? "main" : input.part, number: kind === "main" ? input.number : undefined, id: input.id }) : projectName({ clip: input.clip, id: input.id });
  const what = kind === "main" ? `the main video of the episode “${fileSafe(input.name)}”` : kind === "reel" ? `Reel ${input.part.reel} of the episode “${fileSafe(input.name)}”` : `clip ${input.clip} of a session`;
  // The words are placed as they are said on the recording's clock, by the cut plan's phrases for the main video and a Reel (a
  // clip has none), and only then does a Reel choose its own and move them to its clock: no second halving.
  const placed = saidWords(input.words, kind === "clip" ? [] : input.plan?.phrases);
  const transcript = transcriptJson(kind === "reel" ? reelWords(placed, input.stretch) : placed, episode ? input.spellings : []);
  const track = kind === "reel" ? faceTrack(input.faces) : null;

  const files = new Map();
  files.set("index.html", indexHtml(input.facts));
  files.set("meta.json", jsonText({ id: name, name, createdAt: input.createdAt }));
  files.set("hyperframes.json", jsonText(HYPERFRAMES_JSON));
  files.set("package.json", jsonText({ name, private: true, type: "module", scripts: SCRIPTS }));
  files.set("transcript.json", jsonText(transcript));
  files.set(".claude/settings.json", jsonText(settingsFor(episode ? "main" : "clip")));
  if (kind === "main") {
    files.set("brimm/cut-suggestions.json", jsonText(cutSuggestions(input.plan, transcript)));
    files.set("brimm/reel-suggestions.json", jsonText(reelSuggestions(input.reels, transcript)));
  }
  if (track) files.set("brimm/face-track.json", jsonText(track));
  if (episode) files.set("brimm/spellings.json", jsonText({ version: 1, spellings: [...HOUSE_SPELLINGS, ...(input.spellings ?? [])].map(([wrong, right]) => ({ wrong, right })) }));
  files.set("brimm/brand.md", BRAND);
  files.set("vendor/gsap.min.js", { copy: GSAP });
  for (const font of FONTS) files.set(`assets/fonts/${font.file}`, { copy: own(`./brand/fonts/${font.file}`) });
  if (episode) for (const logo of input.logos ?? []) files.set(`assets/logos/${basename(logo)}`, { copy: logo });
  files.set("node_modules/.bin/hyperframes", { link: input.cli });
  files.set("media/recording.mp4", { move: input.video });

  const paths = listed([...files.keys(), "brimm/facts.json", "CLAUDE.md"]);
  const facts = input.facts;
  files.set("brimm/facts.json", jsonText({
    version: 1, kind, name, seconds: facts.seconds, width: facts.width, height: facts.height, fps: facts.fps,
    // Where a Reel's video starts in the recording (4.3): Studio reads it back, and the notes say it.
    ...(kind === "reel" ? { reel: { n: input.part.reel, offset: input.stretch.start } } : {}),
    files: Object.fromEntries(paths.map((path) => [path, aboutOf(kind, path) ?? ""]))
  }));
  const notes = notesText({ kind, what, name, offset: kind === "reel" ? input.stretch.start : 0, files: paths, guidance: input.guidance });
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
      else if (value && "copy" in value) fs.copyFileSync(value.copy, to);
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
