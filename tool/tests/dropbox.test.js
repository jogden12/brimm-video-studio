// The rule for writing into Dropbox (dropbox.js): each file is made whole outside Dropbox, put in under its final name as a
// clone, never over a file there, and checked again at least 15 minutes later: Dropbox undid two renames minutes after they
// had returned on 2026-10-14. Here the clone is a stand-in that copies into a folder made for the test, the late check is
// asked at once, and a placeholder is a stand-in for what the disk says of a file. One test, on a Mac only, runs the Mac's
// own /bin/cp -c, in a folder made for it. Nothing here touches Dropbox.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { LATE_CHECK_MS, cloneIn, replaceIn, lateCheck, isWhole, waitWhole, textWriter, cloneFile, onSameDisk } from "../dropbox.js";

const notAMac = process.platform !== "darwin" ? "/bin/cp -c makes a clone on a Mac only" : false;
const GB = 2 ** 30;
/** The flag macOS sets on a file whose data is not on this Mac yet. */
const DATALESS = 0x40000000;

/** A clone this Mac cannot make where it is asked to. */
const refused = () => {
  throw new Error("cloning is not possible there");
};

/** A folder for one test: `work` stands for the run's own folder, and `dest` for a folder in Dropbox. `opts` holds a
    stand-in for the clone, which copies the file and is listed in `copies` as [from, to], and the log, whose lines are in
    `logs`. `made` writes a work copy. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "brimm-dropbox-"));
  const work = join(dir, "work");
  const dest = join(dir, "Dropbox");
  mkdirSync(work);
  mkdirSync(dest);
  const copies = [];
  const logs = [];
  const made = (name, text) => {
    writeFileSync(join(work, name), text);
    return join(work, name);
  };
  const clone = (from, to) => {
    copies.push([from, to]);
    copyFileSync(from, to);
  };
  const opts = { clone, log: (line) => logs.push(line) };
  return { dir, work, dest, copies, logs, made, opts, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** What the disk says of files Dropbox is bringing over: each path in `looks` is a placeholder, its full size with no blocks
    and marked dataless, for that many looks, and whole after them. Any other path is whole from the first look. Gives back
    `stat` and `flags` stand-ins. */
function arriving(looks) {
  const seen = {};
  const whole = (path) => seen[path] > (looks[path] || 0);
  return {
    stat: (path) => {
      seen[path] = (seen[path] || 0) + 1;
      return { size: GB, blocks: whole(path) ? GB / 512 : 0 };
    },
    flags: (path) => (whole(path) ? 0 : DATALESS)
  };
}

describe("a file put into Dropbox by the rule", () => {
  it("is cloned in under its final name, and its work copy is kept for the late check", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    const to = join(t.dest, "talk.mp4");
    cloneIn(from, to, t.opts);
    assert.deepEqual(t.copies, [[from, to]]);
    assert.deepEqual([readFileSync(to, "utf8"), readFileSync(from, "utf8"), t.logs], ["a video", "a video", []]);
    t.done();
  });
  it("is never copied byte for byte: a clone that fails stops it, and nothing is left under its name", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    assert.throws(() => cloneIn(from, join(t.dest, "talk.mp4"), { ...t.opts, clone: refused }), { message: `talk.mp4 could not be put into ${t.dest}: cloning is not possible there. Nothing was copied.` });
    assert.deepEqual([readdirSync(t.dest), readFileSync(from, "utf8")], [[], "a video"]);
    t.done();
  });
  it("is taken away again when the clone left it short, and says so", () => {
    const t = setup();
    const short = (from, into) => writeFileSync(into, "a vid");
    assert.throws(() => cloneIn(t.made("talk.mp4", "a video"), join(t.dest, "talk.mp4"), { ...t.opts, clone: short }), { message: `talk.mp4 could not be put into ${t.dest}: it is 5 bytes there, not 7. Nothing was copied.` });
    assert.deepEqual(readdirSync(t.dest), []);
    t.done();
  });
  it("is not cloned at all when the run's folder and Dropbox are on different disks, where cp -c would copy it byte for byte", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    assert.throws(() => cloneIn(from, join(t.dest, "talk.mp4"), { ...t.opts, sameDisk: () => false }), { message: `talk.mp4 could not be put into ${t.dest}: it is on another disk than the run's own folder, and a clone can only be made on one disk. Nothing was copied.` });
    assert.deepEqual([t.copies, readdirSync(t.dest)], [[], []]);
    t.done();
  });
  it("is refused when a file of its name is there already: a file in Dropbox is never written over", () => {
    const t = setup();
    writeFileSync(join(t.dest, "talk.mp4"), "the old video");
    assert.throws(() => cloneIn(t.made("talk.mp4", "a video"), join(t.dest, "talk.mp4"), t.opts), { message: `talk.mp4 is in ${t.dest} already, and a file there is never written over.` });
    assert.deepEqual([t.copies, readFileSync(join(t.dest, "talk.mp4"), "utf8")], [[], "the old video"]);
    t.done();
  });
  it("replaces a file by deleting it first and then cloning the new one in", () => {
    const t = setup();
    const to = join(t.dest, "talk.cut-plan.txt");
    writeFileSync(to, "the old plan");
    const seen = [];
    replaceIn(t.made("talk.cut-plan.txt", "the new plan"), to, { ...t.opts, clone: (from, into) => { seen.push(existsSync(into)); copyFileSync(from, into); } });
    assert.deepEqual([seen, readFileSync(to, "utf8")], [[false], "the new plan"]);
    t.done();
  });
  it("tells one disk from another by the device the file and the folder are on", () => {
    const t = setup();
    assert.equal(onSameDisk(t.made("talk.mp4", "a video"), t.dest), true);
    t.done();
  });
});

