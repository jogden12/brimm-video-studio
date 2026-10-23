// Labels, not file names, in everything Sallie's chat sees (spec 2026-10-22, section 1, "Unanswered and session videos are
// named by a neutral label"). Everything edit.js prints goes into her chat, which is Claude, and a video's file is often named
// for a client ("Coaching call Jane Doe.mov"), as are its episode's folder and its folder in BRIMM Video Work. So a video not yet
// answered, and a client or group session whose mark is not cleared, are named by their label in every line a command says, in
// the log, in a status file and in a result file. Today's records, on a Mac whose import is not the light one, print as they
// always did: the first test here pins that, line for line.
// Nothing here runs a real program or touches Dropbox: each test has a root and a home of its own, and the programs are stand-ins.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMAND_NAMES, editMain } from "../edit.js";
import { newEpisode, recordFile, recordText } from "../episode.js";
import { episodeWork, writeSettings } from "../settings.js";
import { writeStatus } from "../importing.js";
import { resultFile } from "../detached.js";
import { FOLDER, NAME } from "./episodes.js";
import { episode } from "./phase4.js";

/** Run a command of edit.js by its deps: { code, said }, with each line it said. */
async function on(deps, ...argv) {
  const said = [];
  const code = await editMain(argv, { ...deps, say: (line) => said.push(line) });
  return { code, said };
}

/** Write a text file whole, as the rule's text writer would. */
const writeText = (to, text) => writeFileSync(to, text);

/** The clock of episodes.js's setup, as the record keeps a moment. */
const AT = "2026-10-20T15:00:00-05:00";

/** The deps every command here is run with: the made-up Mac's (episodes.js), with stand-ins for what is left of the Mac's own:
    the free space on its disk, the launch agent, git, and whether Final Cut is running. */
const depsOf = (t) => ({
  ...t.ctx.deps,
  statfs: () => ({ bavail: 300 * 2 ** 18, bsize: 4096 }),
  kickstart: () => {},
  agentRunning: () => false,
  running: async () => false,
  run: async (cmd, args, asked) => (cmd === "/usr/bin/git" ? { code: 0, stdout: "0\n", stderr: "" } : t.ctx.deps.run(cmd, args, asked))
});

// --- Today's records, on a Mac whose import is not the light one ---

/** The second episode of today: a short video, named, with nothing pushed. */
const SHORT_FOLDER = "2026-10-15 Pricing short (Mac Studio)";

/** Today's Mac, with its import set to `setting` ("full", or undefined for none): the made-up episode (phase4.js), a short video
    beside it, a video waiting in the drop folder whose import failed, the other Mac's import running, a late check that found a
    problem, what a bring left for the episode, and its library on this Mac. */
function today(setting) {
  const { t } = episode();
  if (setting) writeSettings(t.home, { import: setting });
  const short = join(t.root, "Episodes", SHORT_FOLDER);
  mkdirSync(join(short, "record"), { recursive: true });
  const record = newEpisode({ id: "e-20261015-0a1b2c", machine: "Mac Studio", at: "2026-10-15T09:00:00-05:00", video: { file: "Pricing short.mov", bytes: 5, seconds: 40, created: null }, kind: "short video", writer: { commit: "c709b57", on: "Mac Studio" } });
  writeFileSync(recordFile(short, 1), recordText({ ...record, rev: 1, name: { text: "Pricing in a minute", placeholder: false } }));
  const drop = join(t.root, "Unedited Video", "Mac Studio");
  mkdirSync(drop, { recursive: true });
  writeFileSync(join(drop, "Pricing talk again.mov"), "video");
  writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 1, import: "k3j9x", video: "Pricing talk again.mov", bytes: 5, seconds: null, step: "Writing the transcript", at: "2026-10-20T14:00:00-05:00", failed: "the transcriber stopped (Pricing talk again.mov: Invalid data)" }, writeText);
  writeStatus(t.root, { version: 1, machine: "Sallie's laptop", pid: 2, import: "a1b2", video: "Other talk.mov", bytes: 9, seconds: 60, step: "Writing the transcript", at: "2026-10-20T14:58:00-05:00" }, writeText);
  writeStatus(t.root, { version: 1, machine: "Mac Studio", pid: 3, import: "c3d4", video: "Third talk.mov", bytes: 9, seconds: 60, step: "Late check", at: "2026-10-20T13:00:00-05:00", problem: "Third talk.srt is not whole in Dropbox." }, writeText);
  const work = episodeWork(t.home, FOLDER);
  mkdirSync(join(work, `${FOLDER}.fcpbundle`), { recursive: true });
  writeFileSync(join(work, `${FOLDER}.fcpbundle`, "CurrentVersion.flexolibrary"), "a library");
  const ended = Date.parse(AT) - 2 * 60 * 60 * 1000;
  writeFileSync(resultFile(t.home, FOLDER, "bring"), JSON.stringify({ version: 1, command: "bring", started: ended - 60000, ended, ok: false, made: ["Pricing talk.srt"], failed: ["Pricing talk.mp4 is still not whole"], next: `Some files of ${NAME} are not here yet. Say "open ${NAME}" to try again.` }));
  return t;
}

