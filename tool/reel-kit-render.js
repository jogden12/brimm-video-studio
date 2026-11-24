// The headless render of a Reel Kit edit (spec 2026-11-23 Reel Kit in Studio; plan Task 14, Decisions 6 and 7).
//
// Once she said go and the worker's finalize ended `ready`, Studio renders the edit itself, never the worker: Reel Kit's own
// pipeline/render.py, which runs its build.py (importing the project's edit.py, which the worker wrote), then HyperFrames' check and
// render, ffmpeg and qa.py. So render.py runs model-written code, and Studio runs it under an OS limit as the worker is held:
// `/usr/bin/sandbox-exec -f <profile>`, with a profile Studio writes from the very rules of the worker's sandbox (reel-kit-worker-tools.js
// workerSandbox): no network; writes only in a copy of the project (an APFS clone, in a fresh temp folder of its own) and that temp folder,
// never Studio's own names there; reads only the system and, in the home, the copy, the temp folder, the project itself (never written: its
// source clip is what edit.py names), KIT, Reel Kit's HyperFrames, HyperFrames' Chrome (~/.cache/hyperframes/chrome alone) and
// REEL_KIT_HOME's .venv, .venv-mp, tools, models, vendor, style, fx, cards and hf. The render never writes the project, so an edit she
// saves in the app while it renders is never built over, and the fingerprint finalize recorded stays what a render is judged by. Only the
// render and its phone copy come back into the project's renders/. Whether HyperFrames' headless Chrome renders
// inside it (its Mach services, its GPU, a loopback port) is RK21's, a by-hand spike before any real render: the profile is written as if
// it does, and MACH_SERVICES and the network line are the places RK21 may change.
//
// What is here:
//   - renderWhy: why an edit may not be rendered, in her words, or "": only a `ready` one whose composition is still what finalize
//     recorded (reel-kit-project.js compositionFingerprint); one changed in HyperFrames since is hers to export from the app;
//   - renderProfile: the sandbox-exec profile's text;
//   - renderReelKit: the render, the detached half's job, under the Mac-wide worker lock (reel-kit-worker.js macLock), so that a render and
//     a worker never run at once: `PY <kit>/pipeline/render.py <the copy> <slug>-v<n> --no-deliver`, never without --no-deliver, and only of
//     a copy whose own fingerprint is the one finalize recorded; then the copies Reel Kit's deliver would leave beside the copy's source
//     clip swept to the Trash (sweepCopies, never in the project's own source/), and, when QA passed, the render
//     brought into the project's renders/, the meta record exports.js reads (writeMeta) and the state `rendered`. A QA that failed keeps
//     nothing as an export, and says so. The copy is taken away;
//   - sweepCopies: `<Title> v<n>.mp4` and `<Title> v<n> (phone).mp4` in the copy's source/ moved to the Trash, never deleted, refusing links;
//   - writeMeta: `<project>/public/renders/<entry name>_<YYYY-MM-DD>_<HH-MM-SS>.meta.json` (Decision 7).
//
// What she reads holds no path, no flag and no name of a command.
import { spawn, spawnSync } from "node:child_process";
import { constants, cpSync, lstatSync, mkdirSync, readdirSync, realpathSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { plainName } from "./app.js";
import { releaseEpisodeLock, takeEpisodeLock } from "./detached.js";
import { thisCheckout } from "./filing.js";
import { bashNeeds, bothSpellings, realOf as placeOf } from "./places.js";
import { binDir, kitDir, reelKitEnv, reelKitHome, venvPython } from "./reel-kit.js";
import { reelKitReady } from "./reel-kit-install.js";
import { compositionFingerprint, readCapped, readState, writeState } from "./reel-kit-project.js";
import { freshTmp, killGroup, macLock, macWorkerFile, processStart, settingsFileOf, stopLeftOver, sweepProject, workerTmp } from "./reel-kit-worker.js";
import { holdersOf, stopHolders, writeWhole } from "./reel-kit-worker-own.js";
import { OWN_NAMES, foldName, workerSandbox } from "./reel-kit-worker-tools.js";
import { isRunning } from "./run.js";
import { factsOf } from "./settings.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** What a render is, as the meta record says it: Reel Kit renders an upright 1080 by 1920 MP4. */
export const RENDER_SETTINGS = Object.freeze({ format: "mp4", resolution: "1080x1920" });
/** macOS's own sandbox program. */
export const SANDBOX_EXEC = "/usr/bin/sandbox-exec";
/** macOS's own program that moves a file to the Trash, as Finder does (macOS 15 and later). */
const TRASH = "/usr/bin/trash";
/** How long a render may run before it is stopped: three hours. A Reel renders in minutes. */
const RENDER_MS = 3 * 3600 * 1000;
/** How much of what the render prints is kept for the log. */
const OUT_MOST = 8000;
const SLUG = /^[0-9a-z]{6}-(?:main|reel-[1-9]\d*)-v[1-9]\d*$/;

/** What a render says, in her words. */
export const RENDER_SAY = Object.freeze({
  changed: (name) => `${name} was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac.`,
  notBuilt: `It isn't built to render yet: say "go" when its storyboard is right.`,
  rendered: "It is rendered already.",
  odd: "Its project isn't as Reel Kit left it, so it wasn't rendered: ask Jason.",
  planted: "Something that isn't Reel Kit's was found in its project, so it wasn't rendered: ask Jason.",
  unread: "Its project can't be read, so it wasn't rendered: ask Jason.",
  notSetUp: "Reel Kit isn't set up on this Mac as it should be, so it wasn't rendered: ask Jason.",
  busy: "It is being rendered already.",
  qaFailed: "Reel Kit's own checks of the render didn't pass, so nothing was kept as an export: ask Jason.",
  failed: "The render didn't finish, so nothing was kept as an export: ask Jason.",
  open: "It is open in HyperFrames or another app on this Mac, so it wasn't rendered: close it there first, then say it again.",
  own: "The render left something in its project that isn't Reel Kit's, so nothing was kept as an export: ask Jason.",
  oddRender: "The render didn't come out as Reel Kit makes one, so nothing was kept as an export: ask Jason.",
  moved: "It was changed while it rendered, so nothing was kept as an export.",
  unrecorded: "The render finished, but its record couldn't be written, so nothing was kept as an export: ask Jason."
});

// --- Whether it may render ---

/** Whether the run the edit's studio.json `state` names as rendering it (`rendering: { pid, start }`) still runs: its pid alive, and, when its
    start was recorded, the same process (`startOf(pid)`, the worker's processStart), as a pid is used again. */
export function renderingBy(state, alive = isRunning, startOf = processStart) {
  const mark = state?.rendering;
  if (!isObject(mark) || !Number.isInteger(mark.pid) || !alive(mark.pid)) return false;
  return typeof mark.start !== "string" || startOf(mark.pid) === mark.start;
}

/** Why the edit in `dir`, whose studio.json says `state`, may not be rendered, in her words, or "": a render is only of an edit the
    worker's finalize ended `ready` (after her go), with an edit.py, whose composition's fingerprint is still the one recorded then (or
    after its last render). One changed in HyperFrames since is refused in the words RENDER_SAY.changed says, naming it by its project's
    name as the app shows it; one whose fingerprint can't be made (a link inside) is refused too, as is one with none recorded. */
export function renderWhy(dir, state) {
  if (!isObject(state)) return RENDER_SAY.unread;
  if (state.state === "rendered") return RENDER_SAY.rendered;
  if (state.state !== "ready" || typeof state.fingerprint !== "string" || !/^sha256-[0-9a-f]{64}$/.test(state.fingerprint)) return RENDER_SAY.notBuilt;
  try {
    if (!lstatSync(join(dir, "edit.py")).isFile()) return RENDER_SAY.odd;
  } catch {
    return RENDER_SAY.notBuilt;
  }
  let now;
  try {
    now = compositionFingerprint(dir);
  } catch {
    return RENDER_SAY.odd;
  }
  if (now === state.fingerprint) return "";
  return RENDER_SAY.changed(typeof state.name === "string" && state.name.trim() !== "" ? state.name : "This edit");
}

// --- Where it runs ---

/** The system places a render reads: its programs, libraries, frameworks and fonts, Homebrew's programs (Studio's node and ffmpeg on the
    Mac Studio), the system's settings, time zones and shared caches, and its devices. */
const SYSTEM_READS = Object.freeze(["/System", "/usr", "/bin", "/sbin", "/Library", "/opt/homebrew", "/private/etc", "/private/var/db/timezone", "/private/var/db/dyld", "/private/var/select", "/dev"]);
/** The names of the system's own links and folders above those, which a program looks at to find its way. */
const SYSTEM_LOOKS = Object.freeze(["/", "/etc", "/tmp", "/var", "/private", "/private/var", "/private/var/db"]);
/** The system's devices a render may write to. */
const DEVICE_WRITES = Object.freeze(["/dev/null", "/dev/zero", "/dev/tty", "/dev/dtracehelper"]);
/** The system services a render may ask by name: the log, notifications, user and preference lookups, fonts, the GPU and Core Animation
    that a headless Chrome and VideoToolbox ask for. None that reaches the network (no nsurlsessiond, mDNSResponder, trustd or networkd),
    and none that starts a program outside the sandbox: Launch Services (launchservicesd, lsd.mapdb and coreservicesd) would let the
    model-written edit.py `open` an app or a link, which runs outside it, and the window server is left out with them. RK21 settles the
    list: it runs `open -g https://example.com` and `open -a TextEdit` inside the profile and expects both refused. */
export const MACH_SERVICES = Object.freeze([
  "com.apple.system.logger", "com.apple.logd", "com.apple.diagnosticd", "com.apple.system.notification_center", "com.apple.distributed_notifications@Uv3",
  "com.apple.system.opendirectoryd.libinfo", "com.apple.system.opendirectoryd.membership", "com.apple.cfprefsd.daemon", "com.apple.cfprefsd.agent",
  "com.apple.fonts", "com.apple.FontObjectsServer", "com.apple.SecurityServer", "com.apple.CARenderServer", "com.apple.MTLCompilerService",
  "com.apple.gpumemd.source", "com.apple.PowerManagement.control", "com.apple.audio.coreaudiod", "com.apple.audio.audiohald"
]);

/** A name in a regular expression that matches it in either case, letter by letter: `[cC][lL]…`, anything else escaped. */
const anyCase = (name) => [...name].map((ch) => (ch.toLowerCase() !== ch.toUpperCase() ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("");
/** A path as the start of a regular expression, each character that means something in one escaped. */
const literally = (path) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A path as a string of the profile's language, between double quotes with `\` and `"` escaped. A control character in it (a new
    line) throws: no path Studio makes holds one. */
function quoted(path) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error(`renderProfile: ${JSON.stringify(path)} is not a whole path the profile can hold`);
  return stringOf(path);
}
/** Any text as a string of the profile's language (a regular expression's, say), `\` and `"` escaped; a control character throws. */
function stringOf(text) {
  if (/\p{Cc}/u.test(text)) throw new Error(`renderProfile: ${JSON.stringify(text)} holds a character the profile can't`);
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
const unique = (list) => [...new Set(list)];
const filter = (kind, paths) => unique(paths).map((path) => `(${kind} ${quoted(path)})`).join(" ");
/** Every folder above `path`, up to and with /. */
function above(path) {
  const all = [];
  for (let at = dirname(path); ; at = dirname(at)) {
    all.push(at);
    if (dirname(at) === at) return all;
  }
}

/** The text of the sandbox-exec profile a render runs in, for the project it may write, `project` (the render's copy of the edit, inside
    its fresh temp folder `tmp`), and the folders it may only read, `readOnly` (the edit's own project, whose source clip edit.py names),
    from the inputs of the worker's sandbox (workerSandbox: `checkout`, `kit`, `rkHome`, this Mac's `facts`, settings.js factsOf) and its
    very lists, in this order, the last rule that matches being the one that holds:
    - nothing at all (deny default); then the processes, signals and system lookups a program needs, and the Mach services of MACH_SERVICES;
    - reads of the system (SYSTEM_READS) and of each program in `programs` (real paths: Studio's node, the programs Reel Kit's tools/bin
      links to), by the folder it is installed in unless that is the home or above it, then by itself;
    - every read the worker's sandbox denies (the whole home in both spellings, the gated places, the checkout, the worker settings' folder
      and her folder) denied;
    - the folders above each place read back in looked at (their names only, never their contents), and the places the worker's sandbox
      reads back in, but for the three of Claude Code's own (places.js bashNeeds), which no render needs: the project, `tmp`, KIT, Reel
      Kit's HyperFrames, HyperFrames' Chrome and REEL_KIT_HOME's own folders; and `readOnly`, read and never written;
    - writes of the project and `tmp` (the worker's allowWrite) and a few devices; then Studio's own names in both (the worker's
      denyWrite) denied, and again at any depth under either, in either case, by a regular expression (the worker's Edit() rules do
      that in its sandbox; the look over the project after the render, sweepProject, is for the spellings the disk folds that no
      expression names);
    - the network denied, last. */
export function renderProfile({ checkout, project, kit, rkHome, facts, tmp, programs = [], readOnly = [] }) {
  const box = workerSandbox({ checkout, project, kit, rkHome, facts, tmp }).filesystem;
  const claudeOwn = new Set(bashNeeds({ ...facts, folder: project }));
  const reads = unique([...box.allowRead.filter((path) => !claudeOwn.has(path)), ...readOnly.map(placeOf)].flatMap(bothSpellings));
  const writes = unique(box.allowWrite.flatMap(bothSpellings));
  const homes = unique([facts.home, facts.claudeHome ?? facts.home]);
  const installed = programs.filter((p) => typeof p === "string" && isAbsolute(p)).map((program) => {
    const root = dirname(dirname(program));
    const tooHigh = root === "/" || homes.some((home) => home === root || home.startsWith(`${root}/`));
    return tooHigh ? { kind: "literal", path: program } : { kind: "subpath", path: root };
  });
  const looks = unique([...SYSTEM_LOOKS, ...[...reads, ...writes].flatMap(above)]);
  const own = `(${OWN_NAMES.map(anyCase).join("|")})`;
  const ownAnywhere = writes.map((root) => `(regex ${stringOf(`^${literally(root)}/(.*/)?${own}(/.*)?$`)})`).join(" ");
  const lines = [
    "(version 1)",
    "(deny default)",
    "(allow process-fork)",
    "(allow process-exec)",
    "(allow process-info* (target same-sandbox))",
    "(allow signal (target same-sandbox))",
    "(allow sysctl-read)",
    "(allow user-preference-read)",
    "(allow ipc-posix-shm*)",
    "(allow ipc-posix-sem)",
    "(allow iokit-open)",
    "(allow file-ioctl)",
    `(allow mach-lookup ${MACH_SERVICES.map((name) => `(global-name ${JSON.stringify(name)})`).join(" ")})`,
    `(allow file-read* (literal "/") ${filter("subpath", SYSTEM_READS)})`,
    ...(installed.length ? [`(allow file-read* ${installed.map(({ kind, path }) => `(${kind} ${quoted(path)})`).join(" ")})`] : []),
    `(deny file-read* ${filter("subpath", box.denyRead)})`,
    `(allow file-read-metadata ${filter("literal", looks)})`,
    `(allow file-read* ${filter("subpath", reads)})`,
    `(allow file-write* ${filter("subpath", writes)})`,
    `(allow file-write-data ${filter("literal", DEVICE_WRITES)})`,
    `(deny file-write* ${filter("subpath", box.denyWrite)})`,
    `(deny file-write* ${ownAnywhere})`,
    "(deny network*)"
  ];
  return `${lines.join("\n")}\n`;
}

/** Where a render's profile is written for the project `slug`: beside the worker's settings, out of the render's reach. */
export const renderProfileFile = (home, slug) => join(dirname(settingsFileOf(home, slug)), `${slug}.render.sb`);

/** The real paths of the programs a render runs that live outside the places it reads: Studio's node (`node`) and what each entry of Reel
    Kit's tools/bin links to (its node, ffmpeg, ffprobe and Python; its npx is a file there). A link that leads nowhere is left out. */
function programsOf(home, node) {
  const found = [];
  let inBin = [];
  try {
    inBin = readdirSync(binDir(home)).map((name) => join(binDir(home), name));
  } catch {
    // no tools/bin
  }
  for (const path of [node, ...inBin]) {
    try {
      found.push(realpathSync(path));
    } catch {
      // not there
    }
  }
  return unique(found);
}

// --- The copies beside the source ---

/** The title as Reel Kit's deliver() names its copies: without the characters a file name can't hold, its spaces at the ends taken off,
    "Video" when nothing is left. */
const deliveredTitle = (title) => [...String(title ?? "")].filter((ch) => !'/\\:*?"<>|'.includes(ch)).join("").trim() || "Video";
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Move to the Trash, through macOS's own trash, the file at `path`: whether it is gone. Never a delete. */
function trashFile(path) {
  try {
    return spawnSync(TRASH, [path], { stdio: "ignore", timeout: 60000 }).status === 0;
  } catch {
    return false;
  }
}

/** Sweep the copies a render's deliver would leave beside the source clip, in the `source/` of the render's copy of the project
    (`sourceDir`; never the project's own, where a file of that name is hers): every `<Title> v<n>.mp4` and `<Title> v<n> (phone).mp4`
    there, the title as Reel Kit names them and each name matched as the Mac's disk folds it, is moved to the Trash (`trash`, macOS's own
    by default), never deleted, by the safe-delete rules: only a plain file, looked at again just before its move and moved only while it
    is the same file (device and inode); a link or a folder with such a name is left, and named in the log. A name in `except` (the names
    the copy held before the render ran: clones of her own files) is left alone. A `sourceDir` that is a link, or not a folder, is never
    looked in: `refused`. { trashed, left, refused }, the names. */
export function sweepCopies(sourceDir, title, { trash = trashFile, log = () => {}, except = [] } = {}) {
  const before = new Set(except);
  let there;
  try {
    there = lstatSync(sourceDir);
  } catch {
    return { trashed: [], left: [], refused: false };
  }
  if (there.isSymbolicLink() || !there.isDirectory()) return { trashed: [], left: [], refused: true };
  const copy = new RegExp(`^${escaped(foldName(deliveredTitle(title)))} v\\d+(?: \\(phone\\))?\\.mp4$`);
  const trashed = [];
  const left = [];
  for (const name of readdirSync(sourceDir)) {
    if (before.has(name) || !copy.test(foldName(name))) continue;
    const path = join(sourceDir, name);
    try {
      const seen = lstatSync(path);
      if (seen.isSymbolicLink() || !seen.isFile()) {
        log(`A copy's name beside Reel Kit's source is not a plain file, so it was left: ${name}.`);
        left.push(name);
        continue;
      }
      const now = lstatSync(path);
      if (!now.isFile() || now.dev !== seen.dev || now.ino !== seen.ino || !trash(path)) {
        left.push(name);
        continue;
      }
      try {
        lstatSync(path);
        left.push(name);
      } catch {
        trashed.push(name);
      }
    } catch {
      left.push(name);
    }
  }
  return { trashed, left, refused: false };
}

// --- The meta record (Decision 7) ---

const pad = (n) => String(n).padStart(2, "0");
/** A moment as a meta record's name gives it, in the Mac's zone: `<YYYY-MM-DD>_<HH-MM-SS>`. */
const metaStamp = (at) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}-${pad(at.getMinutes())}-${pad(at.getSeconds())}`;

/** A folder `path` of the project's own, made when it is not there (never through a link, never with the folders above it), or a throw. */
function ownFolder(path) {
  try {
    const kind = lstatSync(path);
    if (kind.isSymbolicLink() || !kind.isDirectory()) throw new Error(`${path} is not a folder of the project's own`);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    mkdirSync(path);
  }
}