describe("the late check", () => {
  it("is made at least 15 minutes after the last copy", () => {
    assert.equal(LATE_CHECK_MS, 900000);
  });
  it("finds nothing wrong, and copies nothing again, when every file is still whole", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    const to = join(t.dest, "talk.mp4");
    cloneIn(from, to, t.opts);
    assert.deepEqual(lateCheck([{ from, to, bytes: 7 }], t.opts), []);
    assert.deepEqual([t.copies.length, t.logs], [1, []]);
    t.done();
  });
  it("copies a file in again from its work copy when it is missing or short, as when Dropbox undid two renames on 2026-10-14", () => {
    const t = setup();
    const entries = [["talk.mp4", "a video"], ["talk.srt", "the captions"]].map(([name, text]) => {
      const from = t.made(name, text);
      cloneIn(from, join(t.dest, name), t.opts);
      return { from, to: join(t.dest, name), bytes: statSync(from).size };
    });
    rmSync(entries[0].to);
    writeFileSync(entries[1].to, "the cap");
    assert.deepEqual(lateCheck(entries, t.opts), []);
    assert.deepEqual([readFileSync(entries[0].to, "utf8"), readFileSync(entries[1].to, "utf8")], ["a video", "the captions"]);
    assert.deepEqual(t.copies.slice(2), [[entries[0].from, entries[0].to], [entries[1].from, entries[1].to]]);
    assert.deepEqual(t.logs, [
      `talk.mp4 is not whole in ${t.dest} at the late check (it is not there), so it is copied in again from its work copy.`,
      `talk.srt is not whole in ${t.dest} at the late check (it is 7 bytes there, not 12), so it is copied in again from its work copy.`
    ]);
    t.done();
  });
  it("says in plain words which files are still wrong after they were copied in again, and keeps their work copies", () => {
    const t = setup();
    const video = { from: t.made("talk.mp4", "a video"), to: join(t.dest, "talk.mp4"), bytes: 7 };
    const captions = { from: t.made("talk.srt", "the captions"), to: join(t.dest, "talk.srt"), bytes: 12 };
    writeFileSync(captions.to, "the cap");
    // Dropbox undoes each copy as soon as it is made: the video is gone again, and the captions are short again.
    const undone = (from, to) => {
      if (to === captions.to) writeFileSync(to, "the cap");
    };
    assert.deepEqual(lateCheck([video, captions], { clone: undone }), [
      `talk.mp4 could not be put into ${t.dest}: it is not there. Nothing was copied.`,
      `talk.srt could not be put into ${t.dest}: it is 7 bytes there, not 12. Nothing was copied.`
    ]);
    assert.deepEqual([readFileSync(video.from, "utf8"), readFileSync(captions.from, "utf8")], ["a video", "the captions"]);
    t.done();
  });
  it("says so when a file is wrong and its work copy is gone, as after the run's folder was lost", () => {
    const t = setup();
    const entry = { from: join(t.work, "gone.mp4"), to: join(t.dest, "talk.mp4"), bytes: 7 };
    assert.deepEqual(lateCheck([entry], t.opts), [`talk.mp4 is not whole in ${t.dest} (it is not there), and its work copy is gone, so it could not be copied in again.`]);
    t.done();
  });
});

