// The recording's captions at their times on the main HyperFrames project's timeline (Jason's by-hand check of 30 October: the app's
// agent moved the recording to start 3 seconds in, for a title card, and `show … transcript` still printed the recording's own times).
// The page is made up in the shape of the ones the app writes (fixtures/hyperframes-0.8.208/on-screen/ and Jason's fbb80c): the
// recording is a `<video>` of the main composition with data-start, data-duration and, once the app has split it, an in-point.
// `recordingPlacements` and `captionsOnTimeline` are pure; `recordingPlacementsIn` reads a project folder made in the test's own
// temporary folder. Nothing here touches the real BRIMM Video Work, Dropbox or the files of Jason's project.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RECORDING, captionsOnTimeline, recordingPlacements, recordingPlacementsIn, timelineTranscript } from "../on-timeline.js";

/** An index.html whose main composition holds `inner`, as the app writes the page. */
const page = (inner) => `<!doctype html><html><body><div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="1920" data-height="1080">${inner}</div></body></html>`;
/** The recording's element, as the app's agent leaves it, with the attributes `attrs` after its src. */
const video = (attrs, tag = "video") => `<${tag} data-hf-id="hf-huzn" id="a-roll" class="clip" src="${RECORDING}" playsinline ${attrs} data-track-index="0"></${tag}>`;
const placements = (inner) => recordingPlacements(page(inner));
/** A caption as captionsOf gives one. */
const cap = (start, end, text = `words ${start}`) => ({ start, end, text });
const times = (lines) => lines.map((line) => [line.start, line.text]);