/** Whether `file` is a render in the project `dir`'s own renders/: a plain file (no link) named straight in `<dir>/renders/`, that folder
    a folder of the project's own and not a link, and the file's real path inside that folder's real path. */
export function renderInProject(dir, file) {
  try {
    if (typeof file !== "string" || !isAbsolute(file)) return false;
    const renders = join(dir, "renders");
    if (join(renders, basename(file)) !== file) return false;
    const folder = lstatSync(renders);
    if (folder.isSymbolicLink() || !folder.isDirectory() || !lstatSync(file).isFile()) return false;
    return dirname(realpathSync.native(file)) === realpathSync.native(renders);
  } catch {
    return false;
  }
}

/** Write the meta record of a render in the project `dir`, as the app leaves one for an export (exports.js metaNameOf and metaOf read
    it): `<dir>/public/renders/<name>_<YYYY-MM-DD>_<HH-MM-SS>.meta.json`, `at` (a Date, when the render began) in the Mac's zone, holding
    `{ status: "complete", exportedTo: <file>, settings: { format: "mp4", resolution: "1080x1920" } }`, `file` the render's whole path in
    `<dir>/renders/` (renderInProject: anything else is refused). Written whole, only into a public/ and a renders/ that are the project's
    own folders and not links, never over one there already. The path it wrote; a throw when it can't. */