describe("a file Dropbox may still be bringing over", () => {
  it("is not whole while Dropbox shows its full size with no data yet: a placeholder of 1 GB with no blocks", () => {
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: 0 }), flags: () => DATALESS }), false);
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: GB / 512 - 1 }), flags: () => DATALESS }), false);
  });
  it("is whole when its blocks cover its size, and when it is empty", () => {
    const never = () => { throw new Error("the flags are not asked for"); };
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: GB / 512 }), flags: never }), true);
    assert.equal(isWhole("/Dropbox/empty.txt", { stat: () => ({ size: 0, blocks: 0 }), flags: never }), true);
  });
  it("is whole when its blocks do not cover its size but the disk does not mark it dataless, as for a file APFS compressed", () => {
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: 8 }), flags: () => 0x20 }), true);
    assert.equal(isWhole("/Dropbox/talk.mp4", { stat: () => ({ size: GB, blocks: 0 }), flags: () => { throw new Error("stat failed"); } }), false);
  });
  it("is not whole when it is not there, and is whole when it was written on this Mac's own disk", () => {
    const t = setup();
    assert.equal(isWhole(join(t.dest, "talk.mp4")), false);
    assert.equal(isWhole(t.made("talk.mp4", "a video")), true);
    t.done();
  });
});

describe("waiting for files Dropbox may still be bringing over", () => {
  it("gives back at once the files that are whole, and does not wait", async () => {
    const waits = [];
    const r = await waitWhole(["/Dropbox/talk.mp4", "/Dropbox/talk.srt"], { wait: async (ms) => { waits.push(ms); }, ...arriving({}) });
    assert.deepEqual([r, waits], [{ whole: ["/Dropbox/talk.mp4", "/Dropbox/talk.srt"], notYet: [] }, []]);
  });
  it("waits and looks again while a file is a placeholder, and takes it once Dropbox has brought it over", async () => {
    const waits = [];
    const r = await waitWhole(["/Dropbox/talk.mp4", "/Dropbox/talk.srt"], { wait: async (ms) => { waits.push(ms); }, ...arriving({ "/Dropbox/talk.mp4": 1 }) });
    assert.deepEqual([r, waits], [{ whole: ["/Dropbox/talk.mp4", "/Dropbox/talk.srt"], notYet: [] }, [5000]]);
  });
  it("gives up after three looks, and names the files still not whole", async () => {
    const waits = [];
    const r = await waitWhole(["/Dropbox/talk.mp4", "/Dropbox/talk.srt"], { wait: async (ms) => { waits.push(ms); }, ...arriving({ "/Dropbox/talk.mp4": Infinity }) });
    assert.deepEqual([r, waits], [{ whole: ["/Dropbox/talk.srt"], notYet: ["/Dropbox/talk.mp4"] }, [5000, 5000]]);
  });
});

describe("a small text file written into Dropbox by the rule", () => {
  it("is written whole in the work folder under a name of its own, cloned in under its final name, and its work copy deleted", () => {
    const t = setup();
    const seen = [];
    const clone = (from, to) => {
      seen.push([from, readFileSync(from, "utf8")]);
      copyFileSync(from, to);
    };
    const work = join(t.dir, "not made yet");
    const write = textWriter({ work, clone });
    write(join(t.dest, "0001.json"), '{"rev":1}\n');
    write(join(t.dest, "0002.json"), '{"rev":2}\n');
    assert.deepEqual([readFileSync(join(t.dest, "0001.json"), "utf8"), readFileSync(join(t.dest, "0002.json"), "utf8")], ['{"rev":1}\n', '{"rev":2}\n']);
    assert.deepEqual([dirname(seen[0][0]), dirname(seen[1][0]), seen[0][0] === seen[1][0]], [work, work, false]);
    assert.deepEqual(readdirSync(work), []);
    t.done();
  });
  it("is never written over a file there, unless it is asked to replace it", () => {
    const t = setup();
    const write = textWriter({ work: t.work, ...t.opts });
    const to = join(t.dest, ".brimm-watched-by");
    write(to, "Mac Studio\n");
    assert.throws(() => write(to, "Mac Studio\n"), { message: `.brimm-watched-by is in ${t.dest} already, and a file there is never written over.` });
    write(to, "Mac Studio, again\n", { replace: true });
    assert.equal(readFileSync(to, "utf8"), "Mac Studio, again\n");
    t.done();
  });
  it("deletes its work copy when it could not be put in, and says why", () => {
    const t = setup();
    const write = textWriter({ work: t.work, clone: refused });
    assert.throws(() => write(join(t.dest, "0001.json"), "{}\n"), { message: `0001.json could not be put into ${t.dest}: cloning is not possible there. Nothing was copied.` });
    assert.deepEqual([readdirSync(t.work), readdirSync(t.dest)], [[], []]);
    t.done();
  });
  it("keeps its work copy when asked to, for the late check, which copies it in again when Dropbox has undone it", () => {
    const t = setup();
    const write = textWriter({ work: t.work, ...t.opts, keep: true });
    const text = "Sallie’s talk\n";
    const entry = write(join(t.dest, "0001.json"), text);
    assert.deepEqual([entry.to, entry.bytes, readFileSync(entry.from, "utf8")], [join(t.dest, "0001.json"), Buffer.byteLength(text), text]);
    rmSync(entry.to);
    assert.deepEqual(lateCheck([entry], t.opts), []);
    assert.equal(readFileSync(entry.to, "utf8"), text);
    t.done();
  });
});

