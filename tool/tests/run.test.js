// The helpers the tool borrows from the transcript tool, in run.js: where the programs are, and how a program is run. These
// tests are the transcript tool's own, from its transcribe.test.js. The lock is tested in unedited.test.js, through the folders
// the tool works.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findTools, runProgram, isRunning } from "../run.js";

describe("before it starts", () => {
  const HOME = "/Users/someone";
  const MODEL = HOME + "/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin";
  it("finds ffmpeg, the transcriber and the model where Homebrew and the installer put them", () => {
    const there = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/whisper-cli", MODEL];
    assert.deepEqual(findTools({ exists: (p) => there.includes(p), env: { HOME, PATH: "/usr/bin:/bin" } }), { ffmpeg: "/opt/homebrew/bin/ffmpeg", whisper: "/opt/homebrew/bin/whisper-cli", model: MODEL, missing: [] });
  });
  it("takes the transcriber under its older name, and a model named by hand", () => {
    const there = ["/usr/local/bin/ffmpeg", "/usr/local/bin/whisper-cpp", "/models/small.bin"];
    const f = findTools({ exists: (p) => there.includes(p), env: { HOME, PATH: "/usr/local/bin", BRIMM_WHISPER_MODEL: "/models/small.bin" } });
    assert.deepEqual([f.whisper, f.model, f.missing], ["/usr/local/bin/whisper-cpp", "/models/small.bin", []]);
  });
  it("says in plain words what is missing and how to get it", () => {
    const f = findTools({ exists: () => false, env: { HOME, PATH: "/usr/bin" } });
    assert.deepEqual(f.missing, [
      "ffmpeg is not installed.",
      "The transcriber (whisper-cpp) is not installed.",
      `The transcriber's model is not at ${MODEL}.`
    ]);
  });
});