export function writeMeta(dir, { name, file, at }) {
  if (!plainName(name)) throw new Error(`writeMeta: ${JSON.stringify(name)} is not a project's name`);
  if (!renderInProject(dir, file)) throw new Error("writeMeta: the render is not a file in the project's own renders/ folder");
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) throw new Error("writeMeta: when it began is a Date");
  const pub = join(dir, "public");
  const kind = lstatSync(pub);
  if (kind.isSymbolicLink() || !kind.isDirectory()) throw new Error("writeMeta: public/ is not a folder of the project's own");
  const renders = join(pub, "renders");
  ownFolder(renders);
  const path = join(renders, `${name}_${metaStamp(at)}.meta.json`);
  try {
    lstatSync(path);
    throw Object.assign(new Error("writeMeta: a record of that name is there already"), { code: "EEXIST" });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  writeWhole(path, `${JSON.stringify({ status: "complete", exportedTo: file, settings: { ...RENDER_SETTINGS } }, null, 2)}\n`);
  return path;
}

// --- The render ---

/** The number of the next render of the project `slug`: one after the highest its studio.json lists or its renders/ holds, so that a
    render never writes over another. */
function nextRender(dir, slug, state) {
  const ours = new RegExp(`^${escaped(slug)}-v([1-9]\\d*)(?:-phone)?\\.mp4$`);
  const numbers = (Array.isArray(state.renders) ? state.renders : []).map((r) => ours.exec(`${r?.name}.mp4`)?.[1]);
  try {
    numbers.push(...readdirSync(join(dir, "renders")).map((name) => ours.exec(name)?.[1]));
  } catch {
    // no renders yet
  }
  const all = numbers.filter(Boolean).map(Number);
  return all.length ? Math.max(...all) + 1 : 1;
}

