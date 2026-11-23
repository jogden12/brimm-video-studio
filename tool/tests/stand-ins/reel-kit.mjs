// A stand-in for Reel Kit's Python scripts (plan Decision 8), for tests: no test runs Reel Kit's Python. It is run as PY is, with the
// script's path first: `node tests/stand-ins/reel-kit.mjs <KIT>/pipeline/<script>.py <args…>`, and does what that script would do of
// what Studio relies on, from tests/fixtures/reel-kit-1.2.0/. Each script is a function in SCRIPTS, by its file's name, so a later task
// adds its own beside the others; a script that is not there prints one line on stderr and ends 2.
//   - new.py <slug> "<clip>" ["<title>"] --mode hifi|lofi|showcase: as Reel Kit's own, it makes the project at
//     $REEL_KIT_HOME/projects/<slug> (through a link there, when Studio made one), its folders (assets audio cards fx public/cards
//     public/media renders storyboard work), `style/` copied from $REEL_KIT_HOME/style (it refuses without style/style.json), and an
//     `edit.py` from the fixture, naming TITLE, STYLE, KIT_VERSION and SRC as the real one does, and prints the project's path. It
//     refuses a project that has an edit.py already, a clip that is not there, and no mode or one it does not know, as the real one does.
//   - render.py <project> [name] [--no-deliver]: as Reel Kit's own (plan Task 14), its build (it writes public/build.json, so that the
//     composition's fingerprint moves as a real build's may), its render into <project>/renders/<name>.mp4 (snapshots made and taken
//     away), then qa.py run as the real one runs it; a QA that fails ends it 1, "QA failed: … Nothing was delivered.", and a pass
//     without --no-deliver copies the render and its phone copy beside edit.py's SRC as '<Title> v<n>.mp4' and '<Title> v<n> (phone).mp4',
//     the title without the characters a file name can't hold, as the real deliver() does.
//   - qa.py <project> renders/<file>.mp4 [--phone]: its cut sheet in work/qa/, the phone copy <file>-phone.mp4 with --phone, and
//     "QA PASS …" (ends 0) or, in the scenario qa-fail, "QA FAIL" (ends 1).
//
// The test bakes what it wants to read into the small script that runs this (as tests/stand-ins/uv.mjs is run), since Studio runs Reel
// Kit in an environment of its own that carries no variable of a test's:
//   - REEL_KIT_STANDIN_LOG: a file each run appends a JSON line to: the script's name, its arguments, and the Reel Kit and offline
//     variables it was given;
//   - REEL_KIT_STANDIN: the scenario, one or more words: `fail` (the script prints a line on stderr and ends 1) and `qa-fail` (qa.py
//     fails, so render.py does); and for render.py what a run might leave that is not its own (Task 14, fix round 1): `app-edit` (public/
//     of the project itself, edit.py's SRC's, changed as the HyperFrames app would, while it renders), `plant` (cards/c1/Claude.md, one of Studio's own names), `renders-link`
//     (renders/ made a link out of the project before it renders into it), `cli-meta` (a record of its own in public/renders/), `link` (a
//     link in public/) and `restate` (the project's own studio.json taken to `queued`, as a job that took the edit would); later tasks add theirs
//     (no-ready, usage-limit).
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = new URL("../fixtures/reel-kit-1.2.0/", import.meta.url);
const [script, ...args] = process.argv.slice(2);
const name = basename(String(script ?? ""));
const SEEN = ["REEL_KIT_HOME", "HF_HOME", "HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE", "PYTHONNOUSERSITE", "PATH", "HOME"];
const log = process.env.REEL_KIT_STANDIN_LOG;
if (log) {
  const env = Object.fromEntries(SEEN.filter((v) => v in process.env).map((v) => [v, process.env[v]]));
  appendFileSync(log, `${JSON.stringify({ script: name, folder: basename(dirname(String(script ?? ""))), args, env })}\n`);
}

