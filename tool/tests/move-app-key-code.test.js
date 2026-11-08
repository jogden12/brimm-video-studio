// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  notAMac,
  EMAIL,
  ORG,
  KEY_COMMENT,
  GITHUB_HOST_KEY,
  HOST_BLOCK,
  HI,
  STOPPED_NOTHING,
  BACKGROUND,
  git,
  put,
  moveOn,
  NOT_INSTALLED,
  count
} from "./move-app-harness.js";

describe("the move script, Studio's key (check 42)", { skip: notAMac }, () => {
  const KEYFILE = (home) => `${home}/.ssh/brimm_video_studio_deploy`;

  it("makes the key on y, with exactly check 42's line, and shows and copies its public half", () => {
    const r = moveOn({ key: null, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.ran.split("\n").includes(`ssh-keygen -t ed25519 -f ${KEYFILE(r.home)} -N  -C ${KEY_COMMENT}`), r.ran);
    const pub = `ssh-ed25519 AAAAstandin ${KEY_COMMENT}\n`;
    assert.equal(r.copied, pub);
    assert.equal(r.publicCopy, pub);
    assert.ok(r.out.includes(pub.trim()));
    assert.match(r.out, /Press Return when that's done/);
    for (const text of [r.out, r.err, r.log, r.report]) assert.ok(!text.includes("PRIVATE-HALF"), "the private half is never shown");
    assert.match(r.log, /Studio's key/);
  });

  it("with --print and no key, says it would make the key, and the exact line, and changes nothing", () => {
    const r = moveOn({ key: null }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Would make Studio's key/);
    assert.ok(r.out.includes(`ssh-keygen -t ed25519 -f "${KEYFILE(r.home)}" -N "" -C "${KEY_COMMENT}"`), r.out);
    assert.ok(!r.ran.includes("ssh-keygen -t"));
    assert.deepEqual(r.tree, r.before);
    assert.ok(r.out.trimEnd().endsWith("Nothing was changed."));
  });

  it("keeps a key of that name made earlier with the same comment, and stops on one with another comment", () => {
    const same = moveOn({ key: KEY_COMMENT });
    assert.equal(same.status, 0, same.out);
    assert.match(same.out, /Already done: .*key/);
    assert.ok(!same.ran.includes("ssh-keygen -t"), same.ran);

    const other = moveOn({ key: "someone else" });
    assert.equal(other.status, 1);
    assert.ok(!other.ran.includes("ssh-keygen -t"));
    assert.ok(other.out.endsWith(STOPPED_NOTHING), other.out);
  });

  it("adds the Host entry on y, exactly, after what is there, and leaves the rest byte for byte", () => {
    const before = "Host other\n  HostName example.com";
    const r = moveOn({ sshConfig: before, answers: "y\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal(r.sshConfig, `${before}\n\n${HOST_BLOCK}`);

    const withNewline = moveOn({ sshConfig: "Host other\n  HostName example.com\n", answers: "y\n" });
    assert.equal(withNewline.sshConfig, `Host other\n  HostName example.com\n\n${HOST_BLOCK}`);

    const made = moveOn({ sshConfig: null, answers: "y\n" });
    assert.equal(made.status, 0, made.out);
    assert.equal(made.sshConfig, HOST_BLOCK);
    assert.equal(made.sshConfigMode, 0o600);

    const declined = moveOn({ sshConfig: before, answers: "n\n" });
    assert.equal(declined.status, 1);

    const again = moveOn({ sshConfig: `Host other\n  HostName example.com\n\n${HOST_BLOCK}` });
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /Already done: .*Host entry/);
    assert.equal(again.sshConfig, `Host other\n  HostName example.com\n\n${HOST_BLOCK}`);

    const different = moveOn({ sshConfig: HOST_BLOCK.replace("github.com", "example.org") });
    assert.equal(different.status, 1);
    assert.match(different.out, /Host github-brimm-video-studio/);
    assert.equal(different.sshConfig, HOST_BLOCK.replace("github.com", "example.org"), "left alone");
  });

  it("offers GitHub's published host key when this Mac has none, and stops on a different one", () => {
    const r = moveOn({ knownHosts: null, answers: "y\n" });
    assert.equal(r.status, 0, r.out);
    assert.equal(r.knownHosts, `${GITHUB_HOST_KEY}\n`);

    const declined = moveOn({ knownHosts: null, answers: "n\n" });
    assert.equal(declined.status, 1);

    const other = moveOn({ knownHosts: "github.com ssh-ed25519 AAAAOTHER\n" });
    assert.equal(other.status, 1);
    assert.match(other.out, /GitHub's key on this Mac isn't the one GitHub publishes/);
    assert.equal(other.knownHosts, "github.com ssh-ed25519 AAAAOTHER\n");
  });

  it("waits for the key to be on GitHub, then checks it with ssh, with her own files and GitHub's ed25519 key only", () => {
    const r = moveOn({ key: null, answers: "y\n\n" });
    assert.equal(r.status, 0, r.out);
    const line = `ssh -F ${r.home}/.ssh/config -o UserKnownHostsFile=${r.home}/.ssh/known_hosts -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes -n -T git@github-brimm-video-studio`;
    assert.ok(r.ran.split("\n").includes(line), r.ran);
    assert.ok(r.out.includes(HI), r.out);
    assert.match(r.out, /Settings.*Deploy keys/s);
    assert.match(r.out, /write access off/i);
    assert.equal(r.sshAsked, 1);
  });

  it("shows all of ssh's lines when it stops, and keeps the welcome line, not ssh's first line, for the report", () => {
    const banner = moveOn({ ssh: ["banner"] });
    assert.equal(banner.status, 1, banner.out);
    assert.match(banner.out, /ssh did not get GitHub's welcome for this key\. It said:/);
    assert.ok(banner.out.includes("@@@@@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@@@@@\nHost key verification failed."), banner.out);

    const noisy = moveOn({ ssh: ["noisy"] });
    assert.equal(noisy.status, 0, noisy.out);
    assert.match(noisy.report, new RegExp(`^What the check of the key printed: ${HI.replace(/[.!]/g, "\\$&")}$`, "m"));
    assert.ok(!noisy.report.includes("a first line that is not the welcome"), noisy.report);
  });

  it("asks to try again when GitHub doesn't know the key yet", () => {
    const again = moveOn({ key: null, ssh: ["denied", "ok"], answers: "y\n\n\n" });
    assert.equal(again.status, 0, again.out);
    assert.equal(again.sshAsked, 2);
    assert.equal((again.out.match(/Press Return when that's done/g) ?? []).length, 2, again.out);

    const stops = moveOn({ key: null, ssh: ["denied"], answers: "y\n\nn\n" });
    assert.equal(stops.status, 1);
    assert.equal(stops.sshAsked, 1);
    assert.ok(!/Already done: .*on GitHub/.test(stops.out));

    // A key made earlier that GitHub already knows needs no waiting.
    const known = moveOn({ answers: "" });
    assert.equal(known.status, 0, known.out);
    assert.match(known.out, /Already done: .*GitHub/);
    assert.ok(!known.out.includes("Press Return when that's done"));

  });
});

describe("the move script, Studio's code (check 42)", { skip: notAMac }, () => {
  it("clones main on y into the partial folder, puts main at the app's commit, then renames it", () => {
    const r = moveOn({ checkout: "absent", laterCommit: true, answers: "y\ny\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.studioNow, "the checkout is there");
    assert.equal(r.studioNow.branch, "main");
    assert.equal(r.studioNow.head, r.sha, "at the app's commit, though GitHub's main is further on");
    assert.equal(r.studioNow.upstream, "origin/main");
    assert.equal(r.studioNow.origin, r.github);
    assert.equal(r.partialLeft, false);
    assert.match(r.out, /3\. Studio's code \(check 42\)/);
    assert.match(r.out, new RegExp(`${r.sha.slice(0, 7)}`));
  });

  it("stops, leaving nothing, when GitHub's main doesn't hold the app's commit", () => {
    const r = moveOn({ checkout: "absent", commit: "1".repeat(40), answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.studioNow, null);
    assert.equal(r.partialLeft, false);
    assert.match(r.out, /doesn't hold the commit this app was made at/);
    assert.ok(!r.out.includes("copied Studio's code"), r.out);
  });

  it("takes away a half-made clone an earlier run left, then clones", () => {
    const r = moveOn({ checkout: "partial-left", answers: "y\ny\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /half-made/);
    assert.equal(r.partialLeft, false);
    assert.equal(r.studioNow?.head, r.sha);
    assert.ok(!r.tree.some((f) => f.includes("half-made")), "the old half-made file is gone");
  });

  it("a failed clone leaves nothing at the checkout's place", () => {
    const r = moveOn({ checkout: "absent", repoMissing: true, answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    assert.equal(r.studioNow, null);
    assert.equal(r.partialLeft, false);
    assert.match(r.out, /could not be copied/);
    assert.ok(!r.out.includes("copied Studio's code to"), r.out);
  });

  it("says already done for a clean checkout at the app's commit, and stops on any other, naming what is wrong", () => {
    const ok = moveOn({ checkout: "at-pin" });
    assert.equal(ok.status, 0, ok.out);
    assert.match(ok.out, /Already done: Studio's code is there/);

    const other = moveOn({ checkout: "other-commit" });
    assert.equal(other.status, 1);
    assert.match(other.out, /is at [0-9a-f]{7}, and this app was made at [0-9a-f]{7}/);
    const dirty = moveOn({ checkout: "dirty" });
    assert.equal(dirty.status, 1);
    assert.match(dirty.out, /has changes that aren't saved/);
    const remote = moveOn({ checkout: "other-remote" });
    assert.equal(remote.status, 1);
    assert.match(remote.out, /comes from \/somewhere\/else, not from Studio's repository/);
    const detached = moveOn({ checkout: "detached" });
    const branch = moveOn({ checkout: "other-branch" });
    for (const r of [detached, branch]) {
      assert.equal(r.status, 1, r.out);
      assert.match(r.out, /isn't on main/);
      assert.ok(!r.out.includes("Already done: Studio's code"), r.out);
    }
    assert.match(branch.out, /\(feature\)|"feature"|feature/);
    assert.equal(moveOn({ checkout: "detached" }, "--print").status, 1);
    assert.match(moveOn({ checkout: "other-branch" }, "--print").out, /isn't on main/);
    assert.equal(branch.studioNow.branch, "feature", "left alone");
    // The only thing this run changed is the Desktop copy of the key's public half (the harness has none): the checkout is untouched.
    const inCheckout = (list) => list.filter((f) => f.startsWith("Claude Code/brimm-video-studio"));
    for (const r of [other, dirty, remote]) {
      assert.ok(!r.out.includes("copied Studio's code"), r.out);
      assert.deepEqual(inCheckout(r.tree), inCheckout(r.before), "the checkout is untouched");
    }
    // A print stops in the same words.
    const printed = moveOn({ checkout: "other-commit" }, "--print");
    assert.equal(printed.status, 1);
    assert.match(printed.out, /is at [0-9a-f]{7}, and this app was made at [0-9a-f]{7}/);
  });

  it("the real clone is from check 42's address, through her own ssh files", () => {
    const r = moveOn({ checkout: "absent", gitStandIn: true, noRepo: true, answers: "y\n" });
    assert.equal(r.status, 1, r.out);
    const calls = r.ran.split("\n");
    assert.ok(calls.includes(`git clone --branch main git@github-brimm-video-studio:jogden12/brimm-video-studio.git ${r.home}/Claude Code/brimm-video-studio.partial`), r.ran);
    const via = calls.find((c) => c.startsWith("GIT_SSH_COMMAND="));
    assert.ok(via, r.ran);
    for (const part of [`-F ${r.home}/.ssh/config`, `UserKnownHostsFile=${r.home}/.ssh/known_hosts`, "StrictHostKeyChecking=yes", "HostKeyAlgorithms=ssh-ed25519", "BatchMode=yes"]) {
      assert.ok(via.includes(part), `${part} in ${via}`);
    }
    assert.equal(r.partialLeft, false, "the failed clone leaves nothing");
  });

  it("runs Studio's tests there with the spec reporter, stops when one fails, and doesn't run them again at the same commit", () => {
    const fail = moveOn({ marks: "", testFail: true });
    assert.equal(fail.status, 1, fail.out);
    assert.match(fail.out, /about 4 minutes/);
    assert.match(fail.out, /ℹ fail 1/);
    assert.match(fail.out, /✖|✔|ok/);
    assert.ok(!/tests=/.test(fail.studioNow.marks), "nothing is marked on a failure");

    const pass = moveOn({ marks: "installed=SHA\nfinder=SHA\n" });
    assert.equal(pass.status, 0, pass.out);
    assert.match(pass.out, /ℹ pass 1/);
    assert.match(pass.out, /ℹ fail 0/);
    assert.equal(pass.studioNow.marks, `installed=${pass.sha}\nfinder=${pass.sha}\ntests=${pass.sha}\n`, "only its own line is written, the rest kept");
    assert.match(pass.log, /ℹ pass 1/, "kept in the log");

    const again = moveOn({});
    assert.equal(again.status, 0, again.out);
    assert.match(again.out, /Already done: Studio's tests passed at this commit/);
    assert.ok(!again.out.includes("ℹ pass"), "not run again");

    // A mark for another commit does not count.
    const old = moveOn({ marks: `tests=${"0".repeat(40)}\n` });
    assert.match(old.out, /ℹ pass 1/);
    assert.equal(old.studioNow.marks, `tests=${old.sha}\n`);
  });

  it("with --print, says what it would clone and test, and runs and changes nothing", () => {
    const r = moveOn({ checkout: "absent", gitStandIn: true, noRepo: true, laterCommit: true }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /Would clone Studio's code with: git clone --branch main git@github-brimm-video-studio:jogden12\/brimm-video-studio\.git .*brimm-video-studio\.partial/);
    assert.match(r.out, /Would put main at [0-9a-f]{7}/);
    assert.match(r.out, /Would run Studio's tests/);
    assert.ok(!r.ran.includes("git clone"), r.ran);
    assert.deepEqual(r.tree, r.before);

    const left = moveOn({ checkout: "partial-left" }, "--print");
    assert.equal(left.status, 0, left.out);
    assert.match(left.out, /Would take away the half-made copy/);
    assert.deepEqual(left.tree, left.before, "a print takes no .partial away");

    const there = moveOn({ marks: "" }, "--print");
    assert.equal(there.status, 0, there.out);
    assert.match(there.out, /Would run Studio's tests/);
    assert.ok(!there.out.includes("ℹ pass"));
  });
});

describe("the move script, the report and brimm-video's old key (check 48)", { skip: notAMac }, () => {
  const LABELS = [
    "Her macOS:", "Free on her disk:", "Anything unexpected in her settings:", "What the count printed:", "Her Claude account's plan:",
    "Whether the key is on GitHub, and how:", "What the check of the key printed:", "The commit:", "The tests' last lines:",
    "The app's version on each Mac:", "Anything in the print that surprised you, and its HDR line:", "The installer's last lines:",
    "What the look for the one-shot check printed:", "What turning HyperFrames on printed:", "Drop folder:", "Exports folder:", "Cloud warning:"
  ];
  const CHECKS = ["41 Before you start", "42 Studio's code on her laptop", "43 The HyperFrames app on her laptop", "44 Studio's installer on her laptop", "48 Afterwards"];

  it("writes the report on her Desktop, one heading a check and one line a box, as the page labels them, and shows it in Finder", () => {
    const r = moveOn({ marks: NOT_INSTALLED, install: { moves: true }, oldReport: "STALE REPORT\n", answers: "y\ny\ny\n\n" });
    assert.equal(r.status, 0, r.out);
    assert.ok(r.tree.includes("Desktop/Studio move report.txt"));
    assert.ok(!r.report.includes("STALE REPORT"), "a run writes it whole again");
    const lines = r.report.split("\n");
    let at = -1;
    for (const heading of [...CHECKS.slice(0, 4)]) {
      const i = lines.indexOf(heading);
      assert.ok(i > at, `${heading} comes in order`);
      at = i;
    }
    assert.ok(lines.indexOf("48 Afterwards") > at);
    let last = -1;
    for (const label of LABELS) {
      const found = lines.map((l, i) => (l.startsWith(label + " ") ? i : -1)).filter((i) => i >= 0);
      assert.equal(found.length, 1, `${label} once`);
      assert.ok(found[0] > last, `${label} in order`);
      last = found[0];
      assert.ok(lines[found[0]].length > label.length + 1, `${label} has a value`);
    }
    const known = (l) => l === "" || CHECKS.includes(l) || LABELS.some((x) => l.startsWith(x + " ")) || l.startsWith("Studio move report:") || l.startsWith("brimm-video's old key: ");
    assert.deepEqual(lines.filter((l) => !known(l)), [], "every line is a heading or a box");
    assert.match(r.report, /^Her macOS: 15\.1$/m);
    assert.match(r.report, /^Free on her disk: 429 GB$/m);
    assert.match(r.report, /^Anything unexpected in her settings: nothing/m);
    assert.match(r.report, /^What the count printed: 0$/m);
    assert.match(r.report, /^Her Claude account's plan: max$/m);
    assert.match(r.report, /^The app's version on each Mac: 1\.4\.0 on Sallie's laptop/m);
    assert.match(r.report, /^Anything in the print that surprised you, and its HDR line: .*HDR video:/m);
    assert.match(r.report, /^The installer's last lines: .*Done\./m);
    assert.match(r.report, new RegExp(`^What the look for the one-shot check printed: ${BACKGROUND}`, "m"));
    assert.match(r.report, /^What turning HyperFrames on printed: .*it was on already|^What turning HyperFrames on printed: .*on already/m);
    assert.match(r.report, /^The commit: [0-9a-f]{7} the stand-in Studio/m);
    assert.ok(r.ran.split("\n").includes(`open -R ${r.home}/Desktop/Studio move report.txt`), r.ran);
    const heading = r.out.indexOf("6. The report");
    assert.ok(heading > r.out.indexOf("5. Studio's installer") && heading < r.out.indexOf("7. brimm-video's old key"));
    for (const secret of [EMAIL, ORG, "PRIVATE-HALF", "OLD-PRIVATE-HALF"]) {
      assert.ok(!r.report.includes(secret), `the report never holds ${secret}`);
      assert.ok(!r.out.includes(secret) && !r.log.includes(secret));
    }
  });

  it("says what is known when earlier steps were already done, never an empty line", () => {
    const r = moveOn({});
    assert.equal(r.status, 0, r.out);
    for (const label of LABELS) {
      const line = r.report.split("\n").find((l) => l.startsWith(label + " "));
      assert.ok(line && line.length > label.length + 1, `${label} has a value: ${line}`);
    }
    assert.match(r.report, /^Whether the key is on GitHub, and how: yes: .*the check of the key worked$/m);
  });

  it("with --print, says 'not checked: this was a print' for what a print cannot check, and claims nothing of an earlier run", () => {
    const r = moveOn({ key: null, marks: "" }, "--print");
    assert.equal(r.status, 0, r.out);
    const not = "not checked: this was a print";
    for (const label of ["What the check of the key printed:", "The tests' last lines:", "What the look for the one-shot check printed:"]) {
      assert.ok(r.out.includes(`${label} ${not}`), `${label}\n${r.out}`);
    }
    assert.ok(!r.out.includes("on an earlier run"), r.out.split("\n").filter((l) => l.includes("earlier run")).join("\n"));
  });

  it("with --print, shows the report and writes no file", () => {
    const r = moveOn({ marks: NOT_INSTALLED, oldKey: true }, "--print");
    assert.equal(r.status, 0, r.out);
    assert.deepEqual(r.tree, r.before);
    assert.equal(r.report, "");
    assert.match(r.out, /Would write this report/);
    for (const label of LABELS) assert.ok(r.out.includes(label), `${label} is shown`);
    assert.ok(!r.ran.includes("open -R"), r.ran);
    assert.ok(!r.out.includes("Has brimm-video's key been deleted"), "a print asks nothing");
    assert.deepEqual(r.oldKeyFiles, [true, true]);
  });

  it("offers to delete brimm-video's old key only once the move is done, and deletes exactly its two files on y", () => {
    const yes = moveOn({ oldKey: true, answers: "y\n" });
    assert.equal(yes.status, 0, yes.out);
    assert.match(yes.out, /7\. brimm-video's old key \(check 48\)/);
    const q = yes.out.slice(yes.out.indexOf("7. brimm-video's old key"));
    assert.ok(q.indexOf("Has brimm-video's key been deleted on GitHub (jogden12/brimm-video › Settings › Deploy keys)?") >= 0, q);
    assert.ok(q.indexOf("GitHub") < q.indexOf(".ssh/brimm_video_deploy"), "GitHub is named first");
    assert.deepEqual(yes.oldKeyFiles, [false, false]);
    assert.ok(yes.ownKeyKept, "her own key stays");
    assert.deepEqual(yes.before.filter((f) => !yes.tree.includes(f)).sort(), [".ssh/brimm_video_deploy", ".ssh/brimm_video_deploy.pub"], "nothing else is taken away");
    assert.ok(yes.tree.includes(".ssh/brimm_video_studio_deploy") && yes.tree.includes(".ssh/config"));
    assert.match(yes.report, /^brimm-video's old key: deleted from this Mac$/m);
    assert.ok(yes.out.trimEnd().endsWith("Done. Next on the By-Hand page: checks 45 to 47, on screen."));

    const no = moveOn({ oldKey: true, answers: "n\n" });
    assert.equal(no.status, 0, no.out);
    assert.deepEqual(no.oldKeyFiles, [true, true]);
    assert.ok(no.out.trimEnd().endsWith("Done. Next on the By-Hand page: checks 45 to 47, on screen."), "an n does not stop the run");
    assert.match(no.report, /^brimm-video's old key: kept for now$/m);

    const eof = moveOn({ oldKey: true, answers: "" });
    assert.equal(eof.status, 0, eof.out);
    assert.deepEqual(eof.oldKeyFiles, [true, true], "the end of input keeps them");

    const notYet = moveOn({ oldKey: true, marks: "tests=SHA\n", install: { moves: true }, answers: "y\ny\nn\n" });
    assert.equal(notYet.status, 1, notYet.out);
    assert.ok(!notYet.out.includes("Has brimm-video's key been deleted"), "not installed: no question");
    assert.deepEqual(notYet.oldKeyFiles, [true, true]);

    const gone = moveOn({});
    assert.equal(gone.status, 0, gone.out);
    assert.ok(!gone.out.includes("Has brimm-video's key been deleted"), "no old key: no question");
    assert.match(gone.report, /^brimm-video's old key: not on this Mac$/m);
  });
});