/** The names in the folder `path`, or none when it can't be read. */
const namesIn = (path) => {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
};

/** Whether `path` is a plain file. */
const plainFile = (path) => {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
};

/** Run the render: `sandboxExec -f <profile> <PY> <kit>/pipeline/render.py <dir> <name> --no-deliver` in the project, in its own process
    group, recorded as the Mac's one worker (macWorkerFile) while it runs, so that the next job stops it if this run died; stopped whole
    when it runs out of time. { code, signal, out, timedOut }, `out` the end of what it printed. */
async function runRender({ home, dir, name, profile, env, sandboxExec, limit, grace, wait }) {
  const args = ["-f", profile, venvPython(home), join(kitDir(home), "pipeline", "render.py"), dir, name, "--no-deliver"];
  const child = spawn(sandboxExec, args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let out = "";
  const keep = (d) => (out = (out + d).slice(-OUT_MOST));
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  let exited = false;
  const closed = new Promise((done) => {
    child.on("error", (e) => done({ code: 127, signal: "", error: e }));
    child.on("exit", () => (exited = true));
    child.on("close", (code, signal) => done({ code, signal }));
  });
  if (child.pid) writeWhole(macWorkerFile(home), `${JSON.stringify({ pid: child.pid, start: processStart(child.pid), dir, at: new Date().toISOString(), render: true })}\n`);
  let timedOut = false;
  const clock = setTimeout(() => {
    timedOut = true;
    void killGroup(child.pid, { grace, gone: () => exited, wait });
  }, limit);
  try {
    const { code, signal } = await closed;
    return { code, signal, out, timedOut };
  } finally {
    clearTimeout(clock);
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // nothing left of it
      }
      try {
        const left = JSON.parse(readCapped(macWorkerFile(home), 64 * 1024) ?? "null");
        if (isObject(left) && left.pid === child.pid) rmSync(macWorkerFile(home), { force: true });
      } catch {
        // the record is another's, or none
      }
    }
  }
}

