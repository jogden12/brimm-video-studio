// The headless render of a Reel Kit edit (reel-kit-render.js; spec 2026-11-23 Reel Kit in Studio; plan Task 14, Decisions 6 and 7).
// Every test builds a temp home (with a space in its name, as BRIMM Video Work has) holding a made-up kit, Reel Kit's Python and a project
// whose edit she approved and the worker finalized (studio.json `ready`, with its fingerprint). Nothing real is run: Reel Kit's Python is
// the stand-in tests/stand-ins/reel-kit.mjs (its render.py and qa.py), `sandbox-exec` is tests/stand-ins/sandbox-exec.mjs (it writes down
// what it was given, then runs the rest), and the Trash is a folder of the test's own.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { metaNameOf, metaOf } from "../exports.js";
import { hfDir, kitDir, reelKitHome, venvPython } from "../reel-kit.js";
import { markReady } from "./reel-kit-ready.js";
import { compositionFingerprint, projectDirOf, readState, writeState } from "../reel-kit-project.js";
import { MACH_SERVICES, RENDER_SAY, copyProject, renderProfile, renderReelKit, renderWhy, sweepCopies, writeMeta } from "../reel-kit-render.js";
import { asideDir, macLock, noteOwnFile } from "../reel-kit-worker.js";
import { workerSandbox } from "../reel-kit-worker-tools.js";
import { factsOf, workFolder } from "../settings.js";

const CHECKOUT = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const REEL_KIT = fileURLToPath(new URL("./stand-ins/reel-kit.mjs", import.meta.url));
const SANDBOX = fileURLToPath(new URL("./stand-ins/sandbox-exec.mjs", import.meta.url));
const q = (p) => `'${String(p).replace(/'/g, "'\\''")}'`;
const SLUG = "abc123-reel-2-v1";
const NAME = "Pricing, Reel 2 Reel Kit v1";
const TITLE = "Pricing, plainly";

const homes = [];
after(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true });
});

/** A Mac with Reel Kit in place and one finalized edit. `scenario` is baked into the Python that runs the stand-in. */
function world({ scenario = "" } = {}) {
  const home = mkdtempSync(join(tmpdir(), "rk render-"));
  homes.push(home);
  const kit = kitDir(home);
  mkdirSync(join(kit, "pipeline"), { recursive: true });
  for (const name of ["render", "qa", "build", "common"]) writeFileSync(join(kit, "pipeline", `${name}.py`), "# made up\n");
  const log = join(home, "reel-kit.log");
  mkdirSync(join(venvPython(home), ".."), { recursive: true });
  writeFileSync(venvPython(home), `#!/bin/sh\nREEL_KIT_STANDIN_LOG=${q(log)} REEL_KIT_STANDIN=${q(scenario)} exec ${q(process.execPath)} ${q(REEL_KIT)} "$@"\n`);
  chmodSync(venvPython(home), 0o755);
  markReady(home);
  const sandboxLog = join(home, "sandbox-exec.log");
  const sandboxExec = join(home, "sandbox-exec");
  writeFileSync(sandboxExec, `#!/bin/sh\nSANDBOX_EXEC_LOG=${q(sandboxLog)} exec ${q(process.execPath)} ${q(SANDBOX)} "$@"\n`);
  chmodSync(sandboxExec, 0o755);

  const work = join(workFolder(home), "Pricing");
  const dir = join(work, NAME);
  for (const folder of ["public/media", "cards/c1", "fx/f1", "work", "source", "storyboard", "renders"]) mkdirSync(join(dir, folder), { recursive: true });
  const src = join(dir, "source", "clip.mp4");
  writeFileSync(src, "THE 4K COPY");
  writeFileSync(join(dir, "edit.py"), `TITLE = "${TITLE}"\nSTYLE = "hifi"\nSRC = "${src}"\n`);
  writeFileSync(join(dir, "public", "index.html"), "<html>the composition</html>\n");
  writeFileSync(join(dir, "cards", "c1", "index.html"), "<html>a card</html>\n");
  writeFileSync(join(dir, "fx", "f1", "fx.js"), "// an effect\n");
  writeState(dir, { slug: SLUG, key: "reel 2", mode: "hifi", version: 1, title: TITLE, name: NAME, state: "ready", job: "finalize", step: "ready", approved: { at: "2026-11-23T10:00:00Z" }, fingerprint: compositionFingerprint(dir) });
  const trash = join(home, "Trash");
  mkdirSync(trash);
  const trashed = [];
  const toTrash = (path) => {
    trashed.push(path);
    renameSync(path, join(trash, basename(path)));
    return true;
  };
  const outside = join(home, "Outside");
  mkdirSync(outside);
  const entry = { key: "reel 2", name: NAME, maker: "reel-kit", mode: "hifi", version: 1, state: "made" };
  const ctx = { home, checkout: CHECKOUT, node: process.execPath, base: { HOME: home, LANG: "en_US.UTF-8" }, settings: { root: join(home, "Dropbox", "BRIMM Video"), machine: "Mac Studio" }, now: () => Date.UTC(2026, 10, 23, 15, 4, 5) };
  // lsof finds what `held(n)` says holds the project open at its n-th look (none by default); ps is the real one.
  let held = () => [];
  let looks = 0;
  const run = (program, args, options) => {
    if (program !== "/usr/sbin/lsof") return spawnSync(program, args, options);
    const pids = held(looks++, args);
    return { status: pids.length ? 0 : 1, stdout: pids.map((pid) => `${pid}\n`).join(""), stderr: "" };
  };
  const deps = { sandboxExec, trash: toTrash, run, every: 10, wait: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))), log: () => {} };
  const runs = (path) => (existsSync(path) ? readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  const hold = (fn) => {
    held = fn;
    looks = 0;
  };
  return { home, kit, dir, work, src, trash, trashed, outside, entry, ctx, deps, hold, reelKitRuns: () => runs(log), sandboxRuns: () => runs(sandboxLog) };
}

