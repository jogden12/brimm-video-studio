// The dialog only she can answer: the script osascript is given, with every text quoted so that none can leave its literal, how
// what osascript prints is read, never as a button that was not clicked, and that nothing makes asking her reject or quotes what
// osascript printed. No test here runs osascript: a stand-in answers.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appleText, dialogScript, askDialog } from "../dialog.js";

/** Texts that have tried to break out of a literal, or could: quotes, backslashes, a backslash before a quote, line breaks,
    a text that finishes the literal and goes on, and a text with nothing in it. */
const AWKWARD = [
  'She said "C:\\new\\" twice',
  "C:\\",
  '"',
  '\\\\"',
  '""',
  "Two lines\nand a\ttab",
  'x" & (do shell script "echo no") & "',
  "Clear \u201cit\u201d? caf\u00e9 \u2014 yes",
  ""
];

/** AppleScript's reading of a script, as far as the tool writes one. Inside a string literal `\\` is a backslash, `\"` is a
    quote, and a bare `"` ends it. Another backslash is nothing appleText writes, so it stops the test. Gives the script with
    each literal put as <text>, and the values the literals read as, in order. */
function readScript(script) {
  const values = [];
  let rest = "";
  for (let i = 0; i < script.length; i++) {
    if (script[i] !== '"') {
      rest += script[i];
      continue;
    }
    let value = "";
    for (i++; script[i] !== '"'; i++) {
      assert.ok(i < script.length, "a literal is never closed");
      if (script[i] === "\\") {
        i++;
        assert.ok(script[i] === "\\" || script[i] === '"', "a backslash is followed by a backslash or a quote");
      }
      value += script[i];
    }
    values.push(value);
    rest += "<text>";
  }
  return { rest, values };
}

/** A stand-in for runProgram. It answers with `result` and keeps what it was asked. Nothing is run. */
function standIn(result) {
  const calls = [];
  const run = async (cmd, args, options) => {
    calls.push({ cmd, args, options });
    return result;
  };
  return { run, calls };
}
const clicked = (name) => ({ code: 0, stderr: "", stdout: `button returned:${name}\n` });
const typed = (name, said) => ({ code: 0, stderr: "", stdout: `button returned:${name}, text returned:${said}\n` });
const CANCELED = { code: 1, stderr: "0:62: execution error: User canceled. (-128)\n", stdout: "" };
const UNREADABLE = { button: null, why: "The dialog's answer could not be read." };
const NOT_SHOWN = { button: null, why: "The dialog could not be shown." };
const ENDED = (code) => ({ button: null, why: `The dialog could not be shown (osascript ended with code ${code}).` });

const CLEAR = "This was marked a client or group session. Lets Claude read its words. Clear it?";

