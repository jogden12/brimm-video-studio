// The parts of the transcript tool that this tool shares, which need no video and no transcriber: which files it takes,
// what it names its files, and what it asks the two programs to do.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMedia, outputsFor, dayFolder, ffmpegArgs, whisperArgs, silenceArgs, silences, dropSilent, spellNames, PROMPT, stampedText, captionCount, captionsOf, settled } from "../lib.js";
import { tidyTranscript, hasStamps } from "../shared/transcript.js";

const SRT = `1
00:00:00,000 --> 00:00:02,400
You want to make more money,

2
00:00:02,400 --> 00:00:05,100
but you can't keep taking on more work.

3
00:01:07,000 --> 00:01:10,000
So how do you grow from here?
`;

describe("which files it takes", () => {
  it("takes video and audio files, whatever the case of the ending", () => {
    for (const n of ["episode.mp4", "Episode 12 FINAL.MOV", "cut.m4v", "audio.m4a", "audio.mp3", "audio.wav", "a.b.c.mkv"]) assert.equal(isMedia(n), true, n);
  });
  it("leaves alone its own files, hidden files and files still arriving", () => {
    for (const n of ["episode.srt", "episode.transcript.txt", "episode.failed.txt", ".DS_Store", ".episode.mp4", "episode.mp4.part", "episode.mp4.download", "episode.mp4.crdownload", "notes", ""]) assert.equal(isMedia(n), false, n);
  });
  it("names its files after the video, beside it or in the folder asked for", () => {
    assert.deepEqual(outputsFor("/in/My Episode.final.mp4"), {
      base: "My Episode.final", srt: "/in/My Episode.final.srt", txt: "/in/My Episode.final.transcript.txt", failed: "/in/My Episode.final.failed.txt"
    });
    assert.equal(outputsFor("/in/a.mov", "/out").srt, "/out/a.srt");
  });
});

describe("the folder a finished video is filed in", () => {
  it("is named for the day", () => {
    assert.equal(dayFolder([], "2026-10-13"), "2026-10-13");
    assert.equal(dayFolder(["a.mp4", "a.srt", "2026-10-12", "2026-10-12-2"], "2026-10-13"), "2026-10-13");
  });
  it("is always a new one: numbered from 2 when the day's name is taken, by a folder or by a file", () => {
    assert.equal(dayFolder(["2026-10-13"], "2026-10-13"), "2026-10-13-2");
    assert.equal(dayFolder(["2026-10-13-2", "a.mp4", "2026-10-13"], "2026-10-13"), "2026-10-13-3");
    const nine = ["2026-10-13", ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => "2026-10-13-" + n)];
    assert.equal(dayFolder(nine, "2026-10-13"), "2026-10-13-10");
    assert.equal(dayFolder([...nine, "2026-10-13-10"], "2026-10-13"), "2026-10-13-11");
  });
  it("takes the first name that is free, so a folder that was renamed or taken away gives its name back", () => {
    assert.equal(dayFolder(["2026-10-13-2"], "2026-10-13"), "2026-10-13");
    assert.equal(dayFolder(["2026-10-13", "2026-10-13-3"], "2026-10-13"), "2026-10-13-2");
  });
});