/** Copy the project `dir` into `clone` for a render, by APFS cloning (copy-on-write, so the 4K source costs nothing; a plain copy where
    the disk can't clone), links copied as links (a link in the composition is refused by its fingerprint before this), and with none
    of Studio's own names (OWN_NAMES, as the Mac's disk folds a name, at any depth: studio.json, the notes for the app's agent, a
    .claude folder): the copy is the render's, and anything under one of those names found in it afterwards was put there by the render.
    The project's renders/ is not copied (an empty one is made): the render's file is all that comes back from it. */
export function copyProject(dir, clone) {
  const own = new Set(OWN_NAMES.map(foldName));
  cpSync(dir, clone, {
    recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false, mode: constants.COPYFILE_FICLONE,
    filter: (source) => {
      const rel = relative(dir, source);
      if (rel === "") return true;
      if (rel === "renders") return false;
      return !rel.split(sep).some((part) => own.has(foldName(part)));
    }
  });
  mkdirSync(join(clone, "renders"));
}

/** Bring the render `name` (and its phone copy, when it made one) from the copy's renders/ into the project's own, by renaming: only a
    plain file straight in the copy's own renders/ (renderInProject of the copy), into the project's renders/, a folder of its own and not
    a link (made when it is not there), never over a file there. The render's whole path in the project, or null when it can't come back
    (said in the log); a phone copy that can't is left in the copy and goes with it. */
