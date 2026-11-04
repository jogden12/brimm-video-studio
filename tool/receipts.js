// The card in code (design 2026-10-26, section 5, "The card's receipt, with the open lock"; R10, R28). Her card's two questions, and
// each set of answers it may offer by the Guess and Maybe lines `episodes` prints, are fixed here, with only the label and a video's
// name put in, as is the follow-up for a Zoom download or sound alone. `episodes` prints the exact card for each video waiting for
// her answer, and her skill asks it as printed: a card Claude words itself is in none of these forms, and earns no receipt.
// These words are a proposal, for Jason and Sallie to settle.
//
// The receipt (R11): a PostToolUse hook on AskUserQuestion (studio/receipt.sh, receipt.mjs) writes one into this Mac's Application
// Support, which neither the sandbox nor Claude's Write tool reaches, only for a card in one of these forms that she answered: her
// answers are taken from the tool's result, never from what Claude asked with, and a card that resolved itself while she was idle
// (afkTimeoutMs), or that she followed up in words (followUp), earns none. `kind`, under Claude Code on a Mac whose lock in effect
// is open, answers a video with no kind only when a receipt of the last hour holds its label and her very answers (edit.js).
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

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

/** Each question's header, the short title AskUserQuestion shows above it. Like every word of the card, fixed: no answer has a
    description beside it, and she gives one answer at a time. */
const HEADER = { what: "What it is", private: "Private", notSession: "Session", planned: "Planned", shot: "Shot", client: "Client" };

const question = (text, header, labels) => ({ question: text, header, multiSelect: false, options: labels.map((label) => ({ label, description: "" })) });

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
  return { questions: [question(WHAT_Q(label), HEADER.what, whatAnswers({ guess, maybe })), question(PRIVATE_Q, HEADER.private, ["Yes", "No"])] };
}

/** The card that asks whether the video called `label` is a session after all, when she answered anything but a session and it
    came as a Zoom download or as sound alone (`came`), or the record does not say how it came (any other `came`). */
export function notSessionCardOf({ label, came = null }) {
  const how = came === "zoom" || came === "sound" ? came : "unknown";
  return { questions: [question(NOT_SESSION_Q[how](label), HEADER.notSession, [IS_SESSION, NOT_SESSION])] };
}

// --- The planned card and the part card (PR H5a): a video with a picture, waiting for its answer, may be footage for a planned video ---

/** The planned card's question, of the video called `label`: is it for a planned video? */
export const PLANNED_Q = (label) => `Is ${label} for a planned video?`;
/** The planned card's answer for a plan, by its title: "Footage for "Too many SKUs"". Her answer on the planned card says which plan. */
export const footageOption = (title) => `Footage for "${title}"`;
/** A plan's title out of its answer on the planned card, or null for any other text. */
const titleOfOption = (text) => /^Footage for "([\s\S]+)"$/.exec(text)?.[1] ?? null;
/** The planned card's last answer: the video is for no plan. */
const NOT_PLANNED = "No";
/** The most plans the planned card offers. */
const MOST_OFFERS = 3;

/** The planned card for the video called `label`, which `episodes` prints under a video waiting for its answer that a plan is offered to:
    one question, answered by each plan offered, as Footage for its title (`offers`: footage.js plannedOffers' { record, option }, or the
    words alone, one to three of them), and then No. Her answer on it says whether the video is footage, and for which plan. */
export function plannedCardOf({ label, offers }) {
  return { questions: [question(PLANNED_Q(label), HEADER.planned, [...offers.map((offer) => (typeof offer === "string" ? offer : offer.option)), NOT_PLANNED])] };
}

/** The part card's questions, of the video called `label`: what kind of shot it is, and whether it shows a client. */
export const SHOT_Q = (label) => `Which kind of shot is ${label}?`;
export const CLIENT_Q = (label) => `Does ${label} show a client, a client's name or their work?`;
/** The part card's answers to its first question, by the kind of part (episode.js PART_KINDS) each stands for. */
export const SHOT_ANSWERS = Object.freeze({ talking: "Talking to the camera", screen: "A screen recording", "b-roll": "B-roll" });

/** The part card for the video called `label`, asked once it is footage: the kind of shot it is, and whether it shows a client, a
    client's name or their work. */
export function partCardOf({ label }) {
  return { questions: [question(SHOT_Q(label), HEADER.shot, Object.values(SHOT_ANSWERS)), question(CLIENT_Q(label), HEADER.client, ["Yes", "No"])] };
}

