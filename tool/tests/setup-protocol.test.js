// The setup protocol's events, answers and arguments, checked in one place (Phase 5, Task 4).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PassThrough, Writable } from "node:stream";
import { EVENTS, STEPS, PARTS, CODES, RUNS, PROTOCOL, eventFault, emitter, readerOf, lineFault, answerFault, argsOf } from "../setup/protocol.js";

/** A stream that keeps everything written to it. */
function sink() {
  const chunks = [];
  const out = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk); done(); } });
  out.text = () => Buffer.concat(chunks).toString();
  return out;
}

const step = { event: "step", id: "welcome", n: 1, of: 9, title: "Welcome", body: ["One line."] };
const question = { event: "question", id: "name", kind: "text", prompt: "What is this Mac called?", suggested: "Mac Studio" };
const progress = { event: "progress", part: "model", label: "Reading model", done: 1, total: 4, state: "running" };
const summary = { event: "summary", id: "status", ok: true, lines: [{ label: "Claude", value: "signed in" }], needs: "nothing" };
const done = { event: "done", outcome: "installed", summary: "All set.\nSecond line.", studio: "/Users/a/BRIMM Video Studio", guide: null, notes: ["A note."] };
const error = { event: "error", code: "busy", message: "Something is at work." };

describe("the setup protocol", () => {
  it("the events are the spec's six, and the steps are its nine in order", () => {
    assert.equal(PROTOCOL, 1);
    assert.deepEqual(EVENTS, ["step", "question", "progress", "summary", "done", "error"]);
    assert.deepEqual(STEPS, ["welcome", "name", "apps", "dropbox", "folders", "permissions", "review", "install", "done"]);
    assert.deepEqual(PARTS, ["programs", "model", "hyperframes", "chrome", "installer", "claude"]);
    assert.deepEqual(CODES, ["arguments", "protocol", "damaged", "dev", "no-settings", "settings", "busy", "install", "download", "engine"]);
    assert.deepEqual(RUNS, ["setup", "repair", "update", "status"]);
  });

  it("an event with a name of no kind, or a step with an id of no step, is a fault", () => {
    assert.notEqual(eventFault({ event: "note" }), "");
    assert.notEqual(eventFault("step"), "");
    assert.notEqual(eventFault({ ...step, id: "finish" }), "");
    assert.notEqual(eventFault({ ...step, n: 3, of: 2 }), "");
    assert.notEqual(eventFault({ ...step, body: "text" }), "");
    for (const e of [step, question, progress, summary, done, error, { ...done, guide: { html: "/a.html", pdf: "/a.pdf" } }]) assert.equal(eventFault(e), "", JSON.stringify(e));
  });

  it("each question kind needs its own fields", () => {
    const base = { event: "question", id: "q", prompt: "Ask?" };
    const good = [
      { kind: "confirm", ok: "Continue" },
      { kind: "text", suggested: "A" },
      { kind: "choice", options: [{ value: "a", label: "A", detail: "d" }, { value: "b", label: "B" }] },
      { kind: "folder", suggested: "/a", words: "Pick it", purpose: "drop" },
      { kind: "apps", apps: [{ id: "claude-code", name: "Claude Code", here: false, action: "install-claude-code" }] },
      { kind: "sign-in", link: "https://x.example", paste: true },
    ];
    for (const k of good) assert.equal(eventFault({ ...base, ...k }), "", k.kind);
    assert.notEqual(eventFault({ ...base, kind: "confirm" }), "");
    assert.notEqual(eventFault({ ...base, kind: "folder", suggested: "/a", words: "w", purpose: "other" }), "");
    assert.notEqual(eventFault({ ...base, kind: "apps", apps: [{ id: "pages", name: "P", here: true }] }), "");
    assert.notEqual(eventFault({ ...base, kind: "sign-in" }), "");
    assert.notEqual(eventFault({ ...base, kind: "choice", options: [{ value: 1, label: "A" }] }), "");
    assert.notEqual(eventFault({ ...base, kind: "weird" }), "");
  });

  it("a progress event's part is one of the six, and its done never passes its total", () => {
    assert.notEqual(eventFault({ ...progress, part: "node" }), "");
    assert.notEqual(eventFault({ ...progress, done: 5, total: 4 }), "");
    assert.equal(eventFault({ ...progress, done: 5, total: null }), "");
    assert.notEqual(eventFault({ ...progress, state: "stuck" }), "");
  });

  it("summary, done and error events keep to their fields", () => {
    assert.notEqual(eventFault({ ...summary, id: "other" }), "");
    assert.notEqual(eventFault({ ...summary, needs: "everything" }), "");
    assert.notEqual(eventFault({ ...summary, id: "review", needs: "nothing" }), "");
    assert.notEqual(eventFault({ ...done, outcome: "lost" }), "");
    assert.notEqual(eventFault({ ...done, guide: { html: "/a" } }), "");
    assert.notEqual(eventFault({ ...error, code: "boom" }), "");
    assert.notEqual(eventFault({ ...error, message: "" }), "");
  });

  it("the protocol takes update among a status's needs, and no other new word", () => {
    for (const needs of ["nothing", "setup", "repair", "update"]) assert.equal(eventFault({ ...summary, needs }), "", needs);
    for (const needs of ["updated", "updating", "Update", "install", "", undefined, null]) assert.notEqual(eventFault({ ...summary, needs }), "", String(needs));
    assert.notEqual(eventFault({ ...summary, id: "setup", needs: "update" }), "");
    assert.equal(PROTOCOL, 1);
  });

  it("a string with a line break is a fault outside details, summary and body", () => {
    assert.notEqual(eventFault({ ...step, title: "a\nb" }), "");
    assert.equal(eventFault({ ...summary, id: "review", needs: undefined, details: "a\nb" }), "");
    assert.equal(eventFault({ ...step, body: ["a\nb"] }), "");
    assert.notEqual(eventFault({ ...error, advice: "a\nb" }), "");
  });

  it("the faults name fields and never values", () => {
    assert.ok(!eventFault({ ...step, id: "secret-value-123" }).includes("secret-value-123"));
    assert.ok(!eventFault({ ...step, title: "pasted\ncode-987" }).includes("code-987"));
  });

  it("the emitter writes one JSON object on one line", () => {
    const out = sink();
    const emit = emitter(out);
    emit(step);
    emit(done);
    const lines = out.text().split("\n");
    assert.equal(lines.pop(), "");
    assert.equal(lines.length, 2);
    assert.deepEqual(JSON.parse(lines[0]), step);
    assert.deepEqual(JSON.parse(lines[1]), done);
  });

  it("the emitter throws on a faulty event before it writes", () => {
    const out = sink();
    assert.throws(() => emitter(out)({ event: "step", id: "finish" }));
    assert.equal(out.text(), "");
  });

  it("the reader gives one object per line, null at the end, and names a line that is not a JSON object", async () => {
    const input = new PassThrough();
    const reader = readerOf(input);
    const waiting = reader.next();
    input.write('{"answer":"name","value":"A"}\nhello 123456\n[1]\n');
    assert.deepEqual(await waiting, { answer: "name", value: "A" });
    for (let i = 0; i < 2; i++) {
      const got = await reader.next();
      assert.equal(typeof got.fault, "string");
      assert.ok(!got.fault.includes("hello") && !got.fault.includes("123456"));
    }
    input.end();
    assert.equal(await reader.next(), null);
    assert.equal(await reader.next(), null);
  });

  it("U+2028, U+2029 and U+0085 are written escaped, so an event is one line to any reader, and parses back the same", () => {
    for (const text of ["a\u2028b", "a\u2029b", "a\u0085b", "x\u2028y\u2029z\u0085w"]) {
      const out = sink();
      emitter(out)({ ...step, title: text, body: [text] });
      const written = out.text();
      assert.equal(/[\u0085\u2028\u2029]/.test(written), false, JSON.stringify(text));
      assert.deepEqual(written.split(/\r\n|[\n\r\u0085\u2028\u2029]/), [written.slice(0, -1), ""]);
      assert.deepEqual(JSON.parse(written), { ...step, title: text, body: [text] });
    }
    const out = sink();
    emitter(out)({ ...step, title: "a\u2028b\u2029c\u0085d" });
    assert.ok(out.text().includes(String.raw`"title":"a\u2028b\u2029c\u0085d"`));
  });

  it("the reader splits on a line feed only: an answer holding U+2028, U+2029 or U+0085 is one answer", async () => {
    const input = new PassThrough();
    const reader = readerOf(input);
    for (const value of ["A\u2028B", "A\u2029B", "A\u0085B"]) {
      input.write(`{"answer":"name","value":"${value}"}\n`);
      assert.deepEqual(await reader.next(), { answer: "name", value });
    }
    input.end();
    assert.equal(await reader.next(), null);
  });

  it("the reader takes a line ended by CR LF, a line in pieces, a character split between two writes, and a last line with no end", async () => {
    const input = new PassThrough();
    const reader = readerOf(input);
    input.write('{"answer":"name","value":"A"}\r\n');
    assert.deepEqual(await reader.next(), { answer: "name", value: "A" });
    input.write('{"answer":"name",');
    input.write('"value":"B"}\n');
    assert.deepEqual(await reader.next(), { answer: "name", value: "B" });
    const bytes = Buffer.from('{"answer":"name","value":"é"}\n');
    const cut = bytes.indexOf(Buffer.from("é")) + 1;
    input.write(bytes.subarray(0, cut));
    input.write(bytes.subarray(cut));
    assert.deepEqual(await reader.next(), { answer: "name", value: "é" });
    input.write("\n   \n");
    input.end('{"back":true}');
    assert.deepEqual(await reader.next(), { back: true });
    assert.equal(await reader.next(), null);
  });

  it("a line holds exactly one of answer, back and cancel", () => {
    assert.equal(lineFault({ answer: "name", value: "A" }), "");
    assert.equal(lineFault({ back: true }), "");
    assert.equal(lineFault({ cancel: true }), "");
    assert.notEqual(lineFault({}), "");
    assert.notEqual(lineFault({ back: false }), "");
    assert.notEqual(lineFault({ back: true, cancel: true }), "");
    assert.notEqual(lineFault({ answer: "name", back: true }), "");
    assert.notEqual(lineFault({ answer: "name" }), "");
    assert.notEqual(lineFault({ answer: 3, value: 1 }), "");
  });

  it("an answer is read against the open question: its id, and a value of the question's kind", () => {
    const ask = (q, value, answer = q.id) => answerFault(q, { answer, value });
    const confirm = { id: "c", kind: "confirm" };
    assert.equal(ask(confirm, true), "");
    assert.notEqual(ask(confirm, "yes"), "");
    assert.notEqual(ask(confirm, true, "other"), "");
    const text = { id: "t", kind: "text" };
    assert.equal(ask(text, "Mac"), "");
    assert.notEqual(ask(text, "a\nb"), "");
    assert.notEqual(ask(text, 4), "");
    const choice = { id: "ch", kind: "choice", options: [{ value: "a" }, { value: "b" }] };
    assert.equal(ask(choice, "b"), "");
    assert.notEqual(ask(choice, "c"), "");
    const folder = { id: "f", kind: "folder" };
    assert.equal(ask(folder, "/Users/a/Drop"), "");
    assert.notEqual(ask(folder, "Drop"), "");
    const apps = { id: "a", kind: "apps", apps: [{ id: "claude-code", action: "install-claude-code" }, { id: "claude-app", action: "sign-in" }] };
    for (const v of ["check", "continue", "install-claude-code", "sign-in"]) assert.equal(ask(apps, v), "", v);
    assert.notEqual(ask(apps, "launch"), "");
    const bare = { id: "a", kind: "apps", apps: [{ id: "dropbox" }] };
    assert.equal(ask(bare, "check"), "");
    assert.notEqual(ask(bare, "install-claude-code"), "");
    assert.notEqual(ask(bare, "sign-in"), "");
    const signIn = { id: "s", kind: "sign-in" };
    assert.equal(ask(signIn, {}), "");
    assert.equal(ask(signIn, { code: "abc#123" }), "");
    assert.notEqual(ask(signIn, { code: "" }), "");
    assert.notEqual(ask(signIn, { code: "a\nb" }), "");
    assert.notEqual(ask(signIn, { code: 5 }), "");
    assert.notEqual(ask(signIn, "abc"), "");
    assert.ok(!ask(signIn, { code: 99887766 }).includes("99887766"));
    assert.ok(!ask(signIn, { code: "a\nSECRETCODE" }).includes("SECRETCODE"));
  });

  it("the arguments: --run, --app, --tools and --protocol 1, each once, absolute paths, no ':' in --tools", () => {
    const good = ["--run", "setup", "--app", "/Applications/B.app", "--tools", "/Applications/B.app/bin", "--protocol", "1"];
    assert.deepEqual(argsOf(good), { run: "setup", app: "/Applications/B.app", tools: "/Applications/B.app/bin", protocol: 1 });
    for (const run of RUNS) assert.equal(argsOf(["--run", run, ...good.slice(2)]).run, run);
    for (let i = 0; i < 8; i += 2) {
      const got = argsOf([...good.slice(0, i), ...good.slice(i + 2)]);
      assert.equal(got.code, "arguments", good[i]);
      assert.ok(got.fault.includes(good[i]), good[i]);
    }
    const bad = (over) => argsOf(good.map((x, i) => (over[i] !== undefined ? over[i] : x)));
    assert.equal(bad({ 1: "install" }).code, "arguments");
    assert.ok(!bad({ 1: "install" }).fault.includes("install"));
    assert.equal(bad({ 3: "rel/B.app" }).code, "arguments");
    assert.equal(bad({ 5: "/a:/b" }).code, "arguments");
    assert.equal(bad({ 7: "2" }).code, "protocol");
    assert.equal(bad({ 7: "x" }).code, "protocol");
    assert.equal(argsOf([...good, "--run", "repair"]).code, "arguments");
    assert.equal(argsOf([...good, "--verbose", "secret"]).code, "arguments");
    assert.ok(!argsOf([...good, "--verbose", "secret"]).fault.includes("secret"));
    assert.equal(argsOf([...good, "stray"]).code, "arguments");
    assert.equal(argsOf(["--run"]).code, "arguments");
    assert.equal(argsOf([]).code, "arguments");
  });
});