function bringBack(clone, dir, name, log) {
  const from = join(clone, "renders", `${name}.mp4`);
  if (!renderInProject(clone, from)) {
    log(`Reel Kit's render ${name} is not a file in its copy's own renders folder, so it was not kept.`);
    return null;
  }
  const into = join(dir, "renders");
  const moveIn = (source, target) => {
    try {
      lstatSync(target);
      return false;
    } catch (e) {
      if (e.code !== "ENOENT") return false;
    }
    renameSync(source, target);
    return true;
  };
  try {
    ownFolder(into);
    const final = join(into, `${name}.mp4`);
    if (!moveIn(from, final) || !renderInProject(dir, final)) {
      log(`Reel Kit's render ${name} could not be brought into its project's renders folder.`);
      return null;
    }
    const phone = join(clone, "renders", `${name}-phone.mp4`);
    if (renderInProject(clone, phone) && !moveIn(phone, join(into, `${name}-phone.mp4`))) log(`Reel Kit's phone copy of ${name} could not be brought into its project.`);
    return final;
  } catch (e) {
    log(`Reel Kit's render ${name} could not be brought into its project's renders folder: ${e.code || e.message}.`);
    return null;
  }
}

/** The processes other than this run (and the one that started it) that hold the project `dir` open (the worker's holdersOf, by lsof), or
    null when that can't be asked. */
function othersHolding(dir, run) {
  const pids = holdersOf([dir], run);
  return pids === null ? null : pids.filter((pid) => pid !== process.pid && pid !== process.ppid);
}

