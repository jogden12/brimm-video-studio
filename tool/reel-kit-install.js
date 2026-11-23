// Installing a pinned Reel Kit beside Studio's toolchain (spec 2026-11-23 Reel Kit in Studio, section 2; plan Task 5).
//
// installPlan says, for a dropped Reel Kit (reel-kit-drop.js readDrop), what the install would do: each step in order, in her words,
// and whether it is needed or is "here already" (made before, as the pin has it). Or one line saying why it won't be installed: an
// installed Mac (Decision 10) takes only the fingerprint Studio pins. runInstall carries the plan out, stage by stage
// (reel-kit-stages.js), and passes Reel Kit's credit line on for the caller to show once. It is all or nothing: until the last stage,
// Reel Kit's own `setup.sh --check`, ends READY, what each stage replaced is kept aside, and if anything fails or is stopped it all
// goes back, so the version in use is left as it was. Only after READY is `.setup-version` written (Reel Kit writes it only without
// --check, which Studio never runs: without it setup.sh and setup.py pip install unpinned packages and fetch what they like).
//
// Nothing here reaches the network or starts a program by itself: `programs` are given (absolute paths: Studio's node, npm, ffmpeg
// and ffprobe from findPrograms, curl, /bin/sh, tar, and ditto as `unzip`), `run` starts them and `fetch` downloads, by default
// `curl -fsSL -o <dest> <url>` through setup/install.js runProgram. Tests give stand-ins for all of them.
import { lstatSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { PIN, pinFrom } from "./reel-kit.js";
import { runProgram } from "./setup/install.js";
import { workFolder } from "./settings.js";
import { INSTALL_WHY, STAGES, pathsOf } from "./reel-kit-stages.js";
import { commit, recoverAll, rollBack, takeAway } from "./reel-kit-swap.js";

export { INSTALL_WHY };
/** The ids of the steps, in the order they run. */
export const STEP_IDS = Object.freeze(STAGES.map((s) => s.id));

const HERE_ALREADY = ": here already";

/** Runs a program to its end with setup/install.js runProgram, keeping what it printed: `{ code, out }`. */
export async function runCaptured(program, args, { env, signal } = {}) {
  let out = "";
  const { code } = await runProgram(program, args, { env, signal, errors: { write: (text) => (out += text) } });
  return { code, out };
}

/** The fetch an install uses unless it is given another: `curl -fsSL -o <dest> <url>`, in an environment of its own. `{ code }`. */
export const curlFetch = ({ curl, home }) => (url, dest, { signal } = {}) =>
  runCaptured(curl, ["-fsSL", "-o", dest, url], { env: { HOME: home, PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" }, signal });

/** The context a stage is given. `programs` is null when only planning. */
const contextOf = ({ home, drop, pin, programs = null, run, fetch, signal }) => ({
  home, drop, pin, version: drop.version, programs, run, fetch, signal, journal: [], paths: pathsOf(home, pin, drop.version)
});

/** The steps a dev Mac runs for a Reel Kit of another version than the one in use (Decision 10: beside it, never over it): its KIT
    with its licence, and its own HyperFrames, in folders of their own. The shared world (the venvs, Python and uv, models, the
    transcription model, GSAP, tools/bin, ffmpeg and .setup-version) and the check stay the version in use's until this one is pinned. */
export const BESIDE = Object.freeze(["kit", "hyperframes"]);

const checkedPin = (pin) => (pin === PIN ? PIN : pinFrom(JSON.stringify(pin)));

/** What installing `drop` would do: `{ refused, steps: [{ id, words, needed }], pin, mode, beside }`. `refused` is "" or the one line
    why it won't be installed, and then there are no steps. `pin` is the pin of the version in use (PIN; a test gives its own), and
    `mode` "dev" (the Mac Studio) or "installed" (only the fingerprint Studio pins; that Mac's pin is always PIN).
    - A drop of the version in use must be the pinned one, by its fingerprint, in either mode; it is installed whole, check and all.
    - On a dev Mac a drop of another version is installed beside the one in use (`beside`: only the BESIDE steps), from `next`, the
      pin written for it from its download; with no such pin it is refused. Each other step's words say it is kept for the version in use.
    Each step's `words` end ": here already" when it is not needed. Reading only: it runs nothing and changes nothing. */
export function installPlan({ home, drop, pin = PIN, next, mode }) {
  if (mode !== "dev" && mode !== "installed") throw new Error(`installPlan: mode must be "dev" or "installed", not ${mode}`);
  const pinned = mode === "installed" ? PIN : checkedPin(pin);
  const refuse = (line) => ({ refused: line, steps: [], pin: pinned, mode, beside: false });
  if (!drop?.ok) return refuse(drop?.why || INSTALL_WHY.noDrop);
  if (mode === "installed" && drop.fingerprint !== PIN.fingerprint) return refuse(INSTALL_WHY.untested);
  const beside = drop.version !== pinned.version;
  if (!beside && drop.fingerprint !== pinned.fingerprint) return refuse(INSTALL_WHY.sameVersion(drop.version));
  let used = pinned;
  if (beside) {
    used = next ? checkedPin(next) : null;
    if (!used || used.version !== drop.version || used.fingerprint !== drop.fingerprint) return refuse(INSTALL_WHY.noPinYet);
  }
  if (drop.hyperframes !== used.hyperframes.version) return refuse(INSTALL_WHY.hyperframes);
  if (drop.gsap !== used.gsap.version) return refuse(INSTALL_WHY.gsap);
  const ctx = contextOf({ home, drop, pin: used });
  const steps = STAGES.map((stage) => {
    if (beside && !BESIDE.includes(stage.id)) return { id: stage.id, words: INSTALL_WHY.kept(stage.words(ctx)), needed: false };
    const needed = !stage.here(ctx);
    return { id: stage.id, words: needed ? stage.words(ctx) : `${stage.words(ctx)}${HERE_ALREADY}`, needed };
  });
  return { refused: "", steps, pin: used, mode, beside };
}

/** Takes away the folder a zip was unpacked into (readDrop's `scratch`), and only that: a real folder (no link) inside
    `<work folder>/.toolchain/incoming/`. Anything else is left where it is. */
export function takeAwayScratch(home, drop) {
  const scratch = drop?.scratch;
  if (typeof scratch !== "string" || scratch === "") return;
  try {
    const incoming = realpathSync(join(workFolder(home), ".toolchain", "incoming"));
    const at = resolve(scratch);
    if (!lstatSync(at).isDirectory()) return;
    if (!realpathSync(at).startsWith(`${incoming}/`)) return;
    rmSync(at, { recursive: true, force: true });
  } catch {
    // Nothing there, or no incoming folder: nothing to take away.
  }
}

/** Carries out `plan` for `drop`: `{ ok, lines, credit, leftOver }`. `lines` are her words, a line a step ("<step>: done.", "<step>:
    here already.", or, beside the version in use, "<step>: kept for the version in use until this one is pinned.") and, when it
    stops, why and what was left; `leftOver` names any set-aside `.old` a whole install couldn't take away (the next run does);
    `credit` is Reel Kit's credit line from a check that ended READY ("" else), for the caller to show once. `progress` hears
    `{ step, words, state }` (state "running", "done", "skipped", "kept" or "failed"). Each stage checks again, as it runs, whether
    what it makes is here already. The drop's scratch folder is taken away at the end either way. */
export async function runInstall({ home, drop, plan, programs, run = runCaptured, fetch, progress = () => {}, signal }) {
  const lines = [];
  try {
    if (!plan || plan.refused || !drop?.ok) return { ok: false, lines: [plan?.refused || drop?.why || INSTALL_WHY.noDrop], credit: "", leftOver: [] };
    const given = { sh: "/bin/sh", tar: "/usr/bin/tar", unzip: "/usr/bin/ditto", ...programs };
    const ctx = contextOf({ home, drop, pin: plan.pin, programs: given, run, fetch: fetch ?? curlFetch({ curl: given.curl, home }), signal });
    recoverAll(ctx, STAGES.flatMap((stage) => stage.targets(ctx)));
    let credit = "";
    for (const stage of STAGES) {
      const words = stage.words(ctx);
      const tell = (state) => progress({ step: stage.id, words, state });
      if (plan.beside && !BESIDE.includes(stage.id)) {
        tell("kept");
        lines.push(`${INSTALL_WHY.kept(words)}.`);
        continue;
      }
      try {
        if (signal?.aborted) throw Object.assign(new Error(INSTALL_WHY.stopped), { line: INSTALL_WHY.stopped });
        tell("running");
        const made = stage.here(ctx) ? "skipped" : await stage.make(ctx);
        if (made === "skipped") {
          tell("skipped");
          lines.push(`${words}${HERE_ALREADY}.`);
        } else {
          if (made?.credit) credit = made.credit;
          tell("done");
          lines.push(`${words}: done.`);
        }
      } catch (e) {
        tell("failed");
        lines.push(e?.line ?? INSTALL_WHY.failed(words));
        let whole = rollBack(ctx);
        // What the failed stage was building is taken away too: nothing of this run is left half made.
        for (const target of STAGES.flatMap((s) => s.targets(ctx))) {
          try {
            takeAway(ctx, `${target}.new`);
          } catch {
            whole = false;
          }
        }
        lines.push(whole ? INSTALL_WHY.leftAsWas : INSTALL_WHY.notPutBack);
        return { ok: false, lines, credit: "", leftOver: [] };
      }
    }
    // Whole: what was set aside goes. One that can't be taken away is named in leftOver (for Jason), and the next run takes it away.
    let leftOver = [];
    try {
      leftOver = commit(ctx);
    } catch {
      leftOver = ctx.journal.map(({ aside }) => aside).filter(Boolean);
    }
    return { ok: true, lines, credit, leftOver };
  } finally {
    takeAwayScratch(home, drop);
  }
}
