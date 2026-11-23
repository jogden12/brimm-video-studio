// Sallie's own Reel Kit style pack in BRIMM Video in Dropbox (reel-kit-style.js; spec 2026-11-23 Reel Kit in Studio; plan Task 8).
// Every test builds a temp home and a made-up BRIMM Video folder (`settings.root`) of its own: no test touches the real Dropbox.
// The shipped pack is copied into the test's own folder wherever a test changes it, so tool/brand/reel-kit is never written.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloneFile } from "../dropbox.js";
import { folderFingerprint, reelKitHome } from "../reel-kit.js";
import {
  NOT_YET, SHIPPED_PACK, backupPack, ensureHerPack, herPack, packDiff, packFault, restorePack, shippedMoved, swapMarker, syncPack
} from "../reel-kit-style.js";

const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

/** A Mac's home and a BRIMM Video folder of the test's own, with a copy of the shipped pack the test may change. */
function world({ withRoot = true } = {}) {
  const base = mkdtempSync(join(tmpdir(), "reel-kit-style-"));
  made.push(base);
  const home = join(base, "home");
  mkdirSync(home);
  const root = join(base, "Dropbox", "BRIMM Video");
  mkdirSync(join(base, "Dropbox"));
  if (withRoot) mkdirSync(root);
  const shipped = join(base, "shipped");
  cpSync(SHIPPED_PACK, shipped, { recursive: true });
  return { base, home, root, settings: { root }, shipped };
}

/** Every file under `dir`, relative, with its bytes, `before …` folders left out when `backups` is false. */
function filesOf(dir, { backups = true } = {}) {
  const out = {};
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs).sort()) {
      if (!backups && rel === "" && name.startsWith("before ")) continue;
      const path = join(abs, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(path).isDirectory()) walk(path, r);
      else out[r] = readFileSync(path).toString("base64");
    }
  };
  walk(dir, "");
  return out;
}

const styleOf = (home) => join(reelKitHome(home), "style");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const editJson = (path, change) => {
  const doc = readJson(path);
  change(doc);
  writeFileSync(path, JSON.stringify(doc, null, 2));
};

