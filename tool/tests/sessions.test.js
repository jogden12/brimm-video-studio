// The names of a private session: the speakers replaced before the call, the names brimm-video can see, the name check on a
// reply, and what she approves item by item. None of it needs a disk, a program or Claude. Every name here is made up.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { replaceSpeakers, visibleNames, namesSkipped, checkNames, holdsName, approve, undecided, approvedSession, EDITS, NOT_NAMES, PUBLIC_NAMES } from "../sessions.js";

const lines = (...l) => l.join("\n");
/** Words as a words file has them, each with a space round it, as the transcriber writes them. */
const say = (text) => text.split(" ").map((w) => ({ w: ` ${w} ` }));
const copy = (v) => JSON.parse(JSON.stringify(v));
const sortedNames = (names) => [...names].sort();

describe("the speakers of a Zoom transcript", () => {
  const VTT = lines(
    "WEBVTT", "",
    "1", "00:00:01.000 --> 00:00:04.000", "Sallie Ogden: Welcome to the call.", "",
    "2", "00:00:04.500 --> 00:00:07.000", "Jane Doe: Thanks for having me, Sallie.", "",
    "3", "00:00:07.500 --> 00:00:09.000", "Kip Tolliver: Glad to be here, Jane.", "",
    "4", "00:00:09.500 --> 00:00:12.000", "Jane Doe: Me too.", ""
  );

  it("are named Participant 1, 2 and so on in a WebVTT text, by first appearance, the same speaker the same number", () => {
    const { text, map } = replaceSpeakers(VTT);
    assert.equal(text, lines(
      "WEBVTT", "",
      "1", "00:00:01.000 --> 00:00:04.000", "Sallie Ogden: Welcome to the call.", "",
      "2", "00:00:04.500 --> 00:00:07.000", "Participant 1: Thanks for having me, Sallie.", "",
      "3", "00:00:07.500 --> 00:00:09.000", "Participant 2: Glad to be here, Jane.", "",
      "4", "00:00:09.500 --> 00:00:12.000", "Participant 1: Me too.", ""
    ));
    assert.deepEqual(map, { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2" });
  });

  it("leave the cue numbers, the times and every word said as they were, Windows line ends too", () => {
    const crlf = VTT.replace(/\n/g, "\r\n");
    const { text } = replaceSpeakers(crlf);
    assert.equal(text, crlf.replace("Jane Doe:", "Participant 1:").replace("Kip Tolliver:", "Participant 2:").replace("Jane Doe:", "Participant 1:"));
  });

  it("keep Sallie's label as it is written, whatever else the label says", () => {
    const { text, map } = replaceSpeakers(lines("Sallie Ogden (The BRIMM): Hello.", "sallie: Hello.", "Sallie's iPhone: Hello.", "SALLIE O: Hello."));
    assert.equal(text, lines("Sallie Ogden (The BRIMM): Hello.", "sallie: Hello.", "Sallie's iPhone: Hello.", "SALLIE O: Hello."));
    assert.deepEqual(map, {});
  });

  it("do not keep a label whose bracketed note is the only place her name is", () => {
    const { text, map } = replaceSpeakers("Jane Doe (Sallie's guest): Hello.");
    assert.equal(text, "Participant 1: Hello.");
    assert.deepEqual(map, { "Jane Doe (Sallie's guest)": "Participant 1" });
  });

  it("do not keep the label of someone whose name only begins like hers", () => {
    const { text, map } = replaceSpeakers("Salliebeth Kay: Hello.");
    assert.equal(text, "Participant 1: Hello.");
    assert.deepEqual(map, { "Salliebeth Kay": "Participant 1" });
  });

  it("are told apart from Sallie by the word given for her", () => {
    const { text, map } = replaceSpeakers(lines("Dana Ray: Hello.", "Kip Tolliver: Hi."), "Dana");
    assert.equal(text, lines("Dana Ray: Hello.", "Participant 1: Hi."));
    assert.deepEqual(map, { "Kip Tolliver": "Participant 1" });
  });

  it("keep a label that is made of the show's names alone, whatever word is given for her", () => {
    const { text, map } = replaceSpeakers(lines("The BRIMM: One.", "Sallie Ogden: Two.", "The BRIMM Jane: Three."), "Dana");
    assert.equal(text, lines("The BRIMM: One.", "Sallie Ogden: Two.", "Participant 1: Three."));
    assert.deepEqual(map, { "The BRIMM Jane": "Participant 1" });
    // The show's names are the ones given, when they are given.
    assert.equal(replaceSpeakers("Jane Roe: Hi.", "Dana", ["Jane Roe"]).text, "Jane Roe: Hi.");
    assert.equal(replaceSpeakers("Sallie Ogden: Hi.", "Dana", ["Jane Roe"]).text, "Participant 1: Hi.");
  });

  it("are replaced in a voice tag, whatever the cue says", () => {
    const vtt = lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "<v Sallie Ogden>Welcome.</v>", "", "00:00:04.500 --> 00:00:07.000", "<v Jane Doe>Thanks, <v Kip Tolliver>and me.</v>", "");
    const { text, map } = replaceSpeakers(vtt);
    assert.equal(text, lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "<v Sallie Ogden>Welcome.</v>", "", "00:00:04.500 --> 00:00:07.000", "<v Participant 1>Thanks, <v Participant 2>and me.</v>", ""));
    assert.deepEqual(map, { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2" });
  });

  it("are replaced in the lines of a saved Zoom transcript, in the brackets", () => {
    const saved = lines(
      "[Sallie Ogden] 10:02:05", "Welcome to the call.", "",
      "[Jane Doe] 10:02:13", "Thanks, Sallie. Here's the thing: it works.", "Next Steps: book the call.", "",
      "[Kip Tolliver] 10:02:40", "Glad to be here.", "",
      "[Jane Doe] 10:03:01", "Me too."
    );
    const { text, map } = replaceSpeakers(saved);
    assert.equal(text, lines(
      "[Sallie Ogden] 10:02:05", "Welcome to the call.", "",
      "[Participant 1] 10:02:13", "Thanks, Sallie. Here's the thing: it works.", "Next Steps: book the call.", "",
      "[Participant 2] 10:02:40", "Glad to be here.", "",
      "[Participant 1] 10:03:01", "Me too."
    ));
    assert.deepEqual(map, { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2" });
  });

  it("are replaced in a text with no timing lines and no brackets, where a line begins with its label and a colon", () => {
    const plain = lines("Sallie Ogden: Hello.", "Jane Doe: Hi.", "So here's the thing: it works.", "Speaker 2: Right.", "Jane's iPhone: Me too.", "Jane Doe: Yes.");
    const { text, map } = replaceSpeakers(plain);
    assert.equal(text, lines("Sallie Ogden: Hello.", "Participant 1: Hi.", "So here's the thing: it works.", "Participant 2: Right.", "Participant 3: Me too.", "Participant 1: Yes."));
    assert.deepEqual(map, { "Jane Doe": "Participant 1", "Speaker 2": "Participant 2", "Jane's iPhone": "Participant 3" });
  });

  it("are not found in the second line of a cue, which is not a label in a WebVTT text", () => {
    const vtt = lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Jane Doe: There are two points.", "Next Steps: book the call.", "", "00:00:05.000 --> 00:00:06.000", "Kip Tolliver: Fine.", "");
    const { text } = replaceSpeakers(vtt);
    assert.equal(text, lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Participant 1: There are two points.", "Next Steps: book the call.", "", "00:00:05.000 --> 00:00:06.000", "Participant 2: Fine.", ""));
  });

  it("are one to four words, each with a capital letter or a figure, and at most forty characters, with a bracketed note allowed", () => {
    const text = lines(
      "Jane Doe (Acme Ltd): One.",
      "Mary Ann Van Berg: Two.",
      "Jane Anne Mary Beth Doe: Three.",
      "Jane doe: Four.",
      "A Very Long Name: Five.",
      "Abcdefghij Abcdefghij Abcdefghij Abcdefg: Six.",
      "Abcdefghij Abcdefghij Abcdefghij Abcdefgh: Seven."
    );
    const { text: out, map } = replaceSpeakers(text);
    assert.equal(out, lines(
      "Participant 1: One.",
      "Participant 2: Two.",
      "Jane Anne Mary Beth Doe: Three.",
      "Jane doe: Four.",
      "Participant 3: Five.",
      "Participant 4: Six.",
      "Abcdefghij Abcdefghij Abcdefghij Abcdefgh: Seven."
    ));
    assert.deepEqual(Object.keys(map), ["Jane Doe (Acme Ltd)", "Mary Ann Van Berg", "A Very Long Name", "Abcdefghij Abcdefghij Abcdefghij Abcdefg"]);
  });

  it("are found whatever their letters, a comma or a hyphen in them, and a colon is not a label unless a space follows it", () => {
    const { text, map } = replaceSpeakers(lines("José Peña-Núñez: Hola.", "Doe, Jane: Hi.", "Meeting 10:30 is on.", "Jane:30"));
    assert.equal(text, lines("Participant 1: Hola.", "Participant 2: Hi.", "Meeting 10:30 is on.", "Jane:30"));
    assert.deepEqual(map, { "José Peña-Núñez": "Participant 1", "Doe, Jane": "Participant 2" });
  });

  it("are given a number even when the label is the name of a method every object has", () => {
    const { text, map } = replaceSpeakers(lines("hasOwnProperty: Hi.", "toString: Hi.", "valueOf: Hi."));
    assert.equal(text, lines("Participant 1: Hi.", "Participant 2: Hi.", "Participant 3: Hi."));
    assert.deepEqual(map, { hasOwnProperty: "Participant 1", toString: "Participant 2", valueOf: "Participant 3" });
  });

  describe("in a WebVTT text, where Zoom puts them", () => {
    const cue = (first) => lines("WEBVTT", "", "1", "00:00:01.000 --> 00:00:04.000", first, "");
    const LABELS = [
      "jane doe", "kip's iPhone", "Jan de Vries", "Jane Doe - Acme Coaching", "Jane Doe | Acme", "[Acme] Jane Doe", "Jane Doe she/her", "Jane 🌸", "李明", "محمد",
      "jane.doe@acme.com", "Mary Ann Van Der Berg", "Dr. Jane Doe, PhD, LCSW", "Jane Doe (Acme Holdings International Group)", "Jane Doe (Sallie's guest)", "Speaker 2"
    ];

    it("are taken whole, whatever they are made of, as everything before the first colon of a cue's first line", () => {
      for (const label of LABELS) {
        const { text, map } = replaceSpeakers(cue(`${label}: Hello there.`));
        assert.equal(text, cue("Participant 1: Hello there."), label);
        assert.deepEqual(map, { [label]: "Participant 1" }, label);
      }
    });

    it("end at the first colon that a space follows or that ends the line, within the first 80 characters", () => {
      assert.equal(replaceSpeakers(cue("Jane Doe:")).text, cue("Participant 1:"));
      assert.equal(replaceSpeakers(cue("  Jane Doe : Hello: there.")).text, cue("  Participant 1 : Hello: there."));
      assert.equal(replaceSpeakers(cue("Jane at 10:30 Doe: Hi.")).text, cue("Participant 1: Hi."));
      assert.equal(replaceSpeakers(cue(`${"A".repeat(79)}: Hi.`)).text, cue("Participant 1: Hi."));
      for (const same of [`${"A".repeat(80)}: Hi.`, ": Hi.", "   : Hi.", "No colon that a space follows, at 10:30", "Hello"]) assert.equal(replaceSpeakers(cue(same)).text, cue(same), same);
      assert.deepEqual(replaceSpeakers(cue(": Hi.")).map, {});
    });

    it("are the whole text of a voice tag, and a line that begins with a voice tag is not read for a colon", () => {
      const vtt = lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "<v jane>Hello: world</v>", "", "00:00:05.000 --> 00:00:06.000", "<v.loud Kip Tolliver - Acme>Hi.</v>", "", "00:00:07.000 --> 00:00:08.000", "<v  jane >Again.</v>", "");
      const { text, map } = replaceSpeakers(vtt);
      assert.equal(text, lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "<v Participant 1>Hello: world</v>", "", "00:00:05.000 --> 00:00:06.000", "<v.loud Participant 2>Hi.</v>", "", "00:00:07.000 --> 00:00:08.000", "<v  Participant 1 >Again.</v>", ""));
      assert.deepEqual(map, { jane: "Participant 1", "Kip Tolliver - Acme": "Participant 2" });
    });

    it("keep Sallie's label by every word given for her, outside any bracketed note", () => {
      const vtt = lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Sallie Ogden: One.", "", "00:00:05.000 --> 00:00:06.000", "Sallie Mae Jones: Two.", "", "00:00:07.000 --> 00:00:08.000", "Jane Doe (Sallie's guest): Three.", "");
      const given = replaceSpeakers(vtt, "Sallie Ogden");
      assert.equal(given.text, lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Sallie Ogden: One.", "", "00:00:05.000 --> 00:00:06.000", "Participant 1: Two.", "", "00:00:07.000 --> 00:00:08.000", "Participant 2: Three.", ""));
      assert.deepEqual(given.map, { "Sallie Mae Jones": "Participant 1", "Jane Doe (Sallie's guest)": "Participant 2" });
      // With her first name alone, a Sallie Mae Jones is hers, and a note still says nothing of whose label it is.
      assert.equal(replaceSpeakers(vtt).text, lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Sallie Ogden: One.", "", "00:00:05.000 --> 00:00:06.000", "Sallie Mae Jones: Two.", "", "00:00:07.000 --> 00:00:08.000", "Participant 1: Three.", ""));
    });
  });

  describe("in a WebVTT text, whose label is hers", () => {
    const vtt = (...labels) => lines("WEBVTT", "", ...labels.flatMap((l, i) => [String(i + 1), `00:00:0${i}.000 --> 00:00:0${i + 1}.000`, `${l}: Hello there.`, ""]));
    it("is hers only when every part of it is, with every bracketed part left out", () => {
      const replaced = [
        "Jane Doe - Sallie's client", "[Sallie's guest] Kip Doe", "Jane Doe (Sallie's guest) [she/her]", "Kip Doe, Sallie's friend", "Kip Doe [Sallie's [guest]]", "Kip Doe | Sallie",
        "Kip Doe / Sallie's team", "Kip Doe – Sallie", "Kip Doe — Sallie", "Salliebeth Kay", "Sallie & Jane", "Jane Doe and Sallie", "Jane Doe x Sallie Ogden", "Sallie + Jane",
        "Jane Doe,Sallie", "Sallie Ogden, Coach", "Sallie Ogden, Founder", "Sallie Ogden / host", "Host - Sallie Ogden", "(Sallie Ogden)"
      ];
      // A note, in brackets, is not looked at: "The BRIMM (Jane Doe)" is the show's account, as "Sallie Ogden (she/her)" is hers.
      const kept = [
        "Sallie Ogden - The BRIMM", "Sallie Ogden (she/her)", "Sallie's iPhone", "Sallie Ogden, The BRIMM", "The BRIMM", "Sallie Ogden (The BRIMM)", "Sallie Ogden | The BRIMM",
        "Sallie Ogden [she/her]", "[Host] Sallie Ogden", "The Sallie Ogden Show", "The BRIMM - Sallie", "The BRIMM (Jane Doe)"
      ];
      for (const label of replaced) assert.deepEqual(replaceSpeakers(vtt(label)).map, { [label]: "Participant 1" }, label);
      for (const label of kept) assert.deepEqual(replaceSpeakers(vtt(label)), { text: vtt(label), map: {} }, label);
    });

    it("is split at &, + and / with no space round them, and at with and w/, as at the other separators", () => {
      for (const label of ["Sallie&Jane", "Sallie/Jane", "Sallie+Jane", "Sallie with Jane", "Sallie w/ Jane", "Jane Doe With Sallie Ogden", "Sallie Ogden W/ Jane"]) {
        assert.deepEqual(replaceSpeakers(vtt(label)).map, { [label]: "Participant 1" }, label);
      }
      for (const label of ["Sallie Ogden/The BRIMM", "Sallie Ogden+The BRIMM", "Sallie Ogden with The BRIMM", "Sallie Ogden (she/her)", "The BRIMM w/ Sallie Ogden"]) {
        assert.deepEqual(replaceSpeakers(vtt(label)), { text: vtt(label), map: {} }, label);
      }
    });
  });

  describe("in a saved Zoom transcript, where Zoom puts them", () => {
    it("are the whole text in the brackets before the time, up to 80 characters", () => {
      const saved = lines(
        "[Sallie Ogden] 10:02:05", "Welcome.", "",
        "[jane doe] 10:02:13", "Hello.", "",
        "[Kip Tolliver - Acme] 10:02:20", "Hi.", "",
        "[Jane Doe (Acme Holdings International Group)] 10:03:00", "Yes.", "",
        `[${"A".repeat(80)}] 10:03:10`, "Long.", "",
        `[${"B".repeat(81)}] 10:03:20`, "Too long.", "",
        "[jane doe] 10:03:30", "Again."
      );
      const { text, map } = replaceSpeakers(saved);
      assert.equal(text, lines(
        "[Sallie Ogden] 10:02:05", "Welcome.", "",
        "[Participant 1] 10:02:13", "Hello.", "",
        "[Participant 2] 10:02:20", "Hi.", "",
        "[Participant 3] 10:03:00", "Yes.", "",
        "[Participant 4] 10:03:10", "Long.", "",
        `[${"B".repeat(81)}] 10:03:20`, "Too long.", "",
        "[Participant 1] 10:03:30", "Again."
      ));
      assert.deepEqual(map, { "jane doe": "Participant 1", "Kip Tolliver - Acme": "Participant 2", "Jane Doe (Acme Holdings International Group)": "Participant 3", ["A".repeat(80)]: "Participant 4" });
    });
  });

  it("are, in a saved Zoom transcript, everything up to the bracket that a time follows", () => {
    const saved = lines("[Sallie Ogden] 10:02:05", "Hi.", "", "[Jane Doe [she/her]] 10:02:13", "Hello [world] 10:30.", "", "[Kip [Acme] Doe]   10:02:20", "Yes.");
    const { text, map } = replaceSpeakers(saved);
    assert.equal(text, lines("[Sallie Ogden] 10:02:05", "Hi.", "", "[Participant 1] 10:02:13", "Hello [world] 10:30.", "", "[Participant 2]   10:02:20", "Yes."));
    assert.deepEqual(map, { "Jane Doe [she/her]": "Participant 1", "Kip [Acme] Doe": "Participant 2" });
  });

  it("are, in a saved Zoom transcript, only on Zoom's own line: the bracket at its start, spaces and a time with seconds, whatever follows", () => {
    const saved = lines("[Jane Doe] 10:02:13", "[Kip Tolliver] 9:02:14  ", "[Kip Tolliver] 10:02:15 okay", "[Kip Tolliver] 10:02", "[Kip Tolliver] 10:02:15:16", "[Kip Tolliver] 10:02:156", "  [Kip Tolliver] 10:02:16", "Kip Tolliver: Hi.");
    const { text, map } = replaceSpeakers(saved);
    assert.equal(text, lines("[Participant 1] 10:02:13", "[Participant 2] 9:02:14  ", "[Participant 2] 10:02:15 okay", "[Kip Tolliver] 10:02", "[Participant 2] 10:02:15:16", "[Kip Tolliver] 10:02:156", "  [Kip Tolliver] 10:02:16", "Kip Tolliver: Hi."));
    assert.deepEqual(map, { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2" });
    const crlf = saved.replace(/\n/g, "\r\n");
    assert.equal(replaceSpeakers(crlf).text, text.replace(/\n/g, "\r\n"));
  });

  it("are, in a saved Zoom transcript, on a line whose time Zoom writes with more after it: AM or PM, a fraction, a tab and words", () => {
    const saved = lines("[Jane Doe] 10:02:13 AM", "Hello.", "", "[Kip Tolliver] 10:02:13.250", "Hi.", "", "[Mara Quill] 10:02:13\tHello.", "", "[Jane Doe] 10:02:20 PM", "Again.");
    const { text, map } = replaceSpeakers(saved);
    assert.equal(text, lines("[Participant 1] 10:02:13 AM", "Hello.", "", "[Participant 2] 10:02:13.250", "Hi.", "", "[Participant 3] 10:02:13\tHello.", "", "[Participant 1] 10:02:20 PM", "Again."));
    assert.deepEqual(map, { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2", "Mara Quill": "Participant 3" });
    // Each of these lines alone makes a text a saved transcript.
    for (const line of ["[Jane Doe] 10:02:13 AM", "[Jane Doe] 10:02:13.250", "[Jane Doe] 10:02:13\tHello."]) {
      assert.deepEqual(replaceSpeakers(lines(line, "Jane Doe: Hi.")), { text: lines(line.replace("Jane Doe", "Participant 1"), "Jane Doe: Hi."), map: { "Jane Doe": "Participant 1" } }, line);
    }
  });

  it("are found after a byte order mark at the start of the text, which is taken off, and only one", () => {
    const BOM = "\uFEFF";
    const saved = replaceSpeakers(`${BOM}[Jane Doe] 10:02:13\nHello.\n\n[Kip Tolliver] 10:02:20\nHi.`);
    assert.deepEqual(saved, { text: "[Participant 1] 10:02:13\nHello.\n\n[Participant 2] 10:02:20\nHi.", map: { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2" } });
    const plain = replaceSpeakers(`${BOM}Jane Doe: Hello.\nKip Tolliver: Hi.`);
    assert.deepEqual(plain, { text: "Participant 1: Hello.\nParticipant 2: Hi.", map: { "Jane Doe": "Participant 1", "Kip Tolliver": "Participant 2" } });
    const vtt = lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Jane Doe: Hello.", "");
    assert.equal(replaceSpeakers(BOM + vtt).text, vtt.replace("Jane Doe", "Participant 1"));
    assert.equal(replaceSpeakers(`${BOM}${BOM}So here's the thing: it works.`).text, `${BOM}So here's the thing: it works.`);
  });

  it("are, in a plain text that has a bracket and a time in a line of speech, the Label: of any line, and the brackets are not names", () => {
    const plain = lines("Jane Doe: Hello.", "[laughs] okay [pause] 10:30 works", "Kip Tolliver: Hi.");
    const { text, map } = replaceSpeakers(plain);
    assert.equal(text, lines("Participant 1: Hello.", "[laughs] okay [pause] 10:30 works", "Participant 2: Hi."));
    assert.deepEqual(sortedNames(visibleNames({ map })), ["Doe", "Jane", "Kip", "Tolliver"]);
  });

  it("are, in a text with neither form, a label with a letter that has no case, but not one that begins with a figure", () => {
    const { text, map } = replaceSpeakers(lines("李明: One.", "محمد Ali: Two.", "1: first point", "2 Jane: Three.", "Jane 2: Four."));
    assert.equal(text, lines("Participant 1: One.", "Participant 2: Two.", "1: first point", "2 Jane: Three.", "Participant 3: Four."));
    assert.deepEqual(map, { 李明: "Participant 1", "محمد Ali": "Participant 2", "Jane 2": "Participant 3" });
  });

  it("come back as they were, with nothing in the map, when a text has no label", () => {
    const none = lines("So here's the thing: it works.", "and then we left", "");
    assert.deepEqual(replaceSpeakers(none), { text: none, map: {} });
    assert.deepEqual(replaceSpeakers(""), { text: "", map: {} });
  });

  it("are nothing when it is not text", () => {
    assert.deepEqual(replaceSpeakers(null), { text: "", map: {} });
    assert.deepEqual(replaceSpeakers(undefined), { text: "", map: {} });
    assert.deepEqual(replaceSpeakers(42), { text: "", map: {} });
  });
});

describe("the names brimm-video can see", () => {
  const sorted = (names) => [...names].sort();

  it("are the words of the speakers' labels that it replaced", () => {
    const names = visibleNames({ map: { "Jane Doe": "Participant 1", "Jane's iPhone": "Participant 2", "Speaker 2": "Participant 3", "Kip Tolliver": "Participant 4" } });
    assert.deepEqual(sorted(names), ["Doe", "Jane", "Kip", "Tolliver"]);
  });

  it("are every word of a label it replaced, the note's too, whatever the show's names, the spellings and Sally say", () => {
    assert.deepEqual(sorted(visibleNames({ map: { "Sally Jones": "Participant 1" } })), ["Jones", "Sally"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Jason Ogden": "Participant 1" } })), ["Jason"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Quillon Smith (Acme Holdings)": "Participant 1" }, spellings: [["quilon", "Quillon"]] })), ["Acme", "Holdings", "Quillon", "Smith"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Ann Show": "Participant 1" } })), ["Ann", "Show"]);
  });

  it("are never a word of her own name, whichever source it comes from", () => {
    assert.deepEqual(visibleNames({ map: { "Kip - Sallie Ogden": "Participant 1" } }), ["Kip"]);
    assert.deepEqual(visibleNames({ fileName: "Sallie Ogden pricing.mov", words: say("We met Sallie and Ogden at noon") }), ["pricing"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Sally Jones": "Participant 1" } })), ["Jones", "Sally"]);
    const names = visibleNames({ map: { "Kip - Sallie Ogden": "Participant 1" } });
    const reading = { principles: [{ n: 1, name: "Price first", description: "Sallie's rule is to price first.", example_application: "Ogden says it.", steps: ["Price first", "Ask Kip"] }] };
    assert.deepEqual(checkNames(reading, names).dropped, [{ field: "Principle 1's steps, entry 2", why: "it held a name brimm-video can see" }]);
  });

  it("are not, in a label, the words of a device or of a role, which a label of Zoom's often holds", () => {
    assert.deepEqual(visibleNames({ map: { "Kip's iPhone": "Participant 1" } }), ["Kip"]);
    const DEVICES = "iphone, ipad, phone, macbook, pro, air, android, galaxy, pixel, laptop, desktop, pc, host, cohost, co-host, guest, coach, speaker, participant, admin, owner, founder, ceo, team, business, office";
    for (const word of DEVICES.split(", ")) {
      for (const form of [word, word[0].toUpperCase() + word.slice(1), word.toUpperCase()]) assert.deepEqual(visibleNames({ map: { [`Zed ${form}`]: "Participant 1" } }), ["Zed"], form);
    }
    for (const label of ["Kip's MacBook Pro", "Kip's iPad Air", "Kip's Galaxy", "Kip's Android", "Kip's Pixel", "Kip's Laptop", "Kip's PC", "Kip (Guest)", "Kip - Co-Host", "Kip Cohost", "Kip (Admin)", "Kip, Owner", "Kip, Founder & CEO", "Kip's Team", "Kip's Office Desktop", "Kip - Participant", "Speaker Kip"]) {
      assert.deepEqual(visibleNames({ map: { [label]: "Participant 1" } }), ["Kip"], label);
    }
    // A label that is replaced, though it holds her name, gives no word of a role.
    const { map } = replaceSpeakers(lines("WEBVTT", "", "00:00:01.000 --> 00:00:04.000", "Sallie Ogden | Business Coach: Hello.", ""));
    assert.deepEqual(map, { "Sallie Ogden | Business Coach": "Participant 1" });
    assert.deepEqual(visibleNames({ map }), []);
    // A business's name in a label is still its words.
    assert.deepEqual(sorted(visibleNames({ map: { "Marisol Vega - Vega Wellness": "Participant 1" } })), ["Marisol", "Vega", "Wellness"]);
    // They are names in the file's name and among the capitalised words, as other words are.
    assert.deepEqual(visibleNames({ fileName: "Kip Coach.mov" }), ["Kip", "Coach"]);
    assert.deepEqual(visibleNames({ words: say("We met Kip and Coach Roe") }), ["Kip", "Coach", "Roe"]);
  });

  it("are not a public name, a platform's or a tool's, in a label, in a file's name or capitalised, nor a part of one", () => {
    const PUBLIC = "instagram, facebook, linkedin, youtube, tiktok, pinterest, threads, twitter, snapchat, whatsapp, zoom, google, gmail, chatgpt, openai, canva, shopify, etsy, amazon, apple, microsoft, excel, slack, notion, calendly, hubspot, quickbooks, paypal, venmo, stripe, squarespace, wix, mailchimp, opusclip, hormozi";
    assert.deepEqual(PUBLIC_NAMES, PUBLIC.split(", "));
    for (const word of PUBLIC_NAMES) {
      for (const form of [word, word[0].toUpperCase() + word.slice(1), word.toUpperCase()]) {
        assert.deepEqual(visibleNames({ map: { [`Zed ${form}`]: "Participant 1" } }), ["Zed"], form);
        assert.deepEqual(visibleNames({ fileName: `Zed ${form}.mov` }), ["Zed"], form);
        assert.deepEqual(visibleNames({ words: say(`We met Zed and ${form} too`) }), ["Zed"], form);
      }
    }
    // Written as the brands write them, a joined word that is public gives no part.
    assert.deepEqual(visibleNames({ words: say("We met Zed on LinkedIn, YouTube, TikTok, ChatGPT, OpenAI, HubSpot, QuickBooks, PayPal and OpusClip") }), ["Zed"]);
    assert.deepEqual(visibleNames({ map: { "Kip Roe | HubSpot": "Participant 1" }, fileName: "Kip QuickBooks call.mov" }), ["Kip", "Roe", "call"]);
    // A part of a joined word that is a public name is not one either.
    assert.deepEqual(sorted(visibleNames({ map: { KipShopify: "Participant 1" }, words: say("We met ZedCanva today") })), ["Kip", "KipShopify", "Zed", "ZedCanva"]);
  });

  it("are not a word the recording writes all in capitals, with or without a small s after, though a label's still are", () => {
    const words = say("Then the CEO said our ROI and the KPIs in my DMs and the CEOs look fine to Zed and AI.");
    assert.deepEqual(visibleNames({ words }), ["Zed"]);
    // A word with a figure in it, or another capital after a small letter, is not all in capitals.
    assert.deepEqual(sorted(visibleNames({ words: say("We sell B2B to Zed and PhDs") })), ["B2B", "PhDs", "Zed"]);
    // It takes two capitals or more: one with an s after it is not all in capitals.
    assert.deepEqual(sorted(visibleNames({ words: say("We gave Zed two Bs") })), ["Bs", "Zed"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Kip ROI": "Participant 1" } })), ["Kip", "ROI"]);
    assert.deepEqual(sorted(visibleNames({ fileName: "Kip ROI.mov" })), ["Kip", "ROI"]);
  });

  it("are not a day of the week, nor a month that is nobody's given name, but April, May, June and August may be names", () => {
    for (const word of "monday tuesday wednesday thursday friday saturday sunday january february march july september october november december".split(" ")) {
      assert.ok(NOT_NAMES.includes(word), word);
    }
    for (const word of ["april", "may", "june", "august"]) assert.ok(!NOT_NAMES.includes(word), word);
    assert.deepEqual(sorted(visibleNames({ words: say("We met every Monday in January and March with June and Zed") })), ["June", "Zed"]);
  });

  it("are none of the words a session says of its work, a brand, a day and a figure of business, and take nothing out of a principle in the second person", () => {
    const words = say("Thanks for coming. Then the CEO said we answer our DMs every Monday, and in January we post on Instagram, ask ChatGPT, design in Canva and read Hormozi with Zed. What is the ROI? It is in the KPIs.");
    const names = visibleNames({ map: { "Jane Doe": "Participant 1", "Kip's iPhone": "Participant 2" }, words });
    assert.deepEqual(sorted(names), ["Doe", "Jane", "Kip", "Zed"]);
    const principle = {
      n: 1, name: "Answer Your DMs", category: "Instagram sales", description: "You answer your DMs every Monday, as a CEO would.", steps: ["In January, post on Instagram.", "Ask ChatGPT for a first draft.", "Design it in Canva."],
      red_flags: ["You skip a Monday.", "You read Hormozi and do nothing."], green_flags: ["Your ROI is clear."], decision_criteria: ["Do your KPIs move?"], example_application: "A coach answers her DMs on Monday and posts on Instagram in January.",
      verbatim_key_phrases: ["answer your DMs"], source_context: "When the CEO came up."
    };
    const reading = { principles: [principle], recurringPrinciples: [{ n: 1, text: "Every Monday, you post." }], reelIdeas: [{ n: 1, from: "p1", to: "p2", idea: "Answer your DMs on Monday", words: "You answer your DMs every Monday.", why: "Use Canva and ChatGPT.", refilm: true, principle: 1 }] };
    assert.deepEqual(checkNames(reading, names), { kept: reading, dropped: [] });
    const asked = { principles: [{ ...principle, approved: true }], recurringPrinciples: [{ ...reading.recurringPrinciples[0], approved: true }], reelIdeas: [{ ...reading.reelIdeas[0], approved: true }] };
    assert.deepEqual(approvedSession(asked, names).dropped, []);
  });

  it("are the words of every name given for the file: the file dropped, Zoom's transcript and the folder Zoom made", () => {
    assert.deepEqual(sorted(visibleNames({ fileName: "2026-10-13 14.29.33 Jane Doe's Zoom Meeting" })), ["Doe", "Jane"]);
    assert.deepEqual(sorted(visibleNames({ fileName: "/Users/someone/Dropbox/Drop/2026-10-13 14.29.33 Jane Doe's Zoom Meeting/" })), ["Doe", "Jane"]);
    assert.deepEqual(sorted(visibleNames({ fileName: ["Kip Tolliver call.mov", "/Users/someone/Mara Quill.vtt"] })), ["Kip", "Mara", "Quill", "Tolliver", "call"]);
    const set = ["/Drop/2026-10-13 14.29.33 Jane Doe's Zoom Meeting/video1449382767.mp4", "GMT20261013-142933_Recording.transcript.vtt", "/Drop/2026-10-13 14.29.33 Jane Doe's Zoom Meeting"];
    assert.deepEqual(sorted(visibleNames({ fileName: set })), ["Doe", "Jane"]);
    // Each name is read as one name is: its folder is not, and of a name that is not Zoom's, every word is.
    assert.deepEqual(sorted(visibleNames({ fileName: ["/Users/Jane Doe/Kip.mov", "Jane Doe's Zoom Meeting.vtt", null] })), ["Doe", "Jane", "Kip", "Meeting"]);
    assert.deepEqual(visibleNames({ fileName: [] }), []);
  });

  it("take off a name's extension only when it is one: a full stop and one to five letters or figures at the end, a letter among them", () => {
    for (const [name, names] of [
      ["Jane Doe.mp4", ["Doe", "Jane"]], ["Jane Doe.m4a", ["Doe", "Jane"]], ["Jane Doe.final", ["Doe", "Jane"]], ["Jane Doe.transcript.vtt", ["Doe", "Jane", "transcript"]],
      ["Jane Doe.Report", ["Doe", "Jane", "Report"]], ["Jane Doe 14.29.33", ["Doe", "Jane"]], ["Kip Roe.Tolliver", ["Kip", "Roe", "Tolliver"]], ["Kip Roe.2026", ["Kip", "Roe"]]
    ]) assert.deepEqual(sorted(visibleNames({ fileName: name })), names, name);
  });

  it("are not a pronoun or a title in a label, nor a label word that begins in lowercase and that the recording writes so in a sentence", () => {
    assert.deepEqual(sorted(visibleNames({ map: { "Jane Doe she/her": "Participant 1", "Kip Doe he/him/his": "Participant 2", "Pat Roe they/them/their/theirs/hers": "Participant 3" } })), ["Doe", "Jane", "Kip", "Pat", "Roe"]);
    const titled = visibleNames({ map: { "Dr. Jane Doe, PhD, LCSW": "Participant 1", "Mr Ng Jr": "Participant 2" } });
    assert.deepEqual(sorted(titled), ["Doe", "Jane", "LCSW", "Ng", "PhD"]);
    assert.deepEqual(sorted(visibleNames({ fileName: "Dr Jane Doe she her.mov" })), ["Doe", "Jane"]);
    assert.deepEqual(sorted(visibleNames({ map: { "jane doe": "Participant 1" }, words: say("We saw a doe run away") })), ["jane"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Jane Doe": "Participant 1" }, words: say("We saw a doe run away") })), ["Doe", "Jane"]);
    assert.deepEqual(sorted(visibleNames({ map: { "jane doe": "Participant 1" } })), ["doe", "jane"]);
  });

  it("are also the parts of a joined word of a label or of the file's name, those of three letters or more, and the whole word", () => {
    assert.deepEqual(sorted(visibleNames({ map: { JaneDoe: "Participant 1" } })), ["Doe", "Jane", "JaneDoe"]);
    assert.deepEqual(visibleNames({ fileName: "PricingTalk.mov" }), ["PricingTalk", "Pricing", "Talk"]);
    assert.deepEqual(sorted(visibleNames({ map: { MoAnn: "Participant 1" } })), ["Ann", "MoAnn"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Kip's eBook": "Participant 1" } })), ["Book", "Kip", "eBook"]);
  });

  it("are not a part of a joined word that the recording writes in lowercase in the middle of a sentence", () => {
    const words = say("We read the book a lot");
    assert.deepEqual(sorted(visibleNames({ map: { "Kip's eBook": "Participant 1" }, words })), ["Kip", "eBook"]);
    assert.deepEqual(visibleNames({ fileName: "PricingTalk.mov", words: say("We like to talk about pricing") }), ["PricingTalk"]);
    // A joined word that is left out as a whole, as an ordinary word is, gives no part.
    assert.deepEqual(sorted(visibleNames({ map: { "Kip's eBook": "Participant 1" }, words: say("We read the ebook a lot") })), ["Kip"]);
  });

  it("are the parts of a capitalised word of the recording that has three letters, that the recording does not write in lowercase", () => {
    const words = say("Then MaryAnn spoke to LaToya and to Pat.");
    assert.deepEqual(sorted(visibleNames({ words })), ["Ann", "LaToya", "Mary", "MaryAnn", "Pat", "Toya"]);
    assert.deepEqual(sorted(visibleNames({ words: [...words, ...say("We said mary and ann and toya too")] })), ["LaToya", "MaryAnn", "Pat"]);
  });

  it("are not the parts of a brand that the recording says, when it also says them as small words", () => {
    const words = say("We post on LinkedIn and YouTube, pay with PayPal, ask OpenAI and buy a MacBook, then link it, pay it, open it, book it and tube it, so linked is fine.");
    const names = visibleNames({ words });
    assert.deepEqual(sorted(names), ["Mac", "MacBook"]);
    for (const part of ["In", "Linked", "You", "Tube", "Pay", "Pal", "Open", "Book"]) assert.ok(!names.includes(part), part);
  });

  it("are not the parts of a joined word that is left out as a whole, by the show's names or by a spelling", () => {
    assert.deepEqual(visibleNames({ fileName: "McKinsey pricing.mov", spellings: [["mckenzie", "McKinsey"]] }), ["pricing"]);
    assert.deepEqual(visibleNames({ words: say("We met McKinsey and Zed"), spellings: [["mckenzie", "McKinsey"]] }), ["Zed"]);
    assert.deepEqual(sorted(visibleNames({ words: say("We met McKinsey and Zed") })), ["Kinsey", "McKinsey", "Zed"]);
    // Nor a part that is itself a word of the show's names or of a spelling, or a word that is nobody's name.
    assert.deepEqual(sorted(visibleNames({ words: say("We met AnnBRIMM and ZedYouNow"), spellings: [["x", "Zed"]] })), ["Ann", "AnnBRIMM", "ZedYouNow"]);
    assert.deepEqual(sorted(visibleNames({ map: { "AnnTheBRIMM Roe": "Participant 1" } })), ["Ann", "AnnTheBRIMM", "Roe"]);
    // A part is spelled the show's way before it is looked at: "Sally" of "AnnSally" is "Sallie", and the host's.
    assert.deepEqual(sorted(visibleNames({ words: say("We met AnnSally today") })), ["Ann", "AnnSally"]);
  });

  it("are never a small word, a pronoun, a title or a mail word, whether in a label, in a file's name or capitalised", () => {
    assert.ok(Array.isArray(NOT_NAMES));
    const small = "a, an, the, and, or, but, nor, so, yet, if, then, than, when, while, what, why, how, who, where, here, there, now, well, yes, no, not, oh, ok, okay, also, just, of, for, at, to, in, on, by, with, from, into, onto, about, as, up, out, my, our, your, its, their, this, that, these, those, we, you, us, it, is, are, was, be, me, i";
    const more = "she, her, hers, he, him, his, they, them, their, theirs, mr, mrs, ms, mx, dr, prof, st, jr, sr, com, net, org, co, uk, gmail, icloud, outlook, hotmail, yahoo, monday, tuesday, wednesday, thursday, friday, saturday, sunday, january, february, march, july, september, october, november, december";
    for (const word of [...small.split(", "), ...more.split(", ")]) assert.ok(NOT_NAMES.includes(word), word);
    for (const word of NOT_NAMES) {
      const big = word[0].toUpperCase() + word.slice(1);
      for (const form of [word, big, word.toUpperCase()]) {
        assert.deepEqual(visibleNames({ map: { [`Zed ${form}`]: "Participant 1" } }), ["Zed"], form);
        assert.deepEqual(visibleNames({ fileName: `Zed ${form}.mov` }), ["Zed"], form);
        assert.deepEqual(visibleNames({ words: say(`We met Zed and ${form} too`) }), ["Zed"], form);
      }
    }
    assert.deepEqual(sorted(visibleNames({ map: { "Jason Ogden (The BRIMM)": "Participant 1" } })), ["BRIMM", "Jason"]);
    assert.deepEqual(sorted(visibleNames({ map: { "Jane Doe (The Growth Lab)": "Participant 1" } })), ["Doe", "Growth", "Jane", "Lab"]);
    assert.deepEqual(sorted(visibleNames({ map: { "jane.doe@gmail.com": "Participant 1" } })), ["doe", "jane"]);
    // "mac" is a given name, and is a name where it stands in a label.
    assert.ok(!NOT_NAMES.includes("mac"));
    assert.deepEqual(sorted(visibleNames({ map: { "jane.doe@mac.com": "Participant 1" } })), ["doe", "jane", "mac"]);
  });

  it("read U+02BC as an apostrophe, as a curly one is", () => {
    const apos = String.fromCharCode(0x2bc);
    assert.deepEqual(visibleNames({ words: say(`We met Jane${apos}s team`) }), ["Jane"]);
    assert.deepEqual(sorted(visibleNames({ map: { [`O${apos}Brien Kay`]: "Participant 1" } })), ["Kay", "O'Brien"]);
  });

  it("are not a title, nor a word after one as if it began a sentence, nor the initial of a first name", () => {
    const words = say("So I talked to Dr. Patel and then Mrs. Okafor came in, and Mr. J. Henderson, with St. Clair and Prof. Ng.");
    assert.deepEqual(sorted(visibleNames({ words })), ["Clair", "Henderson", "Ng", "Okafor", "Patel"]);
    assert.deepEqual(sorted(visibleNames({ words: say("We met Ms. Roe and mx. Poe, then Jr. Lee and Sr. Kay too.") })), ["Kay", "Lee", "Poe", "Roe"]);
  });

  it("end a sentence at I with a full stop, at a lowercase letter with one, and at a longer abbreviation, but not at a capital initial", () => {
    assert.deepEqual(visibleNames({ words: say("We agreed, so did I. Bernard came late.") }), []);
    assert.deepEqual(visibleNames({ words: say("We picked plan b. Bernard came late.") }), []);
    assert.deepEqual(visibleNames({ words: say("We read the U.S. Bernard came late.") }), []);
    assert.deepEqual(visibleNames({ words: say("We read the (U.S.) Bernard came late.") }), []);
    assert.deepEqual(visibleNames({ words: say("We met Mr. J. Bernard at noon.") }), ["Bernard"]);
    assert.deepEqual(visibleNames({ words: say('We met Mr. "J." Bernard at noon.') }), ["Bernard"]);
  });

  it("are the words of the file's name, but not its folder, its extension, a word with a figure in it or a word of less than two letters", () => {
    const names = visibleNames({ fileName: "/Users/someone/Dropbox/Kip Tolliver call2 a.mov" });
    assert.deepEqual(sorted(names), ["Kip", "Tolliver"]);
  });

  it("are the words of a Zoom file name too, but not Zoom's own words, which hold no person's", () => {
    assert.deepEqual(visibleNames({ fileName: "GMT20261013-142933_Recording_gvo_1280x720.mp4" }), []);
    assert.deepEqual(visibleNames({ fileName: "audio1449382767.m4a" }), []);
    assert.deepEqual(sorted(visibleNames({ fileName: "GMT20261013-142933_Recording_Jane Doe.mp4" })), ["Doe", "Jane"]);
    for (const own of ["GMT", "Recording", "gvo", "avo", "audio", "video", "gallery", "speaker", "shared", "screen", "view", "only", "transcript", "chat", "CHAT"]) {
      assert.deepEqual(visibleNames({ fileName: `GMT20261013-142933_Recording_${own}_Kip.mp4` }), ["Kip"], own);
    }
    // Another name is not Zoom's, and all of its words are looked at.
    assert.deepEqual(sorted(visibleNames({ fileName: "Recording gvo.mp4" })), ["Recording", "gvo"]);
  });

  it("are not the words of a file's name that the recording writes in lowercase, in the middle of a sentence", () => {
    const words = say("Today we went with pricing again and then left.");
    assert.deepEqual(visibleNames({ fileName: "Pricing with Kip.mov", words }), ["Kip"]);
    // A word written lowercase at the start of the recording is not in the middle of a sentence; one written with a capital is not lowercase.
    assert.deepEqual(sorted(visibleNames({ fileName: "Pricing talk.mov", words: say("pricing is Talk about it") })), ["Pricing", "talk"]);
  });

  it("are the words the transcriber capitalised in the middle of a sentence, and not the first word of a sentence", () => {
    const words = say("Thanks for coming. Kip and Mara met at the Quillon Hotel. Where was Zed? Did Kip's team agree? Yes.");
    assert.deepEqual(sorted(visibleNames({ words })), ["Hotel", "Kip", "Mara", "Quillon", "Zed"]);
  });

  it("are not a word after a full stop with a quote or a bracket after it, nor after a question mark, an exclamation mark or an ellipsis", () => {
    const words = say('She said "stop." Then Amy left (really!) Next Ben came… Maybe Cat did? Yes. (Now.) Fine Dan went.');
    assert.deepEqual(sorted(visibleNames({ words })), ["Amy", "Ben", "Cat", "Dan"]);
  });

  it("are never I, I'm, I've, I'll or I'd, and not a capital with no second letter", () => {
    const words = say("Then I'm sure I'll say I've seen what I'd say, and I think A is B and Q4 is B2B.");
    assert.deepEqual(sorted(visibleNames({ words })), ["B2B"]);
  });

  it("are each once, in the first spelling seen, taken off their punctuation, possessive and curly apostrophe", () => {
    const words = say('We met MARK and “Mara”, then Mara’s team, and Mark’s (Mara) too, with Jones’ idea.');
    const names = visibleNames({ map: { "Mark Vellum": "Participant 1" }, words });
    assert.deepEqual(sorted(names), ["Jones", "Mara", "Mark", "Vellum"]);
  });

  it("are read from a file name that a Mac wrote with the accent apart from its letter", () => {
    const names = visibleNames({ fileName: "Jose\u0301 talk.mov" });
    assert.deepEqual(names, ["Jos\u00e9", "talk"]);
  });

  it("leave out the show's names, The BRIMM, the words of the episode's spellings in both forms, and Sally, which is Sallie", () => {
    const words = say("We met Sally and Hormozy at The BRIMM with Ogden on the Sallie Ogden Show about Quil and Kip.");
    const names = visibleNames({ words, spellings: [["hormozy", "Hormozi"], { heard: "Quil", spelled: "Quillon Pell" }] });
    assert.deepEqual(names, ["Kip"]);
  });

  it("leave out the words of another show, when it is given", () => {
    const words = say("We met Kip at the Daily Grind with Mara.");
    assert.deepEqual(sorted(visibleNames({ words, show: ["The Daily Grind"] })), ["Kip", "Mara"]);
  });

  it("take the words as a text, or as texts, as well as {w}", () => {
    assert.deepEqual(visibleNames({ words: "We met Mara." }), ["Mara"]);
    assert.deepEqual(visibleNames({ words: ["We", "met", " Mara ", { w: "Kip." }] }), ["Mara", "Kip"]);
  });

  it("are none when nothing is given", () => {
    assert.deepEqual(visibleNames({}), []);
    assert.deepEqual(visibleNames(), []);
    assert.deepEqual(visibleNames({ map: null, fileName: null, words: null, show: null, spellings: null }), []);
  });

  describe("when the recording is capitalised throughout", () => {
    const CAPS = "We Are Going To Talk About Pricing With Mara Today And Then Kip Will Ask Questions About Hiring And Training Plans For The Spring Quarter";
    const LINE = "The transcriber wrote this recording with capitals throughout, so brimm-video did not check its capitalised words for names: only the speakers' names and the file's name were checked.";

    it("have the capitalised-word check skipped, with a line saying so", () => {
      const words = say(CAPS);
      const names = visibleNames({ map: { "Jane Doe": "Participant 1" }, fileName: "Pricing talk.mov", words });
      assert.deepEqual(sorted(names), ["Doe", "Jane", "Pricing", "talk"]);
      assert.equal(namesSkipped(words), LINE);
    });

    it("are those that have twenty words in the middle of sentences, more than half of them capitalised", () => {
      const run = (n, lower = 0) => say(["Start", ...Array.from({ length: n - lower }, () => "Word"), ...Array.from({ length: lower }, () => "word")].join(" "));
      assert.equal(namesSkipped(run(20)), LINE);
      assert.equal(namesSkipped(run(19)), "");
      assert.equal(namesSkipped(run(20, 10)), "");
      assert.equal(namesSkipped(run(20, 9)), LINE);
    });

    it("are not those of an ordinary recording, and say nothing", () => {
      assert.equal(namesSkipped(say("Thanks for coming. Kip and Mara met at the Quillon Hotel. Where was Zed?")), "");
      assert.equal(namesSkipped([]), "");
      assert.equal(namesSkipped(undefined), "");
    });
  });
});

describe("the name check on a reading", () => {
  const WHY = "it held a name brimm-video can see";
  const principle = (n, extra = {}) => ({
    n, name: `Rule ${n}`, category: "pricing", description: "Say the price early.", steps: ["Name the price", "Then explain"], red_flags: ["Hiding the price"],
    green_flags: ["Calm talk of price"], decision_criteria: ["Is the price said?"], example_application: "A coach names the price in the first minute.",
    verbatim_key_phrases: ["say the price"], source_context: "Near the start.", ...extra
  });
  const reading = (extra = {}) => ({
    principles: [principle(1), principle(2)],
    recurringPrinciples: [{ n: 1, text: "Say it plainly." }, { n: 2, text: "Ask first." }],
    reelIdeas: [{ n: 1, from: "p1", to: "p4", idea: "Say the price early", words: "Say the price in the first minute.", why: "It stands alone.", refilm: true, principle: 1 }],
    spellings: [["hormozy", "Hormozi"]], problems: ["one problem"], ...extra
  });
  const NAMES = ["Jane", "Doe", "Mark"];

  it("takes out a field that holds a speaker's name, says which in her words, and holds neither the name nor the field's words", () => {
    const given = reading({ principles: [principle(1), principle(2, { example_application: "Jane Doe asked twice before she signed." })] });
    const { kept, dropped } = checkNames(given, NAMES);
    assert.deepEqual(dropped, [{ field: "Principle 2's example_application", why: WHY }]);
    assert.ok(!("example_application" in kept.principles[1]));
    const rest = principle(2);
    delete rest.example_application;
    assert.deepEqual(kept.principles[1], rest);
    assert.equal(kept.principles[0].example_application, "A coach names the price in the first minute.");
    const said = JSON.stringify(dropped);
    for (const word of ["Jane", "Doe", "asked", "twice", "signed"]) assert.ok(!said.includes(word), word);
  });

  it("takes out of a list only the entry that holds a name, and says which by its place in the list", () => {
    const given = reading({ principles: [principle(1, { verbatim_key_phrases: ["say the price", "as Mark says", "ask first"] })] });
    const { kept, dropped } = checkNames(given, NAMES);
    assert.deepEqual(dropped, [{ field: "Principle 1's verbatim_key_phrases, entry 2", why: WHY }]);
    assert.deepEqual(kept.principles[0].verbatim_key_phrases, ["say the price", "ask first"]);
    assert.ok(!JSON.stringify(dropped).includes("Mark"));
  });

  it("takes out each entry of a list that holds a name, counts the places in the list as given, and leaves an empty list when none is left", () => {
    const given = reading({
      principles: [principle(1), principle(2, { steps: ["Ask Jane", "Name the price", 7, "Then ask Doe", "Wait"], red_flags: ["Mark waits.", "Jane waits."], green_flags: [] })],
      reelsToFilm: [{ n: 4, idea: "Price early", words: "Say it.", why: "It works.", principle: 2, tags: ["price", "Mark's way"] }]
    });
    const { kept, dropped } = checkNames(given, NAMES);
    assert.deepEqual(dropped, [
      { field: "Principle 2's steps, entry 1", why: WHY },
      { field: "Principle 2's steps, entry 4", why: WHY },
      { field: "Principle 2's red_flags, entry 1", why: WHY },
      { field: "Principle 2's red_flags, entry 2", why: WHY },
      { field: "Reel idea 4's tags, entry 2", why: WHY }
    ]);
    assert.deepEqual(kept.principles[1].steps, ["Name the price", 7, "Wait"]);
    assert.deepEqual(kept.principles[1].red_flags, []);
    assert.deepEqual(kept.principles[1].green_flags, []);
    assert.deepEqual(kept.principles[0], principle(1));
    assert.deepEqual(kept.reelsToFilm[0].tags, ["price"]);
    // A text is still taken out whole, and a list in a list is one entry.
    const both = checkNames({ recurringPrinciples: [{ n: 1, text: "Ask Mark, then wait.", notes: [["fine"], ["Ask Mark"]] }] }, NAMES);
    assert.deepEqual(both.dropped, [{ field: "Recurring principle 1's text", why: WHY }, { field: "Recurring principle 1's notes, entry 2", why: WHY }]);
    assert.deepEqual(both.kept.recurringPrinciples, [{ n: 1, notes: [["fine"]] }]);
    for (const word of ["Jane", "Doe", "Mark", "waits", "price"]) assert.ok(!JSON.stringify(dropped).includes(word), word);
  });

  it("checks every field: the context of a principle, a recurring principle's text and the words of a Reel idea", () => {
    const given = reading({
      principles: [principle(1, { source_context: "Jane asked about fees." })],
      recurringPrinciples: [{ n: 1, text: "Say it plainly." }, { n: 2, text: "Ask Mark first." }],
      reelIdeas: [{ n: 3, from: "p1", to: "p4", idea: "Price early", words: "Jane, say the price.", why: "It stands alone.", refilm: true, principle: null }]
    });
    const { kept, dropped } = checkNames(given, NAMES);
    assert.deepEqual(dropped, [
      { field: "Principle 1's source_context", why: WHY },
      { field: "Recurring principle 2's text", why: WHY },
      { field: "Reel idea 3's words", why: WHY }
    ]);
    assert.deepEqual(kept.recurringPrinciples, [{ n: 1, text: "Say it plainly." }, { n: 2 }]);
    assert.deepEqual(kept.reelIdeas, [{ n: 3, from: "p1", to: "p4", idea: "Price early", why: "It stands alone.", refilm: true, principle: null }]);
  });

  it("checks the Reel ideas of a hand-off by the same words", () => {
    const { kept, dropped } = checkNames({ reelsToFilm: [{ n: 2, idea: "Price early", words: "Doe says the price.", why: "Mark likes it.", principle: 1 }] }, NAMES);
    assert.deepEqual(dropped, [{ field: "Reel idea 2's words", why: WHY }, { field: "Reel idea 2's why", why: WHY }]);
    assert.deepEqual(kept, { reelsToFilm: [{ n: 2, idea: "Price early", principle: 1 }] });
  });

  it("checks a field of an item that has been decided, and leaves the decision, the number and the Reel idea's links as they are", () => {
    const given = { reelIdeas: [{ n: 1, from: "p1", to: "p2", idea: "Mark's idea", words: "Say it.", why: "", refilm: true, principle: 1, approved: true }] };
    const { kept, dropped } = checkNames(given, NAMES);
    assert.deepEqual(dropped, [{ field: "Reel idea 1's idea", why: WHY }]);
    assert.deepEqual(kept.reelIdeas[0], { n: 1, from: "p1", to: "p2", words: "Say it.", why: "", refilm: true, principle: 1, approved: true });
  });

  it("does not take out a name that belongs to the show, to an episode's spelling, or to nobody", () => {
    const names = visibleNames({ map: { "Jane Doe": "Participant 1" }, words: say("We met Sally and Hormozy at the BRIMM."), spellings: [["hormozy", "Hormozi"]] });
    const given = reading({ principles: [principle(1, { description: "Hormozi and Hormozy at The BRIMM with Sally, Sallie Ogden and the Sallie Ogden Show." })] });
    const { kept, dropped } = checkNames(given, names);
    assert.deepEqual(dropped, []);
    assert.deepEqual(kept, given);
  });

  it("takes a name only when it is written with a capital letter, and only as a whole word", () => {
    const check = (text) => checkNames({ recurringPrinciples: [{ n: 1, text }] }, ["Mark"]).dropped.length;
    assert.equal(check("Mark said so."), 1);
    assert.equal(check("MARK said so."), 1);
    assert.equal(check("Say so, said Mark."), 1);
    assert.equal(check("It is Mark's idea."), 1);
    assert.equal(check("It is Mark’s idea."), 1);
    assert.equal(check("(Mark)"), 1);
    assert.equal(check("Anne-Mark said so."), 1);
    assert.equal(check("Mark.Smith said so."), 1);
    assert.equal(check("mark the date."), 0);
    assert.equal(check("Marking the date."), 0);
    assert.equal(check("Remark the date."), 0);
    assert.equal(check("Say it plainly."), 0);
  });

  it("takes a name that a Mac wrote with the accent apart from its letter, and one written in full-width letters", () => {
    const names = visibleNames({ fileName: "Jose\u0301.mov" });
    assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text: "Say so, Jos\u00e9." }] }, names).dropped.length, 1);
    assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text: "Say so, Jose\u0301." }] }, names).dropped.length, 1);
    assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text: "Say so, \uff2d\uff41\uff52\uff4b." }] }, ["Mark"]).dropped.length, 1);
    // A name written with a separate accent is found in a field that writes it joined, and the other way round.
    const apart = "Jose" + String.fromCharCode(0x301);
    const joined = "Jos" + String.fromCharCode(0xe9);
    assert.deepEqual(checkNames({ recurringPrinciples: [{ n: 1, text: `Say so, ${joined}.` }] }, [apart]).dropped, [{ field: "Recurring principle 1's text", why: WHY }]);
    assert.deepEqual(checkNames({ recurringPrinciples: [{ n: 1, text: `Say so, ${apart}.` }] }, [joined]).dropped, [{ field: "Recurring principle 1's text", why: WHY }]);
    assert.deepEqual(checkNames({ recurringPrinciples: [{ n: 1, text: "Say so, Jose." }] }, [joined]).dropped, [{ field: "Recurring principle 1's text", why: WHY }]);
  });

  it("compares a name and a field's words with their accents taken off, as well as their case", () => {
    const check = (text, names) => checkNames({ recurringPrinciples: [{ n: 1, text }] }, names).dropped.length;
    const accented = visibleNames({ map: { "José Peña": "Participant 1" } });
    assert.equal(check("Jose said so.", accented), 1);
    assert.equal(check("Ask Pena first.", accented), 1);
    assert.equal(check("JOSÉ said so.", accented), 1);
    const plain = visibleNames({ map: { "Jose Pena": "Participant 1" } });
    assert.equal(check("José said so.", plain), 1);
    assert.equal(check("Ask Peña first.", plain), 1);
    assert.equal(check("Ask Pe\u0301na first.", ["Pena"]), 1);
    assert.equal(check("Zoë and Chloé came.", ["Zoe"]), 1);
    assert.equal(check("Ask Renée.", ["Renee"]), 1);
    assert.equal(check("Ask Josef.", accented), 0);
    // The case rule holds as before: a name seen with a capital is not an ordinary word in lowercase.
    assert.equal(check("josé said so.", ["Jose"]), 0);
    assert.equal(check("Ask Ünal.", ["Unal"]), 1);
  });

  it("asks whether a text holds a name by the same rule, for whoever needs the answer alone", () => {
    const names = visibleNames({ map: { "Mark Vellum": "Participant 1", "José Peña": "Participant 2", "d'Angelo Roe": "Participant 3" } });
    for (const [text, holds] of [
      ["Mark said so.", true], ["mark the date.", false], ["Jose said so.", true], ["As D'Angelo put it.", true], ["Remark the date.", false], ["MarkVellum said so.", true],
      ["Say it plainly.", false], ["", false], ["Ask Vellum's team.", true]
    ]) {
      assert.equal(holdsName(text, names), holds, text);
      assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text }] }, names).dropped.length, holds ? 1 : 0, text);
    }
    for (const notText of [null, undefined, 3, { text: "Mark" }]) assert.equal(holdsName(notText, names), false, String(notText));
    assert.equal(holdsName(["Say it.", "Ask Mark."], names), true);
    assert.equal(holdsName(["Say it."], names), false);
    assert.equal(holdsName("Mark said so.", []), false);
    assert.equal(holdsName("Mark said so.", undefined), false);
  });

  it("takes a name that was seen in lowercase in a word of any case, and a name in a script with no case", () => {
    const check = (text, name) => checkNames({ recurringPrinciples: [{ n: 1, text }] }, [name]).dropped.length;
    assert.equal(check("As d'Angelo put it.", "d'Angelo"), 1);
    assert.equal(check("As D'Angelo put it.", "d'Angelo"), 1);
    assert.equal(check("Mark the date.", "mark"), 1);
    assert.equal(check("mark the date.", "mark"), 1);
    assert.equal(check("mark the date.", "Mark"), 0);
    assert.equal(check("李明 asked.", "李明"), 1);
    assert.equal(check("Then 李明 asked.", "李明"), 1);
    assert.equal(check("Then 王芳 asked.", "李明"), 0);
    const seen = visibleNames({ map: { "d'Angelo Roe": "Participant 1" } });
    assert.equal(check("As d'Angelo put it.", seen[0]), 1);
  });

  it("splits each of the names into words as it splits the fields, so that a whole name finds its first name", () => {
    const check = (text, name) => checkNames({ recurringPrinciples: [{ n: 1, text }] }, [name]).dropped.length;
    assert.equal(check("Jane asked.", "Jane Doe"), 1);
    assert.equal(check("Ask Doe.", "Jane Doe"), 1);
    assert.equal(check("Ask Jan.", "Jane Doe"), 0);
  });

  it("splits a name that is given at non-letters only, and the words of a field at a case change as well", () => {
    const check = (text, name) => checkNames({ recurringPrinciples: [{ n: 1, text }] }, [name]).dropped.length;
    assert.equal(check("MaryAnn said so.", "Mary"), 1);
    assert.equal(check("MaryAnn said so.", "Ann"), 1);
    assert.equal(check("MaryAnn said so.", "MaryAnn"), 1);
    assert.equal(check("Mary said so.", "MaryAnn"), 0);
    assert.equal(check("Jane said so.", "JaneDoe"), 0);
    // A joined word of a label is names by visibleNames, which gives the parts as well.
    const names = visibleNames({ map: { JaneDoe: "Participant 1" } });
    assert.equal(check("Jane said so.", names[0]), 0);
    assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text: "Jane said so." }] }, names).dropped.length, 1);
    assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text: "Ask Doe." }] }, names).dropped.length, 1);
    assert.equal(checkNames({ recurringPrinciples: [{ n: 1, text: "JaneDoe said so." }] }, names).dropped.length, 1);
  });

  it("takes nothing out of a session in the second person, when the recording says brand names with small words in them", () => {
    const words = say("We post on LinkedIn and YouTube, pay with PayPal, ask OpenAI and buy a MacBook, so we link it, pay it, open it, book it and tube it, and linked is fine. Then Zed from the Growth Lab came.");
    const names = visibleNames({ map: { "Jane Doe (The Growth Lab)": "Participant 1" }, words });
    const reading = { principles: [], recurringPrinciples: [], reelIdeas: [] };
    for (const n of [1, 2, 3, 4, 5]) {
      reading.principles.push({ n, name: `Rule ${n}`, category: "pricing", description: "You say the price first.", steps: ["In the first minute, say it.", "Pay attention to the price.", "Open with the price.", "Book a call early."], red_flags: ["You hide it."], green_flags: ["You say it."], decision_criteria: ["Do you say it?"], example_application: "In a call, you say the price.", verbatim_key_phrases: ["You can say it."] });
    }
    reading.recurringPrinciples.push({ n: 1, text: "You say the price." }, { n: 2, text: "In short, say it." });
    reading.reelIdeas.push({ n: 1, from: "p1", to: "p2", idea: "You say it", words: "In a minute, you say the price.", why: "Pay attention.", refilm: true, principle: null });
    assert.deepEqual(checkNames(reading, names), { kept: reading, dropped: [] });
    const asked = { principles: reading.principles.map((p) => ({ ...p, approved: true })), recurringPrinciples: reading.recurringPrinciples.map((r) => ({ ...r, approved: true })), reelIdeas: reading.reelIdeas.map((r) => ({ ...r, approved: true })) };
    assert.deepEqual(approvedSession(asked, names).dropped, []);
  });

  it("does not look at the keys that hold no words", () => {
    const given = { reelIdeas: [{ n: 1, from: "p1", to: "p4", idea: "Say it.", words: "Say it.", why: "Because.", refilm: "Mark", principle: "Mark", approved: "Mark" }] };
    assert.deepEqual(checkNames(given, NAMES), { kept: given, dropped: [] });
  });

  it("changes nothing in the reading it is given, and gives a new one that keeps what it does not check", () => {
    const given = reading({ principles: [principle(1, { description: "Mark says so." })] });
    const before = copy(given);
    const { kept } = checkNames(given, NAMES);
    assert.deepEqual(given, before);
    assert.notEqual(kept, given);
    assert.deepEqual(kept.spellings, [["hormozy", "Hormozi"]]);
    assert.deepEqual(kept.problems, ["one problem"]);
    assert.equal(given.principles[0].description, "Mark says so.");
  });

  it("gives a reading that shares nothing with the one it is given, its problems and spellings too", () => {
    const given = reading({ principles: [principle(1, { description: "Mark says so.", notes: [["kept"]] })], extra: { note: ["kept"] } });
    const before = copy(given);
    const { kept } = checkNames(given, NAMES);
    kept.problems.push("another problem");
    kept.spellings.push(["kipp", "Kip"]);
    kept.spellings[0].push("changed");
    kept.extra.note.push("changed");
    kept.principles[0].steps.push("changed");
    kept.principles[0].red_flags.push("changed");
    kept.principles[0].notes[0].push("changed");
    kept.recurringPrinciples.push({ n: 3, text: "changed" });
    kept.reelIdeas[0].why = "changed";
    assert.deepEqual(given, before);
    assert.deepEqual(given.problems, ["one problem"]);
  });

  it("takes out nothing when there are no names, and checks only the lists that are there", () => {
    const given = reading();
    assert.deepEqual(checkNames(given, []), { kept: given, dropped: [] });
    assert.deepEqual(checkNames(given, undefined), { kept: given, dropped: [] });
    assert.deepEqual(checkNames({}, NAMES), { kept: {}, dropped: [] });
    assert.deepEqual(checkNames(null, NAMES), { kept: {}, dropped: [] });
    assert.deepEqual(checkNames({ principles: "none", recurringPrinciples: [null, 3] }, NAMES), { kept: { principles: "none", recurringPrinciples: [null, 3] }, dropped: [] });
  });
});