describe("recordingPlacements: where the page puts the recording on its timeline", () => {
  it("is the recording's own path, media/recording.mp4", () => {
    assert.equal(RECORDING, "media/recording.mp4");
  });
  it("reads the real page of Jason's fbb80c, where the app's agent moved the recording 3 seconds in for a title card", () => {
    const real = `<div data-hf-id="hf-unau" id="title" data-composition-id="title" data-composition-src="compositions/title.html" data-start="0" data-duration="3" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>
      <video data-hf-id="hf-huzn"
        id="a-roll"
        class="clip"
        src="media/recording.mp4"
        playsinline
        data-start="3"
        data-duration="184.775"
        data-track-index="0"
        style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover"
        data-has-audio="true"
      ></video>`;
    assert.deepEqual(placements(real), [{ start: 3, duration: 184.775, mediaStart: 0, rate: 1 }]);
  });
  it("takes an audio element of the recording too, and a path written with a leading ./", () => {
    assert.deepEqual(placements(video('data-start="0" data-duration="9"', "audio")), [{ start: 0, duration: 9, mediaStart: 0, rate: 1 }]);
    assert.deepEqual(placements(`<video src="./media/recording.mp4" data-start="1" data-duration="9"></video>`), [{ start: 1, duration: 9, mediaStart: 0, rate: 1 }]);
  });
  it("takes no other file, and no other kind of element", () => {
    assert.deepEqual(placements(`<video src="media/broll.mp4" data-start="0" data-duration="9"></video><img src="${RECORDING}" data-start="0" data-duration="9"><div data-src="${RECORDING}" data-start="0" data-duration="9"></div><video src="media/recording.mp4.bak" data-start="0" data-duration="9"></video>`), []);
  });
  it("gives each placement of a recording the app has split, in the order the page has them", () => {
    const split = video('data-start="0" data-duration="6"') + video('data-start="10" data-duration="8" data-playback-start="12"');
    assert.deepEqual(placements(split), [{ start: 0, duration: 6, mediaStart: 0, rate: 1 }, { start: 10, duration: 8, mediaStart: 12, rate: 1 }]);
  });
  it("reads the in-point as the command line does: data-playback-start before data-media-start, and the first that is a number", () => {
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-start="12" data-media-start="4"'))[0].mediaStart, 12);
    assert.equal(placements(video('data-start="0" data-duration="9" data-media-start="4"'))[0].mediaStart, 4);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-start="" data-media-start="4"'))[0].mediaStart, 4);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-start="soon" data-media-start="4"'))[0].mediaStart, 4);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-start="0" data-media-start="4"'))[0].mediaStart, 0);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-start="soon"'))[0].mediaStart, 0);
  });
  it("reads the playback rate, which is 1 when the page gives none that is a number", () => {
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-rate="2"'))[0].rate, 2);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-rate="0.5"'))[0].rate, 0.5);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-rate="fast"'))[0].rate, 1);
    assert.equal(placements(video('data-start="0" data-duration="9" data-playback-rate=""'))[0].rate, 1);
  });
  it("starts at 0 when the page gives no start, as the command line reads it", () => {
    assert.deepEqual(placements(video('data-duration="9"')), [{ start: 0, duration: 9, mediaStart: 0, rate: 1 }]);
    assert.deepEqual(placements(video('data-start="" data-duration="9"')), [{ start: 0, duration: 9, mediaStart: 0, rate: 1 }]);
  });
  it("finds none for a recording element whose numbers cannot be a place on the timeline", () => {
    const odd = [
      'data-start="intro" data-duration="9"', 'data-start="intro + 2" data-duration="9"', 'data-start="-1" data-duration="9"', 'data-start="0"', 'data-start="0" data-duration=""',
      'data-start="0" data-duration="0"', 'data-start="0" data-duration="-3"', 'data-start="0" data-duration="long"', 'data-start="0" data-duration="Infinity"',
      'data-start="0" data-duration="9" data-playback-start="-2"', 'data-start="0" data-duration="9" data-playback-rate="0"', 'data-start="0" data-duration="9" data-playback-rate="-1"'
    ];
    for (const attrs of odd) assert.deepEqual(placements(video(attrs)), [], attrs);
  });
  it("finds none at all when any element of the recording cannot be read as a placement, since where the rest of it is not known", () => {
    // A start by another clip's name is legal in HyperFrames (the second is 4.5 s on from the first's end, say), and not a time here.
    const first = video('data-start="0" data-duration="4.5"');
    const byName = video('data-start="title" data-duration="10" data-media-start="4.5"');
    const fine = video('data-start="2" data-duration="9"');
    assert.deepEqual(placements(first), [{ start: 0, duration: 4.5, mediaStart: 0, rate: 1 }]);
    assert.deepEqual(placements(first + byName), []);
    assert.deepEqual(placements(byName + first), []);
    assert.deepEqual(placements(first + byName + fine), []);
    assert.deepEqual(placements(first + video('data-start="0" data-duration="9" data-playback-rate="0"')), []);
    assert.deepEqual(placements(first + video('data-duration="0"', "audio")), []);
  });
  it("finds none at all when the recording is also in a composition nested inside the main one or inside a host, beside one that can be read", () => {
    const fine = video('data-start="2" data-duration="9"');
    const inline = `<div id="inner" data-composition-id="inner" data-start="20" data-duration="10">${video('data-start="1" data-duration="9"')}</div>`;
    const host = `<div id="h" data-composition-id="h" data-composition-src="compositions/h.html" data-start="5" data-duration="9">${video('data-start="1" data-duration="9"')}</div>`;
    const bareHost = `<div id="h" data-composition-src="compositions/h.html" data-start="5" data-duration="9">${video('data-start="1" data-duration="9"')}</div>`;
    assert.deepEqual(placements(fine + inline), []);
    assert.deepEqual(placements(fine + host), []);
    assert.deepEqual(placements(fine + bareHost), []);
    // A page with no main composition around the recording, and a host holding it: still not the timeline's.
    assert.deepEqual(recordingPlacements(`<div data-composition-src="compositions/h.html">${video('data-start="1" data-duration="9"')}</div>${video('data-start="2" data-duration="9"')}`), []);
    // Another file's elements are not the recording's, whatever they sit in.
    assert.deepEqual(placements(fine + `<div data-composition-src="compositions/h.html"><video src="media/broll.mp4" data-start="1" data-duration="9"></video></div>`), [{ start: 2, duration: 9, mediaStart: 0, rate: 1 }]);
  });
  it("reads the placements anywhere in index.html's own markup, but not in a composition nested inside the main one or one a host names", () => {
    const wrapped = `<div class="layer">${video('data-start="1" data-duration="9"')}</div>`;
    assert.deepEqual(placements(wrapped), [{ start: 1, duration: 9, mediaStart: 0, rate: 1 }]);
    // An inline composition has a clock of its own: a start in it is its own, not the timeline's.
    const inline = `<div id="inner" data-composition-id="inner" data-start="20" data-duration="10">${video('data-start="1" data-duration="9"')}</div>`;
    assert.deepEqual(placements(inline), []);
    // A host's file (compositions/…) is not read at all: it is not index.html's own markup.
    const host = `<div id="h" data-composition-id="h" data-composition-src="compositions/h.html" data-start="5" data-duration="9">${video('data-start="1" data-duration="9"')}</div>`;
    assert.deepEqual(placements(host), []);
  });
  it("finds none in a page that holds none, that is not a page, or that is not text", () => {
    assert.deepEqual(recordingPlacements(page("<h1>Hi</h1>")), []);
    assert.deepEqual(recordingPlacements("not html at all"), []);
    assert.deepEqual(recordingPlacements(""), []);
    for (const nothing of [undefined, null, 5, {}, []]) assert.deepEqual(recordingPlacements(nothing), [], String(nothing));
  });
  it("finds none in a page with more elements than a page is read for", () => {
    const many = page(`${"<span></span>".repeat(200001)}${video('data-start="0" data-duration="9"')}`);
    assert.deepEqual(recordingPlacements(many), []);
  });
  it("reads a recording that is in markup the reader finds odd: a self-closed tag, single quotes, no quotes, upper case", () => {
    assert.deepEqual(placements(`<video src='media/recording.mp4' data-start=2 data-duration='9' />`), [{ start: 2, duration: 9, mediaStart: 0, rate: 1 }]);
    assert.deepEqual(placements(`<VIDEO SRC="media/recording.mp4" DATA-START="2" DATA-DURATION="9"></VIDEO>`), [{ start: 2, duration: 9, mediaStart: 0, rate: 1 }]);
  });
});

