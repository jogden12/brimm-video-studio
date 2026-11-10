// The setup engine's look at its own copy of the app and at the kind of Mac (tool/setup/checks.js), and the made-up Mac that its tests use.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELPERS } from "../helpers.js";
import { readSettings, writeSettings } from "../settings.js";
import { DAMAGED as INSTALL_DAMAGED, HDR_LISTS, appCopy } from "./app-copy.js";
import { installCalls, mac, notAMac, printOnly } from "./setup-harness.js";
import { APPS, DAMAGED, GUARD_CLAUDE, NO_BRIMM_VIDEO, PROGRAMS, appsHere, brimmVideoFolders, claudeAt, claudeState, copyFault, kindOf, nameClash, nameSuggestion, namesInUse, versionAtLeast } from "../setup/checks.js";

const INSTALL = readFileSync(fileURLToPath(new URL("../install.sh", import.meta.url)), "utf8");

/** Runs `check` with a made-up Mac, and takes it away. */
const withMac = (options, check) => {
  const m = mac(options);
  try {
    return check(m);
  } finally {
    m.done();
  }
};
/** The same, of an app's copy alone. */
const withCopy = (options, check) => {
  const copy = appCopy(options);
  try {
    return check(copy);
  } finally {
    copy.done();
  }
};
const codesign = { codesign: "/usr/bin/true" };

describe("the made-up Mac's guard for the installer", () => {
  const run = (m, args) => {
    const [guard] = printOnly(m);
    return spawnSync(guard, args, { encoding: "utf8" });
  };

  it("refuses a call without --print, and runs nothing", () => {
    withMac({}, (m) => {
      const r = run(m, ["--yes", "--machine", "Studio Test"]);
      assert.equal(r.status, 99);
      assert.equal(m.ran(), "refused --yes --machine Studio Test\n");
    });
  });

  it("refuses --yes even with --print, and runs nothing", () => {
    withMac({}, (m) => {
      const r = run(m, ["--print", "--yes"]);
      assert.equal(r.status, 99);
      assert.equal(m.ran(), "refused --print --yes\n");
    });
  });

  it("passes a --print call to the copy's own install.sh on the made-up Mac's home, whatever HOME the caller has", { skip: notAMac }, () => {
    withMac({}, (m) => {
      const elsewhere = join(m.dir, "not-this-home");
      const [guard] = printOnly(m);
      const args = ["--print", "--machine", "Studio Test", "--tools", m.tools, "--app", m.app, m.root];
      const r = spawnSync(guard, args, { encoding: "utf8", env: { ...process.env, HOME: elsewhere } });
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /^The unedited-video tool\n {2}This Mac: {2}Studio Test\n/, "the real installer's --print answered");
      assert.ok(r.stdout.includes(`${m.home}/Downloads`), "it read the made-up Mac's home");
      assert.ok(!r.stdout.includes(elsewhere), "and not the caller's");
      // It asks the stand-in launchctl what is loaded, which changes nothing, and runs nothing else.
      const calls = m.ran().split("\n").filter(Boolean);
      assert.ok(calls.length > 0 && calls.every((line) => line.startsWith("launchctl print ")), m.ran());
    });
  });
});

describe("which kind of Mac this is", () => {
  it("a home with no settings file is a fresh Mac", () => {
    withMac({ settings: "none" }, (m) => assert.deepEqual(kindOf({ home: m.home, checkout: m.checkout }), { kind: "fresh" }));
  });

  it("settings that cannot be read are unusable, with the settings' own words", () => {
    withMac({ settings: "unusable" }, (m) => {
      const got = kindOf({ home: m.home, checkout: m.checkout });
      assert.equal(got.kind, "unusable");
      assert.ok(got.why && got.why === readSettings(m.home).why);
    });
  });

  it("settings marked dev are a dev Mac, whatever their checkout", () => {
    withMac({ settings: "dev" }, (m) => {
      const got = kindOf({ home: m.home, checkout: m.checkout });
      assert.equal(got.kind, "dev");
      assert.equal(got.settings.mode, "dev");
    });
    withMac({ settings: "installed" }, (m) => {
      writeSettings(m.home, { mode: "dev" });
      assert.equal(kindOf({ home: m.home, checkout: m.checkout }).kind, "dev");
    });
  });

  it("settings whose checkout is this app's copy are installed, and not moved", () => {
    withMac({ settings: "installed" }, (m) => {
      const got = kindOf({ home: m.home, checkout: m.checkout });
      assert.deepEqual([got.kind, got.moved], ["installed", false]);
      assert.equal(got.settings.machine, "Studio Test");
    });
  });

  it("settings whose checkout is another app's copy are installed and moved", () => {
    withMac({ settings: "moved" }, (m) => {
      const got = kindOf({ home: m.home, checkout: m.checkout });
      assert.deepEqual([got.kind, got.moved], ["installed", true]);
    });
  });

  it("settings whose checkout is a git clone, or is gone, are a takeover", () => {
    withMac({ settings: "takeover" }, (m) => {
      const got = kindOf({ home: m.home, checkout: m.checkout });
      assert.equal(got.kind, "takeover");
      assert.equal(got.settings.machine, "Studio Test");
      writeSettings(m.home, { checkout: join(m.dir, "gone", "Studio") });
      assert.equal(kindOf({ home: m.home, checkout: m.checkout }).kind, "takeover");
    });
  });
});