/** `questions` as texts and option labels, in order, or null when they are not questions of that shape. */
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

/** The keys a question, and an answer, of the card may hold. */
const QUESTION_KEYS = ["question", "header", "multiSelect", "options"];
const OPTION_KEYS = ["label", "description"];

/** Whether `questions` are the card `card` makes, every text she sees in it: the same questions and answers, in order, and nothing
    beside them but the card's own header, multiSelect and descriptions, each of which a result may leave out. */
function fits(questions, card) {
  const want = card.questions;
  if (!same(shapeOf(questions), shapeOf(want))) return false;
  return questions.every((q, i) => Object.keys(q).every((key) => QUESTION_KEYS.includes(key))
    && (q.header === undefined || q.header === want[i].header) && (q.multiSelect === undefined || q.multiSelect === want[i].multiSelect)
    && q.options.every((o, j) => Object.keys(o).every((key) => OPTION_KEYS.includes(key)) && (o.description === undefined || o.description === want[i].options[j].description)));
}

/** Which fixed card `questions` are, and of which video: { label, form: "what" } for her card, { label, form: "not-a-session" } for
    the follow-up, { label, form: "planned" } for the planned card and { label, form: "part" } for the part card (PR H5a), when their
    texts and option labels, in order, are exactly a card cardOf, notSessionCardOf, plannedCardOf or partCardOf makes for that label,
    with some guess, Maybe line, way it came and one to three plans offered, and nothing beside them but that card's own (fits);
    else null. */
export function formOf(questions) {
  const asked = shapeOf(questions);
  if (!asked) return null;
  if (asked.length === 2) {
    const shot = /^Which kind of shot is ([\s\S]+)\?$/.exec(asked[0][0]);
    if (shot) return fits(questions, partCardOf({ label: shot[1] })) ? { label: shot[1], form: "part" } : null;
    const m = /^What is ([\s\S]+)\?$/.exec(asked[0][0]);
    if (!m) return null;
    const label = m[1];
    const first = asked[0][1][0];
    const maybes = [null, { session: true }];
    if (typeof first === "string") {
      for (const [start, kind] of [["A new version of ", "finished"], ["A finished version of ", "raw"]]) if (first.startsWith(start)) maybes.push({ name: first.slice(start.length), kind });
    }
    for (const maybe of maybes) for (const guess of [null, ...Object.keys(GUESSED)]) if (fits(questions, cardOf({ label, guess, maybe }))) return { label, form: "what" };
    return null;
  }
  if (asked.length === 1) {
    for (const how of CAMES) {
      const after = NOT_SESSION_Q[how]("");
      const text = asked[0][0];
      if (text.length <= after.length || !text.endsWith(after)) continue;
      const label = text.slice(0, -after.length);
      if (fits(questions, notSessionCardOf({ label, came: how }))) return { label, form: "not-a-session" };
    }
    // The planned card: one to three plans offered as Footage for their titles, then No.
    const planned = /^Is ([\s\S]+) for a planned video\?$/.exec(asked[0][0]);
    if (planned) {
      const answers = asked[0][1];
      const offers = answers.slice(0, -1);
      if (offers.length >= 1 && offers.length <= MOST_OFFERS && answers[answers.length - 1] === NOT_PLANNED && offers.every((offer) => titleOfOption(offer) !== null)
        && fits(questions, plannedCardOf({ label: planned[1], offers }))) return { label: planned[1], form: "planned" };
    }
  }
  return null;
}

/** What `kind` says when it would answer a video with no kind without her answer on the card. */
export const NO_RECEIPT = "Ask her on the card first: only her answer on it answers a video that has no answer yet.";
/** How long a receipt answers for. */
const RECEIPT_MS = 60 * 60 * 1000;

/** Where this Mac keeps the card's receipts: in Application Support, on its own disk. */
export const receiptsFolder = (home) => join(home, "Library", "Application Support", "BRIMM Video", "receipts");
/** A receipt's file name, as writeReceipt makes it. */
const RECEIPT_NAME = /^receipt-\d+-[0-9a-f]{6}\.json$/;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The receipt of the card answered in the hook's input `input` (PostToolUse on AskUserQuestion), at `now` (ms): { at, label, form,
    answers }, `answers` her answer to each question by its text, and for her card `offered`, its first answer, which names the video
    its Maybe line offered a new version of, and for the planned card (PR H5a) `offered`, every answer it offered, in order; or null.
    None for any other event or tool, for a result that holds
    afkTimeoutMs or followUp, for a card in no fixed form (formOf), and for a question with no answer in the result or one that is not
    one of its options (her own words, in Other). Only the result, `tool_response`, is read: never what Claude asked with. */