describe("her Reel Kit style pack in Dropbox", () => {
  it("makes her pack from the shipped one the first time", () => {
    const w = world();
    const first = ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped, now: Date.parse("2026-11-23T10:00:00Z") });
    assert.deepEqual(first, { made: true, why: "" });
    const her = herPack(w.settings);
    assert.equal(her, join(w.root, "Reel Kit style"));
    const fingerprint = folderFingerprint(w.shipped);
    const hers = filesOf(her);
    assert.equal(Buffer.from(hers[".made-from"], "base64").toString("utf8").trim(), fingerprint);
    delete hers[".made-from"];
    assert.deepEqual(hers, filesOf(w.shipped));
    const record = readJson(join(reelKitHome(w.home), "style-made.json"));
    assert.equal(record.from, fingerprint);
    assert.equal(record.madeAt, "2026-11-23T10:00:00.000Z");

    assert.deepEqual(ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped }), { made: false, why: "" });

    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    const style = styleOf(w.home);
    for (const f of ["STYLE.md", "style.json", "brand.css", "board/index.html", "board/files.json", "board/img/hifi.jpg"]) {
      assert.ok(existsSync(join(style, f)), `${f} is not in the style Reel Kit reads`);
    }
    const fonts = ["Allison-Regular.ttf", "JosefinSans-normal-400.ttf", "JosefinSans-normal-500.ttf", "JosefinSans-normal-600.ttf", "JosefinSans-normal-700.ttf", "OFL-allison.txt", "OFL-josefin-sans.txt"];
    assert.deepEqual(readdirSync(join(style, "fonts")).sort(), fonts);
    assert.deepEqual(readdirSync(join(style, "board", "fonts")).sort(), fonts);
    assert.ok(!existsSync(join(style, ".made-from")));
    assert.ok(!existsSync(`${style}.new`) && !existsSync(`${style}.old`));
  });

  it("never makes BRIMM Video's folder", () => {
    // Dropbox signed out or moved: BRIMM Video's folder is not there at all.
    const w = world({ withRoot: false });
    const ensured = ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    assert.equal(ensured.made, false);
    assert.match(ensured.why, /BRIMM Video/);
    assert.doesNotMatch(ensured.why, /\//, "a line she reads holds no path");
    assert.ok(!existsSync(w.root), "BRIMM Video's folder was made");
    const synced = syncPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    assert.match(synced, /BRIMM Video/);
    assert.ok(!existsSync(w.root), "BRIMM Video's folder was made");
    assert.ok(!existsSync(styleOf(w.home)), "a style was made without her pack");
    assert.throws(() => backupPack({ settings: w.settings, home: w.home }), /BRIMM Video/);
    assert.ok(!existsSync(w.root));

    // The folder goes while the pack is being put in: every write looks again, and nothing makes it again.
    const v = world();
    let clones = 0;
    const clone = (from, to) => {
      cloneFile(from, to);
      clones += 1;
      if (clones === 3) rmSync(v.root, { recursive: true, force: true });
    };
    const racing = ensureHerPack({ settings: v.settings, home: v.home, shipped: v.shipped, dropbox: { clone } });
    assert.equal(racing.made, false);
    assert.equal(racing.why, ensured.why, "the line is not the one for BRIMM Video's folder gone");
    assert.equal(clones, 3, "a file was put in after BRIMM Video's folder went");
    assert.ok(!existsSync(v.root), "BRIMM Video's folder was made again");
    assert.ok(!existsSync(join(reelKitHome(v.home), "style-made.json")), "a pack that was never made whole is recorded as made");
  });

  it("never writes into her pack on an update", () => {
    const w = world();
    assert.equal(ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped }).made, true);
    const her = herPack(w.settings);
    editJson(join(her, "style.json"), (s) => { s.captions.hifi.size = 60; });
    writeFileSync(join(her, "headshot.jpg"), "her face");
    const before = filesOf(her);

    // Jason ships a new base: the shipped pack changes.
    editJson(join(w.shipped, "style.json"), (s) => { s.captions.hifi.size = 50; s.motion = "lively"; });
    writeFileSync(join(w.shipped, "STYLE.md"), "A new base.\n");
    assert.deepEqual(ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped }), { made: false, why: "" });
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    assert.deepEqual(filesOf(her), before, "her pack was written into");

    // The style Reel Kit reads is hers, and the shipped pack is not even read while she has her own.
    const gone = join(w.base, "no shipped pack");
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: gone }), "");
    const style = styleOf(w.home);
    assert.equal(readJson(join(style, "style.json")).captions.hifi.size, 60);
    assert.equal(readJson(join(style, "style.json")).motion, "calm");
    assert.equal(readFileSync(join(style, "headshot.jpg"), "utf8"), "her face");
    assert.deepEqual(filesOf(her), before);
  });

  it("refuses a pack whose style.json does not read", () => {
    const w = world();
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    const style = styleOf(w.home);
    const was = filesOf(style);
    const her = herPack(w.settings);
    const text = readFileSync(join(her, "style.json"), "utf8");
    // Half-synced: Dropbox has brought over only part of it.
    writeFileSync(join(her, "style.json"), text.slice(0, Math.floor(text.length / 2)));
    const fault = packFault(her);
    assert.match(fault, /style\.json/);
    assert.doesNotMatch(fault, /\//);
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), fault);
    assert.deepEqual(filesOf(style), was, "the style Reel Kit reads changed");
    assert.ok(!existsSync(`${style}.new`));

    rmSync(join(her, "style.json"));
    assert.match(packFault(her), /style\.json/);
    assert.match(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), /style\.json/);
    assert.deepEqual(filesOf(style), was);
    assert.ok(!existsSync(join(her, "style.json")), "Studio put a style.json into her pack");
  });

  it("refuses to edit with the shipped pack once hers has gone", () => {
    const w = world();
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    // A second Mac that has only ever seen her pack, never made it.
    const otherHome = join(w.base, "other home");
    mkdirSync(otherHome);
    assert.equal(syncPack({ settings: w.settings, home: otherHome, shipped: w.shipped }), "");
    const was = filesOf(styleOf(w.home));

    rmSync(herPack(w.settings), { recursive: true });
    for (const home of [w.home, otherHome]) {
      const ensured = ensureHerPack({ settings: w.settings, home, shipped: w.shipped });
      assert.equal(ensured.made, false);
      assert.match(ensured.why, /Reel Kit style/);
      assert.ok(!existsSync(herPack(w.settings)), "her pack was made again from the shipped one");
      const synced = syncPack({ settings: w.settings, home, shipped: w.shipped });
      assert.match(synced, /Reel Kit style/);
      assert.doesNotMatch(synced, /\//);
      assert.ok(!existsSync(herPack(w.settings)), "her pack was made again from the shipped one");
    }
    assert.deepEqual(filesOf(styleOf(w.home)), was, "the style Reel Kit reads was replaced");
  });

  it("keeps the old pack as before <date> and can go back to it", () => {
    const w = world();
    assert.equal(ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped }).made, true);
    const her = herPack(w.settings);
    editJson(join(her, "style.json"), (s) => { s.captions.hifi.size = 58; });
    const first = filesOf(her);

    const name = backupPack({ settings: w.settings, home: w.home, now: new Date(2026, 10, 23, 14, 5) });
    assert.equal(name, "before 2026-11-23 14.05");
    assert.deepEqual(filesOf(join(her, name)), first, "the backup is not her pack as it was");
    assert.deepEqual(filesOf(her, { backups: false }), first, "her pack was moved, not copied");
    // A second backup in the same minute has a name of its own.
    const again = backupPack({ settings: w.settings, home: w.home, now: new Date(2026, 10, 23, 14, 5) });
    assert.notEqual(again, name);
    assert.match(again, /^before 2026-11-23 14\.05/);
    assert.ok(!existsSync(join(her, again, name)), "a backup holds another backup");

    editJson(join(her, "style.json"), (s) => { s.captions.hifi.size = 70; });
    const second = filesOf(her, { backups: false });
    const kept = restorePack({ settings: w.settings, home: w.home, name, now: new Date(2026, 10, 23, 14, 30) });
    assert.equal(kept, "before 2026-11-23 14.30");
    assert.deepEqual(filesOf(join(her, kept)), second, "the pack she had before going back was not kept");
    assert.deepEqual(filesOf(her, { backups: false }), first, "her pack did not go back");
    assert.ok(existsSync(join(her, name)), "the backup she went back to was used up");

    // Backups are never part of the style Reel Kit reads, nor checked as her style.
    writeFileSync(join(her, name, "STYLE.md"), "Sallie Holder\n");
    assert.equal(packFault(her), "");
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    assert.ok(!readdirSync(styleOf(w.home)).some((f) => f.startsWith("before ")));
    assert.throws(() => restorePack({ settings: w.settings, home: w.home, name: "before 1999-01-01 00.00" }), /before 1999-01-01 00\.00/);
  });

  it("says how her pack differs from the shipped one, key by key", () => {
    const w = world();
    ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    assert.deepEqual(packDiff({ settings: w.settings, shipped: w.shipped }), []);
    const her = herPack(w.settings);
    editJson(join(her, "style.json"), (s) => {
      s.captions.hifi.size = 60;
      s.colors.accent = "#B09A80";
      s.type = { caption: { size: 48 } };
      delete s.grade;
    });
    writeFileSync(join(her, "STYLE.md"), `${readFileSync(join(her, "STYLE.md"), "utf8")}\nHer own line.\n`);
    mkdirSync(join(her, "before 2026-11-01 09.00"));
    writeFileSync(join(her, "before 2026-11-01 09.00", "brand.css"), "changed");
    const lines = packDiff({ settings: w.settings, shipped: w.shipped });
    assert.ok(lines.some((l) => l.startsWith("captions.hifi.size:") && l.includes("60") && l.includes("54")), lines.join("\n"));
    assert.ok(lines.some((l) => l.startsWith("colors.accent:") && l.includes("#B09A80") && l.includes("#C1AD97")), lines.join("\n"));
    assert.ok(lines.some((l) => l.startsWith("type.caption.size:") && l.includes("48")), lines.join("\n"));
    assert.ok(lines.some((l) => l.startsWith("grade:")), lines.join("\n"));
    assert.ok(lines.some((l) => /^STYLE\.md\b/.test(l)), lines.join("\n"));
    assert.ok(!lines.some((l) => /brand\.css/.test(l)), "brand.css is the same, and a backup is not her pack");
    assert.ok(!lines.some((l) => l.startsWith("motion:")), "an unchanged key is said");
    for (const l of lines) assert.doesNotMatch(l, /\/Users|\n/);

    // Dropbox signed out: it says so, and nothing untrue about her pack.
    rmSync(w.root, { recursive: true });
    const gone = packDiff({ settings: w.settings, shipped: w.shipped });
    assert.equal(gone.length, 1);
    assert.match(gone[0], /BRIMM Video's folder/);
    mkdirSync(w.root);
    assert.match(packDiff({ settings: w.settings, shipped: w.shipped })[0], /no Reel Kit style folder/);
  });

  it("refuses a font from neither Google Fonts nor Adobe Fonts", () => {
    const w = world();
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    const her = herPack(w.settings);
    assert.equal(packFault(her), "");
    const was = filesOf(styleOf(w.home));

    editJson(join(her, "style.json"), (s) => { s.fonts.display.family = "Comic Sans MS"; });
    assert.match(packFault(her), /Comic Sans MS/);
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), packFault(her));
    assert.deepEqual(filesOf(styleOf(w.home)), was);
    editJson(join(her, "style.json"), (s) => { s.fonts.display.family = "Allison"; });
    assert.equal(packFault(her), "", "Allison is one of the brand's Google Fonts");

    const css = readFileSync(join(her, "brand.css"), "utf8");
    writeFileSync(join(her, "brand.css"), css.replace("--font-text: 'Josefin Sans'", "--font-text: 'Helvetica Neue'"));
    assert.match(packFault(her), /Helvetica Neue/);
    writeFileSync(join(her, "brand.css"), css.replace("fonts/JosefinSans-normal-400.ttf", "fonts/SweetSansPro-Regular.otf"));
    assert.match(packFault(her), /SweetSansPro-Regular\.otf/);
    writeFileSync(join(her, "brand.css"), css);
    assert.equal(packFault(her), "");
  });

  it("tells when Jason has shipped a new base", () => {
    const w = world();
    ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    assert.equal(shippedMoved({ settings: w.settings, shipped: w.shipped }), false);
    // Her own changes are not a new base.
    editJson(join(herPack(w.settings), "style.json"), (s) => { s.captions.hifi.size = 60; });
    assert.equal(shippedMoved({ settings: w.settings, shipped: w.shipped }), false);
    writeFileSync(join(w.shipped, "STYLE.md"), "A new base.\n");
    assert.equal(shippedMoved({ settings: w.settings, shipped: w.shipped }), true);
    // A pack with no record of what it was made from cannot say.
    rmSync(join(herPack(w.settings), ".made-from"));
    assert.equal(shippedMoved({ settings: w.settings, shipped: w.shipped }), false);
  });

  it("refuses a pack that uses Sallie Holder as a name, or a brand colour that is not a colour", () => {
    const w = world();
    ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    const her = herPack(w.settings);
    assert.equal(packFault(her), "", "the shipped pack's 'Never use \"Sallie Holder\"' line is allowed");
    const md = readFileSync(join(her, "STYLE.md"), "utf8");
    writeFileSync(join(her, "STYLE.md"), `${md}\nHosted by Sallie Holder.\n`);
    assert.match(packFault(her), /Sallie Holder/);
    assert.match(packFault(her), /Sallie Ogden/);
    // "no " inside a word is not a line saying never to use it.
    writeFileSync(join(her, "STYLE.md"), `${md}\nPiano by Sallie Holder.\n`);
    assert.match(packFault(her), /Sallie Holder/);
    writeFileSync(join(her, "STYLE.md"), md);

    // A colour she changed on purpose is hers.
    editJson(join(her, "style.json"), (s) => { s.colors.accent = "#B09A80"; });
    assert.equal(packFault(her), "");
    editJson(join(her, "style.json"), (s) => { s.colors.accent = "sandy"; });
    assert.match(packFault(her), /accent/);
    editJson(join(her, "style.json"), (s) => { s.colors.accent = "#C1AD97"; delete s.colors.dark; });
    assert.match(packFault(her), /dark/);
  });
  it("puts the style back when a run was killed in the middle of its swap", () => {
    const w = world();
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    const style = styleOf(w.home);
    const was = filesOf(style);
    // Killed between setting the style aside and renaming the new one in: no style, only style.old (and a style.new).
    renameSync(style, `${style}.old`);
    mkdirSync(`${style}.new`);
    // And this run refuses: the style must still come back.
    const her = herPack(w.settings);
    const text = readFileSync(join(her, "style.json"), "utf8");
    writeFileSync(join(her, "style.json"), "{");
    assert.match(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), /style\.json/);
    assert.deepEqual(filesOf(style), was, "the style was not put back");
    assert.ok(!existsSync(`${style}.old`) && !existsSync(`${style}.new`));

    // Killed again, and this run succeeds: the old style is put back, then replaced, never just deleted.
    writeFileSync(join(her, "style.json"), text.replace('"size": 54', '"size": 56'));
    renameSync(style, `${style}.old`);
    assert.equal(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), "");
    assert.equal(readJson(join(style, "style.json")).captions.hifi.size, 56);
    assert.ok(!existsSync(`${style}.old`));

    // Killed while the old one was being taken away, after the swap was whole: the new style stays.
    const now = filesOf(style);
    cpSync(style, `${style}.old`, { recursive: true });
    writeFileSync(join(`${style}.old`, "style.json"), "older");
    writeFileSync(swapMarker(w.home), "committed\n");
    writeFileSync(join(her, "style.json"), "{");
    assert.match(syncPack({ settings: w.settings, home: w.home, shipped: w.shipped }), /style\.json/);
    assert.deepEqual(filesOf(style), now);
    assert.ok(!existsSync(`${style}.old`) && !existsSync(swapMarker(w.home)));
  });

  it("names a file in the board by its name, never by a path", () => {
    const w = world();
    ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    const her = herPack(w.settings);
    writeFileSync(join(her, "board", "notes.md"), "Made by Sallie Holder.\n");
    const named = packFault(her);
    assert.match(named, /notes\.md in Reel Kit style's board/);
    assert.doesNotMatch(named, /\//);
    rmSync(join(her, "board", "notes.md"));

    symlinkSync(join(w.base, "elsewhere.jpg"), join(her, "board", "img", "extra.jpg"));
    const linked = syncPack({ settings: w.settings, home: w.home, shipped: w.shipped });
    assert.match(linked, /extra\.jpg in Reel Kit style's board is a link/);
    assert.doesNotMatch(linked, /\//);
    rmSync(join(her, "board", "img", "extra.jpg"));

    const css = readFileSync(join(her, "brand.css"), "utf8");
    for (const odd of ["fonts/../../elsewhere/Odd.ttf", "https://fonts.example.com/css/Odd.woff2?v=2"]) {
      writeFileSync(join(her, "brand.css"), css.replace("fonts/JosefinSans-normal-400.ttf", odd));
      const line = packFault(her);
      assert.match(line, /Odd\.(ttf|woff2)/);
      assert.doesNotMatch(line, /\//, line);
    }
    writeFileSync(join(her, "brand.css"), css);
    assert.equal(packFault(her), "");
  });

  it("makes her pack only on the Mac Studio; an installed Mac waits for Dropbox to bring it", () => {
    const w = world();
    const installed = { mode: "installed" };
    const laptop = join(w.base, "laptop home");
    mkdirSync(laptop);
    assert.deepEqual(ensureHerPack({ settings: w.settings, home: laptop, shipped: w.shipped, build: installed }), { made: false, why: NOT_YET });
    assert.equal(syncPack({ settings: w.settings, home: laptop, shipped: w.shipped, build: installed }), NOT_YET);
    assert.ok(!existsSync(herPack(w.settings)), "an installed Mac made her pack");
    assert.ok(!existsSync(styleOf(laptop)));
    assert.ok(!existsSync(join(reelKitHome(laptop), "style-made.json")), "an installed Mac recorded a pack it has not seen");

    // The Mac Studio (dev mode) makes it; then the installed Mac takes it as it is.
    assert.equal(ensureHerPack({ settings: w.settings, home: w.home, shipped: w.shipped, build: { mode: "dev" } }).made, true);
    assert.equal(syncPack({ settings: w.settings, home: laptop, shipped: w.shipped, build: installed }), "");
    assert.equal(readJson(join(reelKitHome(laptop), "style-made.json")).from, folderFingerprint(w.shipped));
    assert.ok(existsSync(join(styleOf(laptop), "style.json")));
  });
});