describe("what she says to keep, change or drop", () => {
  const items = () => [1, 2, 3, 4].map((n) => ({ n, name: `Rule ${n}`, category: "pricing", description: `About rule ${n}.`, example_application: `A coach does ${n}.`, steps: ["One"] }));
  const VERB = 'Say keep, drop or edit, then the numbers: keep 1 3, drop 2, edit 3 --name "…".';
  const NUMBERS = "Say which numbers: keep 1 3.";
  const ONE = 'Edit one at a time: edit 3 --name "…".';
  const WHAT = 'Say what to change it to: edit 3 --name "…".';

  it("keeps the items named, and leaves the others undecided", () => {
    const { items: got } = approve(items(), ["keep", "1", "3"]);
    assert.deepEqual(got.map((i) => i.approved), [true, undefined, true, undefined]);
    assert.deepEqual(got.map((i) => i.n), [1, 2, 3, 4]);
    assert.ok(!("approved" in got[1]));
  });

  it("drops the items named", () => {
    const { items: got } = approve(items(), ["drop", "2"]);
    assert.deepEqual(got.map((i) => i.approved), [undefined, false, undefined, undefined]);
  });

  it("changes a decision she made before", () => {
    const first = approve(items(), ["drop", "1", "2"]).items;
    const { items: got } = approve(first, ["keep", "2"]);
    assert.deepEqual(got.map((i) => i.approved), [false, true, undefined, undefined]);
  });

  it("takes numbers joined with commas, and the same number twice", () => {
    assert.deepEqual(approve(items(), ["keep", "1,3", "4"]).items.map((i) => i.approved), [true, undefined, true, true]);
    assert.deepEqual(approve(items(), ["keep", "1,3,"]).items.map((i) => i.approved), [true, undefined, true, undefined]);
    assert.deepEqual(approve(items(), ["keep", "1, 3"]).items.map((i) => i.approved), [true, undefined, true, undefined]);
    assert.deepEqual(approve(items(), ["drop", "2", "2"]).items.map((i) => i.approved), [undefined, false, undefined, undefined]);
  });

  it("takes keep, drop and edit in any case", () => {
    assert.deepEqual(approve(items(), ["Keep", "2"]).items.map((i) => i.approved), [undefined, true, undefined, undefined]);
  });

  it("sets what she dictates and keeps the item, because an edit she dictates counts as hers", () => {
    const { items: got } = approve(items(), ["edit", "3", "--name", "Price first"]);
    assert.deepEqual(got[2], { n: 3, name: "Price first", category: "pricing", description: "About rule 3.", example_application: "A coach does 3.", steps: ["One"], approved: true });
    assert.deepEqual(got.filter((i) => i.n !== 3), items().filter((i) => i.n !== 3));
  });

  it("sets more than one key, and a text that came in several words, trimmed and on one line", () => {
    const { items: got } = approve(items(), ["edit", "2", "--name", "Price", "first", "--category", "  fees \n and more "]);
    assert.equal(got[1].name, "Price first");
    assert.equal(got[1].category, "fees and more");
    assert.equal(got[1].approved, true);
    assert.equal(approve(items(), ["edit", "2", "--name", "  Price \n first  "]).items[1].name, "Price first");
  });

  it("changes only what each kind of item allows", () => {
    assert.deepEqual(EDITS, { principles: ["name", "category", "description", "example_application"], recurringPrinciples: ["text"], reelIdeas: ["idea", "words", "why"] });
    const recurring = [{ n: 1, text: "Say it plainly." }];
    assert.deepEqual(approve(recurring, ["edit", "1", "--text", "Say it simply."], EDITS.recurringPrinciples).items, [{ n: 1, text: "Say it simply.", approved: true }]);
    const ideas = [{ n: 1, idea: "A", words: "B", why: "C", refilm: true, principle: null }];
    assert.deepEqual(approve(ideas, ["edit", "1", "--why", "Because."], EDITS.reelIdeas).items, [{ n: 1, idea: "A", words: "B", why: "Because.", refilm: true, principle: null, approved: true }]);
  });

  it("says in plain words what it cannot do, and changes nothing", () => {
    const given = items();
    const before = copy(given);
    const refused = [
      [[], VERB],
      [["mark", "1"], VERB],
      [["1", "3"], VERB],
      [["keep"], NUMBERS],
      [["drop"], NUMBERS],
      [["keep", ","], NUMBERS],
      [["keep", "one"], NUMBERS],
      [["keep", "1", "x"], NUMBERS],
      [["keep", "1", "--name", "x"], NUMBERS],
      [["keep", "9"], "There is no 9 in this list."],
      [["keep", "1", "9"], "There is no 9 in this list."],
      [["drop", "0"], "There is no 0 in this list."],
      [["edit", "1", "2", "--name", "x"], ONE],
      [["edit", "1,2", "--name", "x"], ONE],
      [["edit", "--name", "x"], NUMBERS],
      [["edit"], NUMBERS],
      [["edit", "one", "--name", "x"], NUMBERS],
      [["edit", "9", "--name", "x"], "There is no 9 in this list."],
      [["edit", "8", "9", "--name", "x"], "There is no 8 in this list."],
      [["edit", "3"], WHAT],
      [["edit", "3", "--name"], WHAT],
      [["edit", "3", "--name", ""], WHAT],
      [["edit", "3", "--name", "   "], WHAT],
      [["edit", "3", "--name", "x", "--category"], WHAT],
      [["edit", "3", "--steps", "x"], "--steps cannot be changed here: change name, category, description or example_application."],
      [["edit", "3", "--name", "x", "--steps", "y"], "--steps cannot be changed here: change name, category, description or example_application."]
    ];
    for (const [said, why] of refused) {
      assert.deepEqual(approve(given, said), { why }, JSON.stringify(said));
      assert.deepEqual(given, before, JSON.stringify(said));
    }
    assert.deepEqual(approve(given, undefined), { why: VERB });
  });

  it("names the keys that can be changed in the words of each kind of item", () => {
    assert.deepEqual(approve([{ n: 1, text: "A" }], ["edit", "1", "--name", "x"], EDITS.recurringPrinciples), { why: "--name cannot be changed here: change text." });
    assert.deepEqual(approve([{ n: 1, idea: "A" }], ["edit", "1", "--text", "x"], EDITS.reelIdeas), { why: "--text cannot be changed here: change idea, words or why." });
  });

  it("gives a new list and leaves the items it was given as they were", () => {
    const given = items();
    const before = copy(given);
    const kept = approve(given, ["keep", "1"]).items;
    const edited = approve(given, ["edit", "2", "--name", "Other"]).items;
    assert.deepEqual(given, before);
    assert.notEqual(kept, given);
    assert.notEqual(kept[1], given[1]);
    assert.notEqual(edited[0], given[0]);
    assert.equal(edited[1].name, "Other");
    assert.equal(given[1].name, "Rule 2");
  });
});

