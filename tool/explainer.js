// The explainer (design 2026-11-04, H6; PR H6): a planned video made of graphics and words over a voice, with no video of her. Its voice is hers, a
// recording of sound alone dropped for it and answered on the planned card (footage.js `footage … voiceover`; join.js takes it in as the plan's video),
// or a stock HeyGen voice that the app's own agent makes in the plan's HyperFrames project, which she says is done (`plan … voice`). This module is the
// second route's: what the plan's project is before the voice is made (openVoiceProject), what the page of a project plays (voiceIn), and the command
// that says the voice is done (voiceFor). Either way the plan then becomes a short video whose video is the voice, and goes on in HyperFrames as any
// short video does (join.js).
//
// edit.js is only the wiring. What this says goes into her chat, so it holds no path and no flag. Nothing here posts, sends or publishes anything, and
// no HeyGen tool is run by Studio: the app's agent makes the voice, in her words and her project, and Studio takes the file it saved.
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { countWords } from "./shared/text.js";
import { logosIn, mediaOf, openOnly, projectGone } from "./app.js";
import { isFromPlan, localStamp, shownName } from "./episode.js";
import { runningCommand, startDetached } from "./detached.js";
import { keepTitle } from "./footage.js";
import { noFootageWhy } from "./gate.js";
import { htmlTree } from "./on-screen.js";
import { projectCues, projectFiles, projectName, writeProject } from "./project.js";
import { refNamesOf, withReferences } from "./references.js";
import { episodeWork } from "./settings.js";
import { teleprompterText } from "./sentences.js";

// --- The voice a project plays ---

/** The folder of a project the app keeps what it is given in, and the voice it makes: `assets/`. */
const ASSETS = "assets";

/** A source as the file it names in the project's assets/, as a path from the project, or "" when it names none: its escapes (%20) turned, its leading
    ./ and doubled slashes settled, and nothing that is an address on the network, an absolute path or a path out of assets/. */
function assetOf(source) {
  if (typeof source !== "string" || source.trim() === "") return "";
  let text = source.trim();
  try {
    text = decodeURIComponent(text);
  } catch (e) {
    // A name that is not escaped is taken as it is written.
  }
  if (/[\0\\]/.test(text) || /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("/")) return "";
  const path = posix.normalize(text);
  return path.startsWith(`${ASSETS}/`) && path.length > ASSETS.length + 1 && !path.split("/").includes("..") && !path.endsWith("/") ? path : "";
}

/** The sound files of assets/ that the page `html` (an index.html) plays, as its `<audio>` elements name them (their `src`, or a `<source>` inside
    them): { src } for the one file they play, however many elements play it (the app splits a clip into several), { several: [src, …] } for two or
    more files, in the order the page first plays them, and { none: true } when the page plays nothing from assets/, or is not a page that can be read.
    The `src` is the file's own path from the project (`assets/HeyGen voice 4f2a.wav`), its escapes turned. A file in media/, an address on the
    network and a path that leaves assets/ are not the voice the app made, and a <video> is not read: the voice is sound. */
export function voiceIn(html) {
  const tree = typeof html === "string" ? htmlTree(html) : null;
  if (tree === null) return { none: true };
  const found = [];
  const see = (source) => {
    const path = assetOf(source);
    if (path !== "" && !found.includes(path)) found.push(path);
  };
  const walk = (node) => {
    if (node.text !== undefined) return;
    if (node.tag === "audio") {
      see(node.attrs.src);
      for (const kid of node.kids) if (kid.tag === "source") see(kid.attrs.src);
    }
    for (const kid of node.kids) walk(kid);
  };
  walk(tree);
  if (found.length === 0) return { none: true };
  return found.length === 1 ? { src: found[0] } : { several: found };
}

// --- The plan's project, before the voice ---

/** A Mac as a person says it: "the Mac Studio", and a name that is her own ("Sallie's laptop") as it is. */
export const onMac = (name) => (/^Mac\b/.test(String(name)) ? `the ${name}` : String(name));

/** How long the page of a HeyGen explainer is before its voice is made: the teleprompter script at 150 words a minute, to the next whole second, and
    at least ten seconds. The agent makes the page as long as the voice once it has one. */
export function voiceSeconds(lines) {
  const words = (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + countWords(line), 0);
  return Math.max(10, Math.ceil((words * 60) / 150));
}

/** Why `app` will not open the project of the planned video `record`, in words, or "": every plan but a HeyGen explainer is refused in the gate's own
    words; a HeyGen explainer whose package is not set has no script to make a project of; a project made on another Mac is that Mac's to open. */
export function voiceProjectWhy(ctx, record) {
  const { planned } = record;
  if (planned.route !== "explainer" || planned.voice !== "heygen") return noFootageWhy(record);
  if (planned.set === null) return `The plan for "${shownName(record)}" isn't made yet: its guide and its teleprompter script come first.`;
  if (planned.project && planned.project.on !== ctx.machine) return `Its HyperFrames project is on ${onMac(planned.project.on)}: open it there.`;
  return "";
}

