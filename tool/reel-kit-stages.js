// The stages of Reel Kit's install (spec 2026-11-23 Reel Kit in Studio, section 2; plan Task 5). reel-kit-install.js plans them and
// runs them in order; this file says, for each, what it makes, whether that is already there as the pin has it ("here already"),
// and how it is made.
//
// Every stage builds what it makes beside the thing in use, under a `.new` name, and swaps it in last (reel-kit-swap.js): the old one is set aside under
// `.old` (the journal remembers it) until the whole install has passed Reel Kit's own check, and put back if anything after it fails.
// A venv can't be moved once it is made unless uv made it relocatable, so both venvs are made with `uv venv --relocatable`. Every
// download is checked against its pinned SHA-256 (npm's HyperFrames against its pinned integrity) and taken away when it is not the
// pin's. Nothing here reaches the network by itself: the runner's `fetch` and `run` do, and only for what the pin names.
//
// What is made, all in the work folder (never in Dropbox): KIT, `.toolchain/reel-kit-<version>/`, and its licence beside it,
// `.toolchain/reel-kit-<version>.LICENSE` (so the kit's fingerprint is the drop's); Reel Kit's own HyperFrames in
// `.toolchain/hyperframes-<version>/`; and in REEL_KIT_HOME (`.reel-kit/`): `tools/uv/uv`, `tools/python/` (uv's Python, with
// Studio's stamp), `.venv/` and `.venv-mp/` (each with `reel-kit.pth` and Studio's stamp), `vendor/gsap.min.js`, `models/<name>`,
// `hf/hub/models--Systran--faster-whisper-medium/` (Hugging Face's cache layout), `tools/ffmpeg-<version>/` (only when Studio's ffmpeg
// has no libvpx-vp9), `tools/bin/` (links, and the `npx` file) and `.setup-version`, which only a check that ends READY writes.
import { chmodSync, closeSync, copyFileSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readlinkSync, renameSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { binDir, folderFingerprint, hfCli, hfDir, kitDir, npxShim, reelKitEnv, reelKitHome } from "./reel-kit.js";
import { PIN as HF_PIN } from "./hyperframes.js";
import { sha256Of } from "./setup/install.js";
import { workFolder } from "./settings.js";
import { fresh, kindOf, swapIn, takeAway } from "./reel-kit-swap.js";

/** The folder this file is in, `tool/`: the pin's lock files are named relative to it, and Studio's own GSAP is in its vendor/. */
const TOOL = fileURLToPath(new URL("./", import.meta.url));
/** The file of Studio's own GSAP, the one hyperframes.pin.json pins by integrity. */
const STUDIO_GSAP = join(TOOL, "vendor", "gsap.min.js");
/** Studio's note, in what it made, of the pin it made it from: how "here already" is known without running anything. */
const STAMP = ".studio-pin.json";

/** Why a step stopped, one line each, in her words: never a path or a command for her to type. */
export const INSTALL_WHY = Object.freeze({
  untested: "This Reel Kit hasn't been tested yet: ask Jason.",
  hyperframes: "That Reel Kit renders with a HyperFrames Studio has no pin for yet: ask Jason.",
  gsap: "That Reel Kit animates with a GSAP Studio has no pin for yet: ask Jason.",
  notPinned: (what) => `What came down for ${what} isn't what Studio expects, so it wasn't kept.`,
  notFetched: (what) => `${what} couldn't be downloaded. Check this Mac's internet connection, then try again.`,
  failed: (words) => `${words} couldn't be set up. Check this Mac's internet connection, then try again.`,
  hyperframesWrong: "What came down for Reel Kit's HyperFrames isn't the pinned one, so it wasn't kept: ask Jason.",
  kitChanged: "That Reel Kit changed while it was being copied, so it wasn't kept. Drag it into this chat again.",
  notReady: "Reel Kit's own check didn't say it's ready.",
  lockWrong: "Studio's list of Reel Kit's Python packages isn't as its pin says: ask Jason.",
  studioGsapWrong: "Studio's own GSAP isn't as its pin says: ask Jason.",
  leftAsWas: "The Reel Kit in use was left as it was.",
  notPutBack: "Not all of it could be put back as it was: ask Jason.",
  stopped: "Setting up Reel Kit was stopped.",
});

/** A stage's stop: `line` is what she reads. */
export const fault = (line) => Object.assign(new Error(line), { code: "reel-kit-install", line });
const stopped = () => fault(INSTALL_WHY.stopped);

/** Where each piece goes, for a home, a pin and the version being installed. */
export function pathsOf(home, pin, version) {
  const rkh = reelKitHome(home);
  const tools = join(rkh, "tools");
  return {
    work: workFolder(home),
    rkh,
    tools,
    kit: kitDir(home, version),
    license: join(workFolder(home), ".toolchain", `reel-kit-${version}.LICENSE`),
    uvDir: join(tools, "uv"),
    pythonDir: join(tools, "python"),
    venv: join(rkh, ".venv"),
    mp: join(rkh, ".venv-mp"),
    hf: hfDir(home),
    gsap: join(rkh, "vendor", "gsap.min.js"),
    models: join(rkh, "models"),
    whisper: join(rkh, "hf", "hub", `models--${pin.whisper.repo.replace("/", "--")}`),
    ffmpeg: join(tools, `ffmpeg-${pin.ffmpeg.version}`),
    bin: binDir(home),
    setupVersion: join(rkh, ".setup-version"),
  };
}

/** A file's SHA-256, read a block at a time, or "" when it can't be read. */
function sha256Sync(path) {
  let fd;
  try {
    fd = openSync(path, "r");
    const hash = createHash("sha256");
    const block = Buffer.alloc(1 << 20);
    for (let n; (n = readSync(fd, block, 0, block.length, null)) > 0; ) hash.update(block.subarray(0, n));
    return hash.digest("hex");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** A file's npm-style integrity, `sha512-<base64>`, or "". */
function integrityOf(path) {
  try {
    return `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`;
  } catch {
    return "";
  }
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};
/** Whether the stamp in `dir` says exactly `want`. */
const stamped = (dir, want) => kindOf(dir) === "folder" && JSON.stringify(readJson(join(dir, STAMP))) === JSON.stringify(want);
const stamp = (dir, value) => writeFileSync(join(dir, STAMP), `${JSON.stringify(value)}\n`);

/** Downloads `url` to `dest` with the runner's fetch and keeps it only when its SHA-256 is `sha256`; else takes it away and stops. */
async function fetchChecked(ctx, { url, sha256, dest, what }) {
  takeAway(ctx, dest);
  const got = await ctx.fetch(url, dest, { signal: ctx.signal });
  if (ctx.signal?.aborted) {
    takeAway(ctx, dest);
    throw stopped();
  }
  if (got?.code !== 0 || kindOf(dest) !== "file") {
    takeAway(ctx, dest);
    throw fault(INSTALL_WHY.notFetched(what));
  }
  if ((await sha256Of(dest)) !== sha256) {
    takeAway(ctx, dest);
    throw fault(INSTALL_WHY.notPinned(what));
  }
}

/** Runs a program with the runner's `run`; a stop ends the stage. */
async function run(ctx, program, args, env) {
  const got = await ctx.run(program, args, { env, signal: ctx.signal });
  if (ctx.signal?.aborted) throw stopped();
  return got;
}

/** Reel Kit's quiet environment (reel-kit.js reelKitEnv), and the same with some of its offline variables taken out. */
const quietEnv = (ctx) => reelKitEnv({ home: ctx.home, node: ctx.programs.node, base: { HOME: ctx.home } });
const withNetwork = (ctx, names) => {
  const env = quietEnv(ctx);
  for (const name of names) delete env[name];
  return env;
};
/** uv's environment: the network on for uv alone (UV_OFFLINE out), its Python only one it installed in `pythonDir`, no uv.toml. */
const uvEnv = (ctx, pythonDir, more) => ({ ...withNetwork(ctx, ["UV_OFFLINE"]), UV_PYTHON_INSTALL_DIR: pythonDir, UV_PYTHON_PREFERENCE: "only-managed", UV_NO_CONFIG: "1", ...more });
const plainEnv = (ctx) => ({ HOME: ctx.home, PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8" });

const minor = (pin) => pin.python.split(".").slice(0, 2).join(".");
const pythonWant = (pin) => ({ uv: pin.uv.version, uvSha256: pin.uv.sha256, python: pin.python });
/** The Python uv installed, by the stamp in tools/python, or "". */
const interpreterOf = (ctx) => {
  const rel = readJson(join(ctx.paths.pythonDir, STAMP))?.interpreter;
  return typeof rel === "string" && rel !== "" && !rel.startsWith("..") ? join(ctx.paths.pythonDir, rel) : "";
};

const kit = {
  id: "kit",
  words: (ctx) => `Reel Kit ${ctx.version}'s files`,
  targets: (ctx) => [ctx.paths.kit, ctx.paths.license],
  here(ctx) {
    if (kindOf(ctx.paths.kit) !== "folder" || kindOf(ctx.paths.license) !== "file" || kindOf(ctx.drop.license) !== "file") return false;
    if (!readFileSync(ctx.paths.license).equals(readFileSync(ctx.drop.license))) return false;
    try {
      return folderFingerprint(ctx.paths.kit) === ctx.drop.fingerprint;
    } catch {
      return false;
    }
  },
  async make(ctx) {
    const made = fresh(ctx, ctx.paths.kit, { folder: false });
    cpSync(ctx.drop.kit, made, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
    // A download can change between being read and being copied: what is copied must be what was read.
    let print = "";
    try {
      print = folderFingerprint(made);
    } catch {
      print = "";
    }
    if (print !== ctx.drop.fingerprint) {
      takeAway(ctx, made);
      throw fault(INSTALL_WHY.kitChanged);
    }
    if (kindOf(ctx.drop.license) !== "file") {
      takeAway(ctx, made);
      throw fault(INSTALL_WHY.kitChanged);
    }
    const license = fresh(ctx, ctx.paths.license, { folder: false });
    copyFileSync(ctx.drop.license, license);
    swapIn(ctx, made, ctx.paths.kit);
    swapIn(ctx, license, ctx.paths.license);
  },
};

const python = {
  id: "python",
  words: (ctx) => `Python ${minor(ctx.pin)} for Reel Kit`,
  targets: (ctx) => [ctx.paths.uvDir, ctx.paths.pythonDir],
  here(ctx) {
    const held = readJson(join(ctx.paths.pythonDir, STAMP)) ?? {};
    const want = pythonWant(ctx.pin);
    return kindOf(join(ctx.paths.uvDir, "uv")) === "file" && Object.keys(want).every((k) => held[k] === want[k]) && existsSync(interpreterOf(ctx));
  },
  async make(ctx) {
    const what = "Reel Kit's Python installer";
    const uvNew = fresh(ctx, ctx.paths.uvDir);
    const archive = join(uvNew, basename(ctx.pin.uv.url));
    await fetchChecked(ctx, { url: ctx.pin.uv.url, sha256: ctx.pin.uv.sha256, dest: archive, what });
    const unpacked = basename(ctx.pin.uv.url).replace(/\.tar\.gz$/, "");
    const untar = await run(ctx, ctx.programs.tar, ["-xzf", archive, "-C", uvNew], plainEnv(ctx));
    if (untar.code !== 0 || kindOf(join(uvNew, unpacked, "uv")) !== "file") throw fault(INSTALL_WHY.failed(this.words(ctx)));
    renameSync(join(uvNew, unpacked, "uv"), join(uvNew, "uv"));
    takeAway(ctx, join(uvNew, unpacked));
    takeAway(ctx, archive);
    chmodSync(join(uvNew, "uv"), 0o755);

    const pyNew = fresh(ctx, ctx.paths.pythonDir);
    const uv = join(uvNew, "uv");
    const installed = await run(ctx, uv, ["python", "install", ctx.pin.python], uvEnv(ctx, pyNew, { UV_PYTHON_INSTALL_BIN: "0" }));
    const found = installed.code === 0 ? await run(ctx, uv, ["python", "find", ctx.pin.python], uvEnv(ctx, pyNew)) : { code: 1, out: "" };
    const where = String(found.out ?? "").split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
    if (found.code !== 0 || !where.startsWith(`${pyNew}/`) || !existsSync(where)) throw fault(INSTALL_WHY.failed(this.words(ctx)));
    stamp(pyNew, { ...pythonWant(ctx.pin), interpreter: relative(pyNew, where) });
    swapIn(ctx, uvNew, ctx.paths.uvDir);
    swapIn(ctx, pyNew, ctx.paths.pythonDir);
  },
};

/** A venv of Reel Kit's: made by uv from the pinned lock, relocatable, with `reel-kit.pth` naming KIT's pipeline. */
function venvStage(id, words, key, lockKey) {
  const want = (ctx) => ({ lock: ctx.pin.locks[lockKey].sha256, python: ctx.pin.python, pipeline: join(ctx.paths.kit, "pipeline"), relocatable: true });
  return {
    id,
    words: () => words,
    targets: (ctx) => [ctx.paths[key]],
    here: (ctx) => stamped(ctx.paths[key], want(ctx)) && existsSync(join(ctx.paths[key], "bin", "python")),
    async make(ctx) {
      const lock = join(TOOL, ctx.pin.locks[lockKey].file);
      if (kindOf(lock) !== "file" || sha256Sync(lock) !== ctx.pin.locks[lockKey].sha256) throw fault(INSTALL_WHY.lockWrong);
      const base = interpreterOf(ctx);
      if (!existsSync(base)) throw fault(INSTALL_WHY.failed(words));
      const made = fresh(ctx, ctx.paths[key], { folder: false });
      const uv = join(ctx.paths.uvDir, "uv");
      const env = uvEnv(ctx, ctx.paths.pythonDir, { UV_PYTHON_DOWNLOADS: "never" });
      const venv = await run(ctx, uv, ["venv", "--relocatable", "--python", base, made], env);
      const pip = venv.code === 0 ? await run(ctx, uv, ["pip", "install", "--python", join(made, "bin", "python"), "--require-hashes", "--no-deps", "-r", lock], env) : venv;
      const site = join(made, "lib", `python${minor(ctx.pin)}`, "site-packages");
      if (pip.code !== 0 || kindOf(site) !== "folder") {
        takeAway(ctx, made);
        throw fault(INSTALL_WHY.failed(words));
      }
      // What models.py's pth writes, pointing at this version's KIT: an effect's gen.py can `import fxlib` from any folder.
      writeFileSync(join(site, "reel-kit.pth"), `${join(ctx.paths.kit, "pipeline")}\n`);
      stamp(made, want(ctx));
      swapIn(ctx, made, ctx.paths[key]);
    },
  };
}

/** What npm left in a HyperFrames folder, as install.sh's toolchain_holds reads it: is it the pin's version, integrity and program? */
function hyperframesHeld(dir, pin) {
  const version = readJson(join(dir, "node_modules", "hyperframes", "package.json"))?.version;
  const integrity = readJson(join(dir, "package-lock.json"))?.packages?.["node_modules/hyperframes"]?.integrity;
  return version === pin.hyperframes.version && integrity === pin.hyperframes.integrity && kindOf(join(dir, "node_modules", "hyperframes", "bin", "hyperframes.mjs")) === "file";
}

const hyperframes = {
  id: "hyperframes",
  words: (ctx) => `HyperFrames ${ctx.pin.hyperframes.version} for Reel Kit`,
  targets: (ctx) => [ctx.paths.hf],
  here: (ctx) => hyperframesHeld(ctx.paths.hf, ctx.pin),
  async make(ctx) {
    const made = fresh(ctx, ctx.paths.hf);
    const env = { HOME: ctx.home, PATH: `${dirname(ctx.programs.node)}:/usr/bin:/bin`, LANG: "en_US.UTF-8", HYPERFRAMES_NO_TELEMETRY: "1", NPM_CONFIG_UPDATE_NOTIFIER: "false" };
    const args = ["install", "--prefix", made, "--ignore-scripts", "--no-fund", "--no-audit", "--save-exact", `hyperframes@${ctx.pin.hyperframes.version}`];
    const got = await run(ctx, ctx.programs.npm, args, env);
    if (got.code !== 0) {
      takeAway(ctx, made);
      throw fault(INSTALL_WHY.failed(this.words(ctx)));
    }
    if (!hyperframesHeld(made, ctx.pin)) {
      takeAway(ctx, made);
      throw fault(INSTALL_WHY.hyperframesWrong);
    }
    swapIn(ctx, made, ctx.paths.hf);
  },
};

const chrome = {
  id: "chrome",
  words: () => "The Chrome Reel Kit renders with",
  targets: () => [],
  // HyperFrames finds its own Chrome and fetches one only when it has none (as Studio's stageChrome); Studio holds no pin for it.
  here: () => false,
  async make(ctx) {
    const env = withNetwork(ctx, ["HF_HUB_OFFLINE", "PIP_NO_INDEX", "UV_OFFLINE"]);
    const got = await run(ctx, ctx.programs.node, [hfCli(ctx.home), "browser", "ensure"], env);
    if (got.code !== 0) throw fault(INSTALL_WHY.failed(this.words()));
  },
};

/** Whether the GSAP comes from Studio's own copy (the same version) or from the pin's address. */
const gsapFromStudio = (pin) => pin.gsap.version === HF_PIN.gsap.version;
/** Whether a GSAP file is the one wanted: by Studio's integrity or the pin's SHA-256, and saying `GSAP <version>` in its first 400 bytes (setup.py's check). */
function gsapGood(path, pin) {
  if (kindOf(path) !== "file") return false;
  const pinned = gsapFromStudio(pin) ? integrityOf(path) === HF_PIN.gsap.integrity : sha256Sync(path) === pin.gsap.sha256;
  return pinned && readFileSync(path).subarray(0, 400).toString("latin1").includes(`GSAP ${pin.gsap.version}`);
}

const gsap = {
  id: "gsap",
  words: (ctx) => `GSAP ${ctx.pin.gsap.version} for Reel Kit`,
  targets: (ctx) => [ctx.paths.gsap],
  here: (ctx) => gsapGood(ctx.paths.gsap, ctx.pin),
  async make(ctx) {
    const made = fresh(ctx, ctx.paths.gsap, { folder: false });
    if (gsapFromStudio(ctx.pin)) {
      if (integrityOf(STUDIO_GSAP) !== HF_PIN.gsap.integrity) throw fault(INSTALL_WHY.studioGsapWrong);
      copyFileSync(STUDIO_GSAP, made);
    } else {
      await fetchChecked(ctx, { url: ctx.pin.gsap.url, sha256: ctx.pin.gsap.sha256, dest: made, what: this.words(ctx) });
    }
    if (!gsapGood(made, ctx.pin)) {
      takeAway(ctx, made);
      throw fault(INSTALL_WHY.notPinned(this.words(ctx)));
    }
    swapIn(ctx, made, ctx.paths.gsap);
  },
};

const modelHere = (ctx, m) => {
  const path = join(ctx.paths.models, m.name);
  return kindOf(path) === "file" && m.sources.some((s) => s.sha256 === sha256Sync(path));
};

const models = {
  id: "models",
  words: () => "Reel Kit's tracking and depth models",
  targets: (ctx) => ctx.pin.models.map((m) => join(ctx.paths.models, m.name)),
  here: (ctx) => ctx.pin.models.every((m) => modelHere(ctx, m)),
  async make(ctx) {
    const what = this.words();
    for (const m of ctx.pin.models) {
      if (modelHere(ctx, m)) continue;
      const target = join(ctx.paths.models, m.name);
      const made = fresh(ctx, target, { folder: false });
      // Each source in its order, as models.py tries them: the first that downloads and matches its SHA-256 is kept.
      let kept = false;
      let wrong = false;
      for (const source of m.sources) {
        try {
          await fetchChecked(ctx, { url: source.url, sha256: source.sha256, dest: made, what });
          kept = true;
          break;
        } catch (e) {
          if (e.line === INSTALL_WHY.stopped) throw e;
          wrong ||= e.line === INSTALL_WHY.notPinned(what);
        }
      }
      if (!kept) throw fault(wrong ? INSTALL_WHY.notPinned(what) : INSTALL_WHY.notFetched(what));
      swapIn(ctx, made, target);
    }
  },
};

/** The relative link Hugging Face's cache puts in a snapshot for a file: from its folder in snapshots/<revision>/ to blobs/<sha256>. */
const blobLink = (path, sha256) => relative(dirname(join("snapshots", "r", path)), join("blobs", sha256));

const whisper = {
  id: "whisper",
  words: () => "Reel Kit's transcription model",
  targets: (ctx) => [ctx.paths.whisper],
  here(ctx) {
    const { revision, files } = ctx.pin.whisper;
    const repo = ctx.paths.whisper;
    if (kindOf(join(repo, "refs", "main")) !== "file" || readFileSync(join(repo, "refs", "main"), "utf8") !== revision) return false;
    return files.every((f) => {
      const link = join(repo, "snapshots", revision, f.path);
      return kindOf(link) === "link" && readlinkSync(link) === blobLink(f.path, f.sha256) && kindOf(join(repo, "blobs", f.sha256)) === "file";
    });
  },
  async make(ctx) {
    const { repo, revision, files } = ctx.pin.whisper;
    const made = fresh(ctx, ctx.paths.whisper);
    mkdirSync(join(made, "blobs"));
    mkdirSync(join(made, "refs"));
    for (const f of files) {
      const blob = join(made, "blobs", f.sha256);
      if (kindOf(blob) !== "file") {
        // A blob the model in use already holds, with its SHA-256, is copied rather than downloaded again.
        const held = join(ctx.paths.whisper, "blobs", f.sha256);
        if (kindOf(held) === "file" && (await sha256Of(held)) === f.sha256) copyFileSync(held, blob);
        else {
          await fetchChecked(ctx, { url: `https://huggingface.co/${repo}/resolve/${revision}/${f.path}`, sha256: f.sha256, dest: `${blob}.part`, what: this.words() });
          renameSync(`${blob}.part`, blob);
        }
      }
      const link = join(made, "snapshots", revision, f.path);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(blobLink(f.path, f.sha256), link);
    }
    writeFileSync(join(made, "refs", "main"), revision);
    swapIn(ctx, made, ctx.paths.whisper);
  },
};

/** The names tools/bin holds: links to programs, and the npx file. */
const LINKS = ["node", "ffmpeg", "ffprobe", "python3"];
const ffmpegWant = (pin) => ({ ffmpeg: pin.ffmpeg.ffmpeg.sha256, ffprobe: pin.ffmpeg.ffprobe.sha256 });
const npxText = (ctx, node) => npxShim({ node, cli: hfCli(ctx.home), version: ctx.pin.hyperframes.version });
/** Whether tools/bin holds exactly `want` (name -> link target) and the npx for `node`. */
function binHolds(ctx, want, node) {
  const npx = join(ctx.paths.bin, "npx");
  if (kindOf(npx) !== "file" || (statSync(npx).mode & 0o777) !== 0o755 || readFileSync(npx, "utf8") !== npxText(ctx, node)) return false;
  return LINKS.every((name) => {
    const link = join(ctx.paths.bin, name);
    return kindOf(link) === "link" && readlinkSync(link) === want[name] && existsSync(link);
  });
}

/** Reel Kit's own ffmpeg and ffprobe 9.0.2, each from its pinned zip, in tools/ffmpeg-<version>/. */
async function ownFfmpeg(ctx, words) {
  const dir = ctx.paths.ffmpeg;
  const want = ffmpegWant(ctx.pin);
  if (stamped(dir, want) && ["ffmpeg", "ffprobe"].every((name) => kindOf(join(dir, name)) === "file")) return dir;
  const made = fresh(ctx, dir);
  for (const name of ["ffmpeg", "ffprobe"]) {
    const zip = join(made, `${name}.zip`);
    await fetchChecked(ctx, { url: ctx.pin.ffmpeg[name].url, sha256: ctx.pin.ffmpeg[name].sha256, dest: zip, what: "Reel Kit's ffmpeg" });
    const got = await run(ctx, ctx.programs.unzip, ["-x", "-k", zip, made], plainEnv(ctx));
    if (got.code !== 0 || kindOf(join(made, name)) !== "file") {
      takeAway(ctx, made);
      throw fault(INSTALL_WHY.failed(words));
    }
    chmodSync(join(made, name), 0o755);
    takeAway(ctx, zip);
  }
  stamp(made, want);
  swapIn(ctx, made, dir);
  return dir;
}

const bin = {
  id: "bin",
  words: () => "The programs Reel Kit runs",
  targets: (ctx) => [ctx.paths.bin, ctx.paths.ffmpeg],
  // Planning knows no programs: tools/bin is here already when each link leads to a file and its npx serves the pin. A run asks
  // Studio's ffmpeg about its encoders and compares every link exactly (make says "skipped" when they are all as they should be).
  here(ctx) {
    if (ctx.programs) return false;
    const leadsTo = (name) => {
      try {
        return readlinkSync(join(ctx.paths.bin, name));
      } catch {
        return "";
      }
    };
    const want = Object.fromEntries(LINKS.map((name) => [name, leadsTo(name)]));
    return want.python3 === interpreterOf(ctx) && binHolds(ctx, want, want.node);
  },
  async make(ctx) {
    const { programs } = ctx;
    const encoders = await run(ctx, programs.ffmpeg, ["-hide_banner", "-encoders"], plainEnv(ctx));
    const vp9 = encoders.code === 0 && /\blibvpx-vp9\b/.test(String(encoders.out ?? ""));
    const own = vp9 ? "" : await ownFfmpeg(ctx, this.words());
    const want = {
      node: programs.node,
      ffmpeg: vp9 ? programs.ffmpeg : join(own, "ffmpeg"),
      ffprobe: vp9 ? programs.ffprobe : join(own, "ffprobe"),
      python3: interpreterOf(ctx),
    };
    if (!existsSync(want.python3)) throw fault(INSTALL_WHY.failed(this.words()));
    if (binHolds(ctx, want, programs.node)) return "skipped";
    const made = fresh(ctx, ctx.paths.bin);
    for (const name of LINKS) symlinkSync(want[name], join(made, name));
    writeFileSync(join(made, "npx"), npxText(ctx, programs.node), { mode: 0o755 });
    chmodSync(join(made, "npx"), 0o755);
    swapIn(ctx, made, ctx.paths.bin);
    return "done";
  },
};

/** The line of Reel Kit's check that credits its maker, passed on once. */
const CREDIT = /^Reel Kit is part of/;

const check = {
  id: "check",
  words: () => "Reel Kit's own check",
  targets: (ctx) => [ctx.paths.setupVersion],
  here: () => false,
  // Only ever with --check: without it setup.sh and setup.py pip install unpinned packages and fetch what they like.
  async make(ctx) {
    const got = await run(ctx, ctx.programs.sh, [join(ctx.paths.kit, "setup", "setup.sh"), "--check"], quietEnv(ctx));
    const lines = String(got.out ?? "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    if (got.code !== 0 || lines.at(-1) !== "READY") throw fault(INSTALL_WHY.notReady);
    const made = fresh(ctx, ctx.paths.setupVersion, { folder: false });
    writeFileSync(made, `${ctx.version}\n`);
    swapIn(ctx, made, ctx.paths.setupVersion);
    return { credit: lines.find((l) => CREDIT.test(l)) ?? "" };
  },
};

/** The stages, in the order they run. */
export const STAGES = Object.freeze([
  kit,
  python,
  venvStage("venv", "Reel Kit's Python packages", "venv", "main"),
  venvStage("mp", "Reel Kit's tracking packages", "mp", "mp"),
  hyperframes,
  chrome,
  gsap,
  models,
  whisper,
  bin,
  check,
]);
