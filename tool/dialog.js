// The dialog only she can answer. Clearing a session's private mark, and noting that a client agreed, need her click on a macOS
// dialog, and Claude, driving her chat, cannot press one. The dialog is shown through osascript and the tool waits for her.
// The one program run here is osascript, and the only answer taken is the button she clicked, with what she typed when she was
// asked to type. A text is never run as AppleScript: each goes into the script inside a string literal and nowhere else. Nothing
// osascript printed is passed on in a message, since it can quote the script, and so the dialog's text.
import { runProgram, lastLine } from "./run.js";

/** How much of what osascript prints is read. An answer is a button, and one line she typed. */
const OUT = 100000;

const UNREADABLE = "The dialog's answer could not be read.";

const asText = (v) => String(v ?? "");
const failed = (why) => ({ button: null, why });

/** A text as the script holds it: a NUL character is left out, since a program cannot be started with one in what it is given. */
const shown = (v) => asText(v).replace(/\0/g, "");

/** A text as an AppleScript string literal: every backslash written \\ and every quote \", between two quotes. A line break stays
    as it is, which AppleScript takes inside a literal. A NUL character is left out. Anything that is not text is read as its
    text, and nothing as none. */
export const appleText = (s) => `"${shown(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** The script that shows a dialog with `text` and one button for each of `buttons`. The default button is the one named
    "Cancel" when there is one, so that a stray Return cancels, and otherwise the first. With `answer` the dialog has a field
    for her to type in, empty to start with. */
export function dialogScript(text, { buttons, answer }) {
  const names = buttons.map(shown);
  const cancel = names.indexOf("Cancel");
  return `display dialog ${appleText(text)}${answer ? ' default answer ""' : ""} buttons {${names.map(appleText).join(", ")}} default button ${cancel < 0 ? 1 : cancel + 1} with title "brimm-video" with icon caution`;
}

/** What `done`, the end of osascript, says she answered, for the `buttons` she was shown. */
function answerOf(done, buttons, answer) {
  // Nothing, or something that is no end of a program, says nothing: an end has the code it ended with.
  if (!done || !Number.isInteger(done.code)) return failed(UNREADABLE);
  const names = buttons.map(shown);
  if (done.code !== 0) {
    // Cancel and Escape end the script with error -128, "User canceled.", as the last thing it prints. Only a dialog that has a
    // Cancel button can be canceled. What was printed is not passed on: it can quote the script.
    if (names.includes("Cancel") && lastLine(done.stderr).endsWith("(-128)")) return { button: "Cancel" };
    return failed(`The dialog could not be shown (osascript ended with code ${done.code}).`);
  }
  const printed = asText(done.stdout);
  // All of it is read, or it is not an answer: what is as long as the limit was cut.
  if (printed.length >= OUT) return failed(UNREADABLE);
  // It prints "button returned:Clear it", and after a typed answer ", text returned:" and the text, then a line break.
  const said = printed.replace(/\n$/, "");
  for (const name of names) {
    const clicked = `button returned:${name}`;
    const typed = `${clicked}, text returned:`;
    if (!answer && said === clicked) return { button: name };
    if (answer && said.startsWith(typed)) return { button: name, text: said.slice(typed.length) };
  }
  return failed(UNREADABLE);
}

/** Show the dialog and wait for her click, however long that is. Resolves { button } for the button she clicked, and with
    `answer`, { button, text } for what she typed as well, as typed ("" for nothing). A button named "Cancel" is AppleScript's
    cancel button: pressing it, or Escape, is { button: "Cancel" }. Anything else resolves { button: null, why }, with `why` in
    plain words: never a button that was not clicked, and never a rejection, whatever it is given and whatever goes wrong.
    The options are `buttons` (["Cancel", "Clear it"] when none), `answer` (false) and `run` (runProgram, or a stand-in in a test). */
export async function askDialog(text, options = {}) {
  try {
    const { buttons = ["Cancel", "Clear it"], answer = false, run = runProgram } = options;
    const done = await run("/usr/bin/osascript", ["-e", dialogScript(text, { buttons, answer })], { out: OUT });
    return answerOf(done, buttons, answer);
  } catch (e) {
    return failed("The dialog could not be shown.");
  }
}
