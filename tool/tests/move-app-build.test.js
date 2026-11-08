// The "Move to Studio" app's launcher and its build. The build is run from a copy of tool/move-app/ committed into a temporary
// git repo, so its checks of the commit see a repo made for the test, with stand-ins first on its PATH for swiftc, security,
// codesign, xcrun, osascript and open: each records "name args" into a `ran` file. No test runs the real security, codesign,
// osascript, open or xcrun, and nothing is sent to Apple. The one real compiler call is the typecheck of the launcher, and only
// where swiftc is. The tests need a Mac (plutil, ditto, xattr); anywhere else they skip themselves and say why.
import { before, after, describe, it } from "node:test";
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
  // It also marks its output with an extended attribute, as a real build can: a zip made without --norsrc --noextattr then holds a ._ entry.
  standIn(bin, "swiftc", 'while [ $# -gt 0 ]; do if [ "$1" = -o ]; then shift; printf x > "$1"; /usr/bin/xattr -w com.example.mark yes "$1"; fi; shift; done\n');
  standIn(bin, "security", `printf '%s\\n' '${identities.join("' '")}' '     ${identities.length} valid identities found'\n`);
  standIn(bin, "codesign", "");
  standIn(bin, "xcrun", "");
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
    // The helper, as the bundle has it, a level up from Resources: Contents/Helpers/Choose a Folder.app.
    const helper = join(w.dir, "Helpers", "Choose a Folder.app");
    mkdirSync(join(helper, "Contents", "MacOS"), { recursive: true });
    mkdirSync(join(helper, "Contents", "_CodeSignature"));
    writeFileSync(join(helper, "Contents", "Info.plist"), "<plist>helper</plist>\n");
    writeFileSync(join(helper, "Contents", "MacOS", "Choose a Folder"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(join(helper, "Contents", "_CodeSignature", "CodeResources"), "seal\n");
    return { w, res, helper, go: (...args) => run("/bin/zsh", [join(res, "open-in-terminal.zsh"), ...args], { env: w.env, cwd: w.dir }) };
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
      // The copied script may carry what marks it likes: zsh runs it anyway. What keeps Terminal quiet is the fresh .command above, and
      // nothing here clears marks (the step that did was not needed).
      assert.equal(readFileSync(join(MOVE_APP, "open-in-terminal.zsh"), "utf8").includes("xattr"), false);
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

  /** The folder Terminal was opened on, from the stand-in open's record. */
  function openedFolder(w) {
    const line = w.ran().split("\n").find((l) => l.startsWith("open -a Terminal "));
    return line.match(/^open -a Terminal (.+)\/Move to Studio\.command$/)[1];
  }

  it("recreates the chooser beside the move script, with no quarantine mark", () => {
    const { w, res, helper, go } = resources("c".repeat(40));
    try {
      const marked = [helper, ...tree(helper).map((p) => join(helper, p))];
      for (const item of marked) run("xattr", ["-w", "com.apple.quarantine", "0081;5fa00000;Safari;", item]);
      const r = go();
      assert.equal(r.status, 0, r.stderr);
      const copy = join(openedFolder(w), "Choose a Folder.app");
      assert.deepEqual(tree(copy), tree(helper));
      for (const p of tree(helper)) {
        if (statSync(join(helper, p)).isFile()) assert.deepEqual(readFileSync(join(copy, p)), readFileSync(join(helper, p)), p);
      }
      assert.ok(statSync(join(copy, "Contents", "MacOS", "Choose a Folder")).mode & 0o100, "the program can be run");
      for (const item of [copy, ...tree(copy).map((p) => join(copy, p))]) {
        assert.equal(run("xattr", [item]).stdout.includes("com.apple.quarantine"), false, item);
      }
      const source = readFileSync(join(MOVE_APP, "open-in-terminal.zsh"), "utf8").split("\n").filter((l) => !l.trimStart().startsWith("#"));
      // No cp, ditto or xattr touches the chooser (the move script's own copy keeps its cp -X).
      for (const word of ["ditto", "xattr", "cp "]) assert.equal(source.some((l) => l.includes(word) && /chooser/.test(l)), false, word);
      assert.equal(source.some((l) => l.includes("ditto") || l.includes("xattr")), false);
    } finally {
      w.cleanup();
    }
  });

  it("shows the missing-part alert, and opens nothing, without the chooser", () => {
    const { w, helper, go } = resources("d".repeat(40));
    try {
      rmSync(helper, { recursive: true });
      const r = go();
      assert.equal(r.status, 1);
      assert.match(w.ran(), /^osascript -e display alert "Move to Studio could not open Terminal\." message "This copy of the app is missing a part\. Ask Jason for a new copy\."$/m);
      assert.equal(w.ran().includes("open -a"), false);
    } finally {
      w.cleanup();
    }
  });

  it("the copy carries app.txt with the bundle's path, and the .command is unchanged", () => {
    const { w, res, go } = resources("f".repeat(40));
    try {
      const r = go("--try-chooser");
      assert.equal(r.status, 0, r.stderr);
      const folder = openedFolder(w);
      assert.equal(readFileSync(join(folder, "app.txt"), "utf8"), `${dirname(dirname(res))}\n`);
      assert.equal(readFileSync(join(folder, "Move to Studio.command"), "utf8"), `#!/bin/zsh\n/bin/zsh '${folder}/move.zsh' --try-chooser\n`);
    } finally {
      w.cleanup();
    }
  });

  it("--try-chooser, and --try-chooser --second-way, write the try's .command; other arguments are passed over", () => {
    const commit = "e".repeat(40);
    const cases = [
      [["--try-chooser"], (f) => `/bin/zsh '${f}/move.zsh' --try-chooser\n`],
      [["--try-chooser", "--second-way"], (f) => `/bin/zsh '${f}/move.zsh' --try-chooser --second-way\n`],
      [["-psn_0_1", "--try-chooser", "x"], (f) => `/bin/zsh '${f}/move.zsh' --try-chooser\n`],
      [["--second-way"], (f) => `/bin/zsh '${f}/move.zsh' --commit ${commit}\n`],
      [["nonsense"], (f) => `/bin/zsh '${f}/move.zsh' --commit ${commit}\n`],
    ];
    for (const [args, expected] of cases) {
      const { w, go } = resources(commit);
      try {
        const r = go(...args);
        assert.equal(r.status, 0, r.stderr);
        const folder = openedFolder(w);
        const text = readFileSync(join(folder, "Move to Studio.command"), "utf8");
        assert.ok(text.includes(expected(folder)), `${args.join(" ")}: ${text}`);
        if (args.includes("--try-chooser")) assert.equal(text.includes("--commit"), false, "a try has no --commit");
      } finally {
        w.cleanup();
      }
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
      // Without --sign the bundle is still sealed, with an ad-hoc signature, so that another Mac sees a plain "rejected" and not "damaged".
      const calls = w.ran().split("\n");
      const adhoc = calls.indexOf(`codesign --force --sign - --timestamp=none ${w.app}`);
      assert.ok(adhoc >= 0, w.ran());
      assert.equal(calls[adhoc + 1], `codesign --verify --strict --verbose=2 ${w.app}`);
      assert.equal(/^codesign .*--options runtime|^codesign .*--timestamp /m.test(w.ran()), false, "no Developer ID signing, and nothing sent to Apple's timestamp server");
      assert.equal(/^security /m.test(w.ran()), false, "the keychain is not asked without --sign");
    } finally {
      w.cleanup();
    }
  });

  it("builds the chooser into the bundle, with its Info.plist, after the launcher", () => {
    const w = world();
    try {
      const r = w.build("--out", w.out);
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const swifts = w.ran().split("\n").filter((l) => l.startsWith("swiftc "));
      assert.equal(swifts.length, 2, w.ran());
      assert.match(swifts[0], /launcher\.swift$/);
      const m = swifts[1].match(/^swiftc -O -target arm64-apple-macos13\.0 -module-cache-path (\S+) -o (.+\/Contents\/Helpers\/Choose a Folder\.app\/Contents\/MacOS\/Choose a Folder) (\S+\/choose-folder\.swift)$/);
      assert.ok(m, swifts[1]);
      assert.ok(m[1].startsWith(`${w.tmp}/`), "the module cache is in a temporary folder");
      const helper = join(w.app, "Contents", "Helpers", "Choose a Folder.app");
      assert.equal(m[2], join(helper, "Contents", "MacOS", "Choose a Folder"));
      assert.equal(m[3], join(w.repo, "tool", "move-app", "choose-folder.swift"));
      assert.ok(statSync(m[2]).mode & 0o100, "the program can be run");
      const plist = join(helper, "Contents", "Info.plist");
      assert.equal(run("plutil", ["-lint", plist]).status, 0);
      assert.deepEqual(JSON.parse(run("plutil", ["-convert", "json", "-o", "-", plist]).stdout), {
        CFBundleExecutable: "Choose a Folder",
        CFBundleIdentifier: "com.thebrimm.move-to-studio.choose-folder",
        CFBundleName: "Choose a Folder",
        CFBundleDisplayName: "Choose a Folder",
        CFBundlePackageType: "APPL",
        CFBundleInfoDictionaryVersion: "6.0",
        CFBundleShortVersionString: "1.0",
        CFBundleVersion: "1",
        LSMinimumSystemVersion: "13.0",
      });
      const listing = run("/usr/bin/unzip", ["-Z1", w.zip]).stdout.split("\n");
      assert.ok(listing.includes("Move to Studio.app/Contents/Helpers/Choose a Folder.app/Contents/MacOS/Choose a Folder"), listing.join("\n"));
      assert.deepEqual(listing.filter((e) => e.startsWith("._") || e.includes("/._")), []);
    } finally {
      w.cleanup();
    }
  });

  it("signs the chooser first, with its own identifier, the hardened runtime and a timestamp, and verifies it", () => {
    const w = world();
    try {
      const r = w.build("--out", w.out, "--sign");
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const lines = w.ran().split("\n");
      const helper = join(w.app, "Contents", "Helpers", "Choose a Folder.app");
      const sign = lines.indexOf(`codesign --force --options runtime --timestamp --identifier com.thebrimm.move-to-studio.choose-folder --sign ${NAME} ${helper}`);
      assert.ok(sign >= 0, w.ran());
      assert.equal(lines[sign + 1], `codesign --verify --strict --verbose=2 ${helper}`);
      const app = lines.indexOf(`codesign --force --options runtime --timestamp --sign ${NAME} ${w.app}`);
      assert.ok(app > sign + 1, "the app is signed after the chooser");
      assert.equal(lines[app + 1], `codesign --verify --strict --verbose=2 ${w.app}`);
    } finally {
      w.cleanup();
    }
  });

  it("seals the chooser ad hoc without --sign, before the app", () => {
    const w = world();
    try {
      assert.equal(w.build("--out", w.out).status, 0);
      const lines = w.ran().split("\n");
      const helper = join(w.app, "Contents", "Helpers", "Choose a Folder.app");
      const seal = lines.indexOf(`codesign --force --sign - --timestamp=none --identifier com.thebrimm.move-to-studio.choose-folder ${helper}`);
      assert.ok(seal >= 0, w.ran());
      assert.equal(lines[seal + 1], `codesign --verify --strict --verbose=2 ${helper}`);
      const app = lines.indexOf(`codesign --force --sign - --timestamp=none ${w.app}`);
      assert.ok(app > seal + 1, "the app is sealed after the chooser");
    } finally {
      w.cleanup();
    }
  });

  it("zips with --norsrc --noextattr, and prints the same for after stapling", () => {
    const w = world();
    try {
      // The stand-in swiftc marks its output with an extended attribute: a zip made the old way would hold a ._ entry.
      const r = w.build("--out", w.out, "--sign");
      assert.equal(r.status, 0, r.stdout + r.stderr);
      const listing = run("/usr/bin/unzip", ["-Z1", w.zip]).stdout.split("\n");
      assert.deepEqual(listing.filter((e) => e.startsWith("._") || e.includes("/._")), []);
      assert.ok(r.stdout.includes(`ditto -c -k --norsrc --noextattr --keepParent "${w.app}" "${w.zip}"`), r.stdout);
      assert.equal(r.stdout.includes("ditto -c -k --keepParent"), false);
      const source = readFileSync(join(MOVE_APP, "build-app.sh"), "utf8");
      assert.equal(source.includes("ditto -c -k --keepParent"), false);
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
      assert.match(r.stdout + r.stderr, /git fetch/);
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
      assert.ok(r.stdout.includes(`ditto -c -k --norsrc --noextattr --keepParent "${w.app}" "${w.zip}"`));
      // The stand-in xcrun would note any call: there is none.
      for (const word of ["xcrun", "notarytool", "stapler"]) assert.equal(w.ran().includes(word), false);
      // And the script's own text: those two commands are only ever inside a print line.
      const source = readFileSync(join(MOVE_APP, "build-app.sh"), "utf8").split("\n");
      for (const word of ["notarytool submit", "stapler staple"]) {
        const lines = source.filter((l) => l.includes(word) && !l.trimStart().startsWith("#"));
        assert.ok(lines.length > 0, word);
        for (const l of lines) assert.ok(l.trimStart().startsWith("print "), `only printed: ${l}`);
      }
    } finally {
      w.cleanup();
    }
  });

  it("says it is not signed with the Developer ID when --sign is not given, and what to expect from AirDrop and a USB stick", () => {
    const w = world();
    try {
      const r = w.build("--out", w.out);
      assert.match(r.stdout, /not signed with the Developer ID/i);
      assert.match(r.stdout, /AirDrop/);
      assert.match(r.stdout, /System Settings › Privacy & Security › Open Anyway/);
      assert.match(r.stdout, /USB stick it asks nothing/);
      assert.match(r.stdout, /--sign for the copy that goes to Sallie/);
      assert.equal(r.stdout.includes("notarytool"), false);
    } finally {
      w.cleanup();
    }
  });
});

