// The small helpers that say things in her chat, which plan.js, footage.js and join.js all use: a command's words with their six escapes
// turned, some things in a row, a count with its noun, a sentence with its full stop, a day as a person says it, how a shot is said, and
// how two names are compared. They stood in plan.js until footage.js (PR H5a) and plan.js imported each other for them; here they are
// leaves, so that no module needs another to have been read first (PR H5b). Nothing here reads or writes anything.

/** The six marks a command's words cannot carry through the shell and the cue format, written as a % and two hex digits in either case:
    %22 is a double quote, %24 a dollar sign, %25 a percent sign, %5C a backslash, %60 a backtick and %7C a pipe, which splits a cue's
    parts. Nothing else is turned: a % with any other letters after it, or none, such as "100% sure", is a % as it stands. */
const ESCAPES = { 22: '"', 24: "$", 25: "%", "5c": "\\", 60: "`", "7c": "|" };
/** A command's word with its six escapes turned, once, from left to right: "%2522" is "%22", the text of a percent sign and "22". */
export const textArg = (word) => String(word ?? "").replace(/%(22|24|25|5c|60|7c)/gi, (_, code) => ESCAPES[code.toLowerCase()]);

/** A whole number, with its thousands in commas. */
export const number = (n) => n.toLocaleString("en-US");
/** Some things in a row: "a", "a and b", "a, b and c"; with `word` "or", "a or b". */
export const joined = (things, word = "and") => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} ${word} ${things[things.length - 1]}`);
/** A count with its noun. */
export const counted = (n, one, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`;
/** A text as a sentence: it ends with a stop, a question or an exclamation mark, or a full stop is put there. */
export const sentence = (text) => (/[.!?…]["”']?$/.test(text) ? text : `${text}.`);

/** How a shot is said where a cue names it, and what a cue of each kind that shows footage shows. */
export const SHOT_SAID = { talking: "talking to the camera", screen: "a screen recording", "b-roll": "b-roll" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** A day as the record's moment keeps it, as a person says it: "4 November". The day is the one the stamp itself names, where she was. */
export const dayText = (at) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(at));
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : String(at);
};

/** A name or a title as it is compared with another: whatever its case, its accents and its spacing. */
export const plainly = (text) => String(text ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
