// What was done in the HyperFrames app, and the versions it has kept (architecture 2026-10-27: sections 4.1 step 9, 4.6 and F7;
// plan PR 6).
//
// `app "<episode>" what-happened` and `app "<episode>" versions` are questions about the episode's main project, not an edit of the
// episode, so edit.js finds the episode, asks the gate, says a finished video has no project and that this Mac is not set up for the
// app (and, for `versions`, that its command line is not here), and then gives the episode to one of the two functions below.
// Neither claims the episode, brings its files, asks for a working copy or writes its record, so another Mac's claim does not refuse
// them. Both look at this Mac's own project: the main project in use in the record whose folder is here.
//   - whatHappened tells the last turns of `.hyperframes/app-history.jsonl`, the file the app writes in the project with no handover
//     (A0, item 1): what she asked, what the app answered, and which files changed, newest first, under the day they happened.
//   - versionsOf runs the pinned command line's `history --json --limit 20 --dir <project>` and tells the entries it prints: when, who,
//     and the label the app gave each, with whether it was undone or is kept, and the files it changed.
// Studio only reads what the app keeps. It reads the history file as the pinned command line's own reader does (the last megabyte,
// and nothing that is a link), and the command line is run in PR 1's short list of variables with no chat's id. A listing is the
// command line's own work: when the app is closed it may file what changed outside the app as an entry of its own in the app's
// store (hyperframes.js and the plan have the detail), and on a project that has no `.hyperframes/history-id` it would make one, so
// `versions` lists only a project the app (or the command line) has recorded. Studio changes no history: "go back to before the
// music" is said to the app's assistant.
//
// What it says goes into her chat, so it holds no path, no flag and no name of a command (hyperframes.js plainText and its
// neighbours see to the words of the app and hers that it quotes). What it touches beyond the project's own files is given to it
// (`deps`), so that no test runs the command line or the app; the defaults are the Mac's.
import { spawnSync } from "node:child_process";
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { isMain, plainName, projectOnAnotherMac } from "./app.js";
import { VERSIONS_LIMIT, childEnv, historyArgs, plainTurns, plainVersions, readHistory, turnsOf } from "./hyperframes.js";
import { episodeWork } from "./settings.js";

/** How many turns `what-happened` tells: the newest 10 that have something to say. */
export const MOST_TURNS = 10;
/** How long the command line may take to list the versions, in milliseconds. It answers in moments; its own wait for the history is
    five seconds, and a command has two minutes in the Code tab. */
const HISTORY_MS = 30 * 1000;
/** How much of its output is kept, in bytes: every file of 20 entries, with room to spare. A listing that outgrows it is one that
    cannot be listed. */
const HISTORY_ROOM = 16 * 1024 * 1024;
/** How much of the history file is read: the last megabyte, as the command line's own `catch-up` reads it. */
const READ_MOST = 1024 * 1024;

/** What `what-happened` says when nothing has been done in the app on the episode, for want of a project, a file or a turn. */
export const nothingYet = (name) => `Nothing has been done in HyperFrames on ${name} yet.`;
/** What `versions` says when the app has kept none, for want of a project, of a recorded history or of an entry. */
export const noVersions = (name) => `${name} has no versions in HyperFrames yet.`;
/** What `versions` says when the command line cannot list them: History is a trial (F7), and nothing else depends on it. */
export const CANNOT_LIST = "I can't list the versions right now; HyperFrames shows its history.";
/** What both say when the main project in use was made on another Mac and is not here: its history is there. */
const elsewhere = (name, on) => `The HyperFrames project for ${name} is on ${on}, with everything done in it, so there is nothing to look at on this Mac. Ask Jason.`;
const earlier = (count) => `${count} earlier ${count === 1 ? "request is" : "requests are"} not shown.`;
const newest = `These are the newest ${VERSIONS_LIMIT}; HyperFrames shows any older ones.`;

/** The flags by which the pinned command line's own reader opens the history file: it follows no link, and does not wait on a file
    that is not one (a pipe). */
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = constants.O_NONBLOCK ?? 0;