/** The copy of the project a render runs in: in the render's own temp folder. */
const cloneOf = (w) => join(reelKitHome(w.home), "tmp", `${SLUG}.render`, "project");
const metas = (w) => (existsSync(join(w.dir, "public", "renders")) ? readdirSync(join(w.dir, "public", "renders")).filter((n) => n.endsWith(".meta.json")) : []);

describe("the headless render", () => {
  it("renders only an approved edit whose fingerprint still matches", async () => {
    const w = world();
    assert.equal(renderWhy(w.dir, readState(w.dir)), "");
    // An edit that is not built to render yet: nothing runs.
    for (const state of ["storyboard", "working", "queued", "failed"]) {
      writeState(w.dir, { ...readState(w.dir), state });
      assert.notEqual(renderWhy(w.dir, readState(w.dir)), "", state);
      const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
      assert.equal(r.ok, false, state);
      assert.equal(r.why, renderWhy(w.dir, readState(w.dir)));
    }
    writeState(w.dir, { ...readState(w.dir), state: "ready" });
    // Changed in HyperFrames after the worker finalized it: refused, in her words, with nothing run.
    writeFileSync(join(w.dir, "public", "index.html"), "<html>changed in the app</html>\n");
    const changed = `${NAME} was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac.`;
    assert.equal(renderWhy(w.dir, readState(w.dir)), changed);
    assert.deepEqual(await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps), { ok: false, file: null, why: changed });
    // A ready edit with no fingerprint recorded is refused too, and so is one with a link inside its composition (fail closed).
    writeFileSync(join(w.dir, "public", "index.html"), "<html>the composition</html>\n");
    assert.equal(renderWhy(w.dir, readState(w.dir)), "");
    writeState(w.dir, { ...readState(w.dir), fingerprint: undefined });
    assert.notEqual(renderWhy(w.dir, readState(w.dir)), "");
    writeState(w.dir, { ...readState(w.dir), fingerprint: compositionFingerprint(w.dir) });
    symlinkSync(w.outside, join(w.dir, "public", "media", "elsewhere"));
    assert.notEqual(renderWhy(w.dir, readState(w.dir)), "");
    assert.equal((await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps)).ok, false);
    assert.deepEqual(w.reelKitRuns(), [], "Reel Kit's render never ran for a refused edit");
    // Her chat's mark for this very run comes off when it renders nothing.
    writeState(w.dir, { ...readState(w.dir), rendering: { pid: process.pid, at: "2026-11-23T10:00:00.000Z" } });
    await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(readState(w.dir).rendering, undefined);
    assert.deepEqual(w.sandboxRuns(), []);
    rmSync(join(w.dir, "public", "media", "elsewhere"));
    // No studio.json, and no edit.py: refused.
    assert.notEqual(renderWhy(w.dir, null), "");
    // The approved, unchanged edit renders.
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    assert.equal(readState(w.dir).state, "rendered");
  });

  it("runs render.py with --no-deliver, never without", async () => {
    const w = world();
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    const render = w.reelKitRuns().filter((run) => run.script === "render.py");
    assert.equal(render.length, 1);
    assert.deepEqual(render[0].args, [cloneOf(w), `${SLUG}-v1`, "--no-deliver"], "it renders the project's copy, never the project");
    assert.equal(render[0].folder, "pipeline");
    assert.equal(render[0].env.REEL_KIT_HOME, reelKitHome(w.home));
    assert.equal(render[0].env.HF_HUB_OFFLINE, "1");
    // It is run through sandbox-exec, with the profile Studio wrote outside the project.
    const [box] = w.sandboxRuns();
    assert.equal(box.args[0], "-f");
    const profile = box.args[1];
    assert.ok(!profile.startsWith(`${w.dir}/`), "the profile is out of the project's reach");
    assert.match(box.profile, /^\(version 1\)/);
    assert.match(box.profile, /\(deny default\)/);
    assert.deepEqual(box.args.slice(2), [venvPython(w.home), join(w.kit, "pipeline", "render.py"), cloneOf(w), `${SLUG}-v1`, "--no-deliver"]);
    assert.equal(r.file, join(w.dir, "renders", `${SLUG}-v1.mp4`));
    // A second render (after a revise and a new go) never writes over the first.
    writeState(w.dir, { ...readState(w.dir), state: "ready", fingerprint: compositionFingerprint(w.dir) });
    const again = await renderReelKit({ ...w.ctx, now: () => Date.UTC(2026, 10, 23, 16, 30, 0) }, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(again.file, join(w.dir, "renders", `${SLUG}-v2.mp4`));
    assert.equal(readdirSync(join(w.dir, "public", "renders")).length, 2, "a record of its own for each");
    assert.ok(w.reelKitRuns().filter((run) => run.script === "render.py").every((run) => run.args.includes("--no-deliver")));
  });

  it("leaves no copy beside the source clip", async () => {
    // A render whose deliver left its copies in its copy's source/ (fix round 3: the project's own source/ is never swept), a link there
    // with such a name, and her own files.
    const w = world({ scenario: "deliver deliver-link" });
    const source = join(w.dir, "source");
    writeFileSync(join(w.outside, "hers.mp4"), "HERS");
    writeFileSync(join(source, "notes.mp4"), "NOT A COPY");
    const lines = [];
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, { ...w.deps, log: (line) => lines.push(line) });
    assert.equal(r.ok, true, r.why);
    assert.deepEqual(readdirSync(w.trash).sort(), [`${TITLE} v1 (phone).mp4`, `${TITLE} v1.mp4`]);
    assert.ok(lines.some((line) => line.includes(`${TITLE} v2.mp4`)), "the link was refused and left, never followed");
    assert.deepEqual(readdirSync(source).sort(), ["clip.mp4", "notes.mp4"]);
    assert.equal(readFileSync(join(w.outside, "hers.mp4"), "utf8"), "HERS");
    assert.equal(readFileSync(w.src, "utf8"), "THE 4K COPY");
    // sweepCopies alone: only the two names, only plain files, only to the Trash.
    writeFileSync(join(source, `${TITLE} v1.mp4`), "A COPY");
    writeFileSync(join(source, `${TITLE} v1 (phone).mp4`), "A PHONE COPY");
    symlinkSync(join(w.outside, "hers.mp4"), join(source, `${TITLE} v2.mp4`));
    assert.deepEqual(sweepCopies(source, TITLE, { trash: () => true, except: [`${TITLE} v1.mp4`, `${TITLE} v1 (phone).mp4`, `${TITLE} v2.mp4`] }), { trashed: [], left: [], refused: false }, "a name it is told to leave is left");
    rmSync(join(source, `${TITLE} v1.mp4`));
    rmSync(join(source, `${TITLE} v1 (phone).mp4`));
    writeFileSync(join(source, `${TITLE} v3.mp4`), "A COPY");
    mkdirSync(join(source, `${TITLE} v4.mp4`));
    const swept = sweepCopies(source, TITLE, { trash: w.deps.trash });
    assert.deepEqual(swept.trashed, [`${TITLE} v3.mp4`]);
    assert.deepEqual(swept.left.sort(), [`${TITLE} v2.mp4`, `${TITLE} v4.mp4`]);
    // A source folder that is a link is never looked in.
    const linked = join(w.home, "linked source");
    symlinkSync(source, linked);
    assert.deepEqual(sweepCopies(linked, TITLE, { trash: w.deps.trash }), { trashed: [], left: [], refused: true });
    // Reel Kit's own title rule: the characters a file name can't hold are left out.
    writeFileSync(join(source, "Why: costs v1.mp4"), "X");
    writeFileSync(join(source, "Why costs v1.mp4"), "A COPY");
    assert.deepEqual(sweepCopies(source, "Why costs?", { trash: w.deps.trash }).trashed, ["Why costs v1.mp4"]);
  });

  it("writes the meta record exports.js reads, pointing at the render", async () => {
    const w = world();
    const before = readState(w.dir).fingerprint;
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    const [meta, ...more] = metas(w);
    assert.deepEqual(more, []);
    const at = new Date(w.ctx.now());
    const pad = (n) => String(n).padStart(2, "0");
    assert.deepEqual(metaNameOf(meta), { project: NAME, date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, time: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}` });
    const told = metaOf(readFileSync(join(w.dir, "public", "renders", meta), "utf8"));
    assert.deepEqual(told, { complete: true, exportedTo: join(w.dir, "renders", `${SLUG}-v1.mp4`), format: "mp4", resolution: "1080x1920" });
    assert.ok(existsSync(told.exportedTo));
    // The render ran in a copy, so the project is as finalize left it: its fingerprint the one recorded then.
    const state = readState(w.dir);
    assert.equal(state.state, "rendered");
    assert.equal(state.fingerprint, before);
    assert.equal(compositionFingerprint(w.dir), before);
    assert.equal(state.rendering, undefined);
    // Each render is listed with the fingerprint it ran on, which exports.js holds the edit to before it takes the render (Task 15, fix round 1).
    assert.deepEqual(state.renders.map((r) => [r.name, r.file, r.fingerprint]), [[`${SLUG}-v1`, `renders/${SLUG}-v1.mp4`, before]]);
    // writeMeta alone, and a renders folder that is a link is never written through.
    const other = join(w.home, "other project");
    mkdirSync(join(other, "public"), { recursive: true });
    symlinkSync(w.outside, join(other, "public", "renders"));
    assert.throws(() => writeMeta(other, { name: NAME, file: join(other, "renders", "x.mp4"), at }));
    assert.deepEqual(readdirSync(w.outside), []);
  });

  it("keeps nothing as an export when QA fails, and says so", async () => {
    const w = world({ scenario: "qa-fail" });
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.qaFailed });
    assert.doesNotMatch(r.why, /\/|--|\.py\b|\.json\b/);
    assert.deepEqual(metas(w), []);
    assert.deepEqual(readdirSync(join(w.dir, "source")), ["clip.mp4"]);
    const state = readState(w.dir);
    assert.equal(state.state, "ready", "it can be rendered again");
    assert.equal(state.lastRender?.qa, "failed");
    assert.equal(state.rendering, undefined);
    // The render ran in a copy, so the project is unchanged: a render again is not refused as changed in HyperFrames.
    assert.equal(renderWhy(w.dir, state), "");
    // A render that fails for another reason says so in its own line.
    const broken = world({ scenario: "fail" });
    const b = await renderReelKit(broken.ctx, { dir: broken.dir, entry: broken.entry }, broken.deps);
    assert.deepEqual(b, { ok: false, file: null, why: RENDER_SAY.failed });
    assert.deepEqual(metas(broken), []);
  });

  it("leaves out snapshots, renders, .hyperframes and the notes from the fingerprint", () => {
    const w = world();
    const start = compositionFingerprint(w.dir);
    assert.match(start, /^sha256-[0-9a-f]{64}$/);
    for (const [path, text] of [
      ["public/snapshots/a.png", "PNG"], ["public/renders/x.meta.json", "{}"], ["public/.hyperframes/transcripts/t.json", "{}"], ["public/CLAUDE.md", "notes"],
      ["public/AGENTS.md", "notes"], ["public/.DS_Store", "x"], ["cards/c1/._index.html", "x"], ["work/worker-status.json", "{}"], ["renders/r.mp4", "x"],
      ["source/other.mp4", "x"], ["storyboard/notes.json", "[]"], ["studio.json.note", "x"]
    ]) {
      mkdirSync(join(w.dir, path, ".."), { recursive: true });
      writeFileSync(join(w.dir, path), text);
      assert.equal(compositionFingerprint(w.dir), start, path);
    }
    for (const [path, text] of [["edit.py", "TITLE = \"Other\"\n"], ["fx/f1/fx.js", "// other\n"], ["cards/c1/index.html", "<html>other</html>"], ["public/index.html", "<html>other</html>"], ["public/media/new.mp4", "NEW"]]) {
      const was = compositionFingerprint(w.dir);
      mkdirSync(join(w.dir, path, ".."), { recursive: true });
      writeFileSync(join(w.dir, path), text);
      assert.notEqual(compositionFingerprint(w.dir), was, path);
    }
    // A link anywhere inside refuses it (fail closed), a link in a folder it leaves out does not.
    symlinkSync(w.outside, join(w.dir, "public", "snapshots", "elsewhere"));
    compositionFingerprint(w.dir);
    symlinkSync(w.outside, join(w.dir, "cards", "elsewhere"));
    assert.throws(() => compositionFingerprint(w.dir), (e) => e.code === "REEL_KIT_LINK_INSIDE");
    rmSync(join(w.dir, "cards", "elsewhere"));
    rmSync(join(w.dir, "edit.py"));
    symlinkSync(join(w.outside), join(w.dir, "edit.py"));
    assert.throws(() => compositionFingerprint(w.dir), (e) => e.code === "REEL_KIT_LINK_INSIDE");
  });
});

describe("where the render runs", () => {
  /** A Mac with a fixed home, as the profile reads it: nothing of this one's. */
  const FIXED = "/Users/sallie";
  const fixed = () => {
    const facts = factsOf(FIXED, { root: `${FIXED}/Dropbox/BRIMM Video`, machine: "Mac Studio" }, { tmp: "/private/tmp", uid: 501, env: {} });
    const project = `${FIXED}/BRIMM Video Work/Pricing/${NAME}`;
    const tmp = `${FIXED}/BRIMM Video Work/.reel-kit/tmp/${SLUG}.render`;
    const given = { checkout: "/Users/sallie/Studio", project, kit: kitDir(FIXED), rkHome: reelKitHome(FIXED), facts, tmp, programs: ["/opt/homebrew/Cellar/node/22.3.0/bin/node"] };
    return { facts, project, tmp, given, text: renderProfile(given) };
  };

  it("writes only the project and its own temp folder, reads an allowlist, and reaches no network", () => {
    const { project, tmp, text, given } = fixed();
    const sb = (p) => JSON.stringify(p);
    assert.match(text, /^\(version 1\)\n\(deny default\)\n/);
    assert.match(text, /\(deny network\*\)/);
    assert.doesNotMatch(text, /\(allow network/);
    assert.match(text, new RegExp(`\\(allow file-write\\*[^)]*\\(subpath ${sb(project).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
    assert.ok(text.includes(`(subpath ${sb(tmp)})`));
    // Studio's own names in the project are never written, and they come after the writes they hold back.
    const lastWrite = text.lastIndexOf("(allow file-write*");
    for (const own of ["studio.json", "CLAUDE.md", ".claude", "AGENTS.md"]) {
      const at = text.indexOf(`(subpath ${sb(`${project}/${own}`)})`, lastWrite);
      assert.ok(at > lastWrite, own);
    }
    // The home is denied whole, then only the allowlist read back in: the project, the temp folder, the kit, Reel Kit's HyperFrames, its
    // Chrome, and REEL_KIT_HOME's own folders; never its trials/ or another project.
    const denied = text.indexOf(`(deny file-read* (subpath ${sb(FIXED)})`);
    assert.ok(denied > 0, "the home is denied");
    for (const place of [project, tmp, kitDir(FIXED), hfDir(FIXED), `${FIXED}/.cache/hyperframes/chrome`, ...[".venv", ".venv-mp", "tools", "models", "vendor", "style", "fx", "cards", "hf"].map((n) => `${reelKitHome(FIXED)}/${n}`)]) {
      const at = text.indexOf(`(subpath ${sb(place)})`, denied);
      assert.ok(at > denied, place);
    }
    assert.ok(!text.includes(`${reelKitHome(FIXED)}/trials`));
    // BRIMM Video Work itself (a gated place) and the checkout are denied, before the project is read back in.
    const denials = text.slice(denied, text.indexOf("\n", denied));
    for (const place of [`${FIXED}/BRIMM Video Work`, "/Users/sallie/Studio"]) assert.ok(denials.includes(`(subpath ${sb(place)})`), place);
    // The system is read: its programs and libraries; Studio's node from where it is installed.
    for (const place of ["/System", "/usr", "/bin", "/Library", "/opt/homebrew/Cellar/node/22.3.0"]) assert.ok(text.includes(`(subpath ${sb(place)})`), place);
    // Every place it reads in the home is one the worker's sandbox reads too (one rule, two layers).
    const box = workerSandbox(given);
    const homeReads = [...text.slice(denied).matchAll(/\(allow file-read\* ((?:\(subpath "[^"]*"\) ?)+)\)/g)].flatMap((m) => [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1])).filter((p) => p.startsWith(`${FIXED}/`));
    assert.ok(homeReads.length >= 14);
    for (const place of homeReads) assert.ok(box.filesystem.allowRead.includes(place) || box.filesystem.allowWrite.includes(place), place);
  });

  it("names no network daemon among the services it may reach", async () => {
    const { text } = fixed();
    for (const service of ["com.apple.nsurlsessiond", "com.apple.dnssd.service", "com.apple.trustd", "com.apple.nsurlstorage-cache", "com.apple.networkd"]) assert.ok(!text.includes(service), service);
  });

  it("quotes every path as a string the profile reads", () => {
    const { given } = fixed();
    const text = renderProfile({ ...given, project: `${FIXED}/BRIMM Video Work/Pricing/A "quoted" \\ name` });
    assert.ok(text.includes(`(subpath "${FIXED}/BRIMM Video Work/Pricing/A \\"quoted\\" \\\\ name")`));
    assert.throws(() => renderProfile({ ...given, project: `${FIXED}/BRIMM Video Work/Pricing/A\nname` }));
  });

  it("never renders while a worker holds the Mac", async () => {
    const w = world();
    const lock = macLock(w.home);
    mkdirSync(join(lock, ".."), { recursive: true });
    writeFileSync(lock, JSON.stringify({ pid: 424242, command: "reelkit edit", nonce: "n" }));
    let held = true;
    const alive = (pid) => (pid === 424242 ? held : pid === process.pid);
    const rendering = renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, { ...w.deps, alive });
    await new Promise((r) => setTimeout(r, 120));
    assert.deepEqual(w.reelKitRuns(), [], "nothing ran while the worker held the Mac");
    held = false;
    const r = await rendering;
    assert.equal(r.ok, true, r.why);
    assert.ok(!existsSync(lock), "the render lets the Mac go when it ends");
  });
});

describe("a project's folder for its exports", () => {
  it("is public/ for a Reel Kit edit, where the app writes its own, and the project itself for a HyperFrames one", () => {
    const work = "/Users/sallie/BRIMM Video Work/Pricing";
    assert.equal(projectDirOf(work, { name: NAME, maker: "reel-kit" }), join(work, NAME, "public"));
    assert.equal(projectDirOf(work, { name: "Pricing- reel 2 3fa9c1" }), join(work, "Pricing- reel 2 3fa9c1"));
  });
});

describe("fix round 1: what the render may not take for its own", () => {
  const CHANGED = `${NAME} was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac.`;
  /** Everything set aside for the project, as paths inside each look's folder. */
  const asideFiles = (w) => {
    const root = asideDir(w.home, SLUG);
    const all = [];
    const walk = (at, rel) => {
      for (const name of readdirSync(at)) {
        const path = join(at, name);
        if (lstatSync(path).isDirectory()) walk(path, rel ? `${rel}/${name}` : name);
        else all.push(rel ? `${rel}/${name}` : name);
      }
    };
    if (existsSync(root)) walk(root, "");
    return all.map((p) => p.split("/").slice(1).join("/"));
  };

  it("refuses to start while anything but Studio holds the project open, in one line", async () => {
    const w = world();
    w.hold(() => [4242]);
    const lines = [];
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, { ...w.deps, log: (line) => lines.push(line) });
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.open });
    assert.doesNotMatch(r.why, /\/|--|\.py\b|\.json\b/);
    assert.deepEqual(w.reelKitRuns(), []);
    assert.ok(lines.some((line) => line.includes("process 4242")), "the holder is named in the log");
    assert.equal(readState(w.dir).rendering, undefined);
    assert.equal(readState(w.dir).state, "ready");
    // The look is a courtesy, not the guard (the render runs in a copy): one that can't be asked of lsof renders all the same.
    const unasked = world();
    const r2 = await renderReelKit(unasked.ctx, { dir: unasked.dir, entry: unasked.entry }, { ...unasked.deps, run: (p, a, o) => (p === "/usr/sbin/lsof" ? { status: 1, stdout: "", stderr: "usage: lsof" } : spawnSync(p, a, o)) });
    assert.equal(r2.ok, true, r2.why);
  });

  it("fix round 2: renders in a copy, so the project's own files and fingerprint are never written", async () => {
    const w = world();
    const before = readState(w.dir).fingerprint;
    const files = () => ["edit.py", "public/index.html", "cards/c1/index.html", "fx/f1/fx.js"].map((p) => readFileSync(join(w.dir, p), "utf8"));
    const was = files();
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    // The stand-in's build wrote public/build.json into the project it was given: the copy, never the project.
    assert.ok(!existsSync(join(w.dir, "public", "build.json")));
    assert.deepEqual(files(), was);
    assert.equal(compositionFingerprint(w.dir), before);
    assert.equal(readState(w.dir).fingerprint, before);
    // The render and its phone copy arrive in the project's own renders/, as plain files, and the record points at the render.
    assert.equal(r.file, join(w.dir, "renders", `${SLUG}-v1.mp4`));
    assert.ok(lstatSync(r.file).isFile());
    assert.ok(lstatSync(join(w.dir, "renders", `${SLUG}-v1-phone.mp4`)).isFile());
    assert.equal(metaOf(readFileSync(join(w.dir, "public", "renders", metas(w)[0]), "utf8")).exportedTo, r.file);
    // The copy is gone afterwards.
    assert.ok(!existsSync(cloneOf(w)));
    // The profile writes only the copy and the temp folder: the project itself is read, never written.
    const [box] = w.sandboxRuns();
    const writes = box.profile.split("\n").filter((line) => line.startsWith("(allow file-write*"));
    assert.ok(writes.length && writes.every((line) => !line.includes(`"${w.dir}"`) && !line.includes(`"${realpathSync(w.dir)}"`)), "no write rule names the project");
    assert.ok(box.profile.includes(`(subpath "${realpathSync(w.dir)}")`), "the project is read");
  });

  it("fix round 2: keeps an edit she makes in the app while it renders, and refuses the next render as changed", async () => {
    // The app saves an edit to the project's public/ while Reel Kit renders the copy (no file held open), and QA fails.
    const w = world({ scenario: "qa-fail app-edit" });
    const before = readState(w.dir).fingerprint;
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.why, RENDER_SAY.qaFailed);
    assert.equal(readFileSync(join(w.dir, "public", "index.html"), "utf8"), "<html>changed in the app while it rendered</html>\n", "her edit is kept");
    assert.equal(readState(w.dir).fingerprint, before, "her edit is never taken for Reel Kit's");
    assert.equal(renderWhy(w.dir, readState(w.dir)), CHANGED);
    assert.equal((await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps)).why, CHANGED);
    assert.equal(w.reelKitRuns().filter((run) => run.script === "render.py").length, 1, "the next render is refused before Reel Kit's build could run over her edit");
    // One that passes keeps her edit too, and its fingerprint is still finalize's.
    const passed = world({ scenario: "app-edit" });
    const was = readState(passed.dir).fingerprint;
    assert.equal((await renderReelKit(passed.ctx, { dir: passed.dir, entry: passed.entry }, passed.deps)).ok, true);
    assert.equal(readFileSync(join(passed.dir, "public", "index.html"), "utf8"), "<html>changed in the app while it rendered</html>\n");
    assert.equal(readState(passed.dir).fingerprint, was);
  });

  it("lets no LaunchServices nor the window server be asked from inside the render", () => {
    for (const service of ["com.apple.coreservices.launchservicesd", "com.apple.lsd.mapdb", "com.apple.windowserver.active", "com.apple.CoreServices.coreservicesd"]) {
      assert.ok(!MACH_SERVICES.includes(service), service);
    }
    const facts = factsOf("/Users/sallie", { root: "/Users/sallie/Dropbox/BRIMM Video", machine: "Mac Studio" }, { tmp: "/private/tmp", uid: 501, env: {} });
    const text = renderProfile({ checkout: "/Users/sallie/Studio", project: `/Users/sallie/BRIMM Video Work/Pricing/${NAME}`, kit: kitDir("/Users/sallie"), rkHome: reelKitHome("/Users/sallie"), facts, tmp: `/Users/sallie/BRIMM Video Work/.reel-kit/tmp/${SLUG}.render` });
    assert.doesNotMatch(text, /launchservicesd|lsd\.mapdb|windowserver|coreservicesd/);
  });

  it("denies Studio's own names at any depth, in any spelling of case, under the project and its temp folder", async () => {
    const facts = factsOf("/Users/sallie", { root: "/Users/sallie/Dropbox/BRIMM Video", machine: "Mac Studio" }, { tmp: "/private/tmp", uid: 501, env: {} });
    const project = `/Users/sallie/BRIMM Video Work/Pricing/${NAME}`;
    const tmp = `/Users/sallie/BRIMM Video Work/.reel-kit/tmp/${SLUG}.render`;
    const text = renderProfile({ checkout: "/Users/sallie/Studio", project, kit: kitDir("/Users/sallie"), rkHome: reelKitHome("/Users/sallie"), facts, tmp });
    const rule = text.split("\n").find((line) => line.startsWith("(deny file-write* (regex"));
    assert.ok(rule, "a regex rule");
    assert.ok(text.indexOf(rule) > text.lastIndexOf("(allow file-write*"), "after the writes it holds back");
    for (const root of [project, tmp]) assert.ok(rule.includes(`(regex "^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}/(.*/)?`), root);
    for (const spelt of ["[cC][lL][aA][uU][dD][eE]\\\\.[mM][dD]", "\\\\.[cC][lL][aA][uU][dD][eE]", "[sS][tT][uU][dD][iI][oO]\\\\.[jJ][sS][oO][nN]", "[aA][gG][eE][nN][tT][sS]\\\\.[mM][dD]"]) assert.ok(rule.includes(spelt), spelt);
    // And what the render leaves under one of them is set aside after it, and fails it, as the worker's run is failed.
    const w = world({ scenario: "plant" });
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.own });
    assert.ok(!existsSync(join(w.dir, "cards", "c1", "Claude.md")));
    assert.ok(asideFiles(w).includes("cards/c1/Claude.md"));
    assert.deepEqual(metas(w), []);
    assert.deepEqual([readState(w.dir).state, readState(w.dir).why], ["failed", "own"]);
    assert.ok(!existsSync(cloneOf(w)));
  });

  it("fix round 2: copies none of Studio's own names into the copy, so its notes for the app never fail a render", async () => {
    const w = world();
    writeFileSync(join(w.dir, "public", "CLAUDE.md"), "Studio's notes for the app's agent\n");
    noteOwnFile(w.home, SLUG, w.dir, "public/CLAUDE.md");
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    assert.equal(readFileSync(join(w.dir, "public", "CLAUDE.md"), "utf8"), "Studio's notes for the app's agent\n");
    assert.deepEqual(asideFiles(w), []);
  });

  it("writes the meta record only for a render in the project's own renders folder, and keeps no record it did not write", async () => {
    const w = world({ scenario: "renders-link" });
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.oddRender });
    assert.match(RENDER_SAY.oddRender, /nothing was kept as an export/);
    assert.deepEqual(metas(w), []);
    assert.deepEqual(readdirSync(join(w.dir, "renders")), [], "nothing was brought into the project");
    assert.throws(() => writeMeta(w.dir, { name: NAME, file: join(w.outside, "x.mp4"), at: new Date() }), /renders/);
    assert.throws(() => writeMeta(w.dir, { name: NAME, file: join(w.dir, "renders", "..", "edit.py"), at: new Date() }), /renders/);
    // A record the render wrote into public/renders/ itself stays in its copy, and goes with it: only Studio's own is in the project.
    const cli = world({ scenario: "cli-meta" });
    const c = await renderReelKit(cli.ctx, { dir: cli.dir, entry: cli.entry }, cli.deps);
    assert.equal(c.ok, true, c.why);
    assert.equal(metas(cli).length, 1);
    assert.equal(metaOf(readFileSync(join(cli.dir, "public", "renders", metas(cli)[0]), "utf8")).exportedTo, c.file);
    assert.ok(!existsSync(cloneOf(cli)));
  });

  it("leaves a link the render makes in its copy, never in the project", async () => {
    const w = world({ scenario: "link" });
    const before = readState(w.dir).fingerprint;
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    assert.ok(!existsSync(join(w.dir, "public", "elsewhere")));
    assert.equal(compositionFingerprint(w.dir), before);
    assert.ok(!existsSync(cloneOf(w)));
  });

  it("keeps nothing as an export when the edit was taken out of ready while it rendered", async () => {
    const w = world({ scenario: "restate" });
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.moved });
    assert.deepEqual(metas(w), []);
    assert.equal(readState(w.dir).state, "queued", "the job that took it is left its own state");
  });

  it("fix round 3: renders only the edit she approved, refusing a copy changed after the check", async () => {
    // The app saves an edit to the project between the last look (renderWhy) and the copy: here, as lsof is asked whether anything holds it.
    const w = world();
    const before = readState(w.dir).fingerprint;
    w.hold(() => {
      writeFileSync(join(w.dir, "public", "index.html"), "<html>saved in the app just before the copy</html>\n");
      return [];
    });
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.deepEqual(r, { ok: false, file: null, why: CHANGED });
    assert.deepEqual(w.reelKitRuns(), [], "nothing was rendered");
    assert.deepEqual(w.sandboxRuns(), []);
    assert.deepEqual(metas(w), []);
    assert.deepEqual(readdirSync(join(w.dir, "renders")), []);
    assert.equal(readFileSync(join(w.dir, "public", "index.html"), "utf8"), "<html>saved in the app just before the copy</html>\n", "her edit is kept");
    const state = readState(w.dir);
    assert.deepEqual([state.state, state.fingerprint, state.rendering], ["ready", before, undefined]);
    assert.ok(!existsSync(cloneOf(w)), "the copy is taken away");
  });

  it("fix round 3: sweeps the copies in the render's copy of source/, never the project's own", async () => {
    // Her own files in the project's source/, named as Reel Kit's copies are, and a render whose deliver left its copies in its copy's source/.
    const w = world({ scenario: "deliver" });
    const source = join(w.dir, "source");
    writeFileSync(join(source, `${TITLE} v7.mp4`), "HERS");
    writeFileSync(join(source, `${TITLE} v7 (phone).mp4`), "HERS TOO");
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, w.deps);
    assert.equal(r.ok, true, r.why);
    assert.deepEqual(readdirSync(source).sort(), [`${TITLE} v7 (phone).mp4`, `${TITLE} v7.mp4`, "clip.mp4"], "the project's source/ is never swept");
    assert.equal(readFileSync(join(source, `${TITLE} v7.mp4`), "utf8"), "HERS");
    assert.ok(w.trashed.length > 0 && w.trashed.every((path) => path.startsWith(`${cloneOf(w)}/source/`)), "only the copy's source/ is swept");
    assert.deepEqual(readdirSync(w.trash).sort(), [`${TITLE} v1 (phone).mp4`, `${TITLE} v1.mp4`], "only what the render left, never a clone of hers");
  });

  it("fix round 3: a find before the run is recorded as planted, not as an odd render", async () => {
    // Something under one of Studio's own names turns up in the copy before the run (copyProject's own filter is the first guard).
    const w = world();
    const lines = [];
    const copy = (dir, clone) => {
      copyProject(dir, clone);
      writeFileSync(join(clone, "fx", "f1", "CLAUDE.md"), "planted\n");
    };
    const r = await renderReelKit(w.ctx, { dir: w.dir, entry: w.entry }, { ...w.deps, copy, log: (line) => lines.push(line) });
    assert.deepEqual(r, { ok: false, file: null, why: RENDER_SAY.planted });
    assert.doesNotMatch(r.why, /\/|--|\.py\b|\.json\b/);
    assert.notEqual(RENDER_SAY.planted, RENDER_SAY.odd);
    assert.deepEqual(w.reelKitRuns(), [], "nothing was rendered");
    const state = readState(w.dir);
    assert.equal(state.lastRender?.why, "planted");
    assert.equal(state.state, "ready");
    assert.ok(asideFiles(w).includes("fx/f1/CLAUDE.md"));
  });

  it("says the render finished, but its record couldn't be written", () => {
    assert.match(RENDER_SAY.unrecorded, /render(ed)? (finished|was made)/i);
    assert.match(RENDER_SAY.unrecorded, /nothing was kept as an export/);
    for (const line of Object.values(RENDER_SAY)) if (typeof line === "string" && /nothing was kept/.test(line)) assert.match(line, /nothing was kept as an export/, line);
  });
});
