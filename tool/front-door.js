// The front door (design 2026-11-18): a Claude session in Studio accepts any input — a script, an idea, a HyperFrames package or a
// recording — and determines what kind of video it is. This module is the classifier and the script parser:
//   classifyText(text)         what a text is: "script", "idea-with-notes", "idea" or "unknown"
//   parseScript(text)          a script text into { lines, cues, shots } for packageOf
// Everything here is pure: a text goes in and a structure comes out. Nothing is read or written.

// --- Patterns that mark a text as a script rather than an idea ---

const SHOT_MARKER = /^shot\s+\d+\s*:/i;
const CUE_ANNOTATION = /^\[(graphic|on\s*screen|b-roll|screen)\s*:\s*(.+)\]\s*$/i;
const VOICEOVER_MARKER = /^voiceover\s*:\s*$/i;
const BARE_ON_SCREEN = /^on\s*screen\s*:\s*(.+)$/i;

const SCRIPT_SIGNALS = [SHOT_MARKER, CUE_ANNOTATION, VOICEOVER_MARKER, BARE_ON_SCREEN];

const IDEA_MARKERS = /^[-*]\s+/;
const PARAGRAPH_MIN_WORDS = 6;
const MULTI_PARAGRAPH_MIN = 3;

/** What a text is: "script" (teleprompter lines, possibly with annotations), "idea-with-notes" (a topic with bullet points or
    structured notes), "idea" (a short or bare thought), or "unknown". The classification is a best guess from the text's shape:
    a Claude session uses it to decide what questions to ask and which path to take. */
export function classifyText(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { kind: "idea" };

  const lines = trimmed.split(/\n/);

  if (lines.some((line) => SCRIPT_SIGNALS.some((signal) => signal.test(line.trim())))) {
    return { kind: "script" };
  }

  const paragraphs = toParagraphs(trimmed);
  const hasBullets = lines.some((line) => IDEA_MARKERS.test(line.trim()));
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length >= PARAGRAPH_MIN_WORDS);

  if (longParagraphs.length >= MULTI_PARAGRAPH_MIN) {
    return { kind: "script" };
  }

  if (hasBullets || (paragraphs.length >= 2 && longParagraphs.length >= 1)) {
    return { kind: "idea-with-notes" };
  }

  return { kind: "idea" };
}

// --- Script parsing ---

const DEFAULT_SECONDS = { graphic: 4, words: 3, "b-roll": 5, screen: 6 };
const SHOT_KIND_WORDS = { talking: "talking", screen: "screen", "b-roll": "b-roll" };

/** A script text parsed into { lines, cues, shots }: the teleprompter lines (paragraphs of spoken words), the graphic cues
    (each { kind, seconds, words, show }) and the shots (each { kind, what }). A cue's `words` are the nearest spoken line;
    its `seconds` are a default for its kind. A shot's `kind` is taken from its description when it names one, otherwise "talking". */
export function parseScript(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { lines: [], cues: [], shots: [] };

  const rawLines = trimmed.split(/\n/);
  const lines = [];
  const cues = [];
  const shots = [];

  let currentParagraph = [];
  let lastLine = null;

  const flushParagraph = () => {
    if (currentParagraph.length) {
      const joined = currentParagraph.join(" ").trim();
      if (joined) {
        lines.push(joined);
        lastLine = joined;
      }
      currentParagraph = [];
    }
  };

  for (const raw of rawLines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (VOICEOVER_MARKER.test(line)) {
      flushParagraph();
      continue;
    }

    const shotMatch = line.match(SHOT_MARKER);
    if (shotMatch) {
      flushParagraph();
      const rest = line.slice(shotMatch[0].length).trim();
      shots.push(parseShot(rest));
      continue;
    }

    const cueMatch = line.match(CUE_ANNOTATION);
    if (cueMatch) {
      const kind = normalizeCueKind(cueMatch[1]);
      const show = cueMatch[2].trim();
      flushParagraph();
      cues.push({ kind, show, seconds: DEFAULT_SECONDS[kind] ?? 4, words: lastLine, _needsWords: lastLine === null });
      continue;
    }

    const bareOnScreen = line.match(BARE_ON_SCREEN);
    if (bareOnScreen) {
      flushParagraph();
      const show = bareOnScreen[1].trim();
      cues.push({ kind: "words", show, seconds: DEFAULT_SECONDS.words, words: lastLine, _needsWords: lastLine === null });
      continue;
    }

    currentParagraph.push(line);
  }
  flushParagraph();

  for (const cue of cues) {
    if (cue._needsWords && lines.length) {
      cue.words = lines[0];
    }
    if (cue.words === null) cue.words = "";
    delete cue._needsWords;
  }

  return { lines, cues, shots };
}

/** A shot's rest text parsed into { kind, what }. If the text has "TALKING |", "SCREEN |" or "B-ROLL |" at the start, the kind
    is taken from it; otherwise it defaults to "talking". */
function parseShot(text) {
  const pipeAt = text.indexOf("|");
  if (pipeAt >= 0) {
    const before = text.slice(0, pipeAt).trim().toLowerCase();
    const after = text.slice(pipeAt + 1).trim();
    if (SHOT_KIND_WORDS[before] && after) {
      return { kind: SHOT_KIND_WORDS[before], what: after };
    }
  }
  return { kind: "talking", what: text };
}

/** Normalize a cue kind from an annotation: "on screen" → "words", "b-roll" → "b-roll", etc. */
function normalizeCueKind(raw) {
  const lower = raw.trim().toLowerCase();
  if (lower === "on screen" || lower === "onscreen") return "words";
  if (lower === "b-roll") return "b-roll";
  return lower;
}

// --- Converters: parsed objects to pipe-delimited strings for packageOf ---

/** A parsed cue ({ kind, seconds, words, show }) as the pipe-delimited string packageOf expects. */
export function toCueString({ kind, seconds, words, show }) {
  return `${kind} | ${seconds} | ${words} | ${show}`;
}

/** A parsed shot ({ kind, what }) as the pipe-delimited string packageOf expects. */
export function toShotString({ kind, what }) {
  return `${kind} | ${what}`;
}

/** A text split into paragraphs: groups of lines separated by blank lines. */
function toParagraphs(text) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
