// Run in a child process by tests/edit-guide-app.test.js (plan PR 10, review I1; plan PR 16): a made-up episode whose project has a named pipe where a file
// the app keeps should be, and what `guide` or `finish` says of it. A reader that opens a pipe without O_NONBLOCK waits for a writer that never
// comes, so the test gives this process a time limit: it prints READY once the episode and the pipe are made, and a line "RESULT <json>" once the
// command has answered. Nothing here touches the real home, Downloads or Dropbox: the home is a temporary folder (the test sets TMPDIR to one of
// its own, and takes it away whatever happens to this process).
//   node pipe-scenario.mjs history|record|reels-history|reels-record|reels-handoff|reels-link guide|finish
//   history: the project's .hyperframes/app-history.jsonl is a pipe, with an export of the main video in Downloads.
//   record:  an export's record in the project's renders/ is a pipe, with the export in Downloads under its own name and no record of it.
//   The same four, for Reel 2 of a finished video whose hand-off is written (reels-world.js), with an export of the Reel in Downloads:
//   reels-history, reels-record: as history and record, for the Reel's project;
//   reels-handoff: the hand-off in final/ is a pipe;
//   reels-link:    the hand-off in final/ is a link to a pipe.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { editMain } from "../edit.js";
import { FOLDER } from "./episodes.js";
import { exportOf } from "./exports-world.js";
import { OFFERS, READ, depsOf, guideWorld } from "./guide-world.js";
import { HANDOFF_REL, finishedWorld } from "./reels-world.js";

const [what, command] = process.argv.slice(2);
const w = what.startsWith("reels-") ? await finishedWorld({ over: { reading: READ("finished"), offers: OFFERS } }) : guideWorld();
const pipe = (path) => {
  mkdirSync(dirname(path), { recursive: true });
  execFileSync("mkfifo", [path]);
};
if (what === "history") {
  pipe(join(w.dirOf("main"), ".hyperframes", "app-history.jsonl"));
  exportOf(w, "main");
} else if (what === "record") {
  exportOf(w, "main", { record: false });
  pipe(join(w.dirOf("main"), "renders", `${w.names.main}_2026-10-20_13-56-40.meta.json`));
} else if (what === "reels-history") {
  pipe(join(w.dirOf("reel 2"), ".hyperframes", "app-history.jsonl"));
  exportOf(w, "reel 2");
} else if (what === "reels-record") {
  exportOf(w, "reel 2", { record: false });
  pipe(join(w.dirOf("reel 2"), "renders", `${w.names["reel 2"]}_2026-10-20_14-03-12.meta.json`));
} else if (what === "reels-handoff" || what === "reels-link") {
  const file = join(w.found.folder, HANDOFF_REL);
  rmSync(file);
  if (what === "reels-handoff") pipe(file);
  else {
    const target = join(w.t.dir, "a-pipe-elsewhere");
    pipe(target);
    symlinkSync(target, file);
  }
  exportOf(w, "reel 2");
} else throw new Error(`no scenario ${what}`);

console.log("READY");
const said = [];
const code = await editMain(command === "finish" ? ["finish", FOLDER] : ["guide", "3fa9c1"], { ...depsOf(w), say: (line) => said.push(line) });
console.log(`RESULT ${JSON.stringify({ code, said })}`);
w.t.done();
process.exit(0);
