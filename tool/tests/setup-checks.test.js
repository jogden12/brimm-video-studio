// The setup engine's look at its own copy of the app and at the kind of Mac (tool/setup/checks.js), and the made-up Mac that its tests use.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELPERS } from "../helpers.js";
import { readSettings, writeSettings } from "../settings.js";
import { DAMAGED as INSTALL_DAMAGED, HDR_LISTS, appCopy } from "./app-copy.js";
import { installCalls, mac, notAMac, printOnly } from "./setup-harness.js";
import { DAMAGED, PROGRAMS, copyFault, kindOf } from "../setup/checks.js";

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