describe("captionsOnTimeline: the captions at the first moment of them that is on the timeline", () => {
  const whole = [{ start: 3, duration: 20, mediaStart: 0, rate: 1 }];
  it("moves every caption by the recording's start", () => {
    assert.deepEqual(times(captionsOnTimeline([cap(0, 4, "a"), cap(5, 9, "b")], whole)), [[3, "a"], [8, "b"]]);
    assert.deepEqual(times(captionsOnTimeline([cap(0, 4, "a"), cap(5, 9, "b")], [{ ...whole[0], start: 0 }])), [[0, "a"], [5, "b"]]);
  });
  it("gives the end of a caption on the timeline too, by the same shift", () => {
    assert.deepEqual(captionsOnTimeline([cap(5, 9, "b")], whole), [{ start: 8, end: 12, text: "b" }]);
  });
  it("maps a split recording piece by piece, and leaves out the stretch that was cut", () => {
    const split = [{ start: 0, duration: 6, mediaStart: 0, rate: 1 }, { start: 6, duration: 10, mediaStart: 12, rate: 1 }];
    const captions = [cap(0, 4, "first"), cap(5, 9, "straddles the cut"), cap(7, 8, "in the cut"), cap(12, 15, "after it")];
    assert.deepEqual(times(captionsOnTimeline(captions, split)), [[0, "first"], [5, "straddles the cut"], [6, "after it"]]);
  });
  it("starts a caption that begins before a piece's in-point at the start of the piece", () => {
    const piece = [{ start: 6, duration: 10, mediaStart: 12, rate: 1 }];
    assert.deepEqual(captionsOnTimeline([cap(11, 14, "begins in the cut")], piece), [{ start: 6, end: 8, text: "begins in the cut" }]);
  });
  it("leaves out a caption that only touches a piece's edge, and one wholly outside every piece", () => {
    const piece = [{ start: 0, duration: 10, mediaStart: 10, rate: 1 }];
    assert.deepEqual(captionsOnTimeline([cap(8, 10, "ends where the piece begins"), cap(20, 22, "starts where the piece ends"), cap(0, 1, "before"), cap(30, 31, "after")], piece), []);
    assert.deepEqual(times(captionsOnTimeline([cap(19, 21, "reaches in")], piece)), [[9, "reaches in"]]);
  });
  it("puts the captions in timeline order, whatever order the pieces are laid in", () => {
    const moved = [{ start: 20, duration: 6, mediaStart: 0, rate: 1 }, { start: 0, duration: 10, mediaStart: 12, rate: 1 }];
    const captions = [cap(0, 4, "was first"), cap(5, 9, "was second"), cap(12, 15, "was third")];
    assert.deepEqual(times(captionsOnTimeline(captions, moved)), [[0, "was third"], [20, "was first"], [25, "was second"]]);
  });
  it("gives a caption that two pieces both show its earliest time, once", () => {
    const twice = [{ start: 30, duration: 10, mediaStart: 0, rate: 1 }, { start: 5, duration: 10, mediaStart: 0, rate: 1 }];
    assert.deepEqual(times(captionsOnTimeline([cap(2, 4, "shown twice")], twice)), [[7, "shown twice"]]);
  });
  it("keeps the order of two captions that land on the same moment", () => {
    const stacked = [{ start: 0, duration: 10, mediaStart: 0, rate: 1 }, { start: 0, duration: 10, mediaStart: 0, rate: 1 }];
    assert.deepEqual(captionsOnTimeline([cap(1, 2, "one"), cap(1, 3, "two")], stacked).map((c) => c.text), ["one", "two"]);
  });
  it("takes the media a piece plays to be its duration times its rate, and the time on the timeline to be the media's over the rate", () => {
    const fast = [{ start: 0, duration: 5, mediaStart: 0, rate: 2 }];
    // 5 seconds at twice the speed play 10 seconds of the recording.
    assert.deepEqual(times(captionsOnTimeline([cap(5, 9, "in"), cap(12, 15, "past the end"), cap(9, 11, "reaches in")], fast)), [[2.5, "in"], [4.5, "reaches in"]]);
    const slow = [{ start: 4, duration: 10, mediaStart: 2, rate: 0.5 }];
    assert.deepEqual(times(captionsOnTimeline([cap(1, 3, "begins before"), cap(3, 4, "in"), cap(7, 8, "past the end")], slow)), [[4, "begins before"], [6, "in"]]);
  });
  it("places a caption of no length by the moment it is at, which is in a piece from its in-point to just before its end", () => {
    const piece = [{ start: 1, duration: 4, mediaStart: 10, rate: 1 }];
    assert.deepEqual(times(captionsOnTimeline([cap(10, 10, "at the in-point"), cap(12, 12, "inside"), cap(14, 14, "at the end"), cap(9.9, 9.9, "before")], piece)), [[1, "at the in-point"], [3, "inside"]]);
  });
  it("gives nothing for no captions or no placements", () => {
    assert.deepEqual(captionsOnTimeline([], whole), []);
    assert.deepEqual(captionsOnTimeline([cap(0, 4)], []), []);
  });
  it("does not change what it is given", () => {
    const captions = Object.freeze([Object.freeze(cap(0, 4, "a"))]);
    const given = Object.freeze([Object.freeze({ ...whole[0] })]);
    assert.deepEqual(times(captionsOnTimeline(captions, given)), [[3, "a"]]);
  });
});