/** What each command is given on today's Mac, as Claude runs it: by the episode's folder, by its name, with no words, and for the
    commands that name a video or more than one episode, by those. Every command is here, so that one added later is pinned. */
const TODAY_ASKED = {
  episodes: [[]],
  open: [[FOLDER], [NAME], [], ["Pricing"], ["nothing fits this"]],
  push: [[FOLDER], [], [FOLDER, "reel", "2"]],
  bring: [["--now", FOLDER], []],
  status: [[], [FOLDER], ["Pricing"], [NAME]],
  retry: [["Pricing talk again.mov"], ["pricing talk again"], ["Nothing here"], []],
  name: [[FOLDER, "A new name"], [FOLDER], []],
  title: [[FOLDER], [FOLDER, "--words", "Price like you mean it", "--approve"], []],
  reel: [["pick", FOLDER, "1"], ["drop", FOLDER, "1"], []],
  reels: [[FOLDER, "--no-play"], []],
  ask: [[FOLDER], ["--now", FOLDER], []],
  finish: [[FOLDER], ["--now", FOLDER], []],
  release: [[FOLDER], []],
  show: [[FOLDER, "transcript"], [FOLDER, "plan"], []],
  behind: [[]],
  resolve: [[FOLDER], []],
  free: [[FOLDER, "library"], []],
  spell: [[FOLDER], []],
  logo: [[FOLDER, "on"], []],
  captions: [[FOLDER, "reel", "2", "on"], []],
  text: [[FOLDER], []],
  graphic: [[FOLDER], []],
  preset: [[FOLDER], []],
  cut: [[FOLDER, "remove", "--words", "x"], []]
};

/** What every command of TODAY_ASKED says on today's Mac with its import set to `setting`, each on a Mac of its own, by
    "<command> <words…>", with the test's folder written as <dir> so that it reads the same in every run. */
async function todaySays(setting) {
  const says = {};
  for (const name of COMMAND_NAMES) {
    for (const words of TODAY_ASKED[name]) {
      const t = today(setting);
      const r = await on(depsOf(t), name, ...words);
      says[[name, ...words].join(" ")] = [r.code, ...r.said.map((line) => line.split(t.dir).join("<dir>").split(String(process.pid)).join("<pid>"))];
      t.done();
    }
  }
  return says;
}

/** What today's Mac said, before labels: written once from the code as it was, and read back here. */
const TODAY_FILE = new URL("./fixtures/today-says.json", import.meta.url);

describe("today's records, on a Mac whose import is not the light one", () => {
  it("has the words of every command here, so that one added later is pinned too", () => {
    for (const name of COMMAND_NAMES) assert.ok(name in TODAY_ASKED, `${name}: give it its words in TODAY_ASKED`);
  });
  it("prints every command's lines as it did before labels, with no import setting and with the full import", async () => {
    // UPDATE_TODAY=1 writes the file again from the code as it is now: only for a change to today's output that is meant.
    if (process.env.UPDATE_TODAY === "1") writeFileSync(TODAY_FILE, JSON.stringify(await todaySays(undefined), null, 2) + "\n");
    const before = JSON.parse(readFileSync(TODAY_FILE, "utf8"));
    for (const setting of [undefined, "full"]) assert.deepEqual(await todaySays(setting), before, String(setting));
  });
});
