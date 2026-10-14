// An episode's parts (its main video and its picked Reels), the files Final Cut made of each, found by the project names
// recorded at each push, and what finish must ask before it starts. Plain data: no disk.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { partsOf, kindOf, lookFor, firstWordsMatch } from "../parts.js";

const push = (v, project, at = "2026-10-20T10:00:00-05:00") => ({ v, at, on: "Mac Studio", file: `edit/x.v${v}.mac-studio.fcpxml`, project });
const RECORD = {
  kind: "episode",
  name: { text: "Pricing: what to charge?", placeholder: false },
  main: { pushed: [push(4, "Pricing- what to charge- main v4 3fa9c1"), push(5, "Pricing- what to charge- main v5 3fa9c1")] },
  reels: [
    { n: 1, status: "picked", pushed: [push(1, "Pricing- what to charge- reel 1 v1 3fa9c1")] },
    { n: 2, status: "dropped", pushed: [] },
    { n: 3, status: "candidate", pushed: [] }
  ],
  finished: null
};
const file = (name, mtimeMs = 1000, bytes = 5000) => ({ name, bytes, mtimeMs });
const MAIN5 = "Pricing- what to charge- main v5 3fa9c1";
const REEL1 = "Pricing- what to charge- reel 1 v1 3fa9c1";
const NONE = { take: {}, noHandEdits: [], without: [] };
const folders = (fromFinalCut, released = []) => ({ fromFinalCut: { dir: "/h/From Final Cut", files: fromFinalCut }, released: { dir: "/e/edit/from-final-cut", files: released }, finished: null });

describe("partsOf", () => {
  it("is the main video and each Reel picked or finished, with the project names of its pushes", () => {
    const parts = partsOf(RECORD);
    assert.deepEqual(parts.map((p) => p.key), ["main", "reel 1"]);
    assert.deepEqual(parts[0].projects, ["Pricing- what to charge- main v4 3fa9c1", MAIN5]);
    assert.equal(parts[1].last.v, 1);
  });
  it("is the main video alone for a short video", () => {
    assert.deepEqual(partsOf({ ...RECORD, kind: "short video", reels: [] }).map((p) => p.key), ["main"]);
  });
});

describe("kindOf", () => {
  it("tells a finished video from an export by its ending, and passes over the rest", () => {
    assert.deepEqual(["a.mov", "a.MP4", "a.m4v", "a.fcpxmld", "a.fcpxml", "a.mp4.partial", "a.txt", ".a.mp4"].map(kindOf), ["video", "video", "video", "export", "export", "", "", ""]);
  });
});

