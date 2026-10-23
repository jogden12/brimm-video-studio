// The dialog only she can answer. Clearing a session's private mark, and noting that a client agreed, need her click on a macOS
// dialog, and Claude, driving her chat, cannot press one. The dialog is shown through osascript and the tool waits for her.
// The one program run here is osascript, and the only answer taken is the button she clicked, with what she typed when she was
// asked to type. A text is never run as AppleScript: each goes into the script inside a string literal and nowhere else.
import { runProgram, lastLine } from "./run.js";

/** How much of what osascript prints is read. An answer is a button, and one line she typed. */
const OUT = 100000;

const asText = (v) => String(v ?? "");

/** A text as an AppleScript string literal: every backslash written \\ and every quote \", between two quotes. A line break stays
    as it is, which AppleScript takes inside a literal. Anything that is not text is read as its text, and nothing as none. */
export const appleText = (s) => `"${asText(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** The script that shows a dialog with `text` and one button for each of `buttons`. The first button is the default, so that a
    stray Return never presses the other. With `answer` the dialog has a field for her to type in, empty to start with. */
export const dialogScript = (text, { buttons, answer }) =>
  `display dialog ${appleText(text)}${answer ? ' default answer ""' : ""} buttons {${buttons.map(appleText).join(", ")}} default button 1 with title "brimm-video" with icon caution`;

/** Show the dialog and wait for her click, however long that is. Resolves { button } for the button she clicked, and with
    `answer`, { button, text } for what she typed as well, as typed ("" for nothing). A button named "Cancel" is AppleScript's
    cancel button: pressing it, or Escape, is { button: "Cancel" }. Anything else resolves { button: null, why }, with `why` in
    plain words: never a button that was not clicked, and never a rejection. `run` is runProgram, or a stand-in in a test. */
export async function askDialog(text, { buttons = ["Cancel", "Clear it"], answer = false, run = runProgram } = {}) {
  const done = await run("/usr/bin/osascript", ["-e", dialogScript(text, { buttons, answer })], { out: OUT });
  if (done.code !== 0) {
    // Cancel and Escape end the script with error -128, "User canceled."
    if (asText(done.stderr).includes("(-128)")) return { button: "Cancel" };
    return { button: null, why: `The dialog could not be shown: ${lastLine(done.stderr)}.` };
  }
  // It prints "button returned:Clear it", and after a typed answer ", text returned:" and the text, then a line break.
  const said = asText(done.stdout).replace(/\n$/, "");
  for (const name of buttons.map(asText)) {
    const clicked = `button returned:${name}`;
    const typed = `${clicked}, text returned:`;
    if (!answer && said === clicked) return { button: name };
    if (answer && said.startsWith(typed)) return { button: name, text: said.slice(typed.length) };
  }
  return { button: null, why: "The dialog's answer could not be read." };
}