describe("whether this copy of the app is whole", () => {
  const faultOf = (m, extra = {}) => copyFault({ app: m.app, tools: m.tools, checkout: m.checkout, programs: m.programs, ...extra });

  it("a whole copy has no fault", () => {
    withMac({}, (m) => {
      assert.equal(faultOf(m), "");
      assert.match(m.ran(), /^codesign --verify --deep --strict .*BRIMM Video Studio\.app$/m);
    });
  });

  it("a copy with no build.json is a fault that names it", () => {
    withCopy({ build: false }, (c) => assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /build\.json/));
  });

  it("a broken build.json is a fault that names it", () => {
    withCopy({}, (c) => {
      writeFileSync(join(c.checkout, "build.json"), "{");
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /build\.json/);
    });
  });

  it("a missing program is a fault that names it", () => {
    withCopy({}, (c) => {
      rmSync(join(c.tools, "whisper-cli"));
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /whisper-cli/);
    });
  });

  it("a program that cannot be run is a fault that names it", () => {
    withCopy({}, (c) => {
      chmodSync(join(c.tools, "ffprobe"), 0o644);
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /ffprobe/);
    });
  });

  it("a compiled helper that is gone is a fault that names it", () => {
    withCopy({}, (c) => {
      rmSync(join(c.tools, `brimm-${HELPERS[0]}`));
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), new RegExp(`brimm-${HELPERS[0]}`));
    });
  });

  it("an ffmpeg that cannot make an HDR video standard is a fault that names scale_vt", () => {
    withCopy({ lists: { ...HDR_LISTS, filters: "Filters:\n" } }, (c) => {
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /scale_vt/);
    });
  });

  it("an ffmpeg without videotoolbox is a fault that names it", () => {
    withCopy({ lists: { ...HDR_LISTS, hwaccels: "Hardware acceleration methods:\n" } }, (c) => {
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /videotoolbox/);
    });
  });

  it("a fault names the thing and never a path in the home", () => {
    withMac({}, (m) => {
      rmSync(join(m.tools, "npm"));
      const why = faultOf(m);
      assert.ok(why.includes("npm"));
      assert.ok(!why.includes(m.dir) && !why.includes(m.home), why);
    });
  });

  it("a copy whose signature does not verify is a fault", () => {
    withMac({}, (m) => {
      writeFileSync(join(m.dir, "exits", "codesign"), "1\n");
      assert.match(faultOf(m), /signature/);
    });
  });

  it("with deep false, codesign is never asked", () => {
    withMac({}, (m) => {
      writeFileSync(join(m.dir, "exits", "codesign"), "1\n");
      assert.equal(faultOf(m, { deep: false }), "");
      assert.ok(!/codesign/.test(m.ran()), m.ran());
    });
  });

  it("stops at the first fault: a missing build.json is said before a missing program", () => {
    withCopy({ build: false }, (c) => {
      rmSync(join(c.tools, "node"));
      assert.match(copyFault({ app: c.app, tools: c.tools, checkout: c.checkout, programs: codesign, deep: false }), /build\.json/);
    });
  });
});

