// Putting files into an episode kept on this Mac (Phase 3, the local working folder; L4; design D1, D2, D4). unedited.js putHere is this, async; filing.js
// files a joined video into a plan with it, and both are sync underneath: nothing here waits.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { cloneFile, onSameDisk, textWriter } from "./dropbox.js";
import { localStamp, readEpisode, undone, writeEpisode } from "./episode.js";
import { studioHome } from "./home.js";
import { episodeFilesFolder, runsFolder } from "./settings.js";

/** Put files into an episode kept on this Mac (Phase 3, L4; design D1, D2, D4): the files are in its video/ folder here, so nothing of them goes to
    Dropbox but the record, and nothing waits for a check. `found` is { folder, record } (`folder`: its folder in Episodes), `files` are
    [{ rel, from }]: `from` is a file the run made whole, and `rel` its name in video/. Options: `change` (the record's other change, called with the
    record and the sizes of the files put in), `expectRev` (the rev the work was made from), `home`, `writer`, `work` (the run's own folder, for the
    record's work copy), `clone` and `sameDisk` (the rule's), `now` (ms), `log`, `onRecordCopy` (told of the record's work copy, as filing.js is) and
    `killed(at)`, a test's way to stop the run at "written", "renamed" or "recorded".
    In this order: the journal, video/.put.json, is written, naming each rename it will make; each file is written whole in video/ under a name of its
    own; each file it replaces is renamed into video/history/<moment> <name>; each new file is renamed into place; the record is written with `expectRev`,
    listing the files put in at their sizes; the journal is removed. A file it is given under history/ (a reading's own set-aside) is written into
    video/history/ and never listed. A refused record write renames each replaced file back and removes the new ones, and gives { put: false, why }.
    A journal a stopped run left is undone first, unless the record it was making was written (the record's rev is above the journal's), when only the
    journal is removed. Resolves { put: true, record } or { put: false, why }. */