describe("lookFor", () => {
  it("takes each part's Shared video and its export by the recorded project names, and asks nothing when the export is newer", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000), file(`${REEL1}.mov`, 2000), file(`${REEL1}.fcpxmld`, 2500), file("Another episode main v1 9a8b7c.mp4"), file("Pricing- what to charge- main v5 3fa9c1 final cut.mp4")]), NONE);
    assert.deepEqual(got.asks, []);
    assert.deepEqual(got.stops, []);
    assert.equal(got.parts[0].video.name, `${MAIN5}.mp4`);
    assert.equal(got.parts[1].export.name, `${REEL1}.fcpxmld`);
  });
  it("passes over an empty file and one still being written under a temporary name", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 2000, 0), file(`${MAIN5}.mp4.partial`)]), NONE);
    assert.deepEqual(got.parts, []);
    assert.match(got.stops[0], /main video/);
  });
  it("takes the Share of the highest version pushed, wherever it is, when Shares of two versions fit one part", () => {
    const shares = [file(`${MAIN5}.mp4`, 3000), file("Pricing- what to charge- main v4 3fa9c1.mp4", 2000), file(`${MAIN5}.fcpxmld`, 4000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)];
    const got = lookFor(partsOf(RECORD), folders(shares), NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].video.name, `${MAIN5}.mp4`);
    const there = lookFor(partsOf(RECORD), folders([file("Pricing- what to charge- main v4 3fa9c1.mp4", 9000), file("Pricing- what to charge- main v4 3fa9c1.fcpxmld", 9500), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)], [file(`${MAIN5}.mp4`, 3000), file(`${MAIN5}.fcpxmld`, 4000)]), NONE);
    assert.deepEqual([there.parts[0].video.name, there.parts[0].video.where], [`${MAIN5}.mp4`, "the other Mac"]);
  });
  it("asks which is final when two different files are of the highest version, and takes the one named", () => {
    const shares = [file(`${MAIN5}.mp4`, 3000), file(`${MAIN5}.mov`, 3100), file(`${MAIN5}.fcpxmld`, 4000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)];
    const asked = lookFor(partsOf(RECORD), folders(shares), NONE);
    assert.equal(asked.asks.length, 1);
    assert.match(asked.asks[0], /For the main video there are two Shared videos of v5: Pricing- what to charge- main v5 3fa9c1\.mov, Pricing- what to charge- main v5 3fa9c1\.mp4\. Which is the final one\?/);
    assert.deepEqual(asked.parts.map((p) => p.key), ["reel 1"]);
    const told = lookFor(partsOf(RECORD), folders(shares), { ...NONE, take: { main: `${MAIN5}.mp4` } });
    assert.deepEqual(told.asks, []);
    assert.equal(told.parts[0].video.name, `${MAIN5}.mp4`);
  });
  it("takes one file once, from From Final Cut, when the same Share is also among what was released", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 3000), file(`${MAIN5}.fcpxmld`, 4000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)], [file(`${MAIN5}.mp4`, 3000)]), NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].video.where, "From Final Cut");
  });
  it("keeps a part from the last finish when what is there now is of an older version", () => {
    const record = { ...RECORD, main: { pushed: [...RECORD.main.pushed, push(6, "Pricing- what to charge- main v6 3fa9c1")] } };
    const finished = { revision: 1, parts: { main: { file: "final/Pricing- what to charge- main v6 3fa9c1.mp4", source: { bytes: 7000, mtimeMs: 5000 }, export: "final/Pricing- what to charge- main v6 3fa9c1.fcpxmld" } } };
    const got = lookFor(partsOf(record), { ...folders([file(`${REEL1}.mov`, 2000), file(`${REEL1}.fcpxmld`, 3000)], [file("Pricing- what to charge- main v4 3fa9c1.mp4", 9000), file("Pricing- what to charge- main v4 3fa9c1.fcpxmld", 9500)]), finished }, NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].kept, true);
    const again = lookFor(partsOf(record), { ...folders([file("Pricing- what to charge- main v6 3fa9c1.mp4", 8000, 7100), file("Pricing- what to charge- main v6 3fa9c1.fcpxmld", 8500), file(`${REEL1}.mov`, 2000), file(`${REEL1}.fcpxmld`, 3000)]), finished }, NONE);
    assert.equal(again.parts[0].video.name, "Pricing- what to charge- main v6 3fa9c1.mp4", "a new Share of the same version is newer");
  });
  it("takes the file a person names, wherever it is, and asks again when it names no Share of that part", () => {
    const shares = [file(`${MAIN5}.mp4`, 3000), file(`${MAIN5}.fcpxmld`, 4000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)];
    const released = [file("Pricing- what to charge- main v4 3fa9c1.mp4", 2000), file("Pricing- what to charge- main v4 3fa9c1.fcpxmld", 2500)];
    const named = lookFor(partsOf(RECORD), folders(shares, released), { ...NONE, take: { main: "Pricing- what to charge- main v4 3fa9c1.mp4" } });
    assert.deepEqual([named.parts[0].video.name, named.parts[0].video.where], ["Pricing- what to charge- main v4 3fa9c1.mp4", "the other Mac"]);
    const wrong = lookFor(partsOf(RECORD), folders(shares), { ...NONE, take: { main: "Pricing main final.mp4" } });
    assert.match(wrong.asks[0], /"Pricing main final\.mp4" is not a Shared video of the main video\. The ones there are: Pricing- what to charge- main v5 3fa9c1\.mp4\. Which is the final one\?/);
    assert.deepEqual(wrong.parts.map((p) => p.key), ["reel 1"]);
  });
  it("matches names whatever form of their accents the disk gives them, a person's answer included", () => {
    const record = { ...RECORD, main: { pushed: [push(1, "Café owners main v1 3fa9c1")] }, reels: [] };
    const nfd = "Cafe\u0301 owners main v1 3fa9c1";
    const got = lookFor(partsOf(record), folders([file(`${nfd}.mp4`, 2000), file(`${nfd}.fcpxmld`, 3000)]), NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].export.name, `${nfd}.fcpxmld`);
    const told = lookFor(partsOf(record), folders([file(`${nfd}.mp4`, 2000), file(`${nfd}.mov`, 2000), file(`${nfd}.fcpxmld`, 3000)]), { ...NONE, take: { main: "Café owners main v1 3fa9c1.mp4" } });
    assert.deepEqual(told.asks, []);
  });
  it("names a Share that Final Cut renamed, \"<project> 1\", and does not pass it by", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5} 1.mp4`, 3000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)]), NONE);
    assert.match(got.asks.join(" "), /Pricing- what to charge- main v5 3fa9c1 1\.mp4 looks like a copy Final Cut renamed, so it is not taken for the main video\. In Final Cut, Share the project "Pricing- what to charge- main v5 3fa9c1" itself, and move Pricing- what to charge- main v5 3fa9c1 1\.mp4 out of From Final Cut\./);
  });
  it("says to show a part in Final Cut first when it was never pushed", () => {
    const record = { ...RECORD, reels: [{ n: 4, status: "picked", pushed: [] }] };
    const got = lookFor(partsOf(record), folders([file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000)]), NONE);
    assert.match(got.asks[0], /Reel 4 was never shown in Final Cut\. Say "show reel 4 in Final Cut" first, then Share it, or say to leave it out of this finish\./);
    const none = lookFor(partsOf({ ...RECORD, main: { pushed: [] }, reels: [] }), folders([]), NONE);
    assert.match(none.stops[0], /The main video was never shown in Final Cut\. Say "show it in Final Cut" first, then Share it\./);
  });
  it("asks for File > Export XML… when the export is older than the Shared video, naming the project", () => {
    const got = lookFor(partsOf(RECORD), folders([file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 1000), file(`${REEL1}.mov`, 2000), file(`${REEL1}.fcpxmld`, 1000)]), NONE);
    assert.equal(got.parts.length, 2);
    assert.match(got.asks.find((a) => a.includes("Reel 1")), /Reel 1's export is older than its Shared video\. Once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "Pricing- what to charge- reel 1 v1 3fa9c1", and save it into From Final Cut\./);
    assert.ok(got.asks.every((a) => !/no hand edits/.test(a)));
  });
  it("names the project of the video taken in the export question, not the last one pushed", () => {
    const shares = [file(`${MAIN5}.fcpxmld`, 9000), file(`${REEL1}.mov`), file(`${REEL1}.fcpxmld`, 2000)];
    const got = lookFor(partsOf(RECORD), folders(shares, [file("Pricing- what to charge- main v4 3fa9c1.mp4", 2000)]), { ...NONE, take: { main: "Pricing- what to charge- main v4 3fa9c1.mp4" } });
    assert.match(got.asks[0], /The main video was never exported\. If you changed it by hand in Final Cut, then once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "Pricing- what to charge- main v4 3fa9c1"/);
  });
  it("takes 'no hand edits' as the answer for a part never exported", () => {
    const shares = [file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000), file(`${REEL1}.mov`, 2000)];
    assert.match(lookFor(partsOf(RECORD), folders(shares), NONE).asks[0], /Reel 1.*never exported.*no hand edits/s);
    assert.deepEqual(lookFor(partsOf(RECORD), folders(shares), { ...NONE, noHandEdits: ["reel 1"] }).asks, []);
  });
  it("asks about a picked Reel with no Shared video, and leaves it out when told to", () => {
    const shares = [file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000)];
    assert.match(lookFor(partsOf(RECORD), folders(shares), NONE).asks[0], /Reel 1 has no Shared video\. Share it from Final Cut into From Final Cut, and once Final Cut says the Share is done, File > Export XML… of it; or say to leave it out of this finish\./);
    const left = lookFor(partsOf(RECORD), folders(shares), { ...NONE, without: ["reel 1"] });
    assert.deepEqual(left.asks, []);
    assert.deepEqual(left.parts.map((p) => p.key), ["main"]);
  });
  it("stops when the main video has no Shared video anywhere, and says where it looked and for which names", () => {
    const got = lookFor(partsOf(RECORD), folders([]), { ...NONE, without: ["main"] });
    assert.match(got.stops[0], /main video.*Share/);
    assert.match(got.looked, /From Final Cut.*Pricing- what to charge- main v5 3fa9c1\.mov/s);
  });
  it("takes a part from what the other Mac released when nothing is newer here, and keeps a part finished before", () => {
    const finished = { revision: 1, parts: { "reel 1": { file: `final/${REEL1}.mov`, noHandEdits: true } } };
    const got = lookFor(partsOf(RECORD), { ...folders([], [file(`${MAIN5}.mp4`, 2000), file(`${MAIN5}.fcpxmld`, 3000)]), finished }, NONE);
    assert.deepEqual(got.asks, []);
    assert.equal(got.parts[0].video.where, "the other Mac");
    assert.equal(got.parts[1].kept, true);
  });
});

describe("firstWordsMatch", () => {
  it("is true when at least four of the six first words expected are heard, in order, near the start", () => {
    assert.equal(firstWordsMatch("Welcome to the show. Today we are going", "Welcome to the show today we are going to talk"), true);
    assert.equal(firstWordsMatch("Welcome to the show. Today we are going", "Okay. Welcome to the show, today we"), true);
    assert.equal(firstWordsMatch("Welcome to the show. Today we are going", "So the first thing you need to do"), false);
  });
  it("needs every expected word when fewer than six are expected", () => {
    assert.equal(firstWordsMatch("Know your costs", "Know your costs."), true);
    assert.equal(firstWordsMatch("Know your costs", "Know your price"), false);
  });
});
