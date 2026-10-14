// An episode's parts, its main video and its picked Reels, and the files Final Cut made of each: the finished videos it
// Shared and the timelines exported with File > Export XML…, both saved into one local folder, From Final Cut (spec section
// 1, rule 6). A file is an episode's when its name, up to the ending, is a project name recorded at one of the episode's
// pushes (spec section 2), never by the episode's current name, which may have changed since. And what finish must ask
// before it can start (spec section 5, steps 1 and 2). Plain data: nothing here touches a disk.
import { extname } from "node:path";
import { tokens } from "./shared/text.js";

const VIDEOS = [".mov", ".mp4", ".m4v"];
const EXPORTS = [".fcpxmld", ".fcpxml"];

/** What a file in From Final Cut is by its ending: a finished video, an export, or neither. A name that starts with a dot is
    neither: macOS and Final Cut keep their own such files. */
export function kindOf(name) {
  const n = String(name);
  if (n.startsWith(".")) return "";
  const end = extname(n).toLowerCase();
  return VIDEOS.includes(end) ? "video" : EXPORTS.includes(end) ? "export" : "";
}
const stem = (name) => String(name).slice(0, String(name).length - extname(String(name)).length);

/** The parts of an episode: the main video, and each Reel picked or finished. A short video has the main alone. Each part
    gives `pushes`, {v, project} of each push, oldest first, and `projects`, their names. */
export function partsOf(record) {
  const listed = (pushed) => (Array.isArray(pushed) ? pushed : []).filter((p) => p && p.project).map((p) => ({ v: p.v, project: p.project }));
  const last = (pushed) => (Array.isArray(pushed) && pushed.length ? pushed[pushed.length - 1] : null);
  const part = (fields, pushed) => ({ ...fields, pushes: listed(pushed), projects: listed(pushed).map((p) => p.project), last: last(pushed) });
  const main = part({ key: "main", label: "the main video" }, record.main && record.main.pushed);
  const reels = record.kind === "short video" ? [] : (record.reels || []).filter((r) => r.status === "picked" || r.status === "finished");
  return [main, ...reels.map((r) => part({ key: `reel ${r.n}`, label: `Reel ${r.n}`, reel: r.n }, r.pushed))];
}

/** A name as it is compared: Final Cut writes a Share's name to the disk with its accents decomposed (NFD), and the names
    recorded at each push are composed (NFC). */
const nfc = (text) => String(text).normalize("NFC");
const newest = (files) => files.reduce((best, f) => (!best || f.mtimeMs > best.mtimeMs ? f : best), null);
const listed = (files) => files.map((f) => f.name).sort().join(", ");
const count = (n) => (n === 2 ? "two" : String(n));
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/** What each part is taken from, and what to ask before finish can start. The Shared videos of a part are looked for in From
    Final Cut and in what the other Mac released into the episode (`released`) together, and the one of the highest version
    pushed is taken: a Share is of the version whose project name it bears. A Share of a version no newer than the part the
    last finish kept, and no different from it, leaves that part kept. When two different files are of the highest version,
    or a person names one (`answers.take`), the person's answer decides; a name that is no Share of the part is asked about
    again, never passed over. A picked Reel with no Share is asked about, and left out when the person says so
    (`answers.without`); the main video is never left out. For each part with a new video, its newest export of the same
    project must be newer than the video: the order is Share, then File > Export XML… once the Share is done. A part never
    exported may instead be answered "no hand edits since it was shown" (`answers.noHandEdits`). A Share that Final Cut
    renamed ("<project> 1", when a project of that name was already in the library) is named, never passed by. `asks` are
    questions; `stops` are what finish cannot get past by an answer; `looked` says where it looked and for which names. */
