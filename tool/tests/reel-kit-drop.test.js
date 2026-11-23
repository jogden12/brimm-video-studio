// Reading a dropped Reel Kit download (reel-kit-drop.js; spec 2026-11-23 Reel Kit in Studio, section 1; plan Task 3).
// The kit is tests/fixtures/reel-kit-1.2.0/kit/, made up; every download here is a copy of it in a temp folder, laid out as a
// skill folder, as a plugin folder (skills/reel-kit/ inside, LICENSE beside skills/) or as what a zip of one unpacks to. No test
// runs a program: the unzip is a stand-in that builds the unpacked tree, as ditto would.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DROP_WHY, readDrop } from "../reel-kit-drop.js";
import { folderFingerprint, kitDir } from "../reel-kit.js";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "reel-kit-1.2.0", "kit");
const temp = mkdtempSync(join(tmpdir(), "reel-kit-drop-"));
after(() => rmSync(temp, { recursive: true, force: true }));
let made = 0;
/** A new empty folder in the temp folder. */
const fresh = (name = "d") => {
  const dir = join(temp, `${name}${made++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};
/** A home with no settings and a drop folder of its own, which every call is given. */
const world = () => {
  const home = fresh("home");
  const drop = join(home, "BRIMM Video Work", "Drop");
  mkdirSync(drop, { recursive: true });
  return { home, drops: [drop], drop };
};
/** A skill folder: the fixture, with a LICENSE in it, at `at`. */
function skillFolder(at, { license = true } = {}) {
  cpSync(FIXTURE, at, { recursive: true });
  if (license) writeFileSync(join(at, "LICENSE"), "A made-up licence for tests.\n");
  return at;
}
/** A plugin folder: `skills/reel-kit/` the fixture, LICENSE beside `skills/`, as the 1.2.0 download is. */
function pluginFolder(at) {
  mkdirSync(join(at, "skills"), { recursive: true });
  cpSync(FIXTURE, join(at, "skills", "reel-kit"), { recursive: true });
  mkdirSync(join(at, ".claude-plugin"));
  writeFileSync(join(at, ".claude-plugin", "plugin.json"), '{"name":"reel-kit"}\n');
  writeFileSync(join(at, "LICENSE"), "A made-up licence for tests.\n");
  return at;
}
/** A file that looks like a zip to a reader of its first bytes. */
function zipFile(at) {
  writeFileSync(at, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60)]));
  return at;
}
/** The unzip stand-in: it puts `tree(into)` where ditto would unpack, and notes each call. */
function standIn(tree) {
  const calls = [];
  const unzip = (zip, into) => {
    calls.push({ zip, into });
    tree(into);
  };
  return { unzip, calls };
}
/** Every entry under `dir`, with the stamps a write would change. */
function stamps(dir) {
  const out = {};
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs).sort()) {
      const path = join(abs, name);
      const s = lstatSync(path);
      out[`${rel}${name}`] = [s.ino, s.mode, s.size, s.mtimeMs, s.ctimeMs].join(" ");
      if (s.isDirectory()) walk(path, `${rel}${name}/`);
    }
  };
  const s = lstatSync(dir);
  out["."] = [s.ino, s.mode, s.mtimeMs, s.ctimeMs].join(" ");
  walk(dir, "");
  return out;
}
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("reading a dropped Reel Kit", () => {
  it("reads the version, fingerprint, HyperFrames pin and GSAP version of the skill folder", () => {
    const { home, drops } = world();
    const kit = skillFolder(join(fresh(), "reel-kit"));
    const got = readDrop(kit, { home, drops, unzip: () => assert.fail("a folder is never unzipped") });
    assert.deepEqual(got, {
      ok: true,
      kit,
      version: "1.2.0",
      fingerprint: folderFingerprint(kit),
      hyperframes: "0.8.139",
      gsap: "3.15.0",
      requirementsSha: sha256(join(FIXTURE, "setup", "requirements.txt")),
      license: join(kit, "LICENSE"),
    });
  });

  it("finds skills/reel-kit inside the plugin's own folder", () => {
    const { home, drops } = world();
    const plugin = pluginFolder(join(fresh(), "reel-kit-plugin-1.2.0"));
    const got = readDrop(plugin, { home, drops });
    assert.equal(got.ok, true, got.why);
    assert.equal(got.kit, join(plugin, "skills", "reel-kit"));
    assert.equal(got.license, join(plugin, "LICENSE"), "the plugin folder's LICENSE, since the skill folder has none");
    assert.equal(got.fingerprint, folderFingerprint(FIXTURE), "the skill folder's fingerprint, not the plugin folder's");
    assert.equal(got.version, "1.2.0");
  });

  it("reads the same fingerprint from the folder, its zip, and its zip with __MACOSX", () => {
    const { home, drops } = world();
    const plugin = pluginFolder(join(fresh(), "reel-kit-plugin-1.2.0"));
    const fromFolder = readDrop(plugin, { home, drops });
    assert.equal(fromFolder.ok, true, fromFolder.why);

    const downloads = fresh("Downloads");
    const zip = zipFile(join(downloads, "reel-kit-plugin-1.2.0.zip"));
    const plain = standIn((into) => pluginFolder(join(into, "reel-kit-plugin-1.2.0")));
    const scratch = join(fresh("incoming"), "a1");
    const fromZip = readDrop(zip, { home, drops, unzip: plain.unzip, scratch });
    assert.equal(fromZip.ok, true, fromZip.why);
    assert.equal(plain.calls.length, 1);
    assert.equal(plain.calls[0].zip, zip);
    assert.equal(plain.calls[0].into, scratch, "unpacked into the scratch folder");
    assert.notEqual(dirname(plain.calls[0].into), downloads, "never beside the zip");
    assert.deepEqual(readdirSync(downloads), ["reel-kit-plugin-1.2.0.zip"], "nothing written beside the zip");
    assert.equal(fromZip.kit, join(scratch, "reel-kit-plugin-1.2.0", "skills", "reel-kit"));
    assert.equal(fromZip.scratch, scratch, "the scratch folder is given back, for the caller to take away");
    assert.equal(fromZip.fingerprint, fromFolder.fingerprint);

    // A zip made by Finder: a __MACOSX top folder of `._` files, here with a decoy SKILL.md naming reel-kit, which is never looked at.
    const finder = standIn((into) => {
      pluginFolder(join(into, "reel-kit-plugin-1.2.0"));
      const mac = join(into, "__MACOSX", "reel-kit-plugin-1.2.0", "skills", "reel-kit");
      mkdirSync(mac, { recursive: true });
      writeFileSync(join(mac, "._SKILL.md"), "resource fork");
      writeFileSync(join(mac, "SKILL.md"), "---\nname: reel-kit\n---\n");
      writeFileSync(join(into, "__MACOSX", "._reel-kit-plugin-1.2.0"), "resource fork");
    });
    const scratch2 = join(fresh("incoming"), "b2");
    const fromFinder = readDrop(zip, { home, drops, unzip: finder.unzip, scratch: scratch2 });
    assert.equal(fromFinder.ok, true, fromFinder.why);
    assert.equal(fromFinder.kit, join(scratch2, "reel-kit-plugin-1.2.0", "skills", "reel-kit"));
    assert.equal(fromFinder.fingerprint, fromFolder.fingerprint);

    // A zip of the skill folder alone unpacks to it, at the top or in one folder.
    const bare = standIn((into) => skillFolder(join(into, "reel-kit")));
    const fromBare = readDrop(zip, { home, drops, unzip: bare.unzip, scratch: join(fresh("incoming"), "c3") });
    assert.equal(fromBare.ok, true, fromBare.why);
    assert.equal(fromBare.fingerprint, folderFingerprint(skillFolder(join(fresh(), "reel-kit"))));
  });

  it("unpacks a zip into the work folder's incoming folder unless told otherwise", () => {
    const { home, drops } = world();
    const zip = zipFile(join(fresh("Downloads"), "reel-kit.zip"));
    const unzipped = standIn((into) => pluginFolder(join(into, "reel-kit-plugin-1.2.0")));
    const got = readDrop(zip, { home, drops, unzip: unzipped.unzip });
    assert.equal(got.ok, true, got.why);
    const incoming = join(home, "BRIMM Video Work", ".toolchain", "incoming");
    assert.equal(dirname(got.scratch), incoming);
    assert.match(got.scratch.slice(incoming.length + 1), /^[0-9a-f]{16,}$/);
    assert.equal(unzipped.calls[0].into, got.scratch);
    // A zip at the top of the home is unpacked in the work folder too, which is under the home but not beside the zip.
    const atHome = zipFile(join(home, "reel-kit.zip"));
    const top = readDrop(atHome, { home, drops, unzip: standIn((into) => pluginFolder(join(into, "p"))).unzip });
    assert.equal(top.ok, true, top.why);
    assert.equal(dirname(top.scratch), incoming);
    assert.throws(() => readDrop(atHome, { home, drops, unzip: () => {}, scratch: join(home, "beside") }), /beside/);
  });

  it("names the missing path when fx/LIBRARY.md is not there", () => {
    const { home, drops } = world();
    const kit = skillFolder(join(fresh(), "reel-kit"));
    rmSync(join(kit, "fx", "LIBRARY.md"));
    const got = readDrop(kit, { home, drops });
    assert.deepEqual(got, { ok: false, why: DROP_WHY.missing("fx/LIBRARY.md") });
    assert.match(got.why, /fx\/LIBRARY\.md/);

    const noKit = skillFolder(join(fresh(), "reel-kit"));
    rmSync(join(noKit, "kit"), { recursive: true });
    assert.equal(readDrop(noKit, { home, drops }).why, DROP_WHY.missing("kit/"));
    const kitAFile = skillFolder(join(fresh(), "reel-kit"));
    rmSync(join(kitAFile, "kit"), { recursive: true });
    writeFileSync(join(kitAFile, "kit"), "a file, not a folder");
    assert.equal(readDrop(kitAFile, { home, drops }).why, DROP_WHY.missing("kit/"));
  });

  it("refuses a download in the drop folder, and writes nothing there", () => {
    const { home, drops, drop } = world();
    const plugin = pluginFolder(join(drop, "reel-kit-plugin-1.2.0"));
    const zip = zipFile(join(drop, "reel-kit-plugin-1.2.0.zip"));
    const before = stamps(drop);
    const never = () => assert.fail("nothing in the drop folder is unzipped");
    for (const path of [plugin, join(plugin, "skills", "reel-kit"), zip]) {
      assert.deepEqual(readDrop(path, { home, drops, unzip: never, scratch: join(drop, "scratch") }), { ok: false, why: DROP_WHY.inDrop });
    }
    // Spelt another way: through a link to the drop folder, or in another letter case.
    const link = join(fresh(), "drop-link");
    symlinkSync(drop, link);
    assert.equal(readDrop(join(link, "reel-kit-plugin-1.2.0"), { home, drops, unzip: never }).why, DROP_WHY.inDrop);
    assert.equal(readDrop(join(drop.replace(/Drop$/, "DROP"), "reel-kit-plugin-1.2.0.zip"), { home, drops, unzip: never }).why, DROP_WHY.inDrop);
    assert.deepEqual(stamps(drop), before, "nothing in the drop folder changed");
    assert.equal(existsSync(join(home, "BRIMM Video Work", ".toolchain")), false, "no scratch folder was made");
  });

  it("never writes into the dropped folder", () => {
    const { home, drops } = world();
    const plugin = pluginFolder(join(fresh(), "reel-kit-plugin-1.2.0"));
    const parent = dirname(plugin);
    const before = stamps(parent);
    assert.equal(readDrop(plugin, { home, drops }).ok, true);
    assert.deepEqual(stamps(parent), before);
  });
});

describe("what a dropped Reel Kit is refused for", () => {
  const refusal = (path, why, extra = {}) => {
    const { home, drops } = world();
    assert.deepEqual(readDrop(path, { home, drops, ...extra }), { ok: false, why });
  };

  it("refuses what is neither a folder nor a zip, and what is not there", () => {
    const text = join(fresh(), "notes.txt");
    writeFileSync(text, "hello");
    refusal(text, DROP_WHY.notFolderOrZip);
    const fakeZip = join(fresh(), "fake.zip");
    writeFileSync(fakeZip, "not a zip at all");
    refusal(fakeZip, DROP_WHY.notFolderOrZip);
    refusal(join(fresh(), "gone"), DROP_WHY.gone);
  });

  it("refuses a folder with no SKILL.md naming reel-kit", () => {
    refusal(fresh("empty"), DROP_WHY.noSkill);
    const other = skillFolder(join(fresh(), "reel-kit"));
    writeFileSync(join(other, "SKILL.md"), "---\nname: something-else\n---\n# reel-kit\n");
    refusal(other, DROP_WHY.noSkill);
    const noFront = skillFolder(join(fresh(), "reel-kit"));
    writeFileSync(join(noFront, "SKILL.md"), "name: reel-kit\n");
    refusal(noFront, DROP_WHY.noSkill);
  });

  it("refuses a VERSION that is not x.y.z, and a kit that does not say its HyperFrames, GSAP or requirements", () => {
    for (const version of ["latest\n", "1.2\n", "../1.2.0\n", "", "1.2.0 beta\n"]) {
      const kit = skillFolder(join(fresh(), "reel-kit"));
      writeFileSync(join(kit, "VERSION"), version);
      refusal(kit, DROP_WHY.version);
    }
    const noHf = skillFolder(join(fresh(), "reel-kit"));
    writeFileSync(join(noHf, "pipeline", "common.py"), 'HF = ["npx", "-y", "hyperframes"]\n');
    refusal(noHf, DROP_WHY.hyperframes);
    const twoHf = skillFolder(join(fresh(), "reel-kit"));
    writeFileSync(join(twoHf, "pipeline", "common.py"), '"hyperframes@0.8.139"\n"hyperframes@0.8.140"\n');
    refusal(twoHf, DROP_WHY.hyperframes);
    const noCommon = skillFolder(join(fresh(), "reel-kit"));
    rmSync(join(noCommon, "pipeline", "common.py"));
    refusal(noCommon, DROP_WHY.hyperframes);
    const noGsap = skillFolder(join(fresh(), "reel-kit"));
    writeFileSync(join(noGsap, "setup", "setup.py"), "GSAP_VERSION = latest\n");
    refusal(noGsap, DROP_WHY.gsap);
    const noReq = skillFolder(join(fresh(), "reel-kit"));
    rmSync(join(noReq, "setup", "requirements.txt"));
    refusal(noReq, DROP_WHY.requirements);
  });

  it("refuses a link inside, or a link dropped", () => {
    const inside = skillFolder(join(fresh(), "reel-kit"));
    symlinkSync("/etc/hosts", join(inside, "kit", "hosts"));
    refusal(inside, DROP_WHY.link);
    const kitLink = pluginFolder(join(fresh(), "plugin"));
    const real = join(fresh(), "elsewhere");
    cpSync(join(kitLink, "skills", "reel-kit"), real, { recursive: true });
    rmSync(join(kitLink, "skills", "reel-kit"), { recursive: true });
    symlinkSync(real, join(kitLink, "skills", "reel-kit"));
    refusal(kitLink, DROP_WHY.link);
    const licenceLink = pluginFolder(join(fresh(), "plugin"));
    rmSync(join(licenceLink, "LICENSE"));
    symlinkSync("/etc/hosts", join(licenceLink, "LICENSE"));
    refusal(licenceLink, DROP_WHY.link);
    const dropped = join(fresh(), "a-link");
    symlinkSync(skillFolder(join(fresh(), "reel-kit")), dropped);
    refusal(dropped, DROP_WHY.link);
  });

  it("refuses a download with no LICENSE in its skill folder or its plugin folder", () => {
    refusal(skillFolder(join(fresh(), "reel-kit"), { license: false }), DROP_WHY.license);
    const plugin = pluginFolder(join(fresh(), "plugin"));
    rmSync(join(plugin, "LICENSE"));
    refusal(plugin, DROP_WHY.license);
  });

  it("refuses Studio's own copy in KIT, and a zip that will not unpack", () => {
    const { home, drops } = world();
    const kit = skillFolder(kitDir(home, "1.2.0"));
    assert.deepEqual(readDrop(kit, { home, drops }), { ok: false, why: DROP_WHY.inKit });
    assert.deepEqual(readDrop(join(kit, "pipeline"), { home, drops }), { ok: false, why: DROP_WHY.inKit });
    const zip = zipFile(join(fresh(), "reel-kit.zip"));
    const scratch = join(fresh("incoming"), "z");
    const got = readDrop(zip, { home, drops, scratch, unzip: () => { throw new Error("ditto: bad zip"); } });
    assert.deepEqual(got, { ok: false, why: DROP_WHY.unzip, scratch });
    const empty = readDrop(zip, { home, drops, scratch: join(fresh("incoming"), "y"), unzip: () => {} });
    assert.equal(empty.why, DROP_WHY.noSkill);
  });

  it("says each refusal in one plain line, with no path or command for her to type", () => {
    const lines = Object.entries(DROP_WHY).map(([key, line]) => [key, typeof line === "function" ? line("fx/LIBRARY.md") : line]);
    assert.ok(lines.length >= 12);
    for (const [key, line] of lines) {
      assert.equal(typeof line, "string", key);
      assert.ok(line.length > 0 && !line.includes("\n"), key);
      assert.doesNotMatch(line.replace("fx/LIBRARY.md", ""), /[`/~$]|\.js\b|edit\.js|node /, key);
    }
  });
});