const stop = (line, code = 1) => {
  process.stderr.write(`${line}\n`);
  process.exit(code);
};
const scenes = new Set(String(process.env.REEL_KIT_STANDIN ?? "").split(/\s+/).filter(Boolean));
if (scenes.has("fail")) stop(`${name}: failed, as the test asked`);

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
  },

  "render.py": (argv) => {
    const given = argv[0];
    if (!given || !existsSync(given) || !statSync(given).isDirectory()) stop("usage: render.py <project folder> [options]");
    const project = resolve(given);
    const edit = readFileSync(join(project, "edit.py"), "utf8");
    const said = (key) => new RegExp(`^${key} = "(.*)"$`, "m").exec(edit)?.[1] ?? "";
    const rest = argv.slice(1).filter((a) => !a.startsWith("--"));
    const name = rest.length ? rest[0] : `${basename(project)}-v1`;
    const pub = join(project, "public");
    // build.py: the composition made again from edit.py.
    mkdirSync(pub, { recursive: true });
    writeFileSync(join(pub, "build.json"), `${JSON.stringify({ built: "by build.py", title: said("TITLE") })}\n`);
    process.stdout.write("hyperframes check: ok\n");
    // What the scenario says the run leaves that is not its own.
    // The project itself, as the app and Studio see it: edit.py's SRC is its source/clip.mp4 (the copy it renders is elsewhere).
    const real = dirname(dirname(resolve(said("SRC"))));
    if (scenes.has("app-edit")) writeFileSync(join(real, "public", "index.html"), "<html>changed in the app while it rendered</html>\n");
    if (scenes.has("plant")) writeFileSync(join(project, "cards", "c1", "Claude.md"), "planted\n");
    if (scenes.has("link")) symlinkSync(dirname(project), join(pub, "elsewhere"));
    if (scenes.has("restate")) {
      const state = JSON.parse(readFileSync(join(real, "studio.json"), "utf8"));
      writeFileSync(join(real, "studio.json"), `${JSON.stringify({ ...state, state: "queued", job: "revise" })}\n`);
    }
    if (scenes.has("renders-link")) {
      const out = join(dirname(project), "renders elsewhere");
      mkdirSync(out, { recursive: true });
      rmSync(join(project, "renders"), { recursive: true, force: true });
      symlinkSync(out, join(project, "renders"));
    }
    if (scenes.has("cli-meta")) {
      mkdirSync(join(pub, "renders"), { recursive: true });
      writeFileSync(join(pub, "renders", `${basename(project)}_2026-01-02_03-04-05.meta.json`), `${JSON.stringify({ status: "complete", exportedTo: join(project, "renders", `${name}.mp4`) })}\n`);
    }
    mkdirSync(join(project, "renders"), { recursive: true });
    mkdirSync(join(pub, "snapshots"), { recursive: true });
    writeFileSync(join(pub, "snapshots", "frame.png"), "PNG");
    const final = join(project, "renders", `${name}.mp4`);
    writeFileSync(final, "A MADE-UP RENDER");
    rmSync(join(pub, "snapshots"), { recursive: true, force: true });
    const qa = spawnSync(process.execPath, [fileURLToPath(import.meta.url), join(dirname(String(script)), "qa.py"), project, join("renders", `${name}.mp4`), "--phone"], { stdio: "inherit" });
    if (qa.status !== 0) stop("QA failed: fix what it reports, render again. Nothing was delivered.");
    if (argv.includes("--no-deliver")) return;
    const last = name.split("-").at(-1);
    const ver = last.startsWith("v") ? last : name;
    const dest = dirname(resolve(said("SRC")));
    const title = [...said("TITLE")].filter((ch) => !'/\\:*?"<>|'.includes(ch)).join("").trim() || "Video";
    for (const [from, to] of [[final, `${title} ${ver}.mp4`], [final.replace(/\.mp4$/, "-phone.mp4"), `${title} ${ver} (phone).mp4`]]) {
      if (!existsSync(from)) continue;
      copyFileSync(from, join(dest, to));
      process.stdout.write(`delivered ${join(dest, to)}\n`);
    }
  },

  "qa.py": (argv) => {
    const [given, file] = argv;
    if (!given || !existsSync(given) || !file) stop("usage: qa.py <project folder> [options]");
    const project = resolve(given);
    const render = isAbsolute(file) ? file : join(project, file);
    mkdirSync(join(project, "work", "qa"), { recursive: true });
    writeFileSync(join(project, "work", "qa", "cuts_1.jpg"), "JPG");
    process.stdout.write("cuts: work/qa/cuts_1.jpg\nloudness: -14.0 LUFS, peak -1.2 dBFS\n");
    if (scenes.has("qa-fail")) {
      process.stdout.write("QA FAIL\n");
      process.exit(1);
    }
    if (argv.includes("--phone")) writeFileSync(render.replace(/\.mp4$/, "-phone.mp4"), "A MADE-UP PHONE COPY");
    process.stdout.write("QA PASS (now read the cut sheets)\n");
  }
};

if (!Object.hasOwn(SCRIPTS, name)) stop(`reel-kit stand-in: no stand-in for ${name || "a script"}`, 2);
SCRIPTS[name](args);
