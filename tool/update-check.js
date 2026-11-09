// The update check of an installed BRIMM Video Studio: it reads the Sparkle appcast at build.feed at most once a day, keeps what it read in
// Application Support, and gives the line to tell. It sends a plain User-Agent and nothing else about the Mac. It never throws, and git is never run.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isInstalled } from "./build.js";

export const UPDATE_TIMEOUT_MS = 3000;
export const UPDATE_EVERY_MS = 86400000;
export const USER_AGENT = "BRIMM Video Studio";
export const APPCAST_MAX_CHARS = 1000000;

const SYSTEM_PLIST = "/System/Library/CoreServices/SystemVersion.plist";
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const DOTTED = /^\d+(\.\d+)*$/;

/** Where the answer of the last read of the feed is kept. */
export const updateCheckFile = (home) => join(home, "Library", "Application Support", "BRIMM Video", "update-check.json");

/** The text of `<sparkle:name>…</sparkle:name>` in `xml`, trimmed, or undefined when it is not there. */
function elementOf(xml, name) {
  const found = new RegExp(`<sparkle:${name}\\b[^>]*>([\\s\\S]*?)</sparkle:${name}>`).exec(xml);
  return found ? found[1].trim() : undefined;
}

/** The value of the attribute `sparkle:name` on the item's enclosure, or undefined when it is not there. */
function attributeOf(xml, name) {
  const enclosure = /<enclosure\b[^>]*>/.exec(xml);
  const found = enclosure && new RegExp(`\\bsparkle:${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(enclosure[0]);
  return found ? (found[1] ?? found[2]).trim() : undefined;
}

/** The items of an appcast, each { build, version, channel, minimumSystemVersion }. An item without a whole build above 0 or without a
    version of the form 1.2.3 is skipped. Comments are ignored. */
export function parseAppcast(xml) {
  const items = [];
  const clean = String(xml).replace(/<!--[\s\S]*?-->/g, "");
  for (const found of clean.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const body = found[1];
    const build = elementOf(body, "version") ?? attributeOf(body, "version") ?? "";
    const version = elementOf(body, "shortVersionString") ?? attributeOf(body, "shortVersionString") ?? "";
    if (!/^\d+$/.test(build) || !Number.isSafeInteger(Number(build)) || Number(build) <= 0 || !VERSION.test(version)) continue;
    items.push({ build: Number(build), version, channel: elementOf(body, "channel") ?? "", minimumSystemVersion: elementOf(body, "minimumSystemVersion") ?? "" });
  }
  return items;
}

/** Whether the dotted number `have` is `need` or later, compared part by part as numbers, a missing part counting as 0. */
function atLeast(have, need) {
  const a = have.split(".").map(Number);
  const b = need.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/** The item with the highest build among those that count: its channel is "" or `channel`, and its minimum system version is met. */
export function newestFor(items, { channel, system }) {
  let best = null;
  for (const it of items) {
    if (it.channel !== "" && it.channel !== channel) continue;
    const min = it.minimumSystemVersion;
    if (min !== "" && DOTTED.test(min) && system !== "" && !atLeast(system, min)) continue;
    if (!best || it.build > best.build) best = it;
  }
  return best;
}

/** This Mac's macOS version from its own system file, or "" when it cannot be read. It starts no program. */
export function systemVersion(read = (p) => readFileSync(p, "utf8")) {
  try {
    const found = /<key>ProductVersion<\/key>\s*<string>([^<]*)<\/string>/.exec(read(SYSTEM_PLIST));
    return found ? found[1].trim() : "";
  } catch (e) {
    return "";
  }
}

/** The kept answer for `feed`, or null when the file is missing or will not do. */
function readCache(file, feed) {
  try {
    const cache = JSON.parse(readFileSync(file, "utf8"));
    const ok = cache !== null && typeof cache === "object" && cache.version === 1 && cache.feed === feed && Number.isFinite(cache.checkedAt) && Array.isArray(cache.items);
    return ok ? cache : null;
  } catch (e) {
    return null;
  }
}

/** Keeps the answer whole: a temp file in the same folder, renamed over the old one. A failed write is ignored. */
function writeCache(file, cache) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(temp, JSON.stringify(cache));
    renameSync(temp, file);
  } catch (e) {
    try {
      rmSync(temp, { force: true });
    } catch (e2) {
      // Nothing more can be done about a temp file that will not go.
    }
  }
}

/** The items of the feed, or null when it cannot be read in `timeoutMs` (the response and its body together), is not ok, is too long or is no appcast. */
async function readFeed(feed, fetch, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("timed out"));
      }, timeoutMs);
      timer.unref();
    });
    const read = (async () => {
      const response = await fetch(feed, { headers: { "user-agent": USER_AGENT }, redirect: "error", signal: controller.signal });
      if (!response.ok) return null;
      const text = await response.text();
      return typeof text === "string" && text.length <= APPCAST_MAX_CHARS && /<rss\b/.test(text) ? text : null;
    })();
    read.catch(() => {});
    const text = await Promise.race([read, timeout]);
    return text === null ? null : parseAppcast(text);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Whether the items hold a newer build than this Mac's: { state: "newer", version, have } or { state: "newest", have }. */
function answerFrom(items, build, system) {
  const usable = items.filter((it) => it && Number.isSafeInteger(it.build) && typeof it.version === "string" && typeof it.channel === "string" && typeof it.minimumSystemVersion === "string");
  const best = newestFor(usable, { channel: build.channel, system });
  return best && best.build > build.build ? { state: "newer", version: best.version, have: build.version } : { state: "newest", have: build.version };
}

/** Checks the feed at most once a day: { state: "newer", version, have }, { state: "newest", have } or { state: "unknown" }. Nothing is fetched
    for a git checkout or a build file that cannot be read. Offline, it still says "newer" if a kept answer, of any age, shows one. Never throws. */
export async function checkForUpdate({ build, home, now, fetch = globalThis.fetch, timeoutMs = UPDATE_TIMEOUT_MS, system = systemVersion() }) {
  try {
    if (!isInstalled(build) || build.broken) return { state: "unknown" };
    const file = updateCheckFile(home);
    const cache = readCache(file, build.feed);
    if (cache && now - cache.checkedAt >= 0 && now - cache.checkedAt < UPDATE_EVERY_MS) return answerFrom(cache.items, build, system);
    const items = await readFeed(build.feed, fetch, timeoutMs);
    if (items) {
      writeCache(file, { version: 1, feed: build.feed, checkedAt: now, items });
      return answerFrom(items, build, system);
    }
    const known = cache ? answerFrom(cache.items, build, system) : null;
    return known && known.state === "newer" ? known : { state: "unknown" };
  } catch (e) {
    return { state: "unknown" };
  }
}

/** The line to tell for an answer of checkForUpdate. */
export function updateLine(answer) {
  if (answer.state === "newer") return `A newer BRIMM Video Studio is ready: ${answer.version} (this Mac has ${answer.have}).`;
  if (answer.state === "newest") return "This Mac has the newest BRIMM Video Studio.";
  return "Could not check for a newer BRIMM Video Studio. Is this Mac offline?";
}