describe("what it asks the two programs to do", () => {
  it("has ffmpeg take the sound out as the kind of file the transcriber reads, never asking a question", () => {
    assert.deepEqual(ffmpegArgs("/in/a b.mp4", "/tmp/x.wav"), ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", "/in/a b.mp4", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "/tmp/x.wav"]);
  });
  it("has the transcriber write an .srt of short lines, in English, with the show's names spelled out for it", () => {
    const a = whisperArgs({ model: "/m/model.bin", wav: "/tmp/x.wav", outBase: "/tmp/x" });
    const after = (flag) => a[a.indexOf(flag) + 1];
    assert.deepEqual([after("-m"), after("-f"), after("-of"), after("-l"), after("-ml")], ["/m/model.bin", "/tmp/x.wav", "/tmp/x", "en", "60"]);
    assert.ok(a.includes("-osrt") && a.includes("-sow"));
    assert.equal(after("--prompt"), PROMPT);
    assert.match(PROMPT, /Sallie Ogden/);
    assert.match(PROMPT, /The BRIMM/);
  });
});

describe("what it writes", () => {
  it("makes the plain-text transcript exactly as BRIMM Ops reads the .srt, one timestamped line per caption", () => {
    assert.equal(stampedText(SRT), "[0:00] You want to make more money,\n[0:02] but you can't keep taking on more work.\n[1:07] So how do you grow from here?\n");
    assert.equal(stampedText(SRT).trim(), tidyTranscript(SRT));
    assert.equal(hasStamps(stampedText(SRT)), true);
  });
  it("counts the captions, and finds none in a file that is empty or is not captions", () => {
    assert.equal(captionCount(SRT), 3);
    assert.equal(captionCount(""), 0);
    assert.equal(captionCount("just some words\nwith no times"), 0);
  });
});

describe("a file that is still arriving", () => {
  it("is ready once its size has stopped changing and it is not empty", () => {
    assert.equal(settled([100, 250, 250]), true);
    assert.equal(settled([100, 250]), false);
    assert.equal(settled([250]), false);
    assert.equal(settled([0, 0]), false);
    assert.equal(settled([]), false);
  });
});

describe("captions written over silence", () => {
  // What ffmpeg prints when it is asked where the silences are: the first minutes of a real recording.
  const HEARD = `[Parsed_silencedetect_0 @ 0x7b12c44900] silence_start: 0
[Parsed_silencedetect_0 @ 0x7b12c44900] silence_end: 5.046812 | silence_duration: 5.046812
[Parsed_silencedetect_0 @ 0x7b12c44900] silence_start: 5.440563
[Parsed_silencedetect_0 @ 0x7b12c44900] silence_end: 104.286812 | silence_duration: 98.846249
[Parsed_silencedetect_0 @ 0x7b12c44900] silence_start: 682.0655
[Parsed_silencedetect_0 @ 0x7b12c44900] silence_end: 687.186312 | silence_duration: 5.120813
`;
  // What the transcriber wrote of it: words nobody said over the silent opening, then the conversation.
  const WRITTEN = `1
00:00:00,000 --> 00:00:29,980
 Thank you.

2
00:01:30,000 --> 00:01:38,000
 Thank you.

3
00:01:45,000 --> 00:01:46,740
 Hey, Charlie, how are you?

4
00:11:19,260 --> 00:11:26,990
 coaching clients. Um, um, and also I envision having a lot

5
01:12:16,140 --> 01:12:16,580
 Thank you.

`;
  it("has ffmpeg say where the sound is silent for five seconds or more, and write no file", () => {
    assert.deepEqual(silenceArgs("/tmp/x.wav"), ["-nostdin", "-hide_banner", "-nostats", "-i", "/tmp/x.wav", "-af", "silencedetect=noise=-45dB:d=5", "-f", "null", "-"]);
  });
  it("reads the silences from what ffmpeg prints", () => {
    assert.deepEqual(silences(HEARD), [[0, 5.046812], [5.440563, 104.286812], [682.0655, 687.186312]]);
    assert.deepEqual(silences("size=N/A time=01:12:19.39 bitrate=N/A speed=2.1e+03x\n"), []);
  });
  it("takes a silence that never ends as lasting to the end of the recording", () => {
    assert.deepEqual(silences("[Parsed_silencedetect_0 @ 0x1] silence_start: 4300.5\n"), [[4300.5, Infinity]]);
  });
  it("leaves out a caption that lies in a silence, and numbers the rest again", () => {
    const r = dropSilent(WRITTEN, silences(HEARD));
    assert.equal(r.dropped, 2);
    assert.equal(r.srt, "1\n00:01:45,000 --> 00:01:46,740\n Hey, Charlie, how are you?\n\n2\n00:11:19,260 --> 00:11:26,990\n coaching clients. Um, um, and also I envision having a lot\n\n3\n01:12:16,140 --> 01:12:16,580\n Thank you.\n");
  });
  it("keeps a caption that only runs over a pause, and the same words where somebody says them", () => {
    const kept = dropSilent(WRITTEN, silences(HEARD)).srt;
    assert.match(kept, /coaching clients/);
    assert.match(kept, /01:12:16,140 --> 01:12:16,580\n Thank you\./);
  });
  it("gives the captions back as they were when none lies in a silence", () => {
    assert.deepEqual(dropSilent(SRT, []), { srt: SRT, dropped: 0 });
    assert.deepEqual(dropSilent(SRT, [[200, 300]]), { srt: SRT, dropped: 0 });
  });
});

describe("the captions of a file, one by one", () => {
  it("are each the second it starts at, the second it ends at, and its words", () => {
    assert.deepEqual(captionsOf("1\n00:00:00,000 --> 00:00:04,780\n Welcome to the show.\n\n2\n00:01:04,780 --> 01:00:08,905\n Today we are\n going to talk about pricing.\n\n"), [
      { start: 0, end: 4.78, text: "Welcome to the show." },
      { start: 64.78, end: 3608.905, text: "Today we are\n going to talk about pricing." }
    ]);
  });
  it("are read from a file with the line ends of Windows, and from one whose captions have no numbers", () => {
    assert.deepEqual(captionsOf("1\r\n00:00:01,000 --> 00:00:02,500\r\nHello.\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nGoodbye.\r\n"), [{ start: 1, end: 2.5, text: "Hello." }, { start: 3, end: 4, text: "Goodbye." }]);
    assert.deepEqual(captionsOf("00:00:01.000 --> 00:00:02.500\nHello."), [{ start: 1, end: 2.5, text: "Hello." }]);
  });
  it("are none for a text that holds no captions", () => {
    assert.deepEqual(captionsOf("[0:00] Welcome to the show.\n[0:04] Today we are going to talk about pricing.\n"), []);
    assert.deepEqual(captionsOf(""), []);
  });
});

describe("the host's name", () => {
  it("is spelled Sallie wherever the transcriber wrote Sally", () => {
    assert.equal(spellNames(" Thank you so much, Sally.\n Sally's show, with Sallyanne."), " Thank you so much, Sallie.\n Sallie's show, with Sallyanne.");
  });
});

describe("a caption with no length", () => {
  // The transcriber sometimes gives its invented words a start and an end that are the same moment.
  const SILENT = [[0, 368]];
  const MOMENTS = "1\n00:03:32,000 --> 00:03:32,000\n Thank you.\n\n2\n00:06:08,000 --> 00:06:09,000\n So.\n\n3\n00:10:00,000 --> 00:10:00,000\n Okay.\n\n";
  it("is left out when its moment lies in a silence", () => {
    const r = dropSilent(MOMENTS, SILENT);
    assert.equal(r.dropped, 1);
    assert.equal(r.srt, "1\n00:06:08,000 --> 00:06:09,000\n So.\n\n2\n00:10:00,000 --> 00:10:00,000\n Okay.\n");
  });
  it("is kept when somebody is speaking at that moment, and at the moment a silence ends", () => {
    assert.match(dropSilent(MOMENTS, SILENT).srt, /00:10:00,000 --> 00:10:00,000\n Okay\./);
    assert.deepEqual(dropSilent("1\n00:06:08,000 --> 00:06:08,000\n So.\n", SILENT), { srt: "1\n00:06:08,000 --> 00:06:08,000\n So.\n", dropped: 0 });
  });
});

describe("a transcript that came with a Zoom call", () => {
  // Zoom's own transcript. Despite its name it is WebVTT.
  const ZOOM = "WEBVTT\n\n1\n00:06:08.000 --> 00:06:09.000\nSallie Ogden: Hi.\n\n2\n00:06:10.500 --> 01:02:03.250\nPat Example: Hello, Sallie.\n";
  const CHAT = "00:12:01\tPat Example:\tHere is the link\n00:12:40\tSallie Ogden:\tThank you\n";
  // `captionCount` reads Zoom's times, written with a full stop, as it reads an .srt's, and finds none in a chat file.
  it("holds caption time lines, which a chat file does not", () => {
    assert.equal(captionCount(ZOOM), 2);
    assert.equal(captionCount(CHAT), 0);
  });
});
