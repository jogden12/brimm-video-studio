// Where an episode's files are (Phase 3, L2; design D1 and D2): a record that holds `local` keeps its own files on the Mac `local.on`, in its
// work folder's video/, and its folder in Dropbox keeps record/, final/, history/, Original files/ and a plan's three files. A file's place is
// its name. where.js says the place of each file, the folder of each place and the path of each file, and which Mac a record is kept on when
// it is not this one. It is pure: nothing here reads or writes a file.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ON_OTHER_MAC, PLAN_FILES, fileAt, filePlace, folderAt, onOtherMac } from "../where.js";
import { PLAN_FILE_NAMES } from "../plan.js";
import { spokenMac } from "../kinds.js";
import { episodeFilesFolder } from "../settings.js";

const HOME = "/Users/sallie";
const NAME = "2026-11-06 IMG (Mac Studio)";
const FOLDER = join("/Users/sallie/Library/CloudStorage/Dropbox/The BRIMM DB/BRIMM Video/Episodes", NAME);
const CTX = { home: HOME, machine: "Mac Studio" };
/** A record kept on the Mac Studio (layout 6), and one that is not: the same but for `local`. */
const LOCAL = { id: "e-20261106-3fa9c1", version: 6, local: { on: "Mac Studio" } };
const DROPBOX = { id: "e-20261106-3fa9c1", version: 5 };
/** The files the brief names, and where each is on a record with `local`: the recording, its words and the rough cut's captions on the Mac; what
    is set aside, the hand-off's, the recording copied after the hand-off, a plan's file and a record in Dropbox. */
const NAMES = [
  ["IMG.mov", "local"],
  ["IMG.words.json", "local"],
  ["IMG.rough-cut.srt", "local"],
  ["history/2026-11-06T10-00-00 IMG.cut-plan.json", "dropbox"],
  ["final/IMG.mp4", "dropbox"],
  ["Original files/IMG.mov", "dropbox"],
  ["teleprompter.txt", "dropbox"],
  ["record/0002.json", "dropbox"]
];
/** The episode's own folder on this Mac: its work folder's video/. */
const VIDEO = join(HOME, "BRIMM Video Work", NAME, "video");

describe("filePlace, where a file a record lists is", () => {
  it("is on the Mac for every name of a record with `local` but record/, final/, history/, Original files/ and a plan's three files", () => {
    for (const [rel, place] of NAMES) assert.equal(filePlace(LOCAL, rel), place, rel);
    for (const rel of PLAN_FILE_NAMES) assert.equal(filePlace(LOCAL, rel), "dropbox", rel);
    for (const rel of ["final", "history/0003.json", "Original files/Part 2.mov", "record/0001.json"]) assert.equal(filePlace(LOCAL, rel), "dropbox", rel);
  });
  it("is in Dropbox for every name of a record without `local`, as every file was before", () => {
    for (const [rel] of NAMES) assert.equal(filePlace(DROPBOX, rel), "dropbox", rel);
    for (const record of [{ ...LOCAL, local: null }, { ...LOCAL, local: undefined }, {}, null, undefined]) assert.equal(filePlace(record, "IMG.mov"), "dropbox", JSON.stringify(record));
  });
  it("takes a plan's file by its whole name alone: a file of that name in a folder of the episode is the Mac's", () => {
    assert.equal(filePlace(LOCAL, "teleprompter.txt"), "dropbox");
    assert.equal(filePlace(LOCAL, "notes/teleprompter.txt"), "local");
    assert.equal(filePlace(LOCAL, "teleprompter.txt.bak"), "local");
    assert.equal(filePlace(LOCAL, "finals/IMG.mp4"), "local", "a folder whose name only starts as final/'s is no final/");
  });
  it("names a plan's three files as plan.js does", () => {
    assert.deepEqual([...PLAN_FILES], [...PLAN_FILE_NAMES]);
  });
});