describe("a text as AppleScript has it", () => {
  it("is a string literal that reads back as the text, whatever the text holds", () => {
    for (const s of AWKWARD) {
      const { rest, values } = readScript(appleText(s));
      assert.deepEqual([rest, values], ["<text>", [s]], s);
    }
  });
  it("is one literal from its first quote to its last, with no bare quote before the end", () => {
    const literal = appleText('She said "C:\\new\\" twice');
    assert.equal(literal, '"She said \\"C:\\\\new\\\\\\" twice"');
    const inside = literal.slice(1, -1).replace(/\\\\|\\"/g, "");
    assert.ok(!inside.includes('"') && !inside.includes("\\"), inside);
  });
  it("leaves a line break as it is, which AppleScript takes inside a literal", () => {
    assert.equal(appleText("a\nb"), '"a\nb"');
  });
  it("leaves out every NUL character, which no program can be started with in what it is given", () => {
    assert.equal(appleText("a\0b\0\0c"), '"abc"');
    assert.equal(appleText("\0"), '""');
    assert.equal(appleText('a\0"\0b'), '"a\\"b"');
    assert.equal(appleText('\\\0"'), '"\\\\\\""');
  });
  it("reads anything that is not text as its text, and nothing as no text", () => {
    assert.equal(appleText(null), '""');
    assert.equal(appleText(undefined), '""');
    assert.equal(appleText(42), '"42"');
    assert.equal(appleText(false), '"false"');
  });
});

describe("the script that shows the dialog", () => {
  it("shows the text and the buttons, makes the default button the first, and gives the title and the icon", () => {
    assert.equal(
      dialogScript("Clear it?", { buttons: ["Cancel", "Clear it"], answer: false }),
      'display dialog "Clear it?" buttons {"Cancel", "Clear it"} default button 1 with title "brimm-video" with icon caution'
    );
  });
  it("makes Cancel the default button when there is one, by its place counted from 1, so that a stray Return presses it", () => {
    const script = (buttons) => dialogScript("Sure?", { buttons, answer: false });
    assert.match(script(["Clear it", "Cancel"]), /buttons \{"Clear it", "Cancel"\} default button 2 with title/);
    assert.match(script(["Yes", "No", "Cancel"]), /default button 3 with title/);
    assert.match(script(["Cancel", "Clear it"]), /default button 1 with title/);
    assert.match(script(["Cancel"]), /default button 1 with title/);
  });
  it("makes the first button the default when none is named Cancel, and only a button named exactly so is Cancel", () => {
    const script = (buttons) => dialogScript("Sure?", { buttons, answer: false });
    assert.match(script(["No", "Yes"]), /default button 1 with title/);
    assert.match(script(["Yes", "cancel", "Cancel it"]), /default button 1 with title/);
  });
  it("makes Cancel the default button with a typed answer asked for as well", () => {
    assert.match(dialogScript("Who agreed?", { buttons: ["Noted", "Cancel"], answer: true }), /default answer "" buttons \{"Noted", "Cancel"\} default button 2 with title/);
  });
  it("holds no NUL character, from the text or from a button", () => {
    const script = dialogScript("Clear\0 it?", { buttons: ["Can\0cel", "Clear\0 it"], answer: true });
    assert.ok(!script.includes("\0"));
    assert.equal(script, 'display dialog "Clear it?" default answer "" buttons {"Cancel", "Clear it"} default button 1 with title "brimm-video" with icon caution');
  });
  it("asks for a typed answer, with nothing in the field, when it is asked to", () => {
    assert.equal(
      dialogScript("Who agreed, and when?", { buttons: ["Cancel", "Noted"], answer: true }),
      'display dialog "Who agreed, and when?" default answer "" buttons {"Cancel", "Noted"} default button 1 with title "brimm-video" with icon caution'
    );
  });
  it("holds every text, the dialog's and the buttons', only inside its own literal", () => {
    for (const s of AWKWARD) {
      for (const answer of [false, true]) {
        const { rest, values } = readScript(dialogScript(s, { buttons: [s, "Cancel", "Say \"hi\""], answer }));
        const wanted = `display dialog <text>${answer ? " default answer <text>" : ""} buttons {<text>, <text>, <text>} default button 2 with title <text> with icon caution`;
        assert.equal(rest, wanted, s);
        assert.deepEqual(values, [s, ...(answer ? [""] : []), s, "Cancel", 'Say "hi"', "brimm-video"], s);
      }
    }
  });
});

describe("asking her", () => {
  it("runs osascript with the script, reads what it prints and sets no time limit, since it waits for her click", async () => {
    const { run, calls } = standIn(clicked("Clear it"));
    await askDialog(CLEAR, { run });
    assert.deepEqual(calls, [{
      cmd: "/usr/bin/osascript",
      args: ["-e", `display dialog "${CLEAR}" buttons {"Cancel", "Clear it"} default button 1 with title "brimm-video" with icon caution`],
      options: { out: 100000 }
    }]);
  });
  it("asks for a typed answer when it is asked to, and for the buttons it is given", async () => {
    const { run, calls } = standIn(typed("Noted", "Jane Doe"));
    await askDialog("Who agreed, and when?", { buttons: ["Cancel", "Noted"], answer: true, run });
    assert.deepEqual(calls[0].args, ["-e", 'display dialog "Who agreed, and when?" default answer "" buttons {"Cancel", "Noted"} default button 1 with title "brimm-video" with icon caution']);
  });
  it("quotes a dialog text with quotes and backslashes inside its one literal", async () => {
    const { run, calls } = standIn(clicked("Clear it"));
    const text = 'She said "C:\\new\\" twice';
    await askDialog(text, { run });
    const { rest, values } = readScript(calls[0].args[1]);
    assert.equal(rest, "display dialog <text> buttons {<text>, <text>} default button 1 with title <text> with icon caution");
    assert.deepEqual(values, [text, "Cancel", "Clear it", "brimm-video"]);
  });

  describe("answers with the button she clicked", () => {
    it("Clear it", async () => {
      assert.deepEqual(await askDialog(CLEAR, { run: standIn(clicked("Clear it")).run }), { button: "Clear it" });
    });
    it("whichever it is among the buttons given, with the line break osascript ends with taken off, or without", async () => {
      const buttons = ["No", "Yes"];
      assert.deepEqual(await askDialog("Sure?", { buttons, run: standIn(clicked("Yes")).run }), { button: "Yes" });
      assert.deepEqual(await askDialog("Sure?", { buttons, run: standIn({ code: 0, stderr: "", stdout: "button returned:No" }).run }), { button: "No" });
    });
    it("a button with a quote in its name, as it is named", async () => {
      assert.deepEqual(await askDialog("Sure?", { buttons: ['Say "hi"', "Cancel"], run: standIn(clicked('Say "hi"')).run }), { button: 'Say "hi"' });
    });
  });

  describe("answers Cancel", () => {
    it("when she presses Cancel, or Escape, which ends osascript with error -128, User canceled", async () => {
      assert.deepEqual(await askDialog(CLEAR, { run: standIn(CANCELED).run }), { button: "Cancel" });
    });
    it("with a typed answer asked for as well", async () => {
      assert.deepEqual(await askDialog("Who agreed?", { buttons: ["Cancel", "Noted"], answer: true, run: standIn(CANCELED).run }), { button: "Cancel" });
    });
    it("when -128 is the last thing osascript printed, however many lines it printed and whatever follows the last", async () => {
      for (const stderr of ["User canceled. (-128)", "osascript: a warning\n0:62: execution error: User canceled. (-128)\n\n", "0:62: execution error: User canceled. (-128)  \r\n"]) {
        assert.deepEqual(await askDialog(CLEAR, { run: standIn({ code: 1, stderr, stdout: "" }).run }), { button: "Cancel" }, stderr);
      }
    });
    it("only when osascript ended with an error: a code of 0 is read as the answer it printed", async () => {
      assert.deepEqual(await askDialog(CLEAR, { run: standIn({ code: 0, stderr: "execution error: User canceled. (-128)", stdout: "" }).run }), UNREADABLE);
    });
    it("only when the last line osascript printed ends with (-128), not when an error quotes it or it is not the last", async () => {
      for (const stderr of [
        'execution error: Can\'t make "(-128)" into type text. (-1700)',
        "User canceled. (-128)\nosascript: crashed (-600)",
        "execution error: User canceled. (-128) and more",
        "execution error: error 128",
        "execution error: User canceled. -128",
        "execution error: User canceled. (128)",
        "execution error: User canceled. [-128]",
        "(-128",
        "",
        undefined
      ]) {
        assert.deepEqual(await askDialog(CLEAR, { run: standIn({ code: 1, stderr, stdout: "" }).run }), ENDED(1), String(stderr));
      }
    });
    it("only when Cancel is one of the buttons, since only then can she cancel", async () => {
      assert.deepEqual(await askDialog("Sure?", { buttons: ["No", "Yes"], run: standIn(CANCELED).run }), ENDED(1));
      assert.deepEqual(await askDialog("Sure?", { buttons: ["cancel", "Yes"], run: standIn(CANCELED).run }), ENDED(1));
      assert.deepEqual(await askDialog("Sure?", { buttons: ["Yes", "Cancel"], run: standIn(CANCELED).run }), { button: "Cancel" });
    });
  });

  describe("with a typed answer", () => {
    const buttons = ["Cancel", "Noted"];
    it("gives the button and what she typed, commas and all", async () => {
      const { run } = standIn(typed("Noted", "Jane Doe, 22 Oct"));
      assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), { button: "Noted", text: "Jane Doe, 22 Oct" });
    });
    it("gives an empty text when she typed nothing", async () => {
      const { run } = standIn(typed("Noted", ""));
      assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), { button: "Noted", text: "" });
    });
    it("gives the text as typed: spaces, quotes, and words that osascript prints itself", async () => {
      for (const said of ["  Jane  ", 'Jane "JD" Doe', "C:\\new", "Jane, text returned:Noted", "a\rb"]) {
        const { run } = standIn(typed("Noted", said));
        assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), { button: "Noted", text: said }, said);
      }
    });
    it("takes off only the one line break osascript ends with", async () => {
      const { run } = standIn({ code: 0, stderr: "", stdout: "button returned:Noted, text returned:Jane\n\n" });
      assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), { button: "Noted", text: "Jane\n" });
    });
    it("gives the text only when one was asked for", async () => {
      const { run } = standIn(typed("Noted", "Jane"));
      assert.deepEqual(await askDialog("Noted?", { buttons, run }), UNREADABLE);
    });
    it("is read as unreadable when it prints no text though one was asked for", async () => {
      const { run } = standIn(clicked("Noted"));
      assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), UNREADABLE);
    });
  });

  describe("never answers a button that was not clicked", () => {
    it("when osascript prints a button that was not given", async () => {
      assert.deepEqual(await askDialog(CLEAR, { run: standIn(clicked("Delete it")).run }), UNREADABLE);
      assert.deepEqual(await askDialog("Who agreed?", { buttons: ["Cancel", "Noted"], answer: true, run: standIn(typed("Delete it", "Jane")).run }), UNREADABLE);
    });
    it("when the name is only like one that was given: another case, more words, fewer words, or a name with a comma in it", async () => {
      for (const name of ["clear it", "Clear it now", "Clear", " Clear it", "Clear it ", "Cancel, Clear it"]) {
        assert.deepEqual(await askDialog(CLEAR, { run: standIn(clicked(name)).run }), UNREADABLE, name);
      }
      assert.deepEqual(await askDialog("Who agreed?", { buttons: ["Cancel", "Noted"], answer: true, run: standIn(typed("Noted2", "Jane")).run }), UNREADABLE);
    });
    it("when it prints nothing, or something else, or nothing was said of it", async () => {
      for (const stdout of ["", "\n", "Clear it\n", "button returned:\n", "button returned:Clear it\nsomething more\n", "text returned:Clear it\n", undefined, null, 7]) {
        assert.deepEqual(await askDialog(CLEAR, { run: standIn({ code: 0, stderr: "", stdout }).run }), UNREADABLE, String(stdout));
      }
      assert.deepEqual(await askDialog(CLEAR, { run: standIn({ code: 0, stderr: "" }).run }), UNREADABLE);
    });
    it("when osascript ended with an error, whatever it printed", async () => {
      const { run } = standIn({ code: 1, stderr: "execution error: Something broke. (-1708)\n", stdout: "button returned:Clear it\n" });
      assert.deepEqual(await askDialog(CLEAR, { run }), ENDED(1));
    });
  });

  describe("an answer cut short is not an answer", () => {
    const head = "button returned:Noted, text returned:";
    const buttons = ["Cancel", "Noted"];
    it("when what osascript printed is as long as the limit, or longer", async () => {
      for (const length of [100000, 100001, 250000]) {
        const { run } = standIn({ code: 0, stderr: "", stdout: head + "x".repeat(length - head.length) });
        assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), UNREADABLE, String(length));
      }
      const { run } = standIn({ code: 0, stderr: "", stdout: head + "x".repeat(99999 - head.length) + "\n" });
      assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), UNREADABLE);
    });
    it("but one a character shorter than the limit is read", async () => {
      const typedText = "x".repeat(99998 - head.length);
      const { run } = standIn({ code: 0, stderr: "", stdout: `${head}${typedText}\n` });
      assert.deepEqual(await askDialog("Who agreed?", { buttons, answer: true, run }), { button: "Noted", text: typedText });
    });
    it("also when it names a button and no text is asked for", async () => {
      const name = "N".repeat(100000);
      const { run } = standIn({ code: 0, stderr: "", stdout: `button returned:${name}\n` });
      assert.deepEqual(await askDialog("Sure?", { buttons: ["Cancel", name], run }), UNREADABLE);
    });
  });

  describe("holds no NUL character", () => {
    it("in what osascript is given, from the text or from a button, and still answers", async () => {
      const { run, calls } = standIn(clicked("Clear it"));
      assert.deepEqual(await askDialog("Clear\0 this\0?", { buttons: ["Can\0cel", "Clear\0 it"], run }), { button: "Clear it" });
      assert.equal(calls.length, 1);
      assert.ok(calls[0].args.every((arg) => !arg.includes("\0")));
      assert.equal(calls[0].args[1], 'display dialog "Clear this?" buttons {"Cancel", "Clear it"} default button 1 with title "brimm-video" with icon caution');
    });
    it("and still answers Cancel for a Cancel with one in it", async () => {
      assert.deepEqual(await askDialog("Sure?", { buttons: ["Can\0cel", "Yes"], run: standIn(CANCELED).run }), { button: "Cancel" });
    });
  });

  describe("never rejects", () => {
    it("when osascript cannot be asked: the stand-in for it throws, or rejects", async () => {
      const throws = () => {
        throw new Error("spawn failed");
      };
      const rejects = async () => {
        throw new Error("spawn failed");
      };
      assert.deepEqual(await askDialog(CLEAR, { run: throws }), NOT_SHOWN);
      assert.deepEqual(await askDialog(CLEAR, { run: rejects }), NOT_SHOWN);
      assert.deepEqual(await askDialog(CLEAR, { run: () => Promise.reject("no") }), NOT_SHOWN);
    });
    it("when what it was given cannot be turned into a script: buttons that are not a list, or a text that has no text", async () => {
      for (const buttons of ["Cancel", null, 5, {}, { length: 2 }, true]) {
        const { run, calls } = standIn(clicked("Clear it"));
        assert.deepEqual(await askDialog(CLEAR, { buttons, run }), NOT_SHOWN, String(buttons));
        assert.equal(calls.length, 0);
      }
      const { run, calls } = standIn(clicked("Clear it"));
      assert.deepEqual(await askDialog(Object.create(null), { run }), NOT_SHOWN);
      assert.equal(calls.length, 0);
    });
    it("when it is given no options that can be read: null", async () => {
      assert.deepEqual(await askDialog(CLEAR, null), NOT_SHOWN);
    });
    it("when what it was answered cannot be read: nothing, or no object, or one with no code", async () => {
      for (const answered of [undefined, null, "button returned:Clear it", 0, 1, true, {}, { stdout: "button returned:Clear it\n" }, { code: "0", stdout: "button returned:Clear it\n" }, { code: NaN }]) {
        assert.deepEqual(await askDialog(CLEAR, { run: standIn(answered).run }), UNREADABLE, String(answered));
      }
    });
    it("when what it was answered throws as it is read", async () => {
      const hostile = { code: 1, get stderr() { throw new Error("no stderr"); } };
      assert.deepEqual(await askDialog(CLEAR, { run: standIn(hostile).run }), NOT_SHOWN);
      const hostileOut = { code: 0, get stdout() { throw new Error("no stdout"); } };
      assert.deepEqual(await askDialog(CLEAR, { run: standIn(hostileOut).run }), NOT_SHOWN);
    });
  });

  describe("says why no dialog was answered", () => {
    it("with the code osascript ended with, when it is not there", async () => {
      const { run } = standIn({ code: 127, stderr: "spawn /usr/bin/osascript ENOENT" });
      assert.deepEqual(await askDialog(CLEAR, { run }), ENDED(127));
      assert.equal(ENDED(127).why, "The dialog could not be shown (osascript ended with code 127).");
    });
    it("with the code osascript ended with, when it ended with another error", async () => {
      const { run } = standIn({ code: 1, stderr: "osascript: something\n0:20: syntax error: Expected end of line. (-2741)\n", stdout: "" });
      assert.deepEqual(await askDialog(CLEAR, { run }), ENDED(1));
    });
    it("quoting nothing osascript printed, which can quote the script and so the dialog's text", async () => {
      const text = 'Jane "JD" Doe of Acme, 3 Elm Street';
      for (const stderr of [
        `0:20: syntax error: Expected end of line, etc. but found "Jane". (-2741)`,
        `execution error: Can't get ${text}. (-1728)\n`,
        `${text}\n${text}`
      ]) {
        const { why } = await askDialog(text, { run: standIn({ code: 1, stderr, stdout: text }).run });
        assert.equal(why, "The dialog could not be shown (osascript ended with code 1).");
        assert.ok(!why.includes("Jane") && !why.includes("Elm") && !why.includes("-2741"));
      }
    });
    it("in the same words when osascript printed no reason, or a signal ended it", async () => {
      for (const result of [{ code: 1, stderr: "", stdout: "" }, { code: 1, stderr: "\n" }, { code: 1, stderr: undefined }, { code: 1, stderr: "", signal: "SIGKILL" }]) {
        assert.deepEqual(await askDialog(CLEAR, { run: standIn(result).run }), ENDED(1));
      }
    });
  });
});