describe("what is not decided yet", () => {
  it("is one line for each item with no decision, principles first, then recurring principles, then Reel ideas", () => {
    const session = {
      principles: [{ n: 1, approved: true }, { n: 2 }, { n: 3, approved: false }],
      recurringPrinciples: [{ n: 1 }, { n: 2, approved: true }],
      reelIdeas: [{ n: 3 }, { n: 4, approved: false }, { n: 5 }]
    };
    assert.deepEqual(undecided(session), [
      "Principle 2 is not decided yet: keep it or drop it.",
      "Recurring principle 1 is not decided yet: keep it or drop it.",
      "Reel idea 3 is not decided yet: keep it or drop it.",
      "Reel idea 5 is not decided yet: keep it or drop it."
    ]);
  });

  it("is nothing when every item is decided, and a list that is missing counts as empty", () => {
    assert.deepEqual(undecided({ principles: [{ n: 1, approved: false }], recurringPrinciples: [], reelIdeas: [{ n: 1, approved: true }] }), []);
    assert.deepEqual(undecided({ principles: [{ n: 1, approved: true }] }), []);
    assert.deepEqual(undecided({}), []);
    assert.deepEqual(undecided(null), []);
    assert.deepEqual(undecided(undefined), []);
  });

  it("counts a decision that is neither true nor false as none", () => {
    assert.deepEqual(undecided({ principles: [{ n: 1, approved: "yes" }, { n: 2, approved: null }] }), [
      "Principle 1 is not decided yet: keep it or drop it.",
      "Principle 2 is not decided yet: keep it or drop it."
    ]);
  });
});

