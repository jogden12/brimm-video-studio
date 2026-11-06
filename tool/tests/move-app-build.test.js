// The "Move to Studio" app's launcher and its build. The build is run from a copy of tool/move-app/ committed into a temporary
// git repo, so its checks of the commit see a repo made for the test, with stand-ins first on its PATH for swiftc, security,
// codesign, osascript and open: each records "name args" into a `ran` file. No test runs the real security, codesign,
// osascript, open or xcrun, and nothing is sent to Apple. The one real compiler call is the typecheck of the launcher, and only
// where swiftc is. The tests need a Mac (plutil, ditto, xattr); anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MOVE_APP = fileURLToPath(new URL("../move-app/", import.meta.url));
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") ? "the app is built on a Mac, which has zsh, plutil, ditto and xattr" : false;
const NAME = "Developer ID Application: Jason Ogden (TEAMID)";
const IDENTITY = `  1) 1111111111111111111111111111111111111111 "${NAME}"`;
const OTHER = `  2) 2222222222222222222222222222222222222222 "Apple Development: Jason Ogden (OTHERID)"`;
const run = (cmd, args, options = {}) => spawnSync(cmd, args, { encoding: "utf8", ...options });

/** Every file and folder under `dir`, as paths from it, sorted. */
function tree(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    out.push(path.slice(base.length + 1));
    if (entry.isDirectory()) out.push(...tree(path, base));
  }
  return out.sort();
}

