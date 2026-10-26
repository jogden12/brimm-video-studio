// The process chain (chain.js): the table `ps` gives, the chain up from a process to the Claude Code above it, and the flags and
// version that Claude Code was started with (design 2026-10-26, section 1, "Modes", and section 6; R26). `ps` is always a stand-in
// here: no test runs it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PS_ARGS, readProcesses, processTable, chainUp, claudeAbove, argsOf, appVersionOf } from "../chain.js";
import { psText, chatChain, APP_ARGS, NODE } from "./open-world.js";

const APP = "/Users/s/Library/Application Support/Claude/claude-code/2.1.308/claude";

describe("the process chain", () => {
  it("reads ps's table, a start time of 24 letters and arguments with spaces", () => {
    const table = processTable(psText([
      [1, 0, "/sbin/launchd"],
      [700, 1, `${APP} --output-format stream-json --add-dir=/Users/s/Library/Application Support/Claude/side-session-notes/abc`],
      [800, 700, "/bin/zsh -c source /tmp/snapshot.sh && eval 'node edit.js episodes'", "Mon Oct  5 09:00:00 2026"],
    ]));
    assert.deepEqual([...table.keys()], [1, 700, 800]);
    assert.deepEqual(table.get(700), { pid: 700, ppid: 1, start: "Mon Oct 26 09:00:00 2026", args: `${APP} --output-format stream-json --add-dir=/Users/s/Library/Application Support/Claude/side-session-notes/abc` });
    assert.deepEqual(table.get(800), { pid: 800, ppid: 700, start: "Mon Oct  5 09:00:00 2026", args: "/bin/zsh -c source /tmp/snapshot.sh && eval 'node edit.js episodes'" });
    assert.equal(table.get(800).start.length, 24);
  });
  it("walks up to the first claude above, from edit.js (node, zsh, claude) and from the guard (node, sh, claude)", () => {
    const edit = chainUp(processTable(chatChain({ args: APP_ARGS("/f", "/Users/s") })), 900);
    assert.deepEqual(edit.map((p) => p.pid), [900, 800, 700, 1]);
    assert.equal(claudeAbove(edit).pid, 700);
    const guard = processTable(psText([
      [1, 0, "/sbin/launchd"],
      [600, 1, `${APP} --output-format stream-json`],
      [610, 600, `/bin/sh /x/tool/studio/guard.sh ${NODE} /f`],
      [620, 610, `${NODE} /x/tool/studio/guard.mjs /f`],
    ]));
    assert.equal(claudeAbove(chainUp(guard, 620)).pid, 600);
    // The first claude going up, not one above it.
    const nested = processTable(psText([
      [1, 0, "/sbin/launchd"],
      [500, 1, "/opt/homebrew/bin/claude --resume x"],
      [600, 500, `${APP} --verbose`],
      [620, 600, `${NODE} /x/tool/edit.js behind`],
    ]));
    assert.equal(claudeAbove(chainUp(nested, 620)).pid, 600);
  });
  it("finds no claude above Jason's own run in Terminal", () => {
    const table = processTable(psText([
      [1, 0, "/sbin/launchd"],
      [300, 1, "/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal"],
      [310, 300, "login -pf jason"],
      [320, 310, "-zsh"],
      [330, 320, `${NODE} /x/tool/edit.js behind`],
    ]));
    assert.equal(claudeAbove(chainUp(table, 330)), null);
    // Claude Code run as node …/cli.js is no claude by its executable's name either.
    const cli = processTable(psText([[1, 0, "/sbin/launchd"], [700, 1, "node /x/cli.js"], [800, 700, "/bin/zsh -c x"], [900, 800, `${NODE} /x/tool/edit.js behind`]]));
    assert.equal(claudeAbove(chainUp(cli, 900)), null);
  });
  it("splits the app's arguments at each ' --', keeping a value with spaces whole", () => {
    const a = argsOf(`/Users/s/Library/Application Support/Claude/claude-code/2.1.308/claude --output-format stream-json --settings {"a":1} --add-dir=/Users/s/Library/Application Support/Claude/side-session-notes/abc --setting-sources=user,project,local --resume 1234`);
    assert.equal(a.exe, "/Users/s/Library/Application Support/Claude/claude-code/2.1.308/claude");
    assert.deepEqual(a.flags.map((f) => [f.name, f.value]), [["--output-format","stream-json"],["--settings",'{"a":1}'],["--add-dir","/Users/s/Library/Application Support/Claude/side-session-notes/abc"],["--setting-sources","user,project,local"],["--resume","1234"]]);
    assert.deepEqual(argsOf(`${APP} --verbose --model x`).flags, [{ name: "--verbose", value: null }, { name: "--model", value: "x" }]);
    assert.deepEqual(argsOf("/opt/homebrew/bin/claude"), { exe: "/opt/homebrew/bin/claude", flags: [] });
  });
  it("reads the app's copy's version from its path, and none from another claude", () => {
    assert.equal(appVersionOf(APP), "2.1.308");
    assert.equal(appVersionOf("/Users/s/Library/Application Support/Claude/claude-code/2.1.310/claude"), "2.1.310");
    for (const exe of ["/opt/homebrew/bin/claude", "/Users/s/.local/share/claude/versions/2.1.308", "/Users/s/.local/bin/claude", "claude", "/x/claude-code/claude", "/x/claude-code/latest/claude"]) assert.equal(appVersionOf(exe), null, exe);
  });
  it("stops at a loop and at a process ps does not list", () => {
    const loop = processTable(psText([[700, 900, "a"], [800, 700, "b"], [900, 800, "c"]]));
    assert.deepEqual(chainUp(loop, 900).map((p) => p.pid), [900, 800, 700]);
    const gap = processTable(psText([[800, 650, "b"], [900, 800, "c"]]));
    assert.deepEqual(chainUp(gap, 900).map((p) => p.pid), [900, 800]);
    assert.deepEqual(chainUp(gap, 12345), []);
    const self = processTable(psText([[900, 900, "c"]]));
    assert.deepEqual(chainUp(self, 900).map((p) => p.pid), [900]);
  });
  it("gives null when ps cannot be run, exits with an error, or is refused", () => {
    assert.equal(readProcesses(() => ({ error: Object.assign(new Error("spawnSync /bin/ps ENOENT"), { code: "ENOENT" }), status: null, stdout: null })), null);
    assert.equal(readProcesses(() => ({ status: 1, stdout: "", stderr: "ps: illegal option" })), null);
    assert.equal(readProcesses(() => ({ status: null, signal: "SIGTERM", stdout: "" })), null);
    assert.equal(readProcesses(() => { throw Object.assign(new Error("EPERM"), { code: "EPERM" }); }), null);
    assert.equal(readProcesses(() => ({ status: 0, stdout: psText([[1, 0, "/sbin/launchd"]]) })), psText([[1, 0, "/sbin/launchd"]]));
  });
  it("runs ps with LC_ALL=C and nothing else in its environment", () => {
    // a stand-in spawn records its arguments: ["/bin/ps", PS_ARGS, { env: { LC_ALL: "C" }, … }]
    assert.deepEqual(PS_ARGS, ["-A", "-ww", "-o", "pid=,ppid=,lstart=,args="]);
    const calls = [];
    readProcesses((...args) => {
      calls.push(args);
      return { status: 0, stdout: "" };
    });
    assert.deepEqual(calls, [["/bin/ps", PS_ARGS, { env: { LC_ALL: "C" }, encoding: "utf8", timeout: 5000 }]]);
  });
  it("gives no row for a line whose start time is not 24 letters, rather than a wrong one", () => {
    const text = [
      "  700     1 Mon Oct 26 9:00:00 2026 /x/claude --verbose",
      "  710     1 lun. 26 oct. 09:00:00 2026 /x/claude --verbose",
      "  720     1 26 Oct 2026 09:00:00 /x/claude --verbose",
      "  730     1 Mon Oct 26 09:00:00 2026",
      "not a row at all",
      "",
      "  900   700 Mon Oct 26 09:00:00 2026 /opt/homebrew/bin/node /x/tool/edit.js behind",
    ].join("\n");
    assert.deepEqual([...processTable(text).keys()], [900]);
  });
});