/** The text of a project's `.hyperframes/app-history.jsonl`, its last megabyte, as the pinned command line reads it (the reader is
    in its dist/chunk-5PCALX6G.js), and "" for anything else: no `.hyperframes` folder, no file, a link in place of either, a folder
    or a pipe where the file should be, a file that cannot be read. A file larger than a megabyte is read from its end, and the
    first line of what is read is dropped, since the cut may have left it in the middle: the newest turns stand and no half line
    does. It only reads: the file is the app's. */
export function historyTail(projectDir) {
  let fd;
  try {
    const dir = join(projectDir, ".hyperframes");
    if (!lstatSync(dir).isDirectory()) return "";
    const path = join(dir, "app-history.jsonl");
    fd = openSync(path, constants.O_RDONLY | NO_FOLLOW | NON_BLOCK);
    const opened = fstatSync(fd);
    const named = lstatSync(path);
    if (!opened.isFile() || !named.isFile() || named.ino !== opened.ino || named.dev !== opened.dev) return "";
    const length = Math.min(opened.size, READ_MOST);
    const buffer = Buffer.alloc(length);
    let got = 0;
    while (got < length) {
      const read = readSync(fd, buffer, got, length - got, opened.size - length + got);
      if (read === 0) break;
      got += read;
    }
    const text = buffer.subarray(0, got).toString("utf8");
    if (opened.size <= length) return text;
    const first = text.indexOf("\n");
    return first === -1 ? "" : text.slice(first + 1);
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** Lines of items grouped under the day they happened, in the zone `tz` (an IANA name; the Mac's own when none is given): `items`
    are { ms, line } in the order they are to be told, and each day is a line "Today:", "Yesterday:" or "Tuesday 27 October:" with
    its items under it, indented two spaces. A day is the calendar's, in that zone: yesterday is the day before today's by its date
    (not 24 hours back, which on the day the clocks change is today), and a moment after the clock, whose day has not come, is
    given its date. A zone that is not one throws, rather than tell a wrong day. `now` is the clock, in milliseconds. */
export function daysOf(items, { tz, now }) {
  const dayIn = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const nameIn = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  const part = (parts, type) => parts.find((p) => p.type === type)?.value ?? "";
  const keyOf = (ms) => {
    const parts = dayIn.formatToParts(ms);
    return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`;
  };
  const today = keyOf(now);
  const [year, month, day] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  const headingOf = (ms, key) => {
    if (key === today) return "Today";
    if (key === yesterday) return "Yesterday";
    const parts = nameIn.formatToParts(ms);
    return `${part(parts, "weekday")} ${part(parts, "day")} ${part(parts, "month")}`;
  };
  const lines = [];
  let last = null;
  for (const { ms, line } of items) {
    const key = keyOf(ms);
    if (key !== last) {
      lines.push(`${headingOf(ms, key)}:`);
      last = key;
    }
    lines.push(`  ${line}`);
  }
  return lines;
}

/** The folder of the main project in use on this Mac, or null: the record has none (one kept for an earlier kind is none in use,
    and a folder the record does not list is not looked at: the next `app` takes it into the record), or its name leads nowhere a
    folder is, or its folder is not here. */
function mainProjectDir(ctx, { found, record }) {
  const project = (record.app?.projects ?? []).find(isMain);
  if (!project || !plainName(project.name)) return null;
  const dir = join(episodeWork(ctx.home, found.name), project.name);
  return existsSync(dir) ? dir : null;
}

/** Tell what was done in the app on the episode's main video (4.1 step 9), and resolve the exit code: 0 when it has said, whether
    that is the turns or that nothing has been done yet, and 1 when the main project in use was made on another Mac and is not
    here (a line says so). It runs once edit.js has gated the episode and seen that this Mac is set up; it claims nothing, brings
    nothing, writes nothing, and needs no command line: it reads the project's history file. The newest MOST_TURNS turns that have
    something to say are told, each by plainTurns, under the day they happened, with how many earlier ones are not shown.
    `ctx` is what edit.js gives a command, { home, machine, now, say }; `found` is { name, folder }, `record` the episode's.
    `deps.tz` is the zone the times are told in (the Mac's own when none is given). */
export function whatHappened(ctx, { found, record }, deps = {}) {
  const name = record.name.text;
  const on = projectOnAnotherMac(ctx, { found, record });
  if (on) {
    ctx.say(elsewhere(name, on));
    return 1;
  }
  const dir = mainProjectDir(ctx, { found, record });
  const told = (dir ? turnsOf(historyTail(dir)) : []).flatMap((turn, index) => {
    const [line] = plainTurns([turn], { tz: deps.tz });
    return line ? [{ ms: Date.parse(turn.at), index, line }] : [];
  });
  if (told.length === 0) {
    ctx.say(nothingYet(name));
    return 0;
  }
  // Newest first; for the same time the later line first, as plainTurns puts them.
  told.sort((a, b) => b.ms - a.ms || b.index - a.index);
  const shown = told.slice(0, MOST_TURNS);
  ctx.say(`What was done in HyperFrames on ${name}, newest first:`);
  for (const line of daysOf(shown, { tz: deps.tz, now: ctx.now() })) ctx.say(line);
  if (told.length > shown.length) ctx.say(earlier(told.length - shown.length));
  return 0;
}

/** Whether the app (or the command line) has recorded a project's history: `.hyperframes/history-id` is a file, in a folder that
    is one. Listing the history of a project with none would make it, and the store, and the project's own files are not Studio's
    to start. */
function recorded(dir) {
  try {
    return lstatSync(join(dir, ".hyperframes")).isDirectory() && lstatSync(join(dir, ".hyperframes", "history-id")).isFile();
  } catch {
    return false;
  }
}

/** Tell the versions the app has kept of the episode's main video (4.6), and resolve the exit code: 0 when it has said, whether
    that is the versions, that there are none yet, or that it cannot list them right now (History is a trial, F7: a command line
    that fails, times out, prints what cannot be read or prints entries none of which can be, is that one sentence), and 1 when the
    main project in use was made on another Mac and is not here. It runs once edit.js has gated the episode, seen that this Mac is
    set up and that its pinned command line is here. It claims nothing, brings nothing and writes no record. The entries are told
    newest first by plainVersions, under the day they happened, and when exactly VERSIONS_LIMIT come it says those are the newest.
    `deps` is all that is touched beyond the project's own files, and each has a default:
    - `cli` and `node`: the pinned command line's program (hyperframes.js cliPath) and the program that runs it (this one);
    - `spawn` (the system's) runs it, `env` (this process's) is where the LANG comes from, and `tz` is the zone the times are told in.
    The command line is run in PR 1's environment with no chat's id: a listing hands nothing over, whatever this Mac's setting. */
export function versionsOf(ctx, { found, record }, deps = {}) {
  const { spawn = spawnSync, env = process.env, node = process.execPath, tz } = deps;
  const name = record.name.text;
  const on = projectOnAnotherMac(ctx, { found, record });
  if (on) {
    ctx.say(elsewhere(name, on));
    return 1;
  }
  const dir = mainProjectDir(ctx, { found, record });
  if (!dir || !recorded(dir)) {
    ctx.say(noVersions(name));
    return 0;
  }
  const { file, args } = historyArgs({ home: ctx.home, node, project: dir });
  let ran = null;
  try {
    ran = spawn(file, [deps.cli ?? args[0], ...args.slice(1)], { env: childEnv({ base: { HOME: ctx.home, LANG: env.LANG }, node }), encoding: "utf8", timeout: HISTORY_MS, maxBuffer: HISTORY_ROOM });
  } catch {
    // A program that cannot be run is a command line that cannot list them.
  }
  const read = ran === null ? { ok: false } : readHistory(ran.stdout, ran.status);
  if (!read.ok) {
    ctx.say(CANNOT_LIST);
    return 0;
  }
  if (read.entries.length === 0) {
    ctx.say(noVersions(name));
    return 0;
  }
  const told = read.entries.map((entry, index) => ({ ms: entry.endedAt, index, line: plainVersions([entry], { tz })[0] }));
  // Newest first; for the same time the order the command line gave.
  told.sort((a, b) => b.ms - a.ms || a.index - b.index);
  ctx.say(`The versions of ${name} in HyperFrames, newest first:`);
  for (const line of daysOf(told, { tz, now: ctx.now() })) ctx.say(line);
  if (read.entries.length >= VERSIONS_LIMIT) ctx.say(newest);
  return 0;
}