describe("what a session hands over once she has decided", () => {
  const principle = (n, extra = {}) => ({
    n, name: `Rule ${n}`, category: "pricing", description: `About rule ${n}.`, steps: ["Name the price"], red_flags: ["Hiding it"], green_flags: ["Calm talk"],
    decision_criteria: ["Is it said?"], example_application: `A coach does ${n}.`, verbatim_key_phrases: ["say it"], source_context: "Near the start.", approved: true, ...extra
  });
  const idea = (n, extra = {}) => ({ n, from: "p1", to: "p4", idea: `Idea ${n}`, words: `Words ${n}.`, why: `Why ${n}.`, refilm: true, principle: null, approved: true, ...extra });
  const session = () => ({
    principles: [principle(1), principle(2, { approved: false }), principle(3)],
    recurringPrinciples: [{ n: 1, text: "Say it plainly.", approved: true }, { n: 2, text: "Ask first.", approved: false }],
    reelIdeas: [idea(1, { principle: 1 }), idea(2, { principle: 2 }), idea(3, { refilm: false, from: "p5", to: "p7", principle: 3 }), idea(4, { principle: 3, approved: false })],
    spellings: [], problems: []
  });
  const CONTRACT = ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"];

  it("refuses while any item is undecided, and names each", () => {
    const given = session();
    delete given.principles[1].approved;
    delete given.reelIdeas[3].approved;
    assert.deepEqual(approvedSession(given, []), { why: "Principle 2 is not decided yet: keep it or drop it.\nReel idea 4 is not decided yet: keep it or drop it." });
  });

  it("gives only what she kept, with the keys the page takes and no context and no decision", () => {
    const { session: got, why } = approvedSession(session(), []);
    assert.equal(why, undefined);
    assert.deepEqual(Object.keys(got), ["principles", "recurringPrinciples", "reelsToFilm"]);
    assert.deepEqual(got.principles.map((p) => p.n), [1, 3]);
    for (const p of got.principles) assert.deepEqual(Object.keys(p), CONTRACT);
    assert.deepEqual(got.principles[0], {
      n: 1, name: "Rule 1", category: "pricing", description: "About rule 1.", steps: ["Name the price"], red_flags: ["Hiding it"], green_flags: ["Calm talk"],
      decision_criteria: ["Is it said?"], example_application: "A coach does 1.", verbatim_key_phrases: ["say it"]
    });
    assert.deepEqual(got.recurringPrinciples, [{ n: 1, text: "Say it plainly." }]);
    assert.ok(!JSON.stringify(got).includes("Near the start"));
    assert.ok(!JSON.stringify(got).includes("approved"));
  });

  it("gives the Reel ideas to film, naming a principle only when it is in the hand-off, and not an idea cut from the session", () => {
    const { session: got } = approvedSession(session(), []);
    assert.deepEqual(got.reelsToFilm, [
      { n: 1, idea: "Idea 1", words: "Words 1.", why: "Why 1.", principle: 1 },
      { n: 2, idea: "Idea 2", words: "Words 2.", why: "Why 2.", principle: null }
    ]);
    for (const r of got.reelsToFilm) assert.deepEqual(Object.keys(r), ["n", "idea", "words", "why", "principle"]);
  });

  it("gives an empty hand-off when she kept nothing", () => {
    const none = { principles: [principle(1, { approved: false })], recurringPrinciples: [], reelIdeas: [idea(1, { approved: false })] };
    assert.deepEqual(approvedSession(none, []), { session: { principles: [], recurringPrinciples: [], reelsToFilm: [] }, dropped: [] });
    assert.deepEqual(approvedSession({}, []), { session: { principles: [], recurringPrinciples: [], reelsToFilm: [] }, dropped: [] });
  });

  it("puts each list in the order of the numbers", () => {
    const given = { principles: [principle(3), principle(1)], recurringPrinciples: [{ n: 2, text: "B", approved: true }, { n: 1, text: "A", approved: true }], reelIdeas: [idea(2), idea(1)] };
    const { session: got } = approvedSession(given, []);
    assert.deepEqual(got.principles.map((p) => p.n), [1, 3]);
    assert.deepEqual(got.recurringPrinciples.map((r) => r.n), [1, 2]);
    assert.deepEqual(got.reelsToFilm.map((r) => r.n), [1, 2]);
  });

  it("writes a field the name check took out as an empty text, or an empty list, so that every key is there", () => {
    const given = session();
    given.principles[0] = principle(1, { example_application: "Mark does it.", steps: ["Ask Mark"], source_context: "Mark came up." });
    given.reelIdeas[0] = idea(1, { why: "Mark likes it.", principle: 1 });
    const { session: got, dropped } = approvedSession(given, ["Mark"]);
    assert.deepEqual(Object.keys(got.principles[0]), CONTRACT);
    assert.equal(got.principles[0].example_application, "");
    assert.deepEqual(got.principles[0].steps, []);
    assert.equal(got.principles[0].name, "Rule 1");
    assert.deepEqual(got.principles[0].red_flags, ["Hiding it"]);
    assert.deepEqual(Object.keys(got.reelsToFilm[0]), ["n", "idea", "words", "why", "principle"]);
    assert.deepEqual(got.reelsToFilm[0], { n: 1, idea: "Idea 1", words: "Words 1.", why: "", principle: 1 });
    assert.ok(!JSON.stringify(got).includes("Mark"));
    assert.deepEqual(dropped, [
      { field: "Principle 1's steps, entry 1", why: "it held a name brimm-video can see" },
      { field: "Principle 1's example_application", why: "it held a name brimm-video can see" },
      { field: "Reel idea 1's why", why: "it held a name brimm-video can see" }
    ]);
  });

  it("keeps the entries of a list that hold no name, and says which entry it took out of the list she kept", () => {
    const given = session();
    given.principles[0] = principle(1, { steps: ["Name the price", "Ask Mark", "Then wait"], verbatim_key_phrases: ["as Mark says"], decision_criteria: ["Is it said?", "Did Mark agree?"] });
    const { session: got, dropped } = approvedSession(given, ["Mark"]);
    assert.deepEqual(got.principles[0].steps, ["Name the price", "Then wait"]);
    assert.deepEqual(got.principles[0].decision_criteria, ["Is it said?"]);
    assert.deepEqual(got.principles[0].verbatim_key_phrases, []);
    assert.deepEqual(got.principles[0].red_flags, ["Hiding it"]);
    assert.deepEqual(dropped, [
      { field: "Principle 1's steps, entry 2", why: "it held a name brimm-video can see" },
      { field: "Principle 1's decision_criteria, entry 2", why: "it held a name brimm-video can see" },
      { field: "Principle 1's verbatim_key_phrases, entry 1", why: "it held a name brimm-video can see" }
    ]);
    assert.ok(!JSON.stringify(got).includes("Mark"));
    // The list she kept is not changed.
    assert.deepEqual(given.principles[0].steps, ["Name the price", "Ask Mark", "Then wait"]);
  });

  it("writes every key of a principle, an empty text or list when the item never had it", () => {
    const bare = { principles: [{ n: 1, name: "Rule", approved: true }], recurringPrinciples: [], reelIdeas: [{ n: 1, idea: "A", words: "B", refilm: true, principle: null, approved: true }] };
    const { session: got } = approvedSession(bare, []);
    assert.deepEqual(got.principles, [{ n: 1, name: "Rule", category: "", description: "", steps: [], red_flags: [], green_flags: [], decision_criteria: [], example_application: "", verbatim_key_phrases: [] }]);
    assert.deepEqual(got.reelsToFilm, [{ n: 1, idea: "A", words: "B", why: "", principle: null }]);
  });

  it("says which fields the check took out, and only those that are in the file", () => {
    const given = session();
    given.principles[0] = principle(1, { source_context: "Mark came up.", description: "Mark says so." });
    given.principles[1] = principle(2, { description: "Mark says so.", approved: false });
    given.reelIdeas[2] = idea(3, { refilm: false, from: "p5", to: "p7", words: "Mark says it.", principle: null });
    const { dropped } = approvedSession(given, ["Mark"]);
    assert.deepEqual(dropped, [{ field: "Principle 1's description", why: "it held a name brimm-video can see" }]);
    assert.deepEqual(approvedSession(session(), ["Mark"]).dropped, []);
  });

  it("gives lists of its own, never the arrays the session holds", () => {
    const given = session();
    const { session: got } = approvedSession(given, []);
    assert.notEqual(got.principles[0].steps, given.principles[0].steps);
    for (const key of ["steps", "red_flags", "green_flags", "decision_criteria", "verbatim_key_phrases"]) {
      assert.notEqual(got.principles[0][key], given.principles[0][key], key);
      got.principles[0][key].push("changed");
    }
    assert.deepEqual(given.principles[0].steps, ["Name the price"]);
    assert.deepEqual(approvedSession(given, []).session.principles[0].steps, ["Name the price"]);
  });

  it("has what hand-off version 2's check needs of every principle, recurring principle and Reel idea, also when fields were taken out", () => {
    // The check itself (handoffFaultV2, on the branch that has handoff-v2.js) was run by hand on these results; see the report.
    const texts = (v) => Array.isArray(v) && v.every((t) => typeof t === "string");
    const fits = ({ principles, recurringPrinciples, reelsToFilm }) => {
      for (const p of principles) {
        assert.ok(typeof p.name === "string" && p.name.trim(), "name");
        for (const key of ["category", "description", "example_application"]) assert.equal(typeof p[key], "string", key);
        for (const key of ["steps", "red_flags", "green_flags", "decision_criteria", "verbatim_key_phrases"]) assert.ok(texts(p[key]), key);
        assert.ok(!("source_context" in p) && !("approved" in p));
      }
      for (const r of recurringPrinciples) assert.ok(typeof r.text === "string" && r.text.trim());
      for (const r of reelsToFilm) {
        for (const key of ["idea", "words"]) assert.ok(typeof r[key] === "string" && r[key].trim(), key);
        assert.equal(typeof r.why, "string");
        assert.ok(r.principle === null || principles.some((p) => p.n === r.principle));
      }
    };
    fits(approvedSession(session(), []).session);
    const given = session();
    given.principles[0] = principle(1, { category: "Mark's kind", description: "Mark says so.", steps: ["Ask Mark"], red_flags: ["Mark"], green_flags: ["Mark"], decision_criteria: ["Mark?"], example_application: "Mark does it.", verbatim_key_phrases: ["Mark"] });
    given.reelIdeas[0] = idea(1, { why: "Mark likes it.", principle: 1 });
    const got = approvedSession(given, ["Mark"]).session;
    fits(got);
    assert.equal(got.principles[0].category, "");
  });

  it("takes out again a name that is in a text she dictated", () => {
    const edited = approve(session().principles, ["edit", "1", "--description", "Mark said to ask early."]).items;
    const { session: got } = approvedSession({ ...session(), principles: edited }, ["Mark"]);
    assert.equal(got.principles[0].description, "");
    assert.equal(got.principles[0].name, "Rule 1");
  });

  it("does not look at what she dropped, or at an idea that is not to film", () => {
    const given = session();
    given.principles[1] = principle(2, { name: "Mark's rule", approved: false });
    given.recurringPrinciples[1] = { n: 2, text: "Ask Mark.", approved: false };
    given.reelIdeas[2] = idea(3, { refilm: false, idea: "Mark's idea", words: "Mark says.", principle: null });
    const { session: got, why } = approvedSession(given, ["Mark"]);
    assert.equal(why, undefined);
    assert.deepEqual(got.reelsToFilm.map((r) => r.n), [1, 2]);
  });

  it("refuses a kept principle whose name the check took out, until she gives it another", () => {
    const given = session();
    given.principles[2] = principle(3, { name: "Mark's rule" });
    const refused = approvedSession(given, ["Mark"]);
    assert.deepEqual(refused, { why: "Principle 3's name held a name brimm-video took out: give it another name, or drop it." });
    assert.ok(!refused.why.includes("Mark"));
    const renamed = approve(given.principles, ["edit", "3", "--name", "Wait longer"]).items;
    const { session: got, why } = approvedSession({ ...given, principles: renamed }, ["Mark"]);
    assert.equal(why, undefined);
    assert.equal(got.principles[1].name, "Wait longer");
    const dropped = approve(given.principles, ["drop", "3"]).items;
    assert.equal(approvedSession({ ...given, principles: dropped }, ["Mark"]).why, undefined);
  });

  it("refuses a kept recurring principle and a kept Reel idea to film that the check left with nothing to say", () => {
    const given = session();
    given.recurringPrinciples[0] = { n: 1, text: "Ask Mark first.", approved: true };
    given.reelIdeas[1] = idea(2, { idea: "Mark's idea", words: "Mark says it.", principle: null });
    given.reelIdeas[0] = idea(1, { words: "Mark says it.", principle: 1 });
    const refused = approvedSession(given, ["Mark"]);
    assert.deepEqual(refused, { why: lines(
      "Recurring principle 1's text held a name brimm-video took out: say it another way, or drop it.",
      "Reel idea 1's words held a name brimm-video took out: say it another way, or drop it.",
      "Reel idea 2's idea held a name brimm-video took out: say it another way, or drop it.",
      "Reel idea 2's words held a name brimm-video took out: say it another way, or drop it."
    ) });
    assert.ok(!refused.why.includes("Mark"));
  });

  it("refuses a kept item whose name, text, idea or words is missing, not text, or blank", () => {
    const NAME = "Principle 1's name held a name brimm-video took out: give it another name, or drop it.";
    const TEXT = "Recurring principle 1's text held a name brimm-video took out: say it another way, or drop it.";
    const given = (name, text, idea_, words) => ({
      principles: [principle(1, { name })],
      recurringPrinciples: [{ n: 1, text, approved: true }],
      reelIdeas: [idea(1, { idea: idea_, words })]
    });
    for (const blank of ["", "   ", "\n", undefined, null, 3, ["x"], { a: 1 }]) {
      assert.equal(approvedSession(given(blank, "Text.", "Idea", "Words."), []).why, NAME, JSON.stringify(blank));
      assert.equal(approvedSession(given("Name", blank, "Idea", "Words."), []).why, TEXT, JSON.stringify(blank));
      assert.equal(approvedSession(given("Name", "Text.", blank, "Words."), []).why, "Reel idea 1's idea held a name brimm-video took out: say it another way, or drop it.", JSON.stringify(blank));
      assert.equal(approvedSession(given("Name", "Text.", "Idea", blank), []).why, "Reel idea 1's words held a name brimm-video took out: say it another way, or drop it.", JSON.stringify(blank));
    }
    const missing = given("Name", "Text.", "Idea", "Words.");
    delete missing.principles[0].name;
    delete missing.recurringPrinciples[0].text;
    delete missing.reelIdeas[0].idea;
    delete missing.reelIdeas[0].words;
    assert.equal(approvedSession(missing, []).why, lines(NAME, TEXT, "Reel idea 1's idea held a name brimm-video took out: say it another way, or drop it.", "Reel idea 1's words held a name brimm-video took out: say it another way, or drop it."));
  });

  it("gives every line in one refusal, principles first", () => {
    const given = session();
    given.principles[0] = principle(1, { name: "Mark's rule" });
    given.principles[2] = principle(3, { name: "Mark again" });
    given.recurringPrinciples[0] = { n: 1, text: "Ask Mark.", approved: true };
    assert.deepEqual(approvedSession(given, ["Mark"]), { why: lines(
      "Principle 1's name held a name brimm-video took out: give it another name, or drop it.",
      "Principle 3's name held a name brimm-video took out: give it another name, or drop it.",
      "Recurring principle 1's text held a name brimm-video took out: say it another way, or drop it."
    ) });
  });

  it("changes nothing in the session it is given", () => {
    const given = session();
    given.principles[0] = principle(1, { description: "Mark says so." });
    const before = copy(given);
    approvedSession(given, ["Mark"]);
    assert.deepEqual(given, before);
  });
});