describe("the clone this Mac makes", () => {
  it("clones a file with /bin/cp -c, replaces one by a new file, and says in cp's words why it could not", { skip: notAMac }, () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    const to = join(t.dest, "talk.mp4");
    cloneIn(from, to, { log: (line) => t.logs.push(line) });
    assert.deepEqual([readFileSync(to, "utf8"), readFileSync(from, "utf8"), statSync(to).ino === statSync(from).ino], ["a video", "a video", false]);
    const was = statSync(to).ino;
    writeFileSync(from, "a longer video");
    replaceIn(from, to, { log: (line) => t.logs.push(line) });
    assert.deepEqual([readFileSync(to, "utf8"), statSync(to).ino === was, t.logs], ["a longer video", false, []]);
    assert.throws(() => cloneFile(join(t.work, "gone.mp4"), join(t.dest, "gone.mp4")), { message: /No such file or directory/ });
    assert.equal(existsSync(join(t.dest, "gone.mp4")), false);
    t.done();
  });
});

describe("what the lead's review of PR 11 found in the rule", () => {
  /** The free space on the disk a folder is on, in bytes. */
  const free = (folder) => {
    const disk = statfsSync(folder);
    return Number(disk.bavail) * Number(disk.bsize);
  };
  it("9. makes a clone, which takes no space, where a byte copy would take the file's size again", { skip: notAMac }, () => {
    const t = setup();
    const size = 128 * 2 ** 20;
    const from = join(t.work, "big.bin");
    writeFileSync(from, Buffer.alloc(size, 7));
    const before = free(t.dest);
    cloneIn(from, join(t.dest, "cloned.bin"));
    const cloned = before - free(t.dest);
    const again = free(t.dest);
    copyFileSync(from, join(t.dest, "copied.bin"));
    const copied = again - free(t.dest);
    assert.ok(cloned < size / 2, `the clone took ${cloned} bytes`);
    assert.ok(copied > size / 2, `the byte copy took only ${copied} bytes, so this test cannot tell the two apart`);
    t.done();
  });
  it("10. tells two disks apart, by the device each is on", () => {
    const t = setup();
    const from = t.made("talk.mp4", "a video");
    assert.equal(onSameDisk(from, t.dest, (path) => ({ dev: path === from ? 1 : 2 })), false);
    if (process.platform === "darwin") assert.equal(onSameDisk(from, "/dev"), false);
    t.done();
  });
  it("16. puts a file back when Dropbox took its folder away too, and says in plain words when a folder is not there", () => {
    const t = setup();
    const from = t.made("0001.json", "{}\n");
    const to = join(t.dest, "record", "0001.json");
    mkdirSync(dirname(to));
    cloneIn(from, to, t.opts);
    rmSync(dirname(to), { recursive: true });
    assert.deepEqual(lateCheck([{ from, to, bytes: 3 }], t.opts), []);
    assert.equal(readFileSync(to, "utf8"), "{}\n");
    assert.throws(() => cloneIn(from, join(t.dest, "gone", "0001.json"), t.opts), { message: `0001.json could not be put into ${join(t.dest, "gone")}: the folder is not there. Nothing was copied.` });
    t.done();
  });
});