/** Open the project of a planned HeyGen explainer in the app, making it first when the plan has none (PR H6): an upright project with no media from the
    package (explainerHtml with no voice, as long as voiceSeconds says; transcript.json []; every cue with no place), in the plan's work folder, named as a
    main project. One write gives the plan `planned.project`, and each open adds its time. Nothing is claimed or brought. A project the plan names whose
    folder is gone is not made again (its voice is made in it), and a folder a run left that the plan does not know is taken as the project it is.
    `deps`: `cli`, `guidance` (the path of the CLAUDE.md the package ships), `cues` (the plan's graphic cues, plan-project.js), `save(next)` which
    writes the plan's next record and resolves 0 when it has, and `spawn`, `env`, `node`, `chat` as app.js openOnly has them. Resolves the exit code. */
export async function openVoiceProject(ctx, { found, record }, { cli, guidance, cues, save, spawn, env, node, chat }) {
  const known = record.planned.project;
  const name = known ? known.name : projectName({ name: record.name.text, part: "main", number: 1, id: record.id });
  const dir = join(episodeWork(ctx.home, found.name), name);
  const at = localStamp(new Date(ctx.now()));
  if (known && !existsSync(dir)) {
    ctx.say(projectGone(record.name.text));
    return 1;
  }
  if (!existsSync(dir)) {
    const input = {
      kind: "main", number: 1, short: true, id: record.id, name: record.name.text, spellings: record.spellings, logos: logosIn(ctx.settings.root),
      facts: { seconds: voiceSeconds(record.planned.lines), width: 1080, height: 1920, fps: 30 }, words: [], plan: null, graphicCues: cues,
      cli, guidance: readFileSync(guidance, "utf8"), createdAt: at, explainer: { voice: "heygen", teleprompter: teleprompterText(record.planned.lines) }
    };
    await withReferences(ctx, refNamesOf(projectCues(input)), (references) => writeProject(dir, projectFiles({ ...input, references })));
  }
  const read = openOnly(ctx, { record, dir }, { cli, spawn, env, node, chat });
  const project = known ?? { name, madeAt: at, on: ctx.machine, opened: [] };
  const next = { ...record, planned: { ...record.planned, project: { ...project, opened: read.opened ? [...project.opened, at] : project.opened } } };
  const written = await save(next);
  if (written !== 0) return 1;
  return read.opened ? 0 : 1;
}

// --- plan "<planned>" voice: the HeyGen voice is done ---

/** What `plan … voice` and the run `join --voice` take, and every reason they cannot, in the one place that knows them (as joinCase is for the footage).
    `record` is the plan, `found` its folder. In this order it refuses with { why }: a plan no HeyGen voice reads; one that has its voice already; one with
    no project; a project made on another Mac; a project that is not on this Mac; a page that plays no voice, or more than one sound; a voice that is not a
    plain file of the project's assets/. Otherwise it gives { project, dir, src, file }: the plan's project, its folder, the voice's path from the project
    and where it is. */
export function voiceCase(ctx, found, record) {
  const title = shownName(record);
  const { planned } = record;
  if (planned.route !== "explainer" || planned.voice !== "heygen") return { why: `"${title}" isn't read by a HeyGen voice.` };
  if (isFromPlan(record)) return { why: `"${title}" has its voice already.` };
  const project = planned.project;
  if (!project) return { why: `"${title}" has no HyperFrames project yet: say "open it in HyperFrames" first.` };
  if (project.on !== ctx.machine) return { why: `Its HyperFrames project is on ${onMac(project.on)}: say it there.` };
  const dir = join(episodeWork(ctx.home, found.name), project.name);
  let html;
  try {
    html = readFileSync(join(dir, "index.html"), "utf8");
  } catch (e) {
    return { why: "Its HyperFrames project is not on this Mac any more, so its voice can't be taken in. Ask Jason." };
  }
  const heard = voiceIn(html);
  if (heard.none) return { why: "Its HyperFrames project plays no HeyGen voice yet: have one made there first." };
  if (heard.several) return { why: "Its HyperFrames project plays more than one sound: keep one voice there, then say it again." };
  const file = join(dir, heard.src);
  let plain = false;
  try {
    const here = lstatSync(file);
    plain = here.isFile() && here.size > 0;
  } catch (e) {
    plain = false;
  }
  if (!plain) return { why: "Its HyperFrames project plays a voice that isn't in its assets: have one made there again." };
  return { project, dir, src: heard.src, file };
}

/** `plan "<planned>" voice`, once edit.js has found the plan through the gate: the HeyGen voice made in the plan's project is taken in. Refuses as voiceCase
    does, or while a run is at work on the plan; otherwise starts the run (`join --now <the plan's folder> --voice`, detached) and says a notice comes
    when it is ready. Writes nothing. `kit` is edit.js's (calledAs). */
export function voiceFor(ctx, got, kit) {
  const { found, record } = got;
  const title = shownName(record);
  keepTitle(ctx, title);
  const heard = voiceCase(ctx, found, record);
  if (heard.why) {
    ctx.say(heard.why);
    return 1;
  }
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) {
    ctx.say(`${running} is running for ${kit.calledAs(found)} already. Say it again when it has finished.`);
    return 1;
  }
  startDetached(ctx, { command: "join", folder: found.name, args: ["--voice"] });
  ctx.say(`The HeyGen voice of "${title}" is being taken in. A notice comes when it is ready.`);
  return 0;
}