/** Render the Reel Kit edit in the project `dir`, the record's `entry`, headless: the detached half's job of `reelkit render`. { ok, file,
    why }: `file` the render's whole path, `why` the line she reads when it wasn't rendered. The render runs in a copy of the project, so
    the project itself is never written by it: what holds is that the edit she approved, as finalize recorded it (`state.fingerprint`), is
    what renders, and that nothing she does in the app meanwhile is written over or taken for Reel Kit's. In this order:
    - renderWhy, before anything waits: an edit not `ready`, or changed in HyperFrames, renders nothing; nor one another live run renders
      (renderingBy, by its pid and start);
    - the project is marked `rendering` ({ pid, start, at }) by this run, which takes a mark her chat made with its pid for its own;
    - it waits for the Mac-wide worker lock (macLock), so that a render and a worker never run at once; inside it, a worker or render an
      earlier runner left running is stopped (the worker's stopLeftOver), and renderWhy is asked again, as what she did meanwhile counts;
    - as a courtesy, not a guard, a project that something else holds open (lsof: the HyperFrames app, a Terminal, QuickTime) is not
      rendered, RENDER_SAY.open, each holder named in the log and left running (stopHolders): the app may read files into memory and hold
      none, so the copy is the guard;
    - the project is copied into the render's fresh temp folder (the worker's workerTmp of `<slug>.render`, as `project/`; copyProject:
      APFS clones, without Studio's own names), the copy looked over for Studio's own names (sweepProject: a find refuses it,
      RENDER_SAY.planted, `lastRender.why` "planted"), and the copy's own fingerprint compared with `state.fingerprint`: a copy that is not
      the edit she approved (an app save between the look above and the copy) renders nothing, RENDER_SAY.changed; its profile
      (renderProfile: the copy and the temp folder written, the project only read, for edit.py's source clip) written beside the worker's
      settings, and Reel Kit's render.py run on the copy through sandbox-exec in Reel Kit's own environment (reel-kit.js reelKitEnv, TMPDIR
      the temp folder) as `<slug>-v<n>`, n the next render's number, always with --no-deliver;
    - after it, whatever it ended with: the copy looked over again for Studio's own names (any found set aside, and the render failed,
      `state: "failed"`, `why: "own"`, RENDER_SAY.own, as the worker's run fails), the copies a deliver left in the copy's source/ swept to
      the Trash (sweepCopies; the project's own source/ is never looked in, and what the copy held there before the run is left), and only the render and its phone copy brought back into the project's renders/ (bringBack); what else the
      render made (its own records in public/renders/, a link) stays in the copy, which is then taken away. `state.fingerprint` is never
      recorded again: it stays as finalize recorded it, so an edit she made in the app while it rendered is refused at her next render as
      changed in HyperFrames;
    - a render that ended 0 and came back, and an edit still `ready`: the meta record (writeMeta), then `state: "rendered"`, `lastRender`
      and the render added to `renders` with the fingerprint it ran on (`state.fingerprint`, which its copy matched), by which exports.js
      takes it only while the edit is still that one; any other: nothing kept as an export, `lastRender` says why (`qa` when Reel Kit's QA failed,
      `error`, `time`, `odd`, `record`, `own`, `planted`), the state left as it is, and she reads its line. The mark comes off, the copy is taken
      away and the lock is let go, whatever happened.
    `deps`: `sandboxExec` (SANDBOX_EXEC), `trash` (sweepCopies'), `run` (spawnSync: lsof and ps), `alive`, `startOf`, `wait`, `every` (ms
    between looks at the lock), `limit`, `grace`, `facts` (settings.js factsOf of ctx.settings by default), `node` (Studio's), `log`,
    `copy` (copyProject; a test's, to change the copy between the steps).
    `ctx`: `home`, `settings`, `checkout`, `node`, `base`, `now`. */