// The one real program the tests probe: whether a compiler is there. xcrun --find says, on a Mac with the command line tools.
const swiftc = notAMac ? { status: 1, stdout: "" } : run("xcrun", ["--find", "swiftc"]);
describe("launcher.swift and choose-folder.swift", { skip: notAMac || (swiftc.status !== 0 ? "there is no swiftc here" : false) }, () => {
  // One module cache for every compile here, made once.
  let cache;
  before(() => { cache = mkdtempSync(join(tmpdir(), "brimm-swift-cache-")); });
  after(() => { rmSync(cache, { recursive: true, force: true }); });

  it("the launcher compiles", () => {
    const r = run("swiftc", ["-typecheck", "-module-cache-path", cache, join(MOVE_APP, "launcher.swift")]);
    assert.equal(r.status, 0, r.stderr);
  });

  it("the launcher passes on --try-chooser alone", () => {
    const source = readFileSync(join(MOVE_APP, "launcher.swift"), "utf8");
    assert.ok(source.includes('helper.arguments = [resources + "/open-in-terminal.zsh"] + (CommandLine.arguments.dropFirst().contains("--try-chooser") ? ["--try-chooser"] : [])'));
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-launcher-")));
    try {
      const program = join(dir, "Fake.app", "Contents", "MacOS", "Fake");
      const resources = join(dir, "Fake.app", "Contents", "Resources");
      mkdirSync(dirname(program), { recursive: true });
      mkdirSync(resources);
      writeFileSync(join(dir, "Fake.app", "Contents", "Info.plist"), '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleExecutable</key><string>Fake</string><key>CFBundleIdentifier</key><string>com.example.fake</string></dict></plist>\n');
      writeFileSync(join(resources, "open-in-terminal.zsh"), `#!/bin/zsh\nprint -r -- "$#:$*" > ${JSON.stringify(join(dir, "args"))}\n`);
      const c = run("swiftc", ["-module-cache-path", cache, "-o", program, join(MOVE_APP, "launcher.swift")]);
      assert.equal(c.status, 0, c.stderr);
      for (const [args, expected] of [[["--try-chooser", "-psn_0_1", "x"], "1:--try-chooser"], [[], "0:"]]) {
        const r = run(program, args, { timeout: 10000 });
        assert.equal(r.status, 0, r.stderr);
        assert.equal(readFileSync(join(dir, "args"), "utf8").trim(), expected, args.join(" "));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the chooser compiles at its real target, and with no arguments ends 2 within 10 seconds, opening nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-chooser-"));
    try {
      const program = join(dir, "Choose a Folder");
      const c = run("swiftc", ["-O", "-target", "arm64-apple-macos13.0", "-module-cache-path", cache, "-o", program, join(MOVE_APP, "choose-folder.swift")]);
      assert.equal(c.status, 0, c.stderr);
      // Only the ways that open no window: never a real message and an existing start folder.
      for (const args of [[], ["a message", join(dir, "not there")], ["a message", join(dir, "not there"), join(dir, "result"), "1"]]) {
        const r = run(program, args, { timeout: 10000 });
        assert.equal(r.error, undefined, `no timeout: ${r.error}`);
        assert.equal(r.status, 2, r.stderr);
        assert.equal(r.stdout, "");
        assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
        assert.equal(existsSync(join(dir, "result")), false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the chooser's line-break check sees a carriage return, a line feed and CRLF, as scalars", () => {
    const source = readFileSync(join(MOVE_APP, "choose-folder.swift"), "utf8");
    const fn = source.match(/func holdsLineBreak[\s\S]*?\n}\n/);
    assert.ok(fn, "holdsLineBreak is there");
    assert.equal(source.includes('contains("\\n")'), false, "no Character check of a line feed");
    const dir = mkdtempSync(join(tmpdir(), "brimm-linebreak-"));
    try {
      const file = join(dir, "main.swift");
      writeFileSync(file, `import Foundation\n${fn[0]}\nfor p in ["/a/b", "/a\\nb", "/a\\rb", "/a\\r\\nb"] { print(holdsLineBreak(p)) }\n`);
      const program = join(dir, "t");
      const c = run("swiftc", ["-module-cache-path", cache, "-o", program, file]);
      assert.equal(c.status, 0, c.stderr);
      assert.equal(run(program, [], { timeout: 10000 }).stdout, "false\ntrue\ntrue\ntrue\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the chooser has an Edit menu, so its boxes take Command-V, -C, -X, -A, -Z and the emoji picker", () => {
    const source = readFileSync(join(MOVE_APP, "choose-folder.swift"), "utf8");
    const fn = source.match(/func makeMainMenu[\s\S]*?\n}\n/);
    assert.ok(fn, "makeMainMenu is there");
    const dir = mkdtempSync(join(tmpdir(), "brimm-menu-"));
    try {
      const file = join(dir, "main.swift");
      const printer = [
        "let menu = makeMainMenu()",
        "for top in menu.items {",
        "    guard let sub = top.submenu else { continue }",
        '    print("menu:" + sub.title)',
        "    for item in sub.items {",
        "        if item.isSeparatorItem { print(\"-\"); continue }",
        "        let action = item.action.map { NSStringFromSelector($0) } ?? \"\"",
        '        print("\\(item.title)|\\(item.keyEquivalent)|\\(item.keyEquivalentModifierMask.rawValue)|\\(action)")',
        "    }",
        "}",
      ].join("\n");
      writeFileSync(file, `import AppKit\n_ = NSApplication.shared\n${fn[0]}\n${printer}\n`);
      const program = join(dir, "t");
      const c = run("swiftc", ["-module-cache-path", cache, "-o", program, file]);
      assert.equal(c.status, 0, c.stderr);
      assert.equal(
        run(program, [], { timeout: 10000 }).stdout,
        [
          "menu:Choose a Folder",
          "menu:Edit",
          "Undo|z|1048576|undo:",
          "Redo|z|1179648|redo:",
          "-",
          "Cut|x|1048576|cut:",
          "Copy|c|1048576|copy:",
          "Paste|v|1048576|paste:",
          "Select All|a|1048576|selectAll:",
          "-",
          "Emoji & Symbols| |1310720|orderFrontCharacterPalette:",
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the chooser sets that menu as it launches, and registers, never sets, the default that keeps AppKit's own emoji item out", () => {
    const source = readFileSync(join(MOVE_APP, "choose-folder.swift"), "utf8");
    assert.ok(source.includes("func applicationWillFinishLaunching(_ notification: Notification) { NSApp.mainMenu = makeMainMenu() }"));
    const register = 'UserDefaults.standard.register(defaults: ["NSDisabledCharacterPaletteMenuItem": true])';
    assert.ok(source.includes(register));
    assert.equal(source.includes(".set("), false, "no default is ever set");
    assert.ok(source.indexOf(register) < source.indexOf("app.run()"), "registered before the app runs");
  });
});
