// The names brimm-video makes from other names: the file-safe form of a name, the name of a new episode's folder, and the
// short form of a Mac's name, and the names a push gives its project and its timeline. Nothing here touches a disk.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileSafe, episodeFolderName, machineSlug, shortId, projectName, timelineFile } from "../names.js";

describe("the file-safe form of a name", () => {
  it("has a dash for each character Dropbox calls incompatible", () => {
    assert.equal(fileSafe("Pricing: what to charge?"), "Pricing- what to charge-");
    assert.equal(fileSafe('a/b\\c:d*e?f"g<h>i|j'), "a-b-c-d-e-f-g-h-i-j");
  });
  it("has a space for each control character, one space for each run of white space, and none at either end", () => {
    assert.equal(fileSafe("  Q&A:\t2026/10 \n part\u0007two\r\n"), "Q&A- 2026-10 part two");
    assert.equal(fileSafe("Sallie's   talk #1 & 100%"), "Sallie's talk #1 & 100%");
  });
  it("is video when nothing is left of the name", () => {
    for (const empty of ["", "   ", "\n\u0000\u001f", undefined, null]) assert.equal(fileSafe(empty), "video", JSON.stringify(empty));
  });
});

describe("the name of a new episode's folder", () => {
  it("is the day, the file-safe form of the video's name and this Mac's name", () => {
    assert.equal(episodeFolderName([], "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)");
    assert.equal(episodeFolderName([".importing"], "2026-10-14", "Pricing: what to charge?", "Mac Studio"), "2026-10-14 Pricing- what to charge- (Mac Studio)");
  });
  it("gets -2, -3 and so on when that is taken on this Mac", () => {
    const names = ["2026-10-14 Pricing talk (Mac Studio)"];
    assert.equal(episodeFolderName(names, "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)-2");
    names.push("2026-10-14 Pricing talk (Mac Studio)-2");
    assert.equal(episodeFolderName(names, "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)-3");
  });
  it("is never the one the other Mac took for a video of the same name on the same day", () => {
    const taken = ["2026-10-14 Pricing talk (Sallie's laptop)"];
    assert.equal(episodeFolderName(taken, "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)");
  });
  it("counts a name as taken whatever its case and however its accents are written", () => {
    assert.equal(episodeFolderName(["2026-10-14 PRICING TALK (mac studio)"], "2026-10-14", "Pricing talk", "Mac Studio"), "2026-10-14 Pricing talk (Mac Studio)-2");
    assert.equal(episodeFolderName(["2026-10-14 Cafe\u0301 talk (Mac Studio)"], "2026-10-14", "Caf\u00e9 talk", "Mac Studio"), "2026-10-14 Caf\u00e9 talk (Mac Studio)-2");
  });
  it("is the day, video and the Mac's name when nothing is left of the video's name", () => {
    assert.equal(episodeFolderName([], "2026-10-14", " \t ", "Mac Studio"), "2026-10-14 video (Mac Studio)");
  });
});

describe("the names a push gives", () => {
  it("has the short id, the last six characters of the episode's id", () => {
    assert.equal(shortId("e-20261014-3fa9c1"), "3fa9c1");
  });
  it("names a project by the file-safe name, the part, the version and the short id", () => {
    assert.equal(projectName({ name: "Pricing: what to charge?", part: "main", v: 3, id: "e-20261014-3fa9c1" }), "Pricing- what to charge- main v3 3fa9c1");
    assert.equal(projectName({ name: "Pricing talk", part: { reel: 2 }, v: 1, id: "e-20261014-3fa9c1" }), "Pricing talk reel 2 v1 3fa9c1");
  });
  it("names the timeline kept in edit/ by the part, the version and the Mac, and the import's own as version 0", () => {
    assert.equal(timelineFile({ part: "main", v: 0 }), "edit/main.v0.fcpxml");
    assert.equal(timelineFile({ part: "main", v: 3, machine: "Mac Studio" }), "edit/main.v3.mac-studio.fcpxml");
    assert.equal(timelineFile({ part: { reel: 2 }, v: 1, machine: "Sallie's laptop" }), "edit/reel-2.v1.sallies-laptop.fcpxml");
  });
});

describe("the short form of a Mac's name", () => {
  it("is in small letters, with no apostrophe, and a dash for each run of anything but letters and digits", () => {
    assert.equal(machineSlug("Sallie's laptop"), "sallies-laptop");
    assert.equal(machineSlug("Mac Studio"), "mac-studio");
    assert.equal(machineSlug("Sallie’s MacBook Pro (M4, 2024)"), "sallies-macbook-pro-m4-2024");
  });
  it("has no dash at either end", () => {
    assert.equal(machineSlug(" -Studio 2- "), "studio-2");
  });
});
