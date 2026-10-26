// The card in code (design 2026-10-26, section 5, "The card's receipt, with the open lock"; R10, R28). Her card's two questions, and
// each set of answers it may offer by the Guess and Maybe lines `episodes` prints, are fixed here, with only the label and a video's
// name put in, as is the follow-up for a Zoom download or sound alone. `episodes` prints the exact card for each video waiting for
// her answer, and her skill asks it as printed: a card Claude words itself is in none of these forms, and earns no receipt.
// These words are a proposal, for Jason and Sallie to settle.

/** The card's first question, of the video called `label`. */
export const WHAT_Q = (label) => `What is ${label}?`;
/** The card's second question. */
export const PRIVATE_Q = "Is it a private session with a client or a group?";

const FINISHED = "Finished by your editor";
const RAW = "Raw with retakes";
const CLIP = "iPhone clip";
const SESSION = "Client or group session";
/** What a video may be, in the order the card offers it when nothing is guessed. */
const BASE = [FINISHED, RAW, CLIP];
/** The answer each guess (kinds.js guessKind's values) puts first. */
const GUESSED = { finished: FINISHED, raw: RAW, clip: CLIP };
/** The first answer of a card whose Maybe line names a video: a raw one's new version is offered as finished by the editor, any
    other's (finished, or an iPhone clip, kept as "short video") as a new version of it. */
const versionOf = ({ name, kind }) => (kind === "raw" ? `A finished version of ${name}` : `A new version of ${name}`);

/** The not-a-session card's answers. */
const IS_SESSION = "It is a client or group session";
const NOT_SESSION = "It is not a session";
/** The not-a-session card's question, of the video called `label`, by how it came: a Zoom download, sound alone, or not known. */
const NOT_SESSION_Q = {
  zoom: (label) => `${label} came from Zoom, which is often a client or group session. Which is it?`,
  sound: (label) => `${label} is sound alone, which is often a client or group session. Which is it?`,
  unknown: (label) => `${label} may be a Zoom download or sound alone, which is often a client or group session. Which is it?`
};
const CAMES = ["zoom", "sound", "unknown"];

const question = (text, labels) => ({ question: text, options: labels.map((label) => ({ label })) });

/** The answers to "What is <label>?", in order: a Maybe line wins over a Guess line. */
function whatAnswers({ guess, maybe }) {
  if (maybe && maybe.session === true) return [SESSION, ...BASE];
  if (maybe && typeof maybe.name === "string") return [versionOf(maybe), FINISHED, RAW, SESSION];
  if (typeof guess === "string" && Object.hasOwn(GUESSED, guess)) return [GUESSED[guess], ...BASE.filter((a) => a !== GUESSED[guess]), SESSION];
  return [...BASE, SESSION];
}

/** Her card for the video called `label`: `guess` is the import's (finished, raw, clip, or null), and `maybe` the video its words
    were found in, as the Maybe line says it: null, `{ session: true }` for a version of a session not cleared, or `{ name, kind }`,
    its name as shownName gives it and its kind as the record keeps it. As AskUserQuestion's questions: { questions }. */
export function cardOf({ label, guess = null, maybe = null }) {
  return { questions: [question(WHAT_Q(label), whatAnswers({ guess, maybe })), question(PRIVATE_Q, ["Yes", "No"])] };
}

/** The card that asks whether the video called `label` is a session after all, when she answered anything but a session and it
    came as a Zoom download or as sound alone (`came`), or the record does not say how it came (any other `came`). */
export function notSessionCardOf({ label, came = null }) {
  const how = came === "zoom" || came === "sound" ? came : "unknown";
  return { questions: [question(NOT_SESSION_Q[how](label), [IS_SESSION, NOT_SESSION])] };
}

/** `questions` as texts and option labels, in order, or null when they are not questions of that shape. Anything else a question or
    an option holds (a header, a description) is not the card's wording, and is left out. */
function shapeOf(questions) {
  if (!Array.isArray(questions)) return null;
  const shaped = [];
  for (const q of questions) {
    if (!q || typeof q !== "object" || typeof q.question !== "string" || !Array.isArray(q.options)) return null;
    const labels = [];
    for (const o of q.options) {
      if (!o || typeof o !== "object" || typeof o.label !== "string") return null;
      labels.push(o.label);
    }
    shaped.push([q.question, labels]);
  }
  return shaped;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Which fixed card `questions` are, and of which video: { label, form: "what" } for her card, { label, form: "not-a-session" } for
    the follow-up, when their texts and option labels, in order, are exactly a card cardOf or notSessionCardOf makes for that label,
    with some guess, Maybe line and way it came; else null. */
export function formOf(questions) {
  const asked = shapeOf(questions);
  if (!asked) return null;
  if (asked.length === 2) {
    const m = /^What is ([\s\S]+)\?$/.exec(asked[0][0]);
    if (!m) return null;
    const label = m[1];
    const first = asked[0][1][0];
    const maybes = [null, { session: true }];
    if (typeof first === "string") {
      for (const [start, kind] of [["A new version of ", "finished"], ["A finished version of ", "raw"]]) if (first.startsWith(start)) maybes.push({ name: first.slice(start.length), kind });
    }
    for (const maybe of maybes) for (const guess of [null, ...Object.keys(GUESSED)]) if (same(asked, shapeOf(cardOf({ label, guess, maybe }).questions))) return { label, form: "what" };
    return null;
  }
  if (asked.length === 1) {
    for (const how of CAMES) {
      const after = NOT_SESSION_Q[how]("");
      const text = asked[0][0];
      if (text.length <= after.length || !text.endsWith(after)) continue;
      const label = text.slice(0, -after.length);
      if (same(asked, shapeOf(notSessionCardOf({ label, came: how }).questions))) return { label, form: "not-a-session" };
    }
  }
  return null;
}
