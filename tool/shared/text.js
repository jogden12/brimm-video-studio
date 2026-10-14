// Copied from brimm-operations app/src/text.js at commit 84a2f61, to be kept in step by hand.
// Small helpers every other module uses. Pure: no page, no clock, no network.

export const list = (v) => (Array.isArray(v) ? v : []);

/** A deep copy of plain data. A save is always a copy taken at that moment, never the live record. */
export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Text from a value that should be text. Anything else is empty, so nothing prints as "[object Object]". */
export function plain(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Text made safe to put inside HTML. */
export function esc(v) {
  return plain(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Matching ignores case, punctuation, spacing, caption timestamps and bracketed sound tags. */
export function norm(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/>>/g, " ")
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const countWords = (s) => String(s == null ? "" : s).trim().split(/\s+/).filter(Boolean).length;
export const tokens = (s) => norm(s).split(" ").filter(Boolean);

/** 83 -> "1:23", 3725 -> "1:02:05" */
export function stamp(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
}

/** "1:23" or "[1:02:05]" -> seconds. Null for anything that is not a time. */
export function seconds(t) {
  if (t == null) return null;
  const m = /^\s*\[?(?:(\d{1,2}):)?(\d{1,3}):(\d{2})(?:[.,]\d+)?\]?\s*$/.exec(String(t));
  if (!m) return null;
  return (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
}

/** Milliseconds as m:ss, for a clock on screen. */
export function clock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** The calendar day where she is, as "2026-10-10". A day cut from a UTC time is tomorrow's on a United States evening. */
export function localDay(d = new Date()) {
  const two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

export const byteLength = (s) => new TextEncoder().encode(String(s)).length;

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(String(text))) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** A checksum of the text. SHA-256 where the page can do it, otherwise a short one marked "fnv1a:". */
export async function sha256Hex(text) {
  try {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return "fnv1a:" + fnv1a(text);
  }
}

const keys = (path) => (Array.isArray(path) ? path : String(path).split("."));

/** The value at a path such as "final.options.0.title". Undefined when any step is missing. */
export function getIn(obj, path) {
  let v = obj;
  for (const k of keys(path)) {
    if (v == null) return undefined;
    v = v[k];
  }
  return v;
}

/** A copy of obj with the value at the path replaced. Objects along the path are copied, never changed. */
export function setIn(obj, path, value) {
  const ks = keys(path);
  const put = (node, i) => {
    const k = ks[i];
    const base = node == null ? (/^\d+$/.test(String(k)) ? [] : {}) : node;
    const copy = Array.isArray(base) ? base.slice() : { ...base };
    copy[k] = i === ks.length - 1 ? value : put(base[k], i + 1);
    return copy;
  };
  return put(obj, 0);
}

/** A short id that is safe as a record id: letters and digits only. */
export function newId(prefix = "", now = Date.now(), rand = Math.random) {
  return prefix + now.toString(36) + rand().toString(36).slice(2, 6);
}