describe("what the engine says of the copy is the installer's", () => {
  it("the engine's list of programs is install.sh's", () => {
    const programs = INSTALL.match(/^TOOLS_PROGRAMS=\(([^)]*)\)$/m);
    assert.ok(programs, "install.sh names TOOLS_PROGRAMS");
    assert.match(INSTALL, /^TOOLS_HELPERS=\(.*\/#\/brimm-.*\)$/m);
    assert.match(INSTALL, /^helper_line="\$\(sed -n 's\/\^export const HELPERS = .*helpers\.js"/m);
    assert.deepEqual(PROGRAMS, [...programs[1].split(" "), ...HELPERS.map((name) => `brimm-${name}`)]);
  });

  it("the engine's DAMAGED words are install.sh's", () => {
    assert.ok(INSTALL.includes(`DAMAGED="${DAMAGED}"`));
    assert.equal(DAMAGED, INSTALL_DAMAGED);
  });
});

describe("the made-up Mac's installer", () => {
  it("the installer's calls keep each argument whole, spaces and all", () => {
    withMac({}, (m) => {
      const first = ["--print", "--machine", "Studio Test", "--app", join(m.dir, "My Apps", "BRIMM Video Studio.app"), "--root", join(m.home, "The BRIMM DB", "BRIMM Video")];
      const second = ["--yes", "--tools", m.tools];
      const none = [];
      for (const args of [first, none, second]) assert.equal(spawnSync(m.programs.installer[0], args, { encoding: "utf8" }).status, 0);
      assert.deepEqual(installCalls(m.ran()), [first, none, second]);
      assert.match(m.ran(), /^installer --print --machine Studio Test --app /m, "ran() still reads as text");
    });
  });
});

describe("this Mac's name", () => {
  it("the suggested name is this Mac's ComputerName, trimmed", () => {
    withMac({}, (m) => {
      writeFileSync(join(m.dir, "says", "scutil"), "Sallie's MacBook Pro\n");
      assert.equal(nameSuggestion({ programs: m.programs }), "Sallie's MacBook Pro");
      assert.match(m.ran(), /^scutil --get ComputerName$/m);
    });
  });

  it("a ComputerName that machineFault refuses, or a scutil that fails, suggests nothing", () => {
    withMac({}, (m) => {
      writeFileSync(join(m.dir, "says", "scutil"), "Mac/Studio\n");
      assert.equal(nameSuggestion({ programs: m.programs }), "");
      writeFileSync(join(m.dir, "says", "scutil"), "Fine Name\n");
      writeFileSync(join(m.dir, "exits", "scutil"), "1");
      assert.equal(nameSuggestion({ programs: m.programs }), "");
    });
  });

  it("the names in use come from the brackets, and no episode's folder is given back", () => {
    withMac({ dropbox: false }, (m) => {
      for (const name of [join("Episodes", "2026-11-01 Client Jane (Old Mac)"), join("Episodes", "2026-11-02 Group (Old Mac)-2"), join("Episodes", "Loose folder"), join("Drop", "Laptop"), join("Unedited Video", "Mac Studio")]) mkdirSync(join(m.root, name), { recursive: true });
      const names = namesInUse(m.root);
      assert.deepEqual(names, ["Laptop", "Mac Studio", "Old Mac"]);
      for (const name of names) assert.doesNotMatch(name, /Jane|Group|2026/);
    });
  });

  it("a root with no folders gives no names", () => {
    withMac({ dropbox: false }, (m) => assert.deepEqual(namesInUse(m.root), []));
  });

  it("a name already in use gives a warning, whatever its case, and a new name gives none", () => {
    withMac({}, (m) => {
      assert.equal(nameClash("old mac", m.root), 'Another Mac already uses the name "old mac" in BRIMM Video. Two Macs with one name would share a drop folder: choose another name, unless this is that Mac being set up again.');
      assert.equal(nameClash("New Mac", m.root), "");
    });
  });
});

describe("the search for BRIMM Video in Dropbox", () => {
  const places = [
    ["Library/CloudStorage/Dropbox"],
    ["Library/CloudStorage/Dropbox-Team", "Jason Ogden"],
    ["Dropbox"],
    ["Dropbox (Personal)", "Jason Ogden"]
  ];
  for (const place of places) {
    it(`finds BRIMM Video in ${[...place, "The BRIMM DB"].join("/")}`, () => {
      withMac({ dropbox: false }, (m) => {
        const folder = join(m.home, ...place, "The BRIMM DB", "BRIMM Video");
        mkdirSync(folder, { recursive: true });
        assert.deepEqual(brimmVideoFolders(m.home), [folder]);
      });
    });
  }

  it("looks in the four places in order, and counts one folder once, by its real path", () => {
    withMac({ dropbox: false }, (m) => {
      const real = join(m.home, "Library", "CloudStorage", "Dropbox", "The BRIMM DB", "BRIMM Video");
      mkdirSync(real, { recursive: true });
      symlinkSync(join(m.home, "Library", "CloudStorage", "Dropbox"), join(m.home, "Dropbox"));
      assert.deepEqual(brimmVideoFolders(m.home), [real]);
      const other = join(m.home, "Dropbox (Old)", "The BRIMM DB", "BRIMM Video");
      mkdirSync(other, { recursive: true });
      assert.deepEqual(brimmVideoFolders(m.home), [real, other]);
    });
  });

  it("gives folders only", () => {
    withMac({ dropbox: false }, (m) => {
      mkdirSync(join(m.home, "Dropbox", "The BRIMM DB"), { recursive: true });
      writeFileSync(join(m.home, "Dropbox", "The BRIMM DB", "BRIMM Video"), "not a folder");
      assert.deepEqual(brimmVideoFolders(m.home), []);
    });
  });

  it("a home with no Dropbox finds nothing", () => {
    withMac({ dropbox: false }, (m) => assert.deepEqual(brimmVideoFolders(m.home), []));
  });

  it("says what to do when none is found", () => {
    assert.deepEqual(NO_BRIMM_VIDEO, ["BRIMM Video was not found in Dropbox on this Mac.", 'Open Dropbox, sign in to The BRIMM\'s account, and wait until "The BRIMM DB" shows in Finder.', "Then choose Look again."]);
  });

  it("looks as move.zsh's search_brimm_video looks", () => {
    const move = readFileSync(fileURLToPath(new URL("../move-app/move.zsh", import.meta.url)), "utf8");
    const body = move.slice(move.indexOf("search_brimm_video() {"));
    for (const glob of ['Library/CloudStorage/Dropbox*/"The BRIMM DB/BRIMM Video"(N/)', 'Library/CloudStorage/Dropbox*/*/"The BRIMM DB/BRIMM Video"(N/)', '$HOME/Dropbox*/"The BRIMM DB/BRIMM Video"(N/)', '$HOME/Dropbox*/*/"The BRIMM DB/BRIMM Video"(N/)']) assert.ok(body.includes(glob), glob);
  });
});

describe("the apps on this Mac", () => {
  it("the apps are looked for in /Applications and in the home's Applications", () => {
    withMac({ apps: ["dropbox"] }, (m) => {
      const system = join(m.dir, "System Applications");
      mkdirSync(join(system, "HyperFrames.app"), { recursive: true });
      assert.deepEqual(appsHere({ home: m.home, system }), { "claude-app": false, dropbox: true, hyperframes: true });
      assert.deepEqual(appsHere({ home: m.home, system: join(m.dir, "nothing") }), { "claude-app": false, dropbox: true, hyperframes: false });
    });
  });

  it("the links are the three pinned ones", () => {
    const by = Object.fromEntries(APPS.map((app) => [app.id, app]));
    assert.deepEqual(APPS.map((app) => app.id), ["claude-app", "claude-code", "dropbox", "hyperframes"]);
    assert.equal(by["claude-app"].link, "https://claude.ai/download");
    assert.equal(by.dropbox.link, "https://www.dropbox.com/install");
    assert.equal(by.hyperframes.link, "https://hyperframes.dev/studio/download");
    assert.equal(by["claude-code"].link, undefined);
    assert.deepEqual(APPS.map((app) => app.name), ["Claude", "Claude Code", "Dropbox", "HyperFrames"]);
    assert.deepEqual([by["claude-app"].folder, by.dropbox.folder, by.hyperframes.folder], ["Claude.app", "Dropbox.app", "HyperFrames.app"]);
    assert.equal(by.hyperframes.note, "HyperFrames asks you to sign in to HeyGen the first time it opens.");
    for (const id of ["claude-app", "dropbox", "hyperframes"]) assert.match(by[id].link, /^https:/);
    assert.equal(APPS.filter((app) => app.administrator).length, 3);
    for (const app of APPS.filter((app) => app.link)) assert.equal(app.administrator, "If this Mac asks for an administrator's password, drag the app into the Applications folder inside your home folder instead.");
  });
});

describe("Claude Code on this Mac", () => {
  const exe = (file) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "#!/bin/sh\n");
    chmodSync(file, 0o755);
  };

  it("Claude Code is looked for where install.sh looks", () => {
    withMac({ claude: "none" }, (m) => {
      const tools = join(m.dir, "tools-here");
      const system = [join(m.dir, "sys1"), join(m.dir, "sys2")];
      assert.equal(claudeAt({ home: m.home, tools, system }), null);
      exe(join(m.home, ".local", "bin", "claude"));
      assert.equal(claudeAt({ home: m.home, tools, system }), join(m.home, ".local", "bin", "claude"));
      exe(join(system[1], "claude"));
      assert.equal(claudeAt({ home: m.home, tools, system }), join(system[1], "claude"));
      exe(join(system[0], "claude"));
      assert.equal(claudeAt({ home: m.home, tools, system }), join(system[0], "claude"));
      exe(join(tools, "claude"));
      assert.equal(claudeAt({ home: m.home, tools, system }), join(tools, "claude"));
      chmodSync(join(tools, "claude"), 0o644);
      assert.equal(claudeAt({ home: m.home, tools, system }), join(system[0], "claude"));
    });
    assert.match(INSTALL.slice(INSTALL.indexOf("find_claude() {")), /\$HOME\/\.local\/bin/);
  });

  it("versions compare by their three numbers", () => {
    assert.equal(versionAtLeast("2.1.295", "2.1.295"), true);
    assert.equal(versionAtLeast("2.1.296", "2.1.295"), true);
    assert.equal(versionAtLeast("2.2.0", "2.1.295"), true);
    assert.equal(versionAtLeast("3.0.0", "2.1.295"), true);
    assert.equal(versionAtLeast("2.1.294", "2.1.295"), false);
    assert.equal(versionAtLeast("2.0.999", "2.1.295"), false);
    assert.equal(versionAtLeast("", "2.1.295"), false);
    assert.equal(versionAtLeast(null, "2.1.295"), false);
  });

  it("Claude Code's state: not here, too old, signed out, signed in with its plan", () => {
    const state = (claude) => withMac({ claude }, (m) => claudeState({ home: m.home, tools: m.tools }));
    assert.deepEqual(state("none"), { here: false, where: null, version: null, enough: false, signedIn: false, plan: null });
    withMac({ claude: "old" }, (m) => {
      assert.deepEqual(claudeState({ home: m.home, tools: m.tools }), { here: true, where: join(m.home, ".local", "bin", "claude"), version: "2.0.0", enough: false, signedIn: true, plan: "max" });
    });
    withMac({ claude: "signed-out" }, (m) => {
      assert.deepEqual(claudeState({ home: m.home, tools: m.tools }), { here: true, where: join(m.home, ".local", "bin", "claude"), version: "2.1.296", enough: true, signedIn: false, plan: null });
    });
    withMac({ claude: "signed-in" }, (m) => {
      assert.deepEqual(claudeState({ home: m.home, tools: m.tools }), { here: true, where: join(m.home, ".local", "bin", "claude"), version: "2.1.296", enough: true, signedIn: true, plan: "max" });
    });
  });

  it("a claude that prints nothing that can be read is signed out", () => {
    withMac({ claude: "signed-in" }, (m) => {
      writeFileSync(join(m.dir, "says", "claude-status"), "not json at all");
      writeFileSync(join(m.dir, "says", "claude-version"), "no number here\n");
      const s = claudeState({ home: m.home, tools: m.tools });
      assert.equal(s.signedIn, false);
      assert.equal(s.plan, null);
      assert.equal(s.version, null);
      assert.equal(s.enough, false);
    });
  });

  it("Claude Code's state never carries the email or the organisation", () => {
    for (const claude of ["signed-in", "signed-out", "old"]) {
      withMac({ claude }, (m) => {
        const s = claudeState({ home: m.home, tools: m.tools });
        const text = JSON.stringify(s);
        assert.ok(!text.includes("jane@example.invalid") && !text.includes("Example Org"));
        assert.deepEqual(Object.keys(s).sort(), ["enough", "here", "plan", "signedIn", "version", "where"]);
      });
    }
  });

  it("claude is run with an environment built from scratch", () => {
    withMac({ claude: "signed-in" }, (m) => {
      const seen = [];
      const run = (file, args, options) => {
        seen.push({ file, args, env: options.env });
        return spawnSync(file, args, options);
      };
      process.env.BRIMM_LEAK = "yes";
      try {
        claudeState({ home: m.home, tools: m.tools, run });
      } finally {
        delete process.env.BRIMM_LEAK;
      }
      assert.deepEqual(seen.map((c) => c.args), [["--version"], ["auth", "status", "--json"]]);
      for (const c of seen) assert.deepEqual(c.env, { HOME: m.home, PATH: `${m.tools}:/usr/bin:/bin`, LANG: "en_US.UTF-8" });
    });
  });

  it("the engine's floor for Claude Code is install.sh's", () => {
    assert.equal(GUARD_CLAUDE, "2.1.295");
    assert.equal(INSTALL.match(/^GUARD_CLAUDE="([^"]*)"$/m)[1], GUARD_CLAUDE);
  });
});