describe("running a program", () => {
  const print = (n) => ["-e", `process.stderr.write("x".repeat(${n}))`];
  it("keeps the end of what the program prints, so a chatty one cannot fill the Mac's memory", async () => {
    assert.equal((await runProgram(process.execPath, print(10000))).stderr.length, 4000);
  });
  it("keeps more when it is asked to, for a program whose every line is needed", async () => {
    assert.equal((await runProgram(process.execPath, print(10000), { keep: 1000000 })).stderr.length, 10000);
  });
  it("says what killed a program that did not end by itself, and nothing of the kind for one that did", async () => {
    const killed = await runProgram(process.execPath, ["-e", 'process.kill(process.pid, "SIGKILL")']);
    assert.deepEqual([killed.code, killed.signal], [1, "SIGKILL"]);
    assert.deepEqual(await runProgram(process.execPath, ["-e", "process.exit(3)"]), { code: 3, stderr: "", signal: "" });
  });
  it("keeps what the program prints as its answer when it is asked to, whole, and apart from what it says of its work", async () => {
    const answer = ["-e", 'process.stdout.write("[" + "1,".repeat(50000) + "1]"); process.stderr.write("done\\n")'];
    const r = await runProgram(process.execPath, answer, { out: 1000000 });
    assert.deepEqual([r.code, r.stderr, r.signal, r.stdout.length], [0, "done\n", "", 100003]);
    assert.equal(JSON.parse(r.stdout).length, 50001);
    // A character written as more than one byte comes through whole, wherever the program's writes happen to break.
    const wide = await runProgram(process.execPath, ["-e", 'const b = Buffer.from("é".repeat(3)); process.stdout.write(b.subarray(0, 3)); setTimeout(() => process.stdout.write(b.subarray(3)), 50)'], { out: 100 });
    assert.equal(wide.stdout, "ééé");
  });
  it("keeps no more of the answer than it is asked to: its start, and the program still runs to its end", async () => {
    const r = await runProgram(process.execPath, ["-e", 'process.stdout.write("abc".repeat(100000)); process.on("exit", () => process.stderr.write("ended"))'], { out: 10 });
    assert.deepEqual(r, { code: 0, stderr: "ended", signal: "", stdout: "abcabcabca" });
  });
  it("does not keep the answer, or say anything of one, when it is not asked to", async () => {
    assert.deepEqual(await runProgram(process.execPath, ["-e", 'process.stdout.write("an answer nobody asked for")']), { code: 0, stderr: "", signal: "" });
    assert.deepEqual(await runProgram(process.execPath, ["-e", 'process.stdout.write("x".repeat(1000000))'], { keep: 10 }), { code: 0, stderr: "", signal: "" });
  });
  it("gives an empty answer for a program that is not there, when one was asked for", async () => {
    const r = await runProgram("/no/such/program", [], { out: 100 });
    assert.deepEqual([r.code, r.stdout], [127, ""]);
    assert.ok(!("stdout" in await runProgram("/no/such/program", [])));
  });
  it("gives the program a text to read on its standard input, whole, when it is given one", async () => {
    const echo = ["-e", 'let all = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (d) => { all += d; }); process.stdin.on("end", () => process.stdout.write(all.length + " " + all.slice(0, 12) + all.slice(-4)))'];
    // More than a pipe holds at once, and a character written as more than one byte.
    const text = "The request é " + "x".repeat(300000) + " end";
    assert.deepEqual(await runProgram(process.execPath, echo, { input: text, out: 100 }), { code: 0, stderr: "", signal: "", stdout: `${text.length} The request  end` });
  });
  it("gives a program nothing to read when it is given no text: its standard input is closed", async () => {
    const read = ["-e", 'let n = 0; process.stdin.on("data", (d) => { n += d.length; }); process.stdin.on("end", () => process.stdout.write("read " + n))'];
    assert.equal((await runProgram(process.execPath, read, { out: 100 })).stdout, "read 0");
  });
  it("is not stopped by a program that ends before it has read its input, or by one that is not there", async () => {
    // A megabyte is more than a pipe holds, so the rest is still to be written when the program is gone.
    const text = "x".repeat(1000000);
    assert.deepEqual(await runProgram(process.execPath, ["-e", "process.exit(3)"], { input: text }), { code: 3, stderr: "", signal: "" });
    assert.deepEqual(await runProgram(process.execPath, ["-e", "process.stdin.destroy(); setTimeout(() => {}, 100)"], { input: text }), { code: 0, stderr: "", signal: "" });
    assert.equal((await runProgram("/no/such/program", [], { input: text })).code, 127);
  });
  it("runs the program in the folder it is given, and in the tool's own when it is given none", async () => {
    const where = ["-e", "process.stdout.write(process.cwd())"];
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-run-")));
    try {
      assert.equal((await runProgram(process.execPath, where, { cwd: dir, out: 1000 })).stdout, dir);
      assert.equal((await runProgram(process.execPath, where, { out: 1000 })).stdout, process.cwd());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("stops a program that is still running when its time is up, and says that it ran out of time", async () => {
    // It is given a second, which is ten times what it needs to start and to print its one line.
    const hung = ["-e", 'process.stderr.write("thinking\\n"); setInterval(() => {}, 1000)'];
    const r = await runProgram(process.execPath, hung, { limit: 1000 });
    assert.deepEqual(r, { code: 1, stderr: "thinking\n", signal: "SIGKILL", outOfTime: true });
    // A program that is deaf to a polite request is stopped all the same.
    const deaf = await runProgram(process.execPath, ["-e", 'process.on("SIGTERM", () => {}); process.on("SIGINT", () => {}); setInterval(() => {}, 1000)'], { limit: 300, out: 10 });
    assert.deepEqual(deaf, { code: 1, stderr: "", signal: "SIGKILL", outOfTime: true, stdout: "" });
  });
  it("says nothing of time for a program that ends within its limit, or that was given none", async () => {
    assert.deepEqual(await runProgram(process.execPath, ["-e", "process.exit(3)"], { limit: 60000 }), { code: 3, stderr: "", signal: "" });
    assert.deepEqual(await runProgram(process.execPath, ["-e", 'process.stdout.write("done")'], { limit: 60000, out: 10 }), { code: 0, stderr: "", signal: "", stdout: "done" });
  });
  it("does not wait, once a program's time is up, for something the program started that still holds what it prints", async () => {
    // The program starts a second one, which goes on for half a minute with the first one's own output in its hands.
    const parent = ["-e", `const { spawn } = require("node:child_process"); const c = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "inherit" }); process.stderr.write(String(c.pid)); setInterval(() => {}, 1000)`];
    const r = await runProgram(process.execPath, parent, { limit: 1000, out: 10 });
    const pid = Number(r.stderr);
    try {
      assert.deepEqual([r.code, r.signal, r.outOfTime], [1, "SIGKILL", true]);
      // The second program is still running: the answer did not wait for it.
      assert.ok(pid > 0 && isRunning(pid), r.stderr);
    } finally {
      if (pid > 0) process.kill(pid, "SIGKILL");
    }
  });
});