export function receiptFrom(input, now) {
  if (!isObject(input) || input.hook_event_name !== "PostToolUse" || input.tool_name !== "AskUserQuestion") return null;
  const result = input.tool_response;
  if (!isObject(result) || Object.hasOwn(result, "afkTimeoutMs") || Object.hasOwn(result, "followUp") || !isObject(result.answers)) return null;
  const form = formOf(result.questions);
  if (!form) return null;
  const answers = {};
  for (const q of result.questions) {
    const answer = Object.hasOwn(result.answers, q.question) ? result.answers[q.question] : undefined;
    if (typeof answer !== "string" || !q.options.some((o) => o.label === answer)) return null;
    answers[q.question] = answer;
  }
  // The planned card keeps every answer it offered, in order, so that what is asked of the receipt later is the very card she answered.
  return { at: now, label: form.label, form: form.form, answers, ...(form.form === "what" ? { offered: result.questions[0].options[0].label } : {}), ...(form.form === "planned" ? { offered: result.questions[0].options.map((o) => o.label) } : {}) };
}

/** The time a receipt's file name says it was written (ms), or NaN for a name that is not a receipt's. */
const nameTime = (name) => (RECEIPT_NAME.test(name) ? Number(name.slice("receipt-".length, name.lastIndexOf("-"))) : NaN);

/** Write `receipt` into this Mac's receipts folder (receiptsFolder), as a file of its own named by its time and six random hex
    letters, never by its label, and never over a file there (`wx`): its path, or null when it could not be written, the folder being
    a link, or each name tried being taken. The receipts there whose names say they are older than an hour before it are taken
    away first: none answers anything now. `hex` is a test's stand-in for the random letters. */
export function writeReceipt(home, receipt, { hex = () => randomBytes(3).toString("hex") } = {}) {
  const folder = receiptsFolder(home);
  try {
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    if (!lstatSync(folder).isDirectory()) return null;
  } catch (e) {
    return null;
  }
  try {
    for (const name of readdirSync(folder)) if (nameTime(name) < receipt.at - RECEIPT_MS) rmSync(join(folder, name), { force: true });
  } catch (e) {
    // An old receipt left there answers nothing.
  }
  for (let i = 0; i < 3; i++) {
    const file = join(folder, `receipt-${receipt.at}-${hex()}.json`);
    try {
      writeFileSync(file, JSON.stringify(receipt), { flag: "wx", mode: 0o600 });
      return file;
    } catch (e) {
      if (e.code !== "EEXIST") return null;
    }
  }
  return null;
}

/** The first answer to "What is <label>?" that `kind` answering `stored` (finished, raw, short video, session) stands for: with
    `maybeName`, the name of the video `--version-of` names, and `maybeKind` its kind, as the card's Maybe line offered it (the
    table of her skill); null when no card offers it. */
function whatAnswer({ stored, maybeName, maybeKind }) {
  if (stored === "session") return SESSION;
  if (typeof maybeName !== "string") return { finished: FINISHED, raw: RAW, "short video": CLIP }[stored] || null;
  if (maybeKind === "raw") return stored === "finished" ? versionOf({ name: maybeName, kind: "raw" }) : stored === "raw" ? RAW : null;
  return stored === "finished" || stored === "short video" ? versionOf({ name: maybeName, kind: maybeKind }) : null;
}

/** The answers `kind` needs a receipt of, for the video called `label` answered as `stored`: her card's, and with `notASession` the
    not-a-session card's too, worded for how it came (`came`, zoom, sound, or null when the record does not say), each as { form,
    answers }, and `offered`, the first answer her card must have offered: the one given (the card the video's line prints, whose
    other answers follow from it), and for a raw new version of a raw video the version itself, where her answer alone does not say
    which video it is a new version of. A kind no card offers is expected as an answer no card has, which no receipt holds. */
