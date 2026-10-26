// A chat's transcript read a little at a time (scan.js; design 2026-10-26, section 1, "Modes", and section 5; R27): its start, the
// least timestamp of any complete line, and the folders its latest environment snapshot lists as added mid-chat. Only the bytes added
// since the last look are read, up to the last complete line, so a line still being written waits for its newline; a line that does
// not parse is skipped; and a file that is shorter, or is another file, is read again from 0. Each test has a home of its own.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SESSION_ID, heldFolder, scanTranscript, uuidsFile, uuidsOf } from "../scan.js";
import { SESSION } from "./open-world.js";

/** A home of its own, and a transcript in it for SESSION, written from `lines` (objects as JSON, strings as they are). */
function world() {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), "brimm-scan-")));
  const home = join(dir, "home");
  const transcriptPath = join(dir, `${SESSION}.jsonl`);
  const text = (lines) => lines.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n");
  return {
    home,
    transcriptPath,
    write: (lines, end = "\n") => writeFileSync(transcriptPath, text(lines) + end),
    append: (lines, end = "\n") => appendFileSync(transcriptPath, text(lines) + end),
    look: () => scanTranscript({ home, sessionId: SESSION, transcriptPath }),
    stored: () => JSON.parse(readFileSync(join(heldFolder(home), `scan-${SESSION}.json`), "utf8")),
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const OTHER = "22222222-3333-4444-8555-666666666666";
const environment = (dirs) => ({ type: "attachment", attachment: { type: "environment", snapshot: { additionalWorkingDirectories: dirs } } });

describe("a transcript's scan", () => {
  it("reads a transcript's environment snapshot a little at a time, and skips a line still being written", () => {
    // tests/scan.test.js: a transcript whose last line has no newline yet and one line that is not JSON: no throw, the snapshot before them stands;
    // the scan file's offset after the first look; a second look reads only what was added; a shorter or replaced file is read again from 0;
    // start is the least timestamp of any line, with a first line {"type":"mode"} that has none, as K0's fork transcript begins
    const w = world();
    const first = [{ type: "mode", mode: "default" }, { type: "user", timestamp: "2026-10-26T10:00:01.000Z" }, environment(["/a"]), "{not json", { type: "assistant", timestamp: "2026-10-26T09:59:59.000Z" }];
    w.write([...first, JSON.stringify(environment(["/b"])).slice(0, 30)], "");
    assert.deepEqual(w.look(), { start: "2026-10-26T09:59:59.000Z", added: ["/a"], unread: false, forked: false });
    const complete = Buffer.byteLength(first.map((line) => (typeof line === "string" ? line : JSON.stringify(line))).join("\n") + "\n");
    assert.equal(w.stored().offset, complete);
    // The line still being written is finished: now it is read.
    w.write([...first, environment(["/b"])]);
    assert.deepEqual(w.look(), { start: "2026-10-26T09:59:59.000Z", added: ["/b"], unread: false, forked: false });
    // A second look reads only what was added: what lies before the offset is not read again, even when it has changed in place.
    const size = readFileSync(w.transcriptPath).length;
    const text = readFileSync(w.transcriptPath, "utf8").replace('"/b"', '"/c"');
    writeFileSync(w.transcriptPath, text + JSON.stringify({ type: "user", timestamp: "2026-10-26T10:01:00.000Z" }) + "\n");
    assert.deepEqual(w.look(), { start: "2026-10-26T09:59:59.000Z", added: ["/b"], unread: false, forked: false });
    assert.ok(w.stored().offset > size);
    // A shorter file is read again from 0.
    w.write([{ type: "user", timestamp: "2026-10-26T11:00:00.000Z" }]);
    assert.deepEqual(w.look(), { start: "2026-10-26T11:00:00.000Z", added: null, unread: false, forked: false });
    // So is another file put in its place, though it is longer.
    const other = `${w.transcriptPath}.new`;
    writeFileSync(other, [{ type: "user", timestamp: "2026-10-26T12:00:00.000Z" }, environment([]), { type: "user", timestamp: "2026-10-26T12:00:01.000Z" }].map((line) => JSON.stringify(line)).join("\n") + "\n");
    renameSync(other, w.transcriptPath);
    assert.deepEqual(w.look(), { start: "2026-10-26T12:00:00.000Z", added: [], unread: false, forked: false });
    w.done();
  });
  it("keeps the latest snapshot and the least start across looks", () => {
    const w = world();
    w.write([{ type: "user", timestamp: "2026-10-26T10:00:00.000Z" }, environment(["/a"])]);
    assert.deepEqual(w.look().added, ["/a"]);
    w.append([{ type: "user", timestamp: "2026-10-26T10:05:00.000Z" }]);
    assert.deepEqual(w.look(), { start: "2026-10-26T10:00:00.000Z", added: ["/a"], unread: false, forked: false });
    w.append([environment([])]);
    assert.deepEqual(w.look(), { start: "2026-10-26T10:00:00.000Z", added: [], unread: false, forked: false });
    w.done();
  });
  it("reads a line longer than it reads at once, and words of more than one byte across the reads", () => {
    const w = world();
    const long = { type: "assistant", timestamp: "2026-10-26T09:00:00.000Z", text: "é".repeat(1_500_000) };
    w.write([environment(["/a"]), long, environment(["/b"]), { type: "user", timestamp: "2026-10-26T10:00:00.000Z", text: "ü".repeat(700_000) }]);
    assert.deepEqual(w.look(), { start: "2026-10-26T09:00:00.000Z", added: ["/b"], unread: false, forked: false });
    assert.equal(w.stored().offset, readFileSync(w.transcriptPath).length);
    w.done();
  });
  it("has no start for a transcript with no timestamp, and no snapshot until one is written", () => {
    const w = world();
    w.write([{ type: "mode", mode: "default" }, { type: "custom-title", title: "x" }]);
    assert.deepEqual(w.look(), { start: null, added: null, unread: false, forked: false });
    w.done();
  });
  it("says it is unread when the transcript is not there or cannot be read, and takes a scan file that is not JSON as none", () => {
    const w = world();
    assert.deepEqual(w.look(), { start: null, added: null, unread: true, forked: false });
    w.write([environment(["/a"])]);
    w.look();
    writeFileSync(join(heldFolder(w.home), `scan-${SESSION}.json`), "{half");
    assert.deepEqual(w.look(), { start: null, added: ["/a"], unread: false, forked: false });
    assert.deepEqual(scanTranscript({ home: w.home, sessionId: SESSION, transcriptPath: join(w.home, "not there.jsonl") }), { start: null, added: null, unread: true, forked: false });
    w.done();
  });
  it("reads nothing and writes nothing for a chat's id that is not one", () => {
    const w = world();
    w.write([environment(["/a"])]);
    for (const id of ["s", "../../x", `${SESSION}/..`, "ABCDEF12-2222-4333-8444-555555555555", "", null, undefined]) {
      assert.deepEqual(scanTranscript({ home: w.home, sessionId: id, transcriptPath: w.transcriptPath }), { start: null, added: null, unread: true, forked: false }, String(id));
    }
    assert.ok(!existsSync(heldFolder(w.home)));
    assert.ok(SESSION_ID.test(SESSION));
    assert.equal(heldFolder("/Users/s"), "/Users/s/Library/Application Support/BRIMM Video/held");
    w.done();
  });
  it("finds a held chat's message uuid, and reads again from 0 when a held chat's uuids appear or change", () => {
    const w = world();
    const held = (id, uuids) => {
      mkdirSync(heldFolder(w.home), { recursive: true });
      writeFileSync(uuidsFile(w.home, id), JSON.stringify({ uuids }));
    };
    w.write([{ type: "user", uuid: "u-1" }, { type: "user", uuid: "u-2" }]);
    assert.equal(w.look().forked, false);
    held(OTHER, ["x-1"]);
    assert.equal(w.look().forked, false);
    assert.deepEqual(w.stored().checked.map((c) => c.name), [`${OTHER}.uuids.json`]);
    held(OTHER, ["x-1", "u-2"]);
    assert.equal(w.look().forked, true, "a changed file sends the scan back to 0");
    held(OTHER, ["x-1"]);
    assert.equal(w.look().forked, true, "found once, it stays found");
    assert.equal(uuidsFile(w.home, "../x"), null);
    w.done();
  });
  it("takes a held chat's uuids that cannot be read as found", () => {
    const w = world();
    w.write([{ type: "user", uuid: "u-1" }]);
    mkdirSync(heldFolder(w.home), { recursive: true });
    writeFileSync(uuidsFile(w.home, OTHER), "{not json");
    assert.equal(w.look().forked, true);
    w.done();
  });
  it("gives every message uuid of a transcript's complete lines, and null for one that cannot be read", () => {
    const w = world();
    w.write([{ type: "mode" }, { type: "user", uuid: "u-1" }, "{not json", { type: "assistant", uuid: "u-2" }, JSON.stringify({ uuid: "u-3" })], "");
    assert.deepEqual(uuidsOf(w.transcriptPath), ["u-1", "u-2"]);
    assert.equal(uuidsOf(join(w.home, "not there.jsonl")), null);
    w.done();
  });
});
