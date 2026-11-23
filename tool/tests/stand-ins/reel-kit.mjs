// A stand-in for Reel Kit's Python scripts (plan Decision 8), for tests: no test runs Reel Kit's Python. It is run as PY is, with the
// script's path first: `node tests/stand-ins/reel-kit.mjs <KIT>/pipeline/<script>.py <args…>`, and does what that script would do of
// what Studio relies on, from tests/fixtures/reel-kit-1.2.0/. Each script is a function in SCRIPTS, by its file's name, so a later task
// adds its own beside the others; a script that is not there prints one line on stderr and ends 2.
//   - new.py <slug> "<clip>" ["<title>"] --mode hifi|lofi|showcase: as Reel Kit's own, it makes the project at
//     $REEL_KIT_HOME/projects/<slug> (through a link there, when Studio made one), its folders (assets audio cards fx public/cards
//     public/media renders storyboard work), `style/` copied from $REEL_KIT_HOME/style (it refuses without style/style.json), and an
//     `edit.py` from the fixture, naming TITLE, STYLE, KIT_VERSION and SRC as the real one does, and prints the project's path. It
//     refuses a project that has an edit.py already, a clip that is not there, and no mode or one it does not know, as the real one does.
//
// The test bakes what it wants to read into the small script that runs this (as tests/stand-ins/uv.mjs is run), since Studio runs Reel
// Kit in an environment of its own that carries no variable of a test's:
//   - REEL_KIT_STANDIN_LOG: a file each run appends a JSON line to: the script's name, its arguments, and the Reel Kit and offline
//     variables it was given;
//   - storyboard/serve.py <project> --port <n>: says the address it would serve, and runs until stopped (see SCRIPTS["serve.py"]).
//   - REEL_KIT_STANDIN: the scenario. Today `fail` (the script prints a line on stderr and ends 1); later tasks add theirs
//     (qa-fail, no-ready, usage-limit).
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const FIXTURES = new URL("../fixtures/reel-kit-1.2.0/", import.meta.url);
// Python's -I (isolated), which Studio gives serve.py, comes before the script.
const isolated = process.argv[2] === "-I";
const [script, ...args] = process.argv.slice(isolated ? 3 : 2);
const name = basename(String(script ?? ""));
const SEEN = ["REEL_KIT_HOME", "HF_HOME", "HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE", "PYTHONNOUSERSITE", "PATH", "HOME"];
const log = process.env.REEL_KIT_STANDIN_LOG;
if (log) {
  const env = Object.fromEntries(SEEN.filter((v) => v in process.env).map((v) => [v, process.env[v]]));
  appendFileSync(log, `${JSON.stringify({ script: name, folder: basename(dirname(String(script ?? ""))), args, env, ...(isolated ? { isolated } : {}) })}\n`);
}

const stop = (line, code = 1) => {
  process.stderr.write(`${line}\n`);
  process.exit(code);
};
if (process.env.REEL_KIT_STANDIN === "fail") stop(`${name}: failed, as the test asked`);

/** The value after a flag, and the arguments with the flag and its value taken out. */
function flagged(list, flags) {
  let value = null;
  let rest = [...list];
  for (const flag of flags) {
    const at = rest.indexOf(flag);
    if (at >= 0) {
      value = at + 1 < rest.length ? rest[at + 1] : null;
      rest = [...rest.slice(0, at), ...rest.slice(at + 2)];
    }
  }
  return { value, rest };
}

const SCRIPTS = {
  "new.py": (argv) => {
    const { value: mode, rest } = flagged(argv, ["--mode", "--style"]);
    const words = rest.filter((a) => !a.startsWith("--"));
    if (words.length < 2 || !["hifi", "lofi", "showcase"].includes(mode)) stop("usage: new.py <slug> <clip> [title] --mode hifi|lofi|showcase\n--mode hifi|lofi|showcase is required: the creator picks the mode, never guess it.");
    const home = process.env.REEL_KIT_HOME;
    if (!home) stop("new.py stand-in: no REEL_KIT_HOME", 2);
    const [slug, given] = words;
    const src = resolve(given);
    if (!existsSync(src)) stop(`source clip not found: ${src}`);
    const title = words.length > 2 ? words[2] : slug.replace(/-/g, " ");
    const project = join(home, "projects", slug);
    if (existsSync(join(project, "edit.py"))) stop(`${project}/edit.py already exists`);
    for (const d of ["assets", "audio", "cards", "fx", "public/cards", "public/media", "renders", "storyboard", "work"]) mkdirSync(join(project, d), { recursive: true });
    const style = join(home, "style");
    if (!existsSync(join(style, "style.json"))) stop(`no style pack at ${style}: run onboarding first`);
    cpSync(style, join(project, "style"), { recursive: true });
    const version = readFileSync(new URL("kit/VERSION", FIXTURES), "utf8").trim();
    const starter = readFileSync(new URL("project/edit.py", FIXTURES), "utf8");
    const filled = { TITLE: title, MODE: mode, VERSION: version, SRC: src };
    writeFileSync(join(project, "edit.py"), starter.replace(/\{\{(TITLE|MODE|VERSION|SRC)\}\}/g, (_, key) => filled[key]));
    process.stdout.write(`${project}\n`);
  }
};

// KIT/storyboard/serve.py <project> --port <n> (plan Task 12): as Reel Kit's own, it says the address it serves, on 127.0.0.1 alone, and
// keeps running until it is stopped (here at most 20 seconds). It listens on nothing: no test takes a port. With the scenario `go`, it
// writes what the page's "Looks good: render it" would: { beat: "all", text: "go", at } added to <project>/storyboard/notes.json.
SCRIPTS["serve.py"] = (argv) => {
  const { value: port, rest } = flagged(argv, ["--port"]);
  const [project] = rest;
  const sb = join(resolve(String(project ?? "")), "storyboard");
  if (!existsSync(join(sb, "index.html"))) stop(`nothing to review yet: ${sb}/index.html doesn't exist (build the storyboard or the style board first)`);
  const notes = join(sb, "notes.json");
  process.stdout.write(`Storyboard: http://127.0.0.1:${port ?? 8765}/   (notes -> ${notes})\n`);
  if (process.env.REEL_KIT_STANDIN === "go") {
    const kept = existsSync(notes) ? JSON.parse(readFileSync(notes, "utf8")) : [];
    writeFileSync(notes, JSON.stringify([...kept, { beat: "all", text: "go", at: new Date().toISOString().slice(0, 19) }], null, 1));
  }
  setTimeout(() => process.exit(0), 20000);
  process.on("SIGTERM", () => process.exit(0));
};

if (!Object.hasOwn(SCRIPTS, name)) stop(`reel-kit stand-in: no stand-in for ${name || "a script"}`, 2);
SCRIPTS[name](args);