describe("timelineTranscript: the stamped text of those captions", () => {
  const SRT = "1\n00:00:00,000 --> 00:00:04,000\n Welcome to the show.\n\n2\n00:00:05,000 --> 00:00:09,000\n So the first thing\nyou need to do.\n\n3\n00:00:12,000 --> 00:00:15,000\n Thank you so much, Sallie.\n\n";
  it("is the lines of the transcript tool's own stamping, one for each caption, at its time on the timeline", () => {
    const text = timelineTranscript(SRT, [{ start: 3, duration: 20, mediaStart: 0, rate: 1 }]);
    assert.equal(text, "[0:03] Welcome to the show.\n[0:08] So the first thing you need to do.\n[0:15] Thank you so much, Sallie.\n");
  });
  it("tells a time past the hour as the stamping does, and a start below a second to the second before", () => {
    const text = timelineTranscript("1\n00:00:00,000 --> 00:00:02,000\n Hello.\n\n", [{ start: 3599.6, duration: 20, mediaStart: 0, rate: 1 }]);
    assert.equal(text, "[59:59] Hello.\n");
    assert.equal(timelineTranscript("1\n00:00:00,000 --> 00:00:02,000\n Hello.\n\n", [{ start: 3600, duration: 20, mediaStart: 0, rate: 1 }]), "[1:00:00] Hello.\n");
  });
  it("is empty when the file has captions and none is on the timeline", () => {
    assert.equal(timelineTranscript(SRT, [{ start: 0, duration: 2, mediaStart: 100, rate: 1 }]), "");
  });
  it("is null, which is no answer, when the file holds no captions: empty, or not captions", () => {
    for (const given of ["", "\n\n", "not captions", "1\nsoon --> later\nWords\n\n", undefined, null]) {
      assert.equal(timelineTranscript(given, [{ start: 0, duration: 2, mediaStart: 0, rate: 1 }]), null, JSON.stringify(given));
    }
  });
});

describe("recordingPlacementsIn: from a project folder", () => {
  const dirs = [];
  const folder = (files = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "brimm-timeline-"));
    dirs.push(dir);
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    return dir;
  };
  const PAGE = page(video('data-start="3" data-duration="9"'));
  it("reads index.html", () => {
    assert.deepEqual(recordingPlacementsIn(folder({ "index.html": PAGE })), [{ start: 3, duration: 9, mediaStart: 0, rate: 1 }]);
    rmAll();
  });
  it("finds none where there is no folder, no index.html, or index.html is a folder", () => {
    const base = folder();
    assert.deepEqual(recordingPlacementsIn(join(base, "nothing")), []);
    assert.deepEqual(recordingPlacementsIn(base), []);
    mkdirSync(join(base, "index.html"));
    assert.deepEqual(recordingPlacementsIn(base), []);
    for (const nothing of ["", undefined, null, 5]) assert.deepEqual(recordingPlacementsIn(nothing), [], String(nothing));
    rmAll();
  });
  it("does not read index.html through a link, or one of more than 2 MB", () => {
    const linked = folder({ "real.html": PAGE });
    symlinkSync(join(linked, "real.html"), join(linked, "index.html"));
    assert.deepEqual(recordingPlacementsIn(linked), []);
    const big = folder({ "index.html": page(video('data-start="3" data-duration="9"')) + " ".repeat(2 * 1024 * 1024) });
    assert.deepEqual(recordingPlacementsIn(big), []);
    rmAll();
  });
  function rmAll() {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  }
});