export function expectedAnswers({ label, stored, maybeName = null, maybeKind = null, notASession = false, came = null, offered }) {
  // "Raw with retakes" makes a raw video a new version of another raw one only on the card that offered that version first.
  const must = stored === "raw" && typeof maybeName === "string" && maybeKind === "raw" ? versionOf({ name: maybeName, kind: "raw" }) : undefined;
  const first = must !== undefined && offered !== undefined && must !== offered ? null : whatAnswer({ stored, maybeName, maybeKind });
  const expected = [{ form: "what", answers: { [WHAT_Q(label)]: first === null ? "" : first, [PRIVATE_Q]: stored === "session" ? "Yes" : "No" } }];
  if (offered !== undefined || must !== undefined) expected[0].offered = offered !== undefined ? offered : must;
  if (notASession) expected.push({ form: "not-a-session", answers: { [notSessionCardOf({ label, came }).questions[0].question]: NOT_SESSION } });
  return expected;
}

/** Her answer "It is a client or group session" on the not-a-session card of the video called `label`, which answers it as a
    session as surely as her first card's "Client or group session" and "Yes" do. */
export const sessionByFollowUp = ({ label, came = null }) => [{ form: "not-a-session", answers: { [notSessionCardOf({ label, came }).questions[0].question]: IS_SESSION } }];

/** Whether the receipt `r` is of the card it says: the question it answers is the one its form asks of its label. The part card has two
    questions, and both are those of its label. */
function ownLabel(r) {
  const asked = Object.keys(r.answers);
  if (typeof r.label !== "string") return false;
  if (r.form === "what") return asked[0] === WHAT_Q(r.label);
  if (r.form === "planned") return asked.length === 1 && asked[0] === PLANNED_Q(r.label);
  if (r.form === "part") return asked.length === 2 && asked[0] === SHOT_Q(r.label) && asked[1] === CLIENT_Q(r.label);
  return r.form === "not-a-session" && ["zoom", "sound", null].some((came) => asked[0] === notSessionCardOf({ label: r.label, came }).questions[0].question);
}

/** Whether two sets of answers are the same answers to the same questions. */
const sameAnswers = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((q) => Object.hasOwn(b, q) && a[q] === b[q]);

/** "" when, for each of `expected` (expectedAnswers, expectedFootage), a receipt on this Mac of the last hour before `now` (ms) holds that
    form and those very answers, to questions that name its label, from a card that offered what it must; else NO_RECEIPT. What a card
    must have offered is a word (her card's first answer), or a function of what the receipt kept of what it offered (the planned card's
    every answer; expectedFootage). A file in the folder that is not a receipt, or whose name says it was written at another time, is
    passed over. */
export function receiptWhy({ home, expected, now }) {
  let names = [];
  try {
    names = readdirSync(receiptsFolder(home)).filter((name) => nameTime(name) <= now && now - nameTime(name) < RECEIPT_MS);
  } catch (e) {
    return NO_RECEIPT;
  }
  const receipts = [];
  for (const name of names) {
    try {
      const r = JSON.parse(readFileSync(join(receiptsFolder(home), name), "utf8"));
      if (isObject(r) && r.at === nameTime(name) && isObject(r.answers) && ownLabel(r)) receipts.push(r);
    } catch (e) {
      // A file not whole, or not JSON, is no receipt.
    }
  }
  const offeredAs = (one, r) => (one.offered === undefined ? true : typeof one.offered === "function" ? one.offered(r.offered) === true : r.offered === one.offered);
  const holds = (one) => receipts.some((r) => r.form === one.form && sameAnswers(r.answers, one.answers) && offeredAs(one, r));
  return expected.length > 0 && expected.every(holds) ? "" : NO_RECEIPT;
}

/** The answers `footage` needs a receipt of, for the video called `label` made footage as `as` (episode.js PART_KINDS) for the plan
    called `title`, showing a client or not (`client`, true or false): her answer on the planned card, Footage for that plan's title,
    from a card whose every plan is still offered now (`offeredNow`: the planned card's answers for each plan waiting for its footage
    now, as footageOption gives them), and her two answers on the part card. Nothing is expected for a plan dropped since, filmed since,
    or one the card did not offer. */
export function expectedFootage({ label, title, as, client, offeredNow }) {
  const option = footageOption(title);
  const stillOffered = (offered) => Array.isArray(offered) && offered.length >= 2 && offered[offered.length - 1] === NOT_PLANNED
    && offered.slice(0, -1).every((one) => typeof one === "string" && offeredNow.includes(one)) && offered.includes(option);
  return [
    { form: "planned", answers: { [PLANNED_Q(label)]: option }, offered: stillOffered },
    { form: "part", answers: { [SHOT_Q(label)]: SHOT_ANSWERS[as] ?? "", [CLIENT_Q(label)]: client === true ? "Yes" : "No" } }
  ];
}
