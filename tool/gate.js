// The gate: which commands of edit.js may run for a video not yet answered, and for a client or group session whose mark is
// not cleared (spec 2026-10-22, section 2, "One gate in edit.js, for every command"). Everything edit.js prints goes into
// Sallie's Claude chat, so for such a record only a few commands run, and every other is refused before it reads a word. A list
// of what is refused would forget the next command; so these are lists of what is allowed, and a command named in none of them
// is refused. tests/gate.test.js walks every name in COMMAND_NAMES against them.
//
// This file is pure: it is given the command's name, the episode's record and the command's words, and reads nothing. edit.js
// asks it wherever it finds the episode a command names (findEpisode), which reads records only.
import { kindOf } from "./episode.js";

/** The commands that name no episode: their output is built from labels alone, and is not gated here. */
export const UNSCOPED = ["episodes", "status", "behind", "retry"];
/** The commands that run for a video not yet answered: `kind` answers it, `leave` leaves it, `which` says which it is, `show`
    opens a copy of it on this Mac, `release` hands it over to the other Mac, and `resolve` sorts out its conflicted copies. */
export const UNANSWERED = ["kind", "leave", "which", "show", "release", "resolve"];
/** The commands that run for a session not cleared, with this Mac's training gate on or off: those, and `name`. */
export const SESSION = [...UNANSWERED, "name"];
/** The commands that run for a session not cleared once this Mac's training gate is on. `reel` and `render` are narrowed by
    their words (below), and `read` is the session reading's own detached run, which starts only through `teachings`. */
export const SESSION_TAUGHT = [...SESSION, "teachings", "principles", "ideas", "finish", "reel", "render", "read"];

/** Why a command is refused, in plain words. None of them names an episode, so that nothing of a file's name reaches the chat. */
const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
const REEL_NOT_AGREED = "A Reel is cut from a session only once you have noted the client's agreement.";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** A whole number from 1, as a person types it: no sign, no zero in front, no fraction. */
const isNumber = (word) => /^[1-9]\d*$/.test(word);

/** Whether the record is of a client or group session whose mark is not cleared. A mark is cleared only when it holds what her
    click on the dialog leaves: `cleared` an object that says `confirmed: "dialog"`. Any other `cleared` (null, missing, "no",
    true, 1, an object without the confirmation) leaves it not cleared; so does a mark that cannot be read; and a record of kind
    "session" with no mark at all is a session not cleared, since this is a gate and it errs toward refusing. */
function sessionNotCleared(record) {
  const mark = record.session;
  if (mark === undefined || mark === null) return record.kind === "session";
  if (!isObject(mark)) return true;
  return !(isObject(mark.cleared) && mark.cleared.confirmed === "dialog");
}

/** Whether a video has been left alone by the person (`leave`): it has no kind, and its answer says it is not for brimm-video. It
    is gated as a video not answered is, but it is not waiting for anything, and says so in words of its own. */
const leftAlone = (record) => isObject(record) && kindOf(record) === null && isObject(record.answer) && record.answer.state === "not for brimm-video";

/** Whether a record is gated at all: a video with no kind (not yet answered, or left alone as not for brimm-video), or a session
    whose mark is not cleared. Such a record is named by its label in everything edit.js prints (shownName, in episode.js), and
    never by its folder or its file. Anything that is not a record is not one. */
export const gated = (record) => isObject(record) && (kindOf(record) === null || sessionNotCleared(record));

/** The words of a command as the gate reads them. A detached run is started as `<command> --now <folder> <words…>` (detached.js),
    and the folder stands where the person said the episode: so those words are read as `<folder> <words…>`. */
const wordsOf = (words) => (words[0] === "--now" ? words.slice(1) : words);

/** Whether a Reel of a session has been agreed to, as the record says: `session.agreed`, a list of { n, at }. A missing list, or
    one that is not a list, agrees to none. */
function agreedTo(record, n) {
  const list = isObject(record.session) ? record.session.agreed : undefined;
  return Array.isArray(list) && list.some((a) => isObject(a) && a.n === n);
}

/** Whether a session's `reel` or `render` has the words that cut a Reel from it, and the agreement behind them:
    - `reel "<label>" make <n>` of a Reel recorded as agreed;
    - `reel "<label>" <n> --client-agreed`, which asks on a dialog Claude cannot press, and notes the agreement;
    - `render "<label>" reel <n>` of a Reel recorded as agreed.
    Any other words are not: the label is one word, as a quoted name is, so that these are all the words there are. And the
    first word counts as the label only when it is the very word the episode was asked for (`said`, what findEpisode was given):
    otherwise it is a verb of today's reel, as in `reel pick 14 --client-agreed`, which asks for the episode "14". Without `said`
    no words count. */
function reelWords(command, record, words, said) {
  const [label, second, third, ...rest] = wordsOf(words);
  if (label === undefined || typeof said !== "string" || label !== said || rest.length || third === undefined) return false;
  if (command === "reel" && second === "make") return isNumber(third) && agreedTo(record, Number(third));
  if (command === "reel" && third === "--client-agreed") return isNumber(second);
  if (command === "render" && second === "reel") return isNumber(third) && agreedTo(record, Number(third));
  return false;
}

/** Why `command`, with `words`, may not run for the episode with this `record`: the plain words of why, or "" when it may.
    `said` is what the episode was asked for by (findEpisode's second argument), with which the words of a Reel are matched.
    - A command that names no episode (UNSCOPED) is not gated.
    - A record with no kind, whatever its answer says (a video left alone as not for brimm-video included), only the commands of
      UNANSWERED. Any other is refused in the words of a video waiting for its answer, or, for one she left alone, in words that
      say so: it is not waiting for an answer.
    - A session whose mark is not cleared, only those of SESSION, and, once the training gate is on (`teachingsOn`), those of
      SESSION_TAUGHT. Of those, `reel` and `render` run only with the words of a Reel she has agreed on (reelWords).
    - An answered record that is not a session, and a session whose mark is cleared, every command.
    A command named in none of the lists is refused for a record that is gated at all. */
export function gateFor(command, record, { teachingsOn = false, said } = {}, words = []) {
  if (UNSCOPED.includes(command)) return "";
  if (kindOf(record) === null) return UNANSWERED.includes(command) ? "" : leftAlone(record) ? LEFT : WAITING;
  if (!sessionNotCleared(record)) return "";
  if (SESSION.includes(command)) return "";
  if (!SESSION_TAUGHT.includes(command)) return NOT_FOR_SESSION;
  if (!teachingsOn) return TEACHINGS_OFF;
  if ((command === "reel" || command === "render") && !reelWords(command, record, words, said)) return REEL_NOT_AGREED;
  return "";
}

/** Why `show` may not print a file of the episode with this `record` into the chat, in plain words, or "" when it may. The gate
    lets `show` run for a video not answered and for a session (it names them, and opens nothing), but what it prints goes into
    Sallie's chat, and a transcript, notes or cut plan hold words said in them. Until `show` opens a read-only copy on this Mac
    instead, it prints no file of such a record, whether the training gate is on or off. */
export function printWhy(record) {
  if (kindOf(record) === null) return "Its words are not shown in the chat while it waits for its answer.";
  if (sessionNotCleared(record)) return "A client or group session's words are not shown in the chat.";
  return "";
}