export function putHereNow(found, files, opts = {}) {
  const { home = studioHome(), writer, work, clone, sameDisk, change = (record) => record, log = () => {}, killed = () => {} } = opts;
  const folder = found.folder;
  const own = episodeFilesFolder(home, basename(folder));
  const journal = join(own, ".put.json");
  const ropts = { ...(clone ? { clone } : {}), ...(sameDisk ? { sameDisk } : {}), log };
  mkdirSync(own, { recursive: true });
  // A journal a stopped run left is settled first, by the record: written, the files stay; not written, each rename is undone.
  if (existsSync(journal)) {
    let left = null;
    try {
      left = JSON.parse(readFileSync(journal, "utf8"));
    } catch (e) {
      left = null;
    }
    if (left && Array.isArray(left.entries)) {
      const at = readEpisode(folder);
      if (!(at.record && at.record.rev > left.rev)) undoPut(own, left.entries);
    }
    rmSync(journal, { force: true });
  }
  const before = readEpisode(folder);
  const expectRev = opts.expectRev !== undefined ? opts.expectRev : found.record ? found.record.rev : undefined;
  if (!before.record) return { put: false, why: `the episode's record cannot be read: ${String(before.why || "it is not there").replace(/\.$/, "")}` };
  if (before.newer) return { put: false, why: "the episode was written by a newer BRIMM Video Studio. Ask Jason to update this Mac" };
  const gone = undone(before.record, home);
  if (gone) return { put: false, why: gone.replace(/\.$/, "") };
  if (expectRev !== undefined && before.record.rev > expectRev) return { put: false, why: "this episode changed on the other Mac meanwhile. Say it again" };
  if (expectRev !== undefined && before.record.rev !== expectRev) return { put: false, why: "the episode changed while this was made. Say it again" };
  const moment = localStamp(new Date(opts.now !== undefined ? opts.now : Date.now())).replace(/:/g, "-");
  // What each file becomes: a name of its own to be written under, and where what it replaces is set aside.
  const taken = new Set();
  const entries = files.map(({ rel }) => {
    const dir = dirname(rel);
    const tmp = join(dir === "." ? "" : dir, `.${basename(rel)}.${process.pid}.put`);
    let was = null;
    if (!rel.startsWith("history/") && existsSync(join(own, rel))) {
      let n = 1;
      let aside;
      do {
        aside = `history/${moment} ${n > 1 ? `${n} ` : ""}${basename(rel)}`;
        n += 1;
      } while (taken.has(aside) || existsSync(join(own, aside)));
      taken.add(aside);
      was = aside;
    }
    return { rel, tmp, was };
  });
  const sizes = {};
  writeFileSync(`${journal}.${process.pid}.writing`, JSON.stringify({ rev: before.record.rev, entries }) + "\n");
  renameSync(`${journal}.${process.pid}.writing`, journal);
  const undo = () => {
    undoPut(own, entries);
    rmSync(journal, { force: true });
  };
  try {
    for (const [i, { from }] of files.entries()) {
      const to = join(own, entries[i].tmp);
      mkdirSync(dirname(to), { recursive: true });
      rmSync(to, { force: true });
      // A clone on one disk (cp -c), a whole copy otherwise: never a move out of the run's own folder.
      ((sameDisk || onSameDisk)(from, dirname(to)) ? clone || cloneFile : copyFileSync)(from, to);
      const size = statSync(from).size;
      if (statSync(to).size !== size) throw new Error(`${entries[i].rel} could not be put into the episode's folder on this Mac: it is ${statSync(to).size} bytes there, not ${size}`);
      if (!entries[i].rel.startsWith("history/")) sizes[entries[i].rel] = size;
    }
  } catch (e) {
    undo();
    return { put: false, why: String(e.message).replace(/\.$/, "") };
  }
  killed("written");
  try {
    for (const e of entries) {
      if (!e.was) continue;
      mkdirSync(dirname(join(own, e.was)), { recursive: true });
      renameSync(join(own, e.rel), join(own, e.was));
    }
    for (const e of entries) {
      mkdirSync(dirname(join(own, e.rel)), { recursive: true });
      renameSync(join(own, e.tmp), join(own, e.rel));
    }
  } catch (e) {
    undo();
    return { put: false, why: String(e.message).replace(/\.$/, "") };
  }
  killed("renamed");
  let record;
  try {
    const now = readEpisode(folder);
    const why = !now.record ? `the episode's record cannot be read: ${String(now.why || "it is not there").replace(/\.$/, "")}` : now.newer ? "the episode was written by a newer BRIMM Video Studio" : now.record.rev !== before.record.rev ? "the episode changed while this was made. Say it again" : "";
    if (why) throw new Error(why);
    const write = textWriter({ work: join(work || runsFolder(home), `record-${process.pid}`), keep: true, ...(opts.onRecordCopy ? { onCopy: opts.onRecordCopy } : {}), ...ropts });
    const next = change({ ...now.record, files: { ...now.record.files, ...sizes } }, sizes);
    record = writeEpisode(folder, next, { expectRev: before.record.rev, writeText: (to, text) => write(to, text), writer, home });
  } catch (e) {
    undo();
    return { put: false, why: `the episode's record could not be written again: ${String(e.message).replace(/\.$/, "")}` };
  }
  killed("recorded");
  rmSync(journal, { force: true });
  return { put: true, record };
}

/** Undo the renames a put's journal names, in the video/ folder `own`: a file under a name of its own is removed; a file that was set aside is renamed
    back over the new one; a new file with nothing replaced is removed. Whatever is not there is passed over, so a run stopped part-way is undone too. */
function undoPut(own, entries) {
  for (const e of [...entries].reverse()) {
    rmSync(join(own, e.tmp), { force: true });
    if (!e.was) rmSync(join(own, e.rel), { force: true });
    else if (existsSync(join(own, e.was))) {
      rmSync(join(own, e.rel), { force: true });
      renameSync(join(own, e.was), join(own, e.rel));
    }
  }
}