describe("folderAt and fileAt, the folder of a place and the path of a file", () => {
  it("is the episode's folder in Dropbox for a file in Dropbox, and its video/ on this Mac for a file of a record with `local`", () => {
    assert.equal(folderAt(CTX, { folder: FOLDER, record: LOCAL }, "dropbox"), FOLDER);
    assert.equal(folderAt(CTX, { folder: FOLDER, record: LOCAL }, "local"), VIDEO);
    assert.equal(VIDEO, episodeFilesFolder(HOME, NAME));
    for (const [rel, place] of NAMES) assert.equal(fileAt(CTX, { folder: FOLDER, record: LOCAL }, rel), join(place === "local" ? VIDEO : FOLDER, rel), rel);
  });
  it("is the episode's folder in Dropbox for every place and file of a record without `local`", () => {
    for (const place of ["dropbox", "local"]) assert.equal(folderAt(CTX, { folder: FOLDER, record: DROPBOX }, place), FOLDER, place);
    for (const [rel] of NAMES) assert.equal(fileAt(CTX, { folder: FOLDER, record: DROPBOX }, rel), join(FOLDER, rel), rel);
  });
  it("finds the folder on this Mac by the episode's folder's name, wherever its folder in Dropbox is", () => {
    assert.equal(folderAt({ home: "/Users/jason", machine: "Jason's MacBook" }, { folder: join("/elsewhere/Episodes", NAME), record: LOCAL }, "local"), join("/Users/jason/BRIMM Video Work", NAME, "video"));
  });
});

describe("onOtherMac, the Mac a record is kept on when it is not this one", () => {
  it("is the record's Mac on any other Mac, and nothing on its own", () => {
    assert.equal(onOtherMac({ machine: "Jason's MacBook" }, LOCAL), "Mac Studio");
    assert.equal(onOtherMac({ machine: "Sallie's laptop" }, LOCAL), "Mac Studio");
    assert.equal(onOtherMac({ machine: "Mac Studio" }, LOCAL), "");
    assert.equal(onOtherMac({ machine: "Mac Studio" }, { ...LOCAL, local: { on: "Jason's MacBook", original: { file: "IMG.mov", bytes: 1, mtimeMs: 1 } } }), "Jason's MacBook");
  });
  it("is nothing for a record without `local`, or with one that names no Mac, and for what is not a record", () => {
    for (const record of [DROPBOX, { ...LOCAL, local: null }, { ...LOCAL, local: {} }, { ...LOCAL, local: { on: "" } }, { ...LOCAL, local: { on: 3 } }, { ...LOCAL, local: "Mac Studio" }, null, undefined, "x", []]) {
      assert.equal(onOtherMac({ machine: "Jason's MacBook" }, record), "", JSON.stringify(record));
    }
  });
});

describe("ON_OTHER_MAC, what every command that names an episode kept on another Mac says there", () => {
  it("names the episode as every line names it, and the Mac as a sentence says it, and says nothing was changed", () => {
    assert.equal(ON_OTHER_MAC("Pricing talk", "Mac Studio"), '"Pricing talk" is on the Mac Studio: carry on there. Nothing was changed.');
    assert.equal(ON_OTHER_MAC("Video of 6 Nov, 10:00 (Mac Studio)", "Mac Studio"), '"Video of 6 Nov, 10:00 (Mac Studio)" is on the Mac Studio: carry on there. Nothing was changed.');
    assert.equal(ON_OTHER_MAC("Pricing talk", "Sallie's laptop"), "\"Pricing talk\" is on Sallie's laptop: carry on there. Nothing was changed.");
  });
  it("says each Mac as kinds.js spokenMac does", () => {
    for (const mac of ["Mac Studio", "Sallie's laptop", "Jason's MacBook", "Sallie’s MacBook Air", "MacBook Pro"]) {
      assert.equal(ON_OTHER_MAC("x", mac), `"x" is on ${spokenMac(mac)}: carry on there. Nothing was changed.`, mac);
    }
  });
});
