// Copied from brimm-operations app/src/answers.js at commit 84a2f61, to be kept in step by hand.
// Reading what Claude sent back: a whole object, one in a code fence, or the finished part of one that was cut short.

const RAW_LIMIT = 60000;

/** The object in a reply, or null. Accepts a bare object, a code fence, or text around an object. */
export function parseReply(text) {
  const t = String(text || "").trim();
  const tries = [t];
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  if (fence) tries.push(fence[1].trim());
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b > a) tries.push(t.slice(a, b + 1));
  for (const c of tries) {
    try {
      const v = JSON.parse(c);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch (e) {
      /* try the next form */
    }
  }
  return null;
}

/** For an answer cut short or broken part-way: the longest opening stretch that still reads as an object.
    It cuts back to the last finished piece, never inside one, and closes what was left open: the list of
    clips with its first three clips whole, but not a fourth that stops at its caption. Null when nothing can be kept. */
export function salvageReply(text) {
  const t = String(text || "");
  const a = t.indexOf("{");
  if (a === -1 || t.slice(0, a).includes("[")) return null;
  const cuts = [];
  const open = [];
  // A place to cut is only safe where the innermost open thing is the whole answer or a list of pieces.
  const safe = () => open.length === 1 || open[open.length - 1] === "[";
  let inString = false;
  let escaped = false;
  for (let i = a; i < t.length; i++) {
    const c = t[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") open.push(c);
    else if (c === "}" || c === "]") {
      open.pop();
      if (!open.length) {
        cuts.push({ at: i + 1, open: [] });
        break;
      }
      if (safe()) cuts.push({ at: i + 1, open: open.slice() });
    } else if (c === "," && open.length && safe()) cuts.push({ at: i, open: open.slice() });
  }
  for (let k = cuts.length - 1, tries = 0; k >= 0 && tries < 200; k--, tries++) {
    const close = cuts[k].open.slice().reverse().map((o) => (o === "{" ? "}" : "]")).join("");
    try {
      const v = JSON.parse(t.slice(a, cuts[k].at) + close);
      if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) return v;
    } catch (e) {
      /* cut further back */
    }
  }
  return null;
}

/** Everything the page needs from one answer.
    state: done, cut (hit the length limit), partial (broke part-way), or unreadable.
    `raw` is kept only when the page could not read all of it. */
export function readAnswer(text, truncated) {
  const whole = parseReply(text);
  if (whole) return { data: whole, state: truncated ? "cut" : "done", partial: false, raw: "" };
  const raw = String(text || "").slice(0, RAW_LIMIT);
  const kept = salvageReply(text);
  if (kept) return { data: kept, state: truncated ? "cut" : "partial", partial: true, raw };
  return { data: null, state: truncated ? "cut" : "unreadable", partial: false, raw };
}