function standIn(bin, name, body) {
  writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "$RAN"\n${body}`);
  chmodSync(join(bin, name), 0o755);
}

/** A world for one test: a temporary folder with a repo holding a copy of tool/move-app/, committed, `bin/` of stand-ins, `tmp/` as
    TMPDIR and `out/` to build into. `identities` is what the stand-in security lists. Gives back `build(...args)`, which runs the
    copy's build-app.sh, and the pieces a test looks at. */
function world({ identities = [IDENTITY], behind = false } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-move-build-")));
  const repo = join(dir, "repo");
  const bin = join(dir, "bin");
  const tmp = join(dir, "tmp");
  const out = join(dir, "out");
  for (const d of [repo, bin, tmp]) mkdirSync(d);
  mkdirSync(join(repo, "tool"));
  cpSync(MOVE_APP, join(repo, "tool", "move-app"), { recursive: true });
  const git = (...args) => {
    const r = run("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "-C", repo, ...args], { env: { PATH: "/usr/bin:/bin", HOME: dir } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git("init", "-q", "-b", "main");
  git("add", ".");
  git("commit", "-q", "-m", "one");
  const first = git("rev-parse", "HEAD");
  writeFileSync(join(repo, "other.txt"), "more\n");
  git("add", ".");
  git("commit", "-q", "-m", "two");
  const head = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", behind ? first : head);
  standIn(bin, "swiftc", 'while [ $# -gt 0 ]; do if [ "$1" = -o ]; then shift; printf x > "$1"; fi; shift; done\n');
  standIn(bin, "security", `printf '%s\\n' '${identities.join("' '")}' '     ${identities.length} valid identities found'\n`);
  standIn(bin, "codesign", "");
  standIn(bin, "osascript", "");
  standIn(bin, "open", "");
  const env = { PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`, HOME: join(dir, "home"), TMPDIR: tmp, RAN: join(dir, "ran") };
  const script = join(repo, "tool", "move-app", "build-app.sh");
  return {
    dir, repo, tmp, out, head, first, bin, env, git,
    app: join(out, "Move to Studio.app"),
    zip: join(out, "Move to Studio.zip"),
    ran: () => (existsSync(join(dir, "ran")) ? readFileSync(join(dir, "ran"), "utf8") : ""),
    build: (...args) => run("/bin/zsh", [script, ...args], { env, cwd: dir }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("open-in-terminal.zsh", { skip: notAMac }, () => {
  /** A Resources folder as the bundle has it: the move script, the helper, and the commit unless `commit` is null. */
  function resources(commit) {
    const w = world();
    const res = join(w.dir, "Resources");
    mkdirSync(res);
    cpSync(join(MOVE_APP, "move.zsh"), join(res, "move.zsh"));
    cpSync(join(MOVE_APP, "open-in-terminal.zsh"), join(res, "open-in-terminal.zsh"));
    if (commit) writeFileSync(join(res, "commit.txt"), `${commit}\n`);
    return { w, res, go: () => run("/bin/zsh", [join(res, "open-in-terminal.zsh")], { env: w.env, cwd: w.dir }) };
  }

  it("opens Terminal on a fresh .command that runs a copy of the move script with the app's commit", () => {
    const commit = "a".repeat(40);
    const { w, res, go } = resources(commit);
    try {
      // A quarantine mark on the source: the copy must not carry it.
      run("xattr", ["-w", "com.apple.quarantine", "0081;5fa00000;Safari;", join(res, "move.zsh")]);
      const r = go();
      assert.equal(r.status, 0, r.stderr);
      const opened = w.ran().split("\n").filter((l) => l.startsWith("open "));
      assert.equal(opened.length, 1);
      const m = opened[0].match(/^open -a Terminal (.+\/move-to-studio\.[^/]+)\/Move to Studio\.command$/);
      assert.ok(m, opened[0]);
      const folder = m[1];
      assert.ok(folder.startsWith(`${w.tmp}/move-to-studio.`), folder);
      const command = join(folder, "Move to Studio.command");
      assert.ok(statSync(command).mode & 0o100, "the .command can be run");
      assert.equal(run("xattr", [command]).stdout.includes("com.apple.quarantine"), false);
      assert.equal(run("xattr", [join(folder, "move.zsh")]).stdout.includes("com.apple.quarantine"), false);
      assert.ok(readFileSync(command, "utf8").includes(`/bin/zsh '${folder}/move.zsh' --commit ${commit}\n`), readFileSync(command, "utf8"));
      assert.deepEqual(readFileSync(join(folder, "move.zsh")), readFileSync(join(res, "move.zsh")));
      assert.equal(w.ran().includes("osascript"), false);
    } finally {
      w.cleanup();
    }
  });

  it("quotes a folder path that holds a space", () => {
    const { w, res } = resources("b".repeat(40));
    try {
      const spaced = join(w.dir, "a b");
      mkdirSync(spaced);
      const r = run("/bin/zsh", [join(res, "open-in-terminal.zsh")], { env: { ...w.env, TMPDIR: spaced }, cwd: w.dir });
      assert.equal(r.status, 0, r.stderr);
      const folder = readdirSync(spaced).find((n) => n.startsWith("move-to-studio."));
      assert.ok(readFileSync(join(spaced, folder, "Move to Studio.command"), "utf8").includes(`/bin/zsh '${spaced}/${folder}/move.zsh' --commit`));
    } finally {
      w.cleanup();
    }
  });

  it("shows an alert and opens nothing without a commit", () => {
    const { w, go } = resources(null);
    try {
      const r = go();
      assert.equal(r.status, 1);
      assert.match(w.ran(), /^osascript -e display alert "Move to Studio could not open Terminal\."/m);
      assert.equal(w.ran().includes("open -a"), false);
      assert.deepEqual(readdirSync(w.tmp), []);
    } finally {
      w.cleanup();
    }
  });
});

describe("build-app.sh", { skip: notAMac }, () => {
  it("builds the bundle, its Info.plist and the commit, and writes nowhere but its folder", () => {
    const w = world();
    try {
      const before = tree(w.dir);
      const r = w.build("--out", w.out);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const plist = join(w.app, "Contents", "Info.plist");
      assert.equal(run("plutil", ["-lint", plist]).status, 0);
      const keys = JSON.parse(run("plutil", ["-convert", "json", "-o", "-", plist]).stdout);
      assert.deepEqual(keys, {
        CFBundleExecutable: "Move to Studio",
        CFBundleIdentifier: "com.thebrimm.move-to-studio",
        CFBundleName: "Move to Studio",
        CFBundleDisplayName: "Move to Studio",
        CFBundlePackageType: "APPL",
        CFBundleInfoDictionaryVersion: "6.0",
        CFBundleShortVersionString: "1.0",
        CFBundleVersion: "1",
        LSMinimumSystemVersion: "13.0",
        LSUIElement: true,
      });
      const res = join(w.app, "Contents", "Resources");
      assert.equal(readFileSync(join(res, "commit.txt"), "utf8").trim(), w.head);
      for (const f of ["move.zsh", "open-in-terminal.zsh"]) {
        assert.deepEqual(readFileSync(join(res, f)), readFileSync(join(w.repo, "tool", "move-app", f)));
      }
      const program = join(w.app, "Contents", "MacOS", "Move to Studio");
      assert.ok(statSync(program).mode & 0o100);
      const swift = w.ran().split("\n").find((l) => l.startsWith("swiftc "));
      const m = swift.match(/^swiftc -O -target arm64-apple-macos13\.0 -module-cache-path (\S+) -o (.+) (\S+\/launcher\.swift)$/);
      assert.ok(m, swift);
      assert.ok(m[1].startsWith(`${w.tmp}/`), "the module cache is in a temporary folder");
      assert.equal(m[2], program);
      assert.equal(m[3], join(w.repo, "tool", "move-app", "launcher.swift"));
      // The zip holds the app.
      const listing = run("/usr/bin/unzip", ["-Z1", w.zip]).stdout;
      assert.match(listing, /^Move to Studio\.app\/Contents\/Info\.plist$/m);
      assert.match(listing, /^Move to Studio\.app\/Contents\/MacOS\/Move to Studio$/m);
      // Nowhere else: the folder it was given, and the stand-ins' record.
      const added = tree(w.dir).filter((p) => !before.includes(p) && !p.startsWith("out") && p !== "ran");
      assert.deepEqual(added, []);
      assert.deepEqual(readdirSync(w.tmp), [], "its temporary folder is taken away");
      assert.deepEqual(readdirSync(w.out).sort(), ["Move to Studio.app", "Move to Studio.zip"]);
      assert.equal(/^codesign /m.test(w.ran()), false, "no signing without --sign");
    } finally {
      w.cleanup();
    }
  });

  it("replaces only its own two files from an earlier build", () => {
    const w = world();
    try {
      mkdirSync(w.out);
      mkdirSync(join(w.app, "stale"), { recursive: true });
      writeFileSync(join(w.out, "keep.txt"), "mine\n");
      assert.equal(w.build("--out", w.out).status, 0);
      assert.equal(existsSync(join(w.app, "stale")), false);
      assert.equal(readFileSync(join(w.out, "keep.txt"), "utf8"), "mine\n");
    } finally {
      w.cleanup();
    }
  });

  it("refuses a commit not on main, unless --any-commit, and uncommitted changes to the app's files", () => {
    const behind = world({ behind: true });
    try {
      const r = behind.build("--out", behind.out);
      assert.equal(r.status, 1);
      assert.match(r.stdout + r.stderr, /not on origin\/main/);
      assert.equal(existsSync(behind.app), false);
      assert.equal(behind.build("--out", behind.out, "--any-commit").status, 0);
      assert.equal(existsSync(behind.app), true);
    } finally {
      behind.cleanup();
    }
    const dirty = world();
    try {
      appendFileSync(join(dirty.repo, "tool", "move-app", "move.zsh"), "# changed\n");
      for (const extra of [[], ["--any-commit"]]) {
        const r = dirty.build("--out", dirty.out, ...extra);
        assert.equal(r.status, 1);
        assert.match(r.stdout + r.stderr, /not committed/);
        assert.equal(existsSync(dirty.app), false);
      }
    } finally {
      dirty.cleanup();
    }
  });

  it("refuses an option it does not know, and a missing --out", () => {
    const w = world();
    try {
      assert.equal(w.build("--out", w.out, "--nope").status, 2);
      assert.equal(w.build().status, 2);
    } finally {
      w.cleanup();
    }
  });

  it("signs with the one Developer ID Application identity, with the hardened runtime and a timestamp, and checks the signature", () => {
    const w = world({ identities: [IDENTITY, OTHER] });
    try {
      const r = w.build("--out", w.out, "--sign");
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const lines = w.ran().split("\n");
      const sign = lines.findIndex((l) => l === `codesign --force --options runtime --timestamp --sign ${NAME} ${w.app}`);
      assert.ok(sign >= 0, w.ran());
      assert.equal(lines[sign + 1], `codesign --verify --strict --verbose=2 ${w.app}`);
      assert.ok(lines.indexOf("security find-identity -v -p codesigning") >= 0);
      // The zip is made after the signing, so it holds the signed app.
      assert.equal(existsSync(w.zip), true);
    } finally {
      w.cleanup();
    }
  });

  it("refuses to sign with no identity or two, naming how many, and signs nothing", () => {
    for (const [identities, n] of [[[], 0], [[IDENTITY, IDENTITY.replace("1) 1111", "3) 3333")], 2]]) {
      const w = world({ identities });
      try {
        const r = w.build("--out", w.out, "--sign");
        assert.equal(r.status, 1);
        assert.match(r.stdout + r.stderr, new RegExp(`found ${n} Developer ID Application`));
        assert.equal(/^codesign /m.test(w.ran()), false);
        assert.equal(existsSync(w.app), false);
      } finally {
        w.cleanup();
      }
    }
  });

  it("names the notarizing steps and runs none of them", () => {
    const w = world();
    try {
      const r = w.build("--out", w.out, "--sign");
      assert.equal(r.status, 0, r.stderr);
      assert.ok(r.stdout.includes(`xcrun notarytool submit "${w.zip}" --keychain-profile "BRIMM notary" --wait`), r.stdout);
      assert.ok(r.stdout.includes(`xcrun stapler staple "${w.app}"`));
      assert.ok(r.stdout.includes(`ditto -c -k --keepParent "${w.app}" "${w.zip}"`));
      for (const word of ["xcrun", "notarytool", "stapler"]) assert.equal(w.ran().includes(word), false);
      assert.equal(w.ran().includes("ditto"), false);
    } finally {
      w.cleanup();
    }
  });

  it("says it is not signed when --sign is not given", () => {
    const w = world();
    try {
      const r = w.build("--out", w.out);
      assert.match(r.stdout, /not signed/i);
      assert.equal(r.stdout.includes("notarytool"), false);
    } finally {
      w.cleanup();
    }
  });
});

describe("launcher.swift", { skip: notAMac || run("/usr/bin/which", ["swiftc"]).status !== 0 ? notAMac || "there is no swiftc here" : false }, () => {
  it("the launcher compiles", () => {
    const cache = mkdtempSync(join(tmpdir(), "brimm-swift-cache-"));
    try {
      const r = run("swiftc", ["-typecheck", "-module-cache-path", cache, join(MOVE_APP, "launcher.swift")]);
      assert.equal(r.status, 0, r.stderr);
    } finally {
      rmSync(cache, { recursive: true, force: true });
    }
  });
});