export function lookFor(parts, { fromFinalCut, released, finished }, answers) {
  const { take = {}, noHandEdits = [], without = [] } = answers || {};
  const asks = [];
  const stops = [];
  const out = [];
  const all = [[fromFinalCut, "From Final Cut"], [released, "the other Mac"]].flatMap(([place, where]) => place.files
    .filter((f) => f.bytes > 0 && kindOf(f.name))
    .map((f) => ({ ...f, dir: place.dir, where, project: nfc(stem(f.name)) })));
  const whereSaid = (f) => (f.where === "From Final Cut" ? "From Final Cut" : "what the other Mac released");
  for (const part of parts) {
    if (part.key !== "main" && without.includes(part.key)) continue;
    const versions = new Map(part.pushes.map((p) => [nfc(p.project), p.v]));
    for (const f of all.filter((g) => kindOf(g.name) === "video")) {
      const copy = /^(.*) \d+$/.exec(f.project);
      if (copy && versions.has(copy[1]) && !versions.has(f.project)) asks.push(`${f.name} looks like a copy Final Cut renamed, so it is not taken for ${part.label}. In Final Cut, Share the project "${copy[1]}" itself, and move ${f.name} out of ${whereSaid(f)}.`);
    }
    if (!part.pushes.length) {
      if (part.key === "main") stops.push('The main video was never shown in Final Cut. Say "show it in Final Cut" first, then Share it.');
      else asks.push(`${part.label} was never shown in Final Cut. Say "show reel ${part.reel} in Final Cut" first, then Share it, or say to leave it out of this finish.`);
      continue;
    }
    const videos = all.filter((f) => kindOf(f.name) === "video" && versions.has(f.project)).map((f) => ({ ...f, v: versions.get(f.project) }));
    // One file in both places, as a Share this Mac released and still has, is taken once: from From Final Cut.
    const once = (files) => files.filter((f, i) => !files.some((g, k) => k < i && nfc(g.name) === nfc(f.name) && g.bytes === f.bytes));
    const before = finished && finished.parts && finished.parts[part.key];
    let video = null;
    if (take[part.key]) {
      const named = once(videos.filter((f) => nfc(f.name) === nfc(take[part.key])));
      if (!named.length) {
        asks.push(`"${take[part.key]}" is not a Shared video of ${part.label}. ${videos.length ? `The ones there are: ${listed(once(videos))}.` : "There is none there."} Which is the final one?`);
        continue;
      }
      video = named[0];
    } else {
      const keptV = before ? versions.get(nfc(stem(String(before.file).split("/").pop()))) : undefined;
      const same = (f) => before && before.source && before.source.bytes === f.bytes && before.source.mtimeMs === f.mtimeMs;
      const newer = videos.filter((f) => keptV === undefined || f.v > keptV || (f.v === keptV && !same(f)));
      if (!newer.length && before) {
        out.push({ ...part, video: null, export: null, kept: true });
        continue;
      }
      if (!newer.length) {
        if (part.key === "main") stops.push("The main video has not been Shared from Final Cut. Share it into From Final Cut, in BRIMM Video Work, and once Final Cut says the Share is done, File > Export XML… of it; then say finish again.");
        else asks.push(`${part.label} has no Shared video. Share it from Final Cut into From Final Cut, and once Final Cut says the Share is done, File > Export XML… of it; or say to leave it out of this finish.`);
        continue;
      }
      const top = Math.max(...newer.map((f) => f.v));
      const highest = once(newer.filter((f) => f.v === top));
      if (highest.length > 1) {
        asks.push(`For ${part.label} there are ${count(highest.length)} Shared videos of v${top}: ${listed(highest)}. Which is the final one?`);
        continue;
      }
      video = highest[0];
    }
    const exported = newest(all.filter((f) => kindOf(f.name) === "export" && f.project === video.project));
    const project = stem(video.name);
    if (exported && exported.mtimeMs < video.mtimeMs) asks.push(`${capital(part.label)}'s export is older than its Shared video. Once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut.`);
    else if (!exported && !noHandEdits.includes(part.key)) asks.push(`${capital(part.label)} was never exported. If you changed it by hand in Final Cut, then once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut. If you made no hand edits since it was shown, say so.`);
    const { project: _p, v: _v, ...shown } = video;
    out.push({ ...part, video: shown, export: exported ? (({ project: _q, ...e }) => e)(exported) : null, kept: false });
  }
  const names = parts.flatMap((p) => p.projects.slice(-1).flatMap((n) => VIDEOS.map((e) => n + e)));
  const looked = `Looked in ${fromFinalCut.dir} and ${released.dir} for: ${names.join(", ")}.`;
  return { parts: out, asks, stops, looked };
}

/** Does a finished video start with the words its part is expected to start with? At least four of the six first words
    expected (or every one, when fewer are expected) must be among its first twenty words, in the same order. A hand trim at
    the start changes them, so a "no" is for a person to check by eye, and stops nothing. */
export function firstWordsMatch(expected, heard) {
  const want = tokens(expected).slice(0, 6);
  const got = tokens(heard).slice(0, 20);
  let at = 0;
  let found = 0;
  for (const w of want) {
    const k = got.indexOf(w, at);
    if (k !== -1) {
      found += 1;
      at = k + 1;
    }
  }
  return want.length > 0 && found >= Math.min(4, want.length);
}