export async function renderReelKit(ctx, { dir, entry }, deps = {}) {
  const {
    sandboxExec = SANDBOX_EXEC, trash, run = spawnSync, alive = isRunning, startOf = processStart, wait = (ms) => new Promise((r) => setTimeout(r, ms)),
    every = 2000, limit = RENDER_MS, grace = 5000, facts, node = ctx.node ?? process.execPath, log = () => {}, copy = copyProject
  } = deps;
  const home = ctx.home;
  const refuse = (why) => ({ ok: false, file: null, why });
  const first = readState(dir);
  const mark = (fields) => writeState(dir, { ...(readState(dir) ?? {}), ...fields });
  // Her chat's mark for this very run comes off when it renders nothing.
  const unmark = () => {
    try {
      if (readState(dir)?.rendering?.pid === process.pid) mark({ rendering: undefined });
    } catch {
      // the mark dies with this run
    }
  };
  const why = renderWhy(dir, first);
  if (why) {
    unmark();
    return refuse(why);
  }
  if (!isObject(entry) || !plainName(entry.name) || typeof first.slug !== "string" || !SLUG.test(first.slug)) {
    unmark();
    return refuse(RENDER_SAY.unread);
  }
  const slug = first.slug;
  if (first.rendering?.pid !== process.pid && renderingBy(first, alive, startOf)) return refuse(RENDER_SAY.busy);
  const at = new Date(ctx.now ? ctx.now() : Date.now());
  mark({ rendering: { pid: process.pid, start: startOf(process.pid) ?? undefined, at: at.toISOString() } });

  const lock = macLock(home);
  mkdirSync(dirname(lock), { recursive: true });
  let took;
  for (;;) {
    took = takeEpisodeLock(lock, "reelkit render", alive);
    if (took.taken) break;
    await wait(every);
  }
  const tmp = workerTmp(home, `${slug}.render`);
  const clone = join(tmp, "project");
  try {
    await stopLeftOver(home, { alive, startOf, grace, wait, log });
    const state = readState(dir);
    const again = renderWhy(dir, state);
    if (again) {
      mark({ rendering: undefined });
      return refuse(again);
    }
    // An install may have changed Reel Kit while the render waited (it holds this lock while it runs).
    if (!reelKitReady(home, { alive })) {
      mark({ rendering: undefined });
      return refuse(RENDER_SAY.notSetUp);
    }
    // A courtesy: she is told to close the app first. The copy, not this look, keeps her edits from Reel Kit's build.
    const holding = othersHolding(dir, run);
    if (holding?.length) {
      await stopHolders({ dirs: [dir], said: `Before Reel Kit's render of ${slug}`, run, startOf: (pid) => startOf(pid), log });
      mark({ rendering: undefined });
      return refuse(RENDER_SAY.open);
    }
    const name = `${slug}-v${nextRender(dir, slug, state)}`;
    const began = new Date(ctx.now ? ctx.now() : Date.now());
    freshTmp(tmp);
    copy(dir, clone);
    // What the copy holds before the render runs: anything under Studio's own names fails it (said as such in status), and so does a copy
    // that is not the edit she approved (an app save between the look above and the copy), which renders nothing.
    if (sweepProject(home, slug, clone, { said: `Before Reel Kit's render of ${slug}`, log }).planted.length) {
      mark({ rendering: undefined, lastRender: { at: began.toISOString(), name, qa: "", why: "planted" } });
      return refuse(RENDER_SAY.planted);
    }
    let copied = null;
    try {
      copied = compositionFingerprint(clone);
    } catch {
      copied = null;
    }
    if (copied !== state.fingerprint) {
      log(`Reel Kit's ${slug} changed as it was copied for its render, so it was not rendered.`);
      mark({ rendering: undefined });
      return refuse(RENDER_SAY.changed(typeof state.name === "string" && state.name.trim() !== "" ? state.name : "This edit"));
    }
    const hers = namesIn(join(clone, "source"));
    const profile = renderProfileFile(home, slug);
    writeWhole(profile, renderProfile({
      checkout: ctx.checkout ?? thisCheckout(), project: clone, readOnly: [dir], kit: kitDir(home), rkHome: reelKitHome(home),
      facts: facts ?? factsOf(home, ctx.settings, {}), tmp, programs: programsOf(home, node)
    }));
    const env = { ...reelKitEnv({ home, node, base: ctx.base ?? { HOME: home } }), TMPDIR: tmp };
    const ran = await runRender({ home, dir: clone, name, profile, env, sandboxExec, limit, grace, wait });

    // What the render left: Studio's own names in its copy fail it; the copies a deliver left beside the copy's source go to the Trash,
    // and the project's own source/ is never looked in (a file of that name there is hers).
    const planted = sweepProject(home, slug, clone, { said: `After Reel Kit's render of ${slug}`, log }).planted;
    const swept = sweepCopies(join(clone, "source"), state.title, { ...(trash ? { trash } : {}), log, except: hers });
    if (swept.left.length || swept.refused) log(`Reel Kit's render of ${slug} left copies beside its source that couldn't be moved to the Trash.`);
    const last = { at: began.toISOString(), name };
    const leave = (fields, said) => {
      mark({ rendering: undefined, ...fields });
      return refuse(said);
    };
    if (planted.length) return leave({ state: "failed", why: "own", lastRender: { ...last, qa: "", why: "own" } }, RENDER_SAY.own);
    if (ran.code !== 0 || !plainFile(join(clone, "renders", `${name}.mp4`))) {
      const qa = /QA failed/.test(ran.out);
      const failed = qa ? "qa" : ran.timedOut ? "time" : "error";
      log(`Reel Kit's render of ${slug} ended ${ran.code ?? ran.signal} (${failed}): ${ran.out.trim().split("\n").slice(-3).join(" | ")}`);
      return leave({ lastRender: { ...last, qa: qa ? "failed" : "", why: failed } }, qa ? RENDER_SAY.qaFailed : RENDER_SAY.failed);
    }
    // A job that took the edit while it rendered (its state no longer ready) is left its own: this render is of an edit no longer there.
    if (readState(dir)?.state !== "ready") {
      log(`Reel Kit's ${slug} was taken out of ready while it rendered, so its render was not kept as an export.`);
      return leave({}, RENDER_SAY.moved);
    }
    const final = bringBack(clone, dir, name, log);
    if (final === null) return leave({ lastRender: { ...last, qa: "passed", why: "odd" } }, RENDER_SAY.oddRender);
    try {
      writeMeta(dir, { name: entry.name, file: final, at: began });
    } catch (e) {
      log(`Reel Kit's render of ${slug} is made, but its record could not be written: ${e.code || e.message}.`);
      return leave({ lastRender: { ...last, qa: "passed", why: "record" } }, RENDER_SAY.unrecorded);
    }
    const phone = join(dir, "renders", `${name}-phone.mp4`);
    const renders = [...(Array.isArray(state.renders) ? state.renders : []), { name, file: `renders/${name}.mp4`, phone: plainFile(phone) ? `renders/${name}-phone.mp4` : null, at: last.at, fingerprint: state.fingerprint }];
    mark({ state: "rendered", rendering: undefined, lastRender: { ...last, qa: "passed", why: "" }, renders });
    return { ok: true, file: final, why: "" };
  } catch (e) {
    log(`Reel Kit's render of ${slug} could not be done: ${e.code || e.message}.`);
    try {
      mark({ rendering: undefined, lastRender: { at: at.toISOString(), qa: "", why: "error" } });
    } catch {
      // said in the log
    }
    return refuse(RENDER_SAY.failed);
  } finally {
    // The copy is the render's own, made by this run in its temp folder: taken away whole, a link in it as a link.
    try {
      rmSync(clone, { recursive: true, force: true });
    } catch (e) {
      log(`Reel Kit's copy of ${slug} for its render could not be taken away: ${e.code || e.message}.`);
    }
    releaseEpisodeLock(lock, took.text);
  }
}
